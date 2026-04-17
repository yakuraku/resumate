# ResuMate: Cloud Deployment & Multi-User Implementation Plan

## Status: PLAN FINALIZED, READY TO EXECUTE

Revision 2 (2026-04-15). Supersedes the original planning draft. All open
questions from the prior planning session are now closed and recorded below.

---

## 1. Background & Motivation

### Original Pain Point
Developer maintains two repos:
- `C:\YASH\CODE\ResuMate` (private, personal data, development)
- `C:\YASH\CODE\ResuMate-docker` (public release, Docker testing)

Fixing bugs, pushing to private, pulling into the docker repo, and rebuilding
on every change was too tedious. Testing different user states required manual
folder wiping and volume manipulation.

### Solution
Implement proper multi-user authentication with cloud persistence. This solves
the dev-workflow problem as a side effect: test accounts are just rows in the
DB, isolated by `user_id`. No volume wiping, no folder juggling.

### Hosting Model: Shared SaaS (admin-invite only)
One hosted instance, all users on the developer's Neon DB + R2 bucket.
Account creation is admin-only via CLI; the developer shares credentials
privately with early invited users. No open registration.

---

## 2. Locked Architecture Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Auth | Built-in JWT in **httpOnly cookie**, `SameSite=None; Secure`, CSRF token header | XSS-safe (localStorage is not), works cross-origin Vercel to Render, CSRF token is one extra header |
| DB | **Neon Postgres** in `aws-us-west-2` | Colocated with Render Oregon, ~5ms query latency |
| Text storage (markdown, YAML) | **Postgres TEXT columns** | Sub-ms reads/writes, trivial backup via `pg_dump`, no cache invalidation |
| Binary storage (PDFs) | **Cloudflare R2**, bucket `resumate-files`, presigned URLs with 1h expiry | Zero egress fees, CDN-backed, cheap for large binaries |
| Secrets at rest (user API keys) | **Fernet symmetric encryption** using server-side `ENCRYPTION_KEY` env var | DB leak does not expose users' OpenAI/OpenRouter/Gemini keys |
| Authorization | Route-level `Depends(get_current_user)` + Postgres **Row-Level Security** policies | Defense in depth: if a route forgets to filter by `user_id`, RLS blocks the leak |
| Backend host | Render (free tier, Oregon) | Only free option that can run 5-15s RenderCV subprocess (Vercel has 10s cap) |
| Frontend host | Vercel (Hobby) | Unlimited projects, 100GB bandwidth, Next.js native |
| Cold-start mitigation | UptimeRobot pings `/api/v1/health` every 5 min (endpoint touches DB to keep Neon warm too) | Prevents Render spin-down and Neon auto-suspend in the same call |
| DB migration timing | Render **pre-deploy hook**, not the start command | Prevents migration races on multi-instance or overlapping deploys |
| LLM keys | **Per-user**, entered in Settings, encrypted at rest, persisted across logins | Developer pays nothing for shared usage, users keep control |
| Master resume | **Dedicated `master_resumes` table**, one row per user | Cleaner than a column on `users`, carries `updated_at` + audit history |
| Agentic tailor SSE | **30s heartbeat** events on the stream | Render has a 100s idle connection cap; heartbeats prevent drops |

### Dual-Mode Remains
The same codebase still supports a local/Docker mode for self-hosters:
- `STORAGE_BACKEND=local` plus `DATABASE_URL=sqlite+aiosqlite:///./data/resumate.db`
- Filesystem + SQLite, same schema, same auth code (bcrypt + JWT)
- Docker compose unchanged: `docker compose up` works with no cloud accounts

The cloud instance is the same image with env vars flipped to Neon + R2.

---

## 3. Prerequisites (do these before Phase 1)

- [ ] **Enable Cloudflare R2.** Cloudflare Dashboard > R2 > Enable. Create
  bucket `resumate-files`. Note the Account ID. Generate an R2 API token
  with read+write on that bucket only (principle of least privilege).
- [ ] **Generate secrets locally.** Record these, do not commit them:
  - `JWT_SECRET_KEY` via `openssl rand -hex 32`
  - `ENCRYPTION_KEY` via `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
  - `CSRF_SECRET_KEY` via `openssl rand -hex 32`
- [ ] **Back up current local data.** Before anything else:
  ```bash
  cp backend/data/resumate.db backend/data/resumate.db.backup-2026-04-15
  tar -czf backend/data/files-backup-2026-04-15.tar.gz backend/data/my_info backend/data/master-resume_CV.yaml backend/data/resume-tailor-helper.md backend/data/pdfs
  ```

---

## 4. Schema Migration (the big one)

### 4.1 Tables Added

```sql
CREATE TABLE users (
  id            VARCHAR PRIMARY KEY,
  email         VARCHAR(320) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_users_email ON users(email);

CREATE TABLE master_resumes (
  id           VARCHAR PRIMARY KEY,
  user_id      VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  yaml_content TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE context_files (
  id         VARCHAR PRIMARY KEY,
  user_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename   VARCHAR(255) NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, filename)
);
CREATE INDEX ix_context_files_user_id ON context_files(user_id);

CREATE TABLE tailor_helpers (
  user_id    VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Rationale: `my_info/*.md`, master resume YAML, and the tailor helper all move
out of the filesystem and into Postgres TEXT. Editor autosave becomes a simple
UPDATE, which is sub-ms once the pool is warm.

### 4.2 Tables Altered (add `user_id`)

These five tables hold user-owned rows directly:

- `applications`
- `user_settings` (also: drop `UNIQUE(setting_key)`, add `UNIQUE(user_id, setting_key)`)
- `user_context` (also: drop `UNIQUE(key)`, add `UNIQUE(user_id, key)`)
- `resume_templates`
- `tailor_rules`

These are owned transitively through `applications` (no direct `user_id`
column, access control enforced via JOIN):

- `resumes`, `resume_versions`, `chat_history`, `interviews`,
  `application_questions`, `application_credentials`

### 4.3 Safe ALTER Sequence (avoids data loss)

For each of the five tables above, the migration executes in this order
(NEVER drop to a single `ALTER ADD COLUMN NOT NULL` - it would fail on any
existing row):

```sql
-- Step 1: add as nullable
ALTER TABLE applications ADD COLUMN user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE;

-- Step 2: backfill (admin user created first, see section 5)
UPDATE applications SET user_id = :admin_user_id WHERE user_id IS NULL;

-- Step 3: enforce NOT NULL
ALTER TABLE applications ALTER COLUMN user_id SET NOT NULL;

-- Step 4: index for query performance
CREATE INDEX ix_applications_user_id ON applications(user_id);
```

The unique-constraint rewrites on `user_settings.setting_key` and
`user_context.key` use SQLAlchemy `op.batch_alter_table` so the migration
still runs against SQLite in local/dev mode.

### 4.4 Indexes (performance)

Postgres does NOT auto-index foreign keys. Without these, every scoped query
is a full table scan. Create indexes on:

```
ix_applications_user_id, ix_resume_templates_user_id, ix_tailor_rules_user_id,
ix_context_files_user_id, ix_master_resumes_user_id
(unique indexes on user_settings and user_context already cover their user_id)
```

### 4.5 Row-Level Security (defense in depth)

Applied to every table with a direct or indirect user ownership. The app
sets `SET LOCAL app.current_user_id = :uid` at the start of each request;
RLS policies enforce that queries only see rows where `user_id = current_setting('app.current_user_id')`.

```sql
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_owner ON applications
  USING (user_id = current_setting('app.current_user_id', true));
-- repeat for user_settings, user_context, resume_templates, tailor_rules,
-- context_files, master_resumes, tailor_helpers
```

Child tables (resumes, resume_versions, chat_history, interviews,
application_questions, application_credentials) use a join-based policy:

```sql
CREATE POLICY resume_owner ON resumes
  USING (EXISTS (
    SELECT 1 FROM applications a
    WHERE a.id = resumes.application_id
      AND a.user_id = current_setting('app.current_user_id', true)
  ));
```

An admin bypass role is NOT created; the developer uses their own user account.
For schema migrations, Alembic runs as a superuser role that bypasses RLS.

### 4.6 Alembic Migration Ordering

The schema changes land in a single migration named
`multi_user_baseline.py`. Its `upgrade()` runs in this exact order:

1. Create `users`, `master_resumes`, `context_files`, `tailor_helpers`.
2. Add nullable `user_id` to the five ownable tables.
3. (Data migration is a SEPARATE one-shot script, not inline in Alembic,
   see section 5. Alembic leaves rows with NULL user_id until that script
   runs.)
4. A follow-up migration `multi_user_enforce.py` runs AFTER the data script,
   flips `user_id` to NOT NULL, rewrites unique constraints, creates indexes,
   enables RLS, installs policies.

Splitting in two migrations means the dangerous NOT-NULL flip only runs once
you have manually confirmed the data migration succeeded.

---

## 5. Data Migration (local SQLite + filesystem to Neon + R2)

One-shot Python script at `backend/app/cli/migrate_to_cloud.py`.
Run ONCE from the developer machine with both `DATABASE_URL` pointed at
Neon and cloud env vars set.

### 5.1 What It Does (in order)

1. Connect to SQLite source (`sqlite+aiosqlite:///./data/resumate.db`) and
   Neon target simultaneously using two engines.
2. Create the admin user in Neon first:
   - Prompts for email + password
   - `id = uuid4()`, `is_admin = true`
   - Records the new admin UUID for use in step 3.
3. Copy rows, in FK-safe order:
   ```
   applications -> resumes -> resume_versions -> chat_history -> interviews
     -> application_questions -> application_credentials
   user_settings -> user_context -> resume_templates -> tailor_rules
   ```
   Each row gets `user_id = <admin_id>` on insert.
4. Encrypt API keys during the `user_settings` copy: any row whose
   `setting_key` matches `*_api_key` has its `setting_value` Fernet-encrypted.
5. Read `data/master-resume_CV.yaml` from disk, insert into `master_resumes`
   as a single row for the admin user.
6. Read every `data/my_info/*.md` from disk, insert each as a row in
   `context_files` (`filename = basename`, `content = file contents`).
7. Read `data/resume-tailor-helper.md` into `tailor_helpers` row.
8. Set `user_settings.setup_completed = 'true'` for the admin user so the
   setup wizard is skipped on first login.
9. Upload PDFs from `data/pdfs/*.pdf` to R2 under
   `users/<admin_id>/pdfs/<original_filename>`. Skip if bucket already has
   the object (idempotent).
10. Print a summary: counts copied per table, files uploaded, any skipped.

### 5.2 Verification Step (mandatory before running `multi_user_enforce`)

After the script runs, the developer manually verifies:
```bash
python manage.py verify-migration --admin-email you@example.com
```
This reads the Neon DB and confirms:
- Admin user exists
- All counts match between SQLite source and Neon target
- Every `user_id` on ownable tables matches the admin UUID (no NULLs)
- Every file in `data/my_info` has a corresponding `context_files` row
- `master_resumes` has one row for admin with non-empty `yaml_content`
- Every PDF in `data/pdfs` has a corresponding R2 object

Only after this passes green do you run `alembic upgrade head` to apply
`multi_user_enforce.py`.

### 5.3 Rollback

- Source SQLite and filesystem are NEVER modified by the migration script.
  Rollback = point the app back at SQLite, nothing else to undo.
- The Neon project can be reset by `alembic downgrade base` plus
  `TRUNCATE users CASCADE` (cascade FKs handle the rest).
- R2 cleanup: `aws s3 rm s3://resumate-files/users/<admin_id>/ --recursive`
  against the R2 endpoint.

---

## 6. Backend Implementation Phases

### Phase 1: Auth + Core Models

New files:
- `backend/app/models/user.py`, `master_resume.py`, `context_file.py`, `tailor_helper.py`
- `backend/app/schemas/auth.py`
- `backend/app/api/v1/auth.py` with routes:
  ```
  POST /auth/login         sets httpOnly cookie + returns {csrf_token, user}
  POST /auth/logout        clears cookie
  GET  /auth/me            returns current user (requires auth)
  GET  /auth/csrf          returns fresh CSRF token (for SPA refresh)
  ```
- `backend/app/services/auth_service.py` (bcrypt, JWT encode/decode, CSRF)
- `backend/app/services/encryption_service.py` (Fernet wrapper for API keys)
- `backend/app/dependencies.py`:
  ```
  get_current_user(request)        # reads JWT cookie, verifies CSRF on mutating verbs
  get_current_admin(current_user)  # 403 if not admin
  ```
- `backend/app/middleware/rls.py`: after auth resolves, executes
  `SET LOCAL app.current_user_id = :uid` on the request's DB connection.
- `backend/app/cli/manage.py`:
  ```
  create-user  --email X --password Y [--admin]
  delete-user  --email X
  list-users
  rotate-encryption-key --old-key KEY --new-key KEY
  verify-migration --admin-email X
  ```

Modified:
- `backend/app/config.py`: add `JWT_SECRET_KEY`, `JWT_ALGORITHM`,
  `JWT_EXPIRE_MINUTES=10080`, `CSRF_SECRET_KEY`, `ENCRYPTION_KEY`,
  `STORAGE_BACKEND`, `R2_*` vars, `COOKIE_DOMAIN`, `COOKIE_SECURE`.
- `backend/app/api/v1/router.py`: mount `auth` router.
- `backend/pyproject.toml`: add `python-jose[cryptography]`, `passlib[bcrypt]`,
  `asyncpg`, `boto3`, `cryptography` (already a transitive dep but pin it).

### Phase 2: Storage Abstraction (hybrid)

`backend/app/services/text_storage_service.py`: reads/writes TEXT content
in Postgres (`context_files`, `master_resumes`, `tailor_helpers` tables).
Pure DB, no filesystem, no R2.

`backend/app/services/binary_storage_service.py`: abstract base with two
implementations.
```
class BinaryStorageService:
    async def put(user_id, key, data: bytes) -> None
    async def get(user_id, key) -> bytes
    async def delete(user_id, key) -> None
    async def url(user_id, key, expires_in=3600) -> str
    async def exists(user_id, key) -> bool

class LocalBinaryStorage:  # writes ./data/users/{uid}/{key}
class R2BinaryStorage:     # boto3 with R2 endpoint, returns presigned URLs
```

Instantiation in `main.py` lifespan based on `settings.STORAGE_BACKEND`.
Used only for PDFs under `pdfs/...`.

Modified:
- `utils/filesystem.py`: all path helpers gain a `user_id` parameter.
  For cloud mode the helpers are no-ops (paths are not used).
- `api/v1/context_files.py`: replace `Path.read_text/write_text` with
  `text_storage.read(user_id, filename)` / `write(user_id, filename, content)`.
- `services/rendercv_service.py`: render into a temp dir, then
  `binary_storage.put(user_id, f"pdfs/{name}.pdf", bytes)`.
  Temp dir deleted after upload.
- `api/v1/resumes.py`: `GET /pdf` returns a 302 to the presigned R2 URL in
  cloud mode; streams the local file in local mode.
- `main.py._startup_checks()`: no longer filesystem-based. First-login
  initialization is handled by `ensure_user_storage_initialized(user_id)`
  called from the login handler on a user's first successful login.

### Phase 3: Protect All Routes

Every router adds `current_user: User = Depends(get_current_user)` and
passes `current_user.id` to its service layer. Every service query gains
`.where(Model.user_id == user_id)`. For child tables, add a JOIN through
`applications`.

Routers to update: `applications`, `resumes`, `resume_templates`,
`context_files`, `tailor_rules`, `questions`, `settings`, `chat`,
`credentials`, `interviews`, `setup`.

The setup wizard check becomes per-user (reads `user_settings.setup_completed`
for `current_user.id`).

Settings write path: if `setting_key` ends with `_api_key`, the value is
encrypted with `encryption_service.encrypt()` before insert/update. Read
path decrypts transparently so route handlers see plaintext.

### Phase 4: Frontend Auth

New:
- `frontend/src/app/login/page.tsx`: email + password form.
- `frontend/src/hooks/useAuth.ts`: `{user, isLoading, login, logout, checkAuth}`.
- `frontend/src/components/AuthGuard.tsx`: redirects to `/login` if
  `useAuth()` reports unauthenticated after initial check.
- `frontend/src/lib/csrf.ts`: fetches and caches the CSRF token.

Modified:
- `frontend/src/lib/axios.ts`:
  - `withCredentials: true` (send cookies cross-origin)
  - Request interceptor: on mutating verbs (POST/PUT/PATCH/DELETE), attach
    `X-CSRF-Token` header.
  - Response interceptor: on 401, clear local auth state and redirect to `/login`.
- `frontend/src/app/layout.tsx`: wrap children with `AuthProvider` and `AuthGuard`.

Initial load UX: `useAuth` starts in `isLoading=true`. Layout renders a thin
skeleton (not the login page) until `checkAuth` resolves. Prevents the
"flash of login screen" on hard refresh.

### Phase 5: Cutover to Neon + R2

Exact sequence (run from developer machine):

```bash
# 1. Recreate Neon project in us-west-2 via Neon MCP.
# 2. Enable R2 + create bucket resumate-files, note Account ID + API token.
# 3. Add env vars to .env.local:
#    DATABASE_URL=postgresql+asyncpg://user:pw@ep-xxx-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require
#    STORAGE_BACKEND=r2
#    R2_BUCKET_NAME=resumate-files
#    R2_ENDPOINT_URL=https://<acct>.r2.cloudflarestorage.com
#    R2_ACCESS_KEY_ID=...
#    R2_SECRET_ACCESS_KEY=...
#    JWT_SECRET_KEY=... CSRF_SECRET_KEY=... ENCRYPTION_KEY=...
# 4. Apply the baseline migration (creates tables, adds nullable user_id).
cd backend && alembic upgrade multi_user_baseline

# 5. Run the data migration (creates admin user, copies everything).
python manage.py migrate-to-cloud --sqlite-path ./data/resumate.db

# 6. Verify.
python manage.py verify-migration --admin-email you@example.com

# 7. Apply the enforce migration (NOT NULL, indexes, RLS).
alembic upgrade head

# 8. Start the backend locally, log in as admin, sanity-check every page.
```

Note the `-pooler` suffix in the Neon hostname: use Neon's pooled endpoint
(pgbouncer-equivalent), not the direct endpoint. asyncpg + direct endpoint
will exhaust connections on Render free tier.

### Phase 6: Deployment

**Backend on Render:**
- Connect GitHub, pick the public mirror repo.
- Environment: Python.
- Build command: `pip install -e backend/`
- **Pre-deploy command**: `cd backend && alembic upgrade head` (NOT in the
  start command; this prevents races between instances).
- Start command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Env vars: same set as Phase 5 plus `APP_URL=https://<frontend>.vercel.app`
  and `COOKIE_DOMAIN=<your-render-host>`.
- CORS: `allow_origins=["https://<frontend>.vercel.app"]`,
  `allow_credentials=True`, and the frontend axios client uses
  `withCredentials: true`.

**Frontend on Vercel:**
- Import the same repo, root directory `frontend/`.
- Framework: Next.js.
- Env: `NEXT_PUBLIC_API_URL=https://<render-host>/api/v1`.

**UptimeRobot:**
- New HTTP(s) monitor, URL `https://<render-host>/api/v1/health`, interval
  5 min. The health endpoint executes `SELECT 1` so Neon stays warm in the
  same call.

---

## 7. Performance Budget & Guarantees

| Scenario | Target | How |
|---|---|---|
| Warm request, list applications | < 100ms p95 | Neon + Render colocated, indexed queries |
| Context file autosave roundtrip | < 80ms | Postgres UPDATE on TEXT column |
| PDF preview (cached) | < 200ms | 302 to R2 presigned URL, CDN edge |
| PDF preview (cold re-render) | 5-15s | Unchanged, RenderCV subprocess bound |
| Cold start (Render + Neon both asleep) | 60-90s | Acceptable for free tier; UptimeRobot keeps rare |
| Auth check on every navigation | < 20ms | JWT verify is local, no DB hit |

If these budgets slip after deployment, the first escalation is the Render
paid tier ($7/mo) which eliminates spin-down and gives more RAM for
RenderCV. DB bottlenecks would point to upgrading Neon.

---

## 8. Rollback Plan (per phase)

- **Phase 1-4 local dev**: pure code; revert via git.
- **Phase 5 data migration**: source SQLite and files are untouched; repoint
  `DATABASE_URL` and `STORAGE_BACKEND=local` and the app works as before.
  For Neon, `alembic downgrade base` + `TRUNCATE users CASCADE`. For R2,
  delete the `users/<admin_id>/` prefix.
- **Phase 6 deploy**: Render and Vercel both keep prior deploys; one-click
  rollback in each dashboard.

---

## 9. Post-Launch Operational Checklist

- [ ] Neon paid tier eventually (for PITR; free tier has 6h retention on
      your current project, which is OK short-term but not long-term).
- [ ] `pg_dump` to R2 nightly (cron job on a small scheduled Render task or
      a GitHub Action; R2 lifecycle rule to delete backups older than 30d).
- [ ] Rate limiting on `/auth/login` (slowapi middleware, 5 attempts/min/IP).
- [ ] Rate limiting on LLM endpoints (per-user daily cap, enforced in
      `llm_service`).
- [ ] Sentry (free tier) for error tracking.
- [ ] GitHub Action to sync `ResuMate` (private) to `ResuMate-docker` (public)
      on push to `main`, stripping `data/` and `.agents/`.

---

## 10. Open Questions: NONE

Every open question from the prior draft is now resolved and recorded above.
Proceed with Phase 1.

---

## Appendix A: File Layout After Migration

```
Postgres (Neon):
  users                  - auth
  master_resumes         - 1 per user, YAML content
  context_files          - N per user, markdown content
  tailor_helpers         - 1 per user, markdown content
  applications + children - per user with RLS
  user_settings          - per user, API keys encrypted
  user_context, resume_templates, tailor_rules - per user

R2 (resumate-files bucket):
  users/{user_id}/pdfs/resume_{id}.pdf         - active PDF
  users/{user_id}/pdfs/resume_{id}_v{n}.pdf    - version PDFs

Local (self-host mode only):
  data/resumate.db
  data/users/{user_id}/pdfs/*.pdf
  (markdown/YAML still in SQLite via the same schema)
```

## Appendix B: Key Files Reference

| Purpose | File |
|---|---|
| Models | `backend/app/models/` |
| DB engine + session | `backend/app/database.py` |
| Config / env | `backend/app/config.py` |
| API router root | `backend/app/api/v1/router.py` |
| Auth service | `backend/app/services/auth_service.py` (new) |
| Encryption service | `backend/app/services/encryption_service.py` (new) |
| Text storage | `backend/app/services/text_storage_service.py` (new) |
| Binary storage | `backend/app/services/binary_storage_service.py` (new) |
| RLS middleware | `backend/app/middleware/rls.py` (new) |
| CLI | `backend/app/cli/manage.py` (new) |
| Data migration script | `backend/app/cli/migrate_to_cloud.py` (new) |
| Axios client | `frontend/src/lib/axios.ts` |
| Auth hook | `frontend/src/hooks/useAuth.ts` (new) |
| Auth guard | `frontend/src/components/AuthGuard.tsx` (new) |
| Docker compose | `docker-compose.yml` (unchanged) |
