# Walkthrough — what was built and why (for *you*)

This is your personal cheat-sheet so you can defend every line in an interview.  
Repo: https://github.com/dgoenka/note-share

---

## 1. Architecture in one paragraph

**pnpm monorepo** with three packages:

1. **`packages/shared`** — Zod schemas + TypeScript types + constants  
2. **`apps/api`** — Hono HTTP API, Prisma, JWT auth, share-claim logic  
3. **`apps/web`** — Next.js App Router UI that calls the API  

Same Zod schemas validate on the browser *and* the server. Models (types) are shared; the DB schema lives only in Prisma (server).

---

## 2. Domain model

A **Note** is owned by a **User**. Creating a note always creates a **share link** identified by `shareToken`.

| Field | Role |
|-------|------|
| `shareType` | `ONE_TIME` or `TIME_BASED` |
| `accessType` | `PUBLIC` or `PASSWORD` |
| `shareToken` | Random 32-byte base64url string in the URL |
| `accessKeyHash` | bcrypt of server-generated key (PASSWORD only) |
| `expiresAt` | Hard stop for TIME_BASED (optional extra for others) |
| `revokedAt` | Owner force-kill |
| `usedAt` | Set when ONE_TIME is successfully opened |
| `viewCount` | Successful opens only |

---

## 3. Critical algorithms (memorize these)

### 3.1 Secure share token

```ts
randomBytes(32).toString("base64url")
```

256 bits of entropy — not enumerable.

### 3.2 Access key (password-protected)

```ts
randomBytes(12).toString("base64url")  // shown once
bcrypt.hash(key, 12)                   // stored
```

Client never supplies the key at create time. Reloading owner page does **not** re-show the key.

### 3.3 Race-safe one-time open

```sql
UPDATE notes
SET viewCount = viewCount + 1,
    usedAt = CASE WHEN shareType = 'ONE_TIME' THEN NOW() ELSE usedAt END
WHERE id = $id
  AND revokedAt IS NULL
  AND (usedAt IS NULL OR shareType <> 'ONE_TIME')
  AND (expiresAt IS NULL OR expiresAt > NOW())
RETURNING *;
```

- Winner: 1 row → content returned, count +1  
- Loser: 0 rows → 410 already used  
- Wrong password never reaches this UPDATE  

### 3.4 View count rules

| Event | +1? |
|-------|-----|
| Public open success | yes |
| Correct password unlock | yes |
| Wrong password | **no** |
| Status GET | **no** |
| Expired / revoked / used | **no** |

### 3.5 Brute-force mitigation

In-memory rate limit: **10 unlocks / 15 min / (token + IP)**.  
Plus bcrypt cost + high-entropy keys.

---

## 4. API map

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/register` | no | Create user |
| POST | `/auth/login` | no | JWT |
| GET | `/auth/me` | yes | Session |
| GET | `/notes` | yes | List |
| POST | `/notes` | yes | Create + share |
| GET | `/notes/:id` | yes | Owner detail |
| POST | `/notes/:id/revoke` | yes | Force invalidate |
| GET | `/share/:token` | no | Status (no count) |
| POST | `/share/:token/open` | no | Public open |
| POST | `/share/:token/unlock` | no | Password open |

---

## 5. Frontend pages

| Route | What it does |
|-------|----------------|
| `/login`, `/register` | Auth; FE validates with shared Zod |
| `/` | Note list |
| `/notes/new` | Create form (share type, access type, expiry) |
| `/notes/[id]` | Share URL, stats, revoke; access key once via `?accessKey=` |
| `/share/[token]` | Public auto-open or password form; error states |

Auth token lives in `localStorage` (`note-share-token`) and is sent as `Authorization: Bearer …`.

---

## 6. File map (where to look)

```
packages/shared/src/schemas.ts   ← all Zod rules
packages/shared/src/types.ts     ← API DTOs
apps/api/prisma/schema.prisma    ← DB
apps/api/src/routes/share.ts     ← claim + rate limit + unlock
apps/api/src/routes/notes.ts     ← create + revoke
apps/api/src/lib/crypto.ts       ← tokens / bcrypt
apps/api/src/lib/note-state.ts   ← pure accessibility helper
apps/web/src/lib/api.ts          ← fetch wrapper
apps/web/src/app/share/[token]   ← recipient UX
```

---

## 7. How to run locally

```bash
cd note-share
pnpm install
pnpm --filter @note-share/shared build
# ensure Postgres + DATABASE_URL in apps/api/.env
pnpm --filter @note-share/api db:push
pnpm dev:api   # :4000
pnpm dev:web   # :3000
```

Demo account used in testing: `demo@example.com` / `password123` (re-register if DB is wiped).

---

## 8. Demo script (for the video)

1. Register → land on empty notes  
2. Create **public time-based** note → copy share link → open in private window → content shows, viewCount = 1  
3. Create **password one-time** note → copy key + link → wrong password (count stays 0) → right password (count 1) → second open fails  
4. Create another note → **revoke** → open fails  
5. Show owner note detail badges (Active / Used / Revoked)

---

## 9. Still open for later (not required for core POC)

- Deploy live demo (Render / Railway / Vercel + Neon)  
- Demo video recording  
- Optional: Prisma migrate history instead of `db push`  
- Optional: official shadcn CLI install (UI is already shadcn-style)

---

## 10. Interview answers (short)

**Q: Two people open a one-time link at once?**  
A: Conditional `UPDATE … WHERE usedAt IS NULL … RETURNING`. One wins.

**Q: Safe view count?**  
A: Incremented in the same atomic UPDATE, not read-modify-write in app code.

**Q: 1M concurrent opens?**  
A: One hot row; scale with Redis counters / sharding / cache status; claim SQL remains source of truth for one-time.

**Q: Brute force?**  
A: High-entropy keys, bcrypt, rate limit per token+IP; Redis in production.
