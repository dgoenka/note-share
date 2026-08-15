# NoteShare — Secure Expiring Note Links

A monorepo note-taking app built for the **MERN/PERN Stack Developer POC**.  
Create a note, generate a cryptographically random share link, optionally protect it with a server-generated access key, and control lifetime with **one-time** or **time-based** expiry. Owners can force-revoke links and see accurate successful-view counts.

> **You should be able to explain every decision below in an interview.**  
> AI was used as a coding accelerator; the security model, race handling, and shared validation design are intentional and documented here.

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | **Next.js 15** (App Router) + TypeScript + Tailwind | Spec stack; simple pages, no complex dashboard |
| UI | **shadcn-style** primitives (`Button`, `Input`, `Card`, …) | Matches the shadcn/ui look without coupling the monorepo to the shadcn CLI |
| Backend | **Hono.js** on Node | Lightweight, typed middleware, easy CORS/auth |
| DB | **PostgreSQL** + **Prisma** | Preferred by the brief; strong transactional SQL for race safety |
| Shared | **`@note-share/shared`** (Zod schemas + types) | Same validation on FE and BE — no drift |
| Auth | Email/password + **JWT** (HS256, `jose`) + **bcrypt** | Simple, explainable; no third-party auth black box |

### Monorepo layout

```
note-share/
├── apps/
│   ├── api/          # Hono API + Prisma
│   └── web/          # Next.js frontend
├── packages/
│   └── shared/       # Zod schemas, types, constants (used by both apps)
├── docker-compose.yml
└── package.json      # pnpm workspaces
```

Validations live once in `packages/shared` and are imported by:

- **Web** — client-side form checks before submit  
- **API** — `zValidator` on every mutating route  

---

## Setup

### Prerequisites

- Node.js **≥ 20**
- **pnpm** 9+
- **PostgreSQL** 14+ (local install **or** Docker)

### 1. Install

```bash
git clone <this-repo-url>
cd note-share
pnpm install
pnpm --filter @note-share/shared build
```

### 2. Database

**Option A — local Postgres (used during development)**

```bash
# create role + db (adjust if you already have them)
psql -d postgres -c "CREATE ROLE noteshare LOGIN PASSWORD 'noteshare';"  # if needed
psql -d postgres -c "CREATE DATABASE noteshare OWNER noteshare;"         # if needed

# apps/api/.env
DATABASE_URL="postgresql://noteshare:noteshare@localhost:5432/noteshare?schema=public"
```

**Option B — Docker Compose**

```bash
docker compose up -d
# then set DATABASE_URL to port 5433 (see apps/api/.env.example)
```

### 3. Environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# edit JWT_SECRET for anything beyond local demos
```

| Variable | App | Purpose |
|----------|-----|---------|
| `DATABASE_URL` | API | Postgres connection |
| `JWT_SECRET` | API | Sign/verify access tokens |
| `WEB_ORIGIN` | API | Build absolute share URLs |
| `CORS_ORIGIN` | API | Allowed browser origin |
| `PORT` | API | Default `4000` |
| `NEXT_PUBLIC_API_URL` | Web | Browser → API base URL |

### 4. Migrate & run

```bash
pnpm --filter @note-share/api db:push     # or db:migrate
pnpm dev:api                              # http://localhost:4000
pnpm dev:web                              # http://localhost:3000
```

Health check: `GET http://localhost:4000/health`

### Test credentials

Register any account via `/register`, e.g.:

| Field | Value |
|-------|--------|
| Name | Demo User |
| Email | `demo@example.com` |
| Password | `password123` |

(No seed is required — registration is open.)

---

## Database schema

```
users
  id, name, email (unique), passwordHash, createdAt, updatedAt

notes
  id
  title, content
  shareType      enum ONE_TIME | TIME_BASED
  accessType     enum PUBLIC | PASSWORD
  shareToken     unique, opaque random (URL-safe)
  accessKeyHash  bcrypt of server-generated key (null if PUBLIC)
  expiresAt      optional hard deadline
  revokedAt      set when owner force-invalidates
  usedAt         set on first successful ONE_TIME view (race-safe claim)
  viewCount      atomic counter of successful views only
  ownerId → users
  createdAt, updatedAt
```

Indexes: `shareToken` (lookup), `ownerId` (list).

---

## Pages

| Route | Purpose |
|-------|---------|
| `/login` | Sign in |
| `/register` | Create account |
| `/` | Note list (authenticated) |
| `/notes/new` | Create note + share options |
| `/notes/[id]` | Owner view: link, stats, revoke; access key shown once after create |
| `/share/[token]` | Recipient view / password unlock |

---

## Share link flow

```
Owner (auth)
  POST /notes  { title, content, shareType, accessType, expiresAt? }
       │
       ├─ generate shareToken  (32 random bytes → base64url)
       ├─ if PASSWORD: generate accessKey, store bcrypt(accessKey)
       └─ return note + shareUrl + accessKey (once)

Recipient
  GET  /share/:token          → status only (no viewCount bump)
  POST /share/:token/open     → PUBLIC successful open
  POST /share/:token/unlock   → PASSWORD unlock with key
       │
       └─ claimSuccessfulView()  → atomic UPDATE … RETURNING
```

### Password / key generation

- **Not** chosen by the client for share unlock.
- Server uses `crypto.randomBytes(12).toString("base64url")`.
- Only the **bcrypt hash** is stored (`accessKeyHash`).
- Plain key is returned **only** on `POST /notes` create response (and surfaced once in the UI via query string after redirect). Reloading `/notes/[id]` later does **not** re-show it.

### Expiry logic

| Share type | When inaccessible |
|------------|-------------------|
| `TIME_BASED` | `expiresAt <= now` |
| `ONE_TIME` | after first successful claim (`usedAt` set) |
| either | `revokedAt` set by owner |
| either | optional extra `expiresAt` still enforced if set |

Status helpers are pure (`getNoteAccessibility`) so FE-facing owner metadata and share status stay consistent.

### Invalidate / revoke

`POST /notes/:id/revoke` (owner only) sets `revokedAt = now()`.  
Idempotent. Subsequent open/unlock return **410**. View count does not increase.

### View count logic

| Event | Count |
|-------|-------|
| Public successful open | +1 |
| Successful password unlock | +1 |
| Wrong password | no change |
| Expired / revoked / already-used | no change |
| Status poll (`GET /share/:token`) | no change |

Increment happens **only** inside the atomic claim SQL (`viewCount = viewCount + 1`), never as a separate non-transactional read-modify-write.

---

## Race-condition handling

### How do you prevent two users from using a one-time link at the same time?

A single conditional `UPDATE … RETURNING` is the claim:

```sql
UPDATE notes
SET
  "viewCount" = "viewCount" + 1,
  "usedAt" = CASE WHEN "shareType" = 'ONE_TIME' THEN now() ELSE "usedAt" END
WHERE id = $id
  AND "revokedAt" IS NULL
  AND ("usedAt" IS NULL OR "shareType" <> 'ONE_TIME')
  AND ("expiresAt" IS NULL OR "expiresAt" > now())
RETURNING *;
```

Under concurrency, **only one** transaction can match `usedAt IS NULL` for a `ONE_TIME` row and set it. The loser gets **zero rows** and receives **410 Already used**. No application-level locks required for correctness.

### How do you update view count safely?

The counter is incremented in that same `UPDATE` (`viewCount = viewCount + 1`). PostgreSQL row-level locking serializes concurrent updates on the same row, so counts are not lost to read-modify-write races.

### How would this work if 1 million people opened the link?

- **TIME_BASED / PUBLIC**: every success is an `UPDATE` on one row → becomes a write hotspot. Mitigations at scale: sharded counters, Redis `INCR` with async flush, read replicas for status, CDN for static “expired” pages.
- **ONE_TIME**: after the first claim, further attempts fail the `WHERE` without rewriting content; still one hot row for a short window. A cache layer in front of status checks reduces DB load.
- Horizontally scale API; keep the claim SQL as the source of truth.

### How would you prevent brute-force on password-protected links?

Already in this POC:

1. **High-entropy server-generated keys** (not user-chosen short passwords).
2. **bcrypt** verification (slow by design).
3. **In-memory rate limit** on `POST /share/:token/unlock` — 10 attempts / 15 minutes per `token + IP`.

Production upgrades: Redis rate limits, CAPTCHA after N failures, temporary lockouts, anomaly alerts, never leak whether the token exists vs wrong password beyond what product requires (status endpoint intentionally exposes validity state for UX).

---

## API surface (summary)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | — | |
| POST | `/auth/login` | — | |
| GET | `/auth/me` | JWT | |
| GET | `/notes` | JWT | Owner list |
| POST | `/notes` | JWT | Create + share metadata |
| GET | `/notes/:id` | JWT | Owner detail |
| POST | `/notes/:id/revoke` | JWT | Force invalidate |
| GET | `/share/:token` | — | Status only |
| POST | `/share/:token/open` | — | Public open |
| POST | `/share/:token/unlock` | — | Password unlock |

---

## Security decisions (interview notes)

1. **Share tokens are unguessable** — 32 bytes random base64url (~256 bits).
2. **Access keys never stored in plaintext** — bcrypt only.
3. **Access key shown once** — create response only.
4. **JWT in `Authorization` header** — not cookies (POC simplicity); 7-day expiry.
5. **Owner isolation** — every note query filters `ownerId`.
6. **Wrong password ≠ view** — verify before claim.
7. **CORS locked** to the web origin.
8. **Shared Zod schemas** — FE/BE cannot disagree on payload shape.

---

## Required edge cases (checklist)

- [x] Invalid share link  
- [x] Public share link access  
- [x] Password-protected access  
- [x] Wrong password / key  
- [x] Expired share link  
- [x] One-time link already used  
- [x] Revoked share link  
- [x] Concurrent one-time open (SQL claim)  
- [x] Accurate view count (atomic increment)  

---

## Live deployment

| Layer | URL |
|-------|-----|
| **Frontend (Vercel)** | https://note-share-ruby.vercel.app |
| **API (Railway)** | https://api-production-5dd68.up.railway.app |
| **API health** | https://api-production-5dd68.up.railway.app/health |
| **GitHub** | https://github.com/dgoenka/note-share |
| **Database** | Aiven PostgreSQL (`sslmode=require`) |

Redeploy API after code changes (from monorepo root, linked project):

```bash
railway up -y -d -s api
```

Redeploy web:

```bash
vercel deploy --prod --yes
```

## Deliverables checklist

- [x] GitHub repository (this repo)
- [x] Live demo URL — https://note-share-ruby.vercel.app
- [ ] Demo video
- [x] Test credentials (self-register; example above)

---

## Scripts

```bash
pnpm dev:api          # API on :4000
pnpm dev:web          # Web on :3000
pnpm build:shared     # compile shared package
pnpm db:push          # sync Prisma schema
pnpm db:studio        # Prisma Studio
pnpm typecheck        # all packages
```

---

## License

MIT — built as a job-application POC.
