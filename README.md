# NoteShare

Job-application POC: create notes and share them with **expiring** links (one-time or time-based), optionally **password-protected** or **email-allowlisted**.

**Stack:** Next.js 15 · Hono · PostgreSQL/Prisma · Zod (shared) · JWT + bcrypt  

**Repo:** https://github.com/dgoenka/note-share  
**Assignment live (`main`):** https://note-share-ruby.vercel.app · API https://api-production-5dd68.up.railway.app  

## Softboard playground (`softboard` branch)

Isolated fun layer on the same share/security model — **does not replace** the assignment demo on `main`.

| | |
|--|--|
| **What** | Corkboard home: title-only post-its, **Mine** / **Everyone’s** tabs, desktop drag + Arrange, mobile chronological list, `/profile` overflow menu |
| **Why** | Show adaptive UX + cursor pagination without risking the Peacock submission deploy |
| **How** | Pins never include `content`. Open loads `GET /notes/:id` (owner) or share open/unlock. Layout lives in browser `localStorage` keyed per user + tab (`apps/web/src/lib/softboard-positions.ts`) — not Postgres. Board lists use keyset cursors on `GET /board/mine` and `GET /board/feed`. |

- Softboard web: https://note-share-softboard.vercel.app  
- Softboard API: https://api-production-26060.up.railway.app  
- Assignment demo on `main` stays: https://note-share-ruby.vercel.app  

## Quick demo path

1. Open https://note-share-ruby.vercel.app and register (or sign in).
2. **New note** → pick share type + access type → create.
3. On the note page: **copy share link** (and **access key** if password-protected — shown once).
4. Open the link in a private/incognito window.
5. Optional: create a one-time note and open it twice (second open should fail); try **revoke**.

Register any user (e.g. `demo@example.com` / `password123`).

```
pnpm install && pnpm --filter @note-share/shared build
pnpm --filter @note-share/api db:push
pnpm test          # API integration tests (needs local Postgres)
pnpm test:web      # Softboard Vitest + Testing Library
pnpm dev:api       # :4000
pnpm dev:web       # :3000
```

---

## Monorepo

```
apps/api          Hono + Prisma
apps/web          Next.js App Router
packages/shared   Zod schemas + types (imported by FE and BE)
```

---

## Create → open flow

```text
Owner (JWT)
  POST /notes
    → shareToken = randomBytes(32).base64url
    → PASSWORD? accessKey (shown once) / bcrypt hash stored
    → RESTRICTED? rows in note_allowed_emails
    → shareUrl = WEB_ORIGIN/share/:token

Recipient
  GET  /share/:token          status only (no viewCount++)
  POST /share/:token/open     PUBLIC or RESTRICTED(+JWT)
  POST /share/:token/unlock   PASSWORD
    → claimSuccessfulView(): conditional UPDATE … RETURNING
```

Code: token/key minting in `apps/api/src/routes/notes.ts`; claim SQL in `apps/api/src/routes/share.ts`; auth in `apps/api/src/middleware/auth.ts`.

---

## Behavior (what the tests cover)

| Scenario | Expected | Proof |
|----------|----------|--------|
| Public open | content + `viewCount += 1` | `pnpm test` |
| Concurrent ONE_TIME opens | exactly one 200; others 410; `viewCount = 1` | `pnpm test` |
| Wrong password | 401; `viewCount` unchanged | `pnpm test` |
| Revoked / expired / already used | 410; no claim | `pnpm test` |
| RESTRICTED wrong email | 403; `viewCount` unchanged | `pnpm test` |
| GET status | never increments count | `pnpm test` |
| Board mine | own notes, title-only pins | `pnpm test` (`board.test.ts`) |
| Board feed | PUBLIC + allowlisted RESTRICTED; excludes own | `pnpm test` |
| Board cursor | keyset pagination on mine | `pnpm test` |
| Softboard UX | positions scoped per user/tab; desktop Arrange; mobile list; dialog open/close | `pnpm test:web` |

```bash
pnpm test        # share + board API (apps/api)
pnpm test:web    # softboard positions + Softboard / PostItDialog
pnpm test:all    # both
```

### View count rules

Increments **only** inside the claim `UPDATE`. Wrong password, status polls, revoked/expired/used, and forbidden allowlist opens do **not** increment.

### Claim SQL (one-time race)

```sql
UPDATE notes
SET "viewCount" = "viewCount" + 1,
    "usedAt" = CASE WHEN "shareType" = 'ONE_TIME' THEN NOW() ELSE "usedAt" END
WHERE id = $id
  AND "revokedAt" IS NULL
  AND ("usedAt" IS NULL OR "shareType" <> 'ONE_TIME')
  AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
RETURNING *;
```

Zero rows ⇒ already claimed / invalid ⇒ HTTP 410.

---

## Access types

| Type | Open rule |
|------|-----------|
| `PUBLIC` | Link only |
| `PASSWORD` | Link + server-generated key (bcrypt; plain shown once at create) |
| `RESTRICTED` | Link + logged-in user whose email is on the allowlist (stretch) |

---

## Schema (abbreviated)

```
users(id, email unique, passwordHash, …)
notes(id, shareType, accessType, shareToken unique, accessKeyHash?,
      expiresAt?, revokedAt?, usedAt?, viewCount, ownerId, …)
note_allowed_emails(noteId, email)  -- RESTRICTED only
```

---

## Pages

| Route | Role |
|-------|------|
| `/register`, `/login` | Auth |
| `/` | Softboard corkboard when logged in (`?tab=feed` = Everyone’s) |
| `/profile` | Account summary + note count |
| `/notes/new` | Create (share + access options) |
| `/notes/[id]` | Copy link / key once / revoke |
| `/share/[token]` | Open, unlock, or sign-in for allowlist |

---

## Stack tradeoffs

| Choice | Why | Tradeoff |
|--------|-----|----------|
| Hono API (separate from Next) | Clear BE boundary; easy to test with `app.request` | Two deploys (Railway + Vercel) |
| Prisma + raw claim SQL | ORM for CRUD; SQL where races matter | Must keep column names aligned |
| Shared Zod package | One validation source for FE/BE | Build shared before apps |
| JWT in `Authorization` | Simple for a POC SPA | No httpOnly cookie / CSRF story |
| bcrypt access keys | Slow verify; no plaintext at rest | Key shown once via create redirect |

---

## Limitations (intentional for this POC)

- **In-memory rate limit** on unlock (`apps/api/src/lib/rate-limit.ts`) — not multi-instance safe; use Redis in production.
- **No background job** to purge expired rows — expiry is enforced at read/claim time.
- **No email sending** — allowlist assumes recipients already have (or will create) accounts.
- **No structured observability** — logs to stdout only.
- **Timestamp-without-tz** Prisma defaults — claim SQL uses DB `NOW()`; prefer `timestamptz` in production.
- **Prod DB network** — Aiven must allow Railway egress (`0.0.0.0/0` is fine for a short-lived POC).
- **Softboard pin layout is client-only** — positions live in per-browser `localStorage` (per user + tab), not the server; clearing site data resets the freeform layout.

---

## Security decisions → code

| Decision | Where |
|----------|--------|
| Opaque share token | `apps/api/src/lib/crypto.ts` → `notes.ts` create |
| Access key bcrypt + one-time reveal | `notes.ts` create; never on later GET |
| Atomic one-time claim | `share.ts` `claimSuccessfulView` |
| Owner isolation | `notes.ts` queries filter `ownerId` |
| Optional auth for RESTRICTED status/open | `middleware/auth.ts` `optionalAuth` |
| Shared FE/BE validation | `packages/shared/src/schemas.ts` |

---

## API (summary)

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register`, `/auth/login` | — |
| GET | `/auth/me` | JWT |
| GET/POST | `/notes`, `/notes/:id`, `/notes/:id/revoke` | JWT |
| GET | `/board/mine`, `/board/feed` | JWT (title-only pins; softboard) |
| GET | `/share/:token` | optional JWT |
| POST | `/share/:token/open` | optional JWT (required if RESTRICTED) |
| POST | `/share/:token/unlock` | — |

---

## Scripts

```bash
pnpm test             # API share + board integration tests
pnpm test:web         # Softboard Vitest / Testing Library
pnpm test:all         # API + web
pnpm dev:api          # :4000
pnpm dev:web          # :3000
pnpm db:push
pnpm typecheck
```


## License

MIT — job-application POC.
