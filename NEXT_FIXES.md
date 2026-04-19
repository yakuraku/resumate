# ResuMate -- Production Audit & Fix Tracker

**Audit date:** 2026-04-19  
**Auditor:** Claude Code (full-stack review)  
**Scope:** Post-migration cloud audit from fresh-user perspective  
**Stack:** Neon Postgres + Cloudflare R2 + Vercel (frontend) + Render (backend)

---

## Infrastructure State (Confirmed Live via MCP)

| Service | Status | URL / ID |
|---|---|---|
| Render backend | LIVE (last deploy 2026-04-17) | `https://resumate-ws0y.onrender.com` |
| Vercel frontend | Deployed, `live: false` | `resumate-sigma-sepia.vercel.app` |
| Neon Postgres | Active, PG 17, Sydney region | `fancy-thunder-36519184` |
| Cloudflare R2 | Bucket exists, no CORS config | `resumate-files` (OC region) |
| Users in DB | 2 total, 1 admin | Confirmed live |
| Alembic version | `e6f7a8b9c0d1` (latest ran) | Confirmed live |
| RLS on all 18 tables | `rowsecurity = false` EVERYWHERE | **Confirmed live -- critical** |

---

## TIER 1 -- BLOCKERS (Must fix before any beta user gets credentials)

### B1. `BACKEND_URL` almost certainly not set in Vercel [UNCONFIRMED - CHECK MANUALLY]
- `next.config.ts` proxies all `/api/v1/*` to `process.env.BACKEND_URL ?? 'http://localhost:8921'`
- If `BACKEND_URL` is not set in Vercel project env vars, every API call hits `localhost:8921` on the Vercel server -- instant failure
- Vercel shows `live: false` on the project, which may indicate the frontend cannot talk to the backend
- **Action:** Go to Vercel dashboard -> resumate project -> Settings -> Environment Variables. Confirm `BACKEND_URL` is set to `https://resumate-ws0y.onrender.com`
- **Fix time:** 2 minutes in Vercel dashboard

### B2. RLS never implemented in Neon -- confirmed live
- Ran `SELECT tablename, rowsecurity FROM pg_tables` against production Neon DB
- **All 18 tables have `rowsecurity = false`** -- the PostgreSQL-level policies were never created
- No middleware in the codebase sets `SET LOCAL app.current_user_id` either
- Only protection is application-level `WHERE user_id = current_user.id` in service queries
- A bug in any service method = cross-user data exposure
- **Impact for beta:** Low risk if only you and trusted testers use it. High risk at any real scale.
- **Fix:** Defer until after beta IF you trust the service-layer filtering. Add RLS as a hardening step post-beta.
- **Fix time:** 2-4 hours (SQL policies + middleware)

### B3. `applications.user_id` is nullable -- confirmed live in production schema
- `information_schema.columns` query confirmed: `is_nullable = YES` on `applications.user_id`
- ORM model (`application.py:28`) still has `nullable=True`
- A NULL `user_id` means that row is orphaned from all user-scoped queries
- **Fix:** Alembic migration to set `NOT NULL` constraint + update model definition
- **Fix time:** 30 minutes

### B4. JWT and CSRF secrets have insecure defaults with no startup guard
- `config.py:46`: `JWT_SECRET_KEY: str = "dev-insecure-change-me"`
- `config.py:49`: `CSRF_SECRET_KEY: str = "dev-insecure-change-me"`
- If either was not set in Render dashboard, all JWTs are forgeable by anyone who reads the open-source code
- No startup validation that fails the app if defaults are in use in cloud mode
- **Action:** Confirm in Render dashboard that both vars are set to random values (not the defaults)
- **Fix (code):** Add startup guard in `main.py` lifespan that checks these in cloud mode
- **Fix time:** 20 minutes

### B5. `ENCRYPTION_KEY` has no startup validation
- `config.py:50`: defaults to empty string `""`
- When any beta user saves an LLM API key in Settings, `encryption_service.encrypt()` crashes if this is empty
- **Action:** Confirm `ENCRYPTION_KEY` is set in Render dashboard
- **Fix (code):** Add startup guard alongside B4
- **Fix time:** 10 minutes (combined with B4 fix)

### B6. No user creation mechanism for beta testers
- No self-registration, no invite system, no admin UI
- Only path: admin calls a `/auth/register` endpoint (if it exists) or inserts directly into Neon
- Need to verify if a `/auth/register` or admin `/users/create` endpoint exists
- **Fix options:** (a) Add a simple admin-only `POST /users` endpoint, or (b) use the CLI `manage.py create-user` command via Render SSH
- Render SSH: `ssh srv-d7gshl0sfn5c73e20jeg@ssh.oregon.render.com`
- **Fix time:** 1-2 hours for a proper admin endpoint; 5 minutes via SSH CLI

### B7. Cookie flow through Next.js proxy is unverified
- Auth uses httpOnly cookies set by the Render backend
- With the Next.js proxy, the browser talks to Vercel, Vercel proxies to Render
- Cookie `Set-Cookie` header passes through the proxy and is scoped to the Vercel domain -- should work in theory
- **But:** This has never been tested end-to-end in the production environment
- **Fix:** Manual login test on the production Vercel URL before giving anyone credentials

---

## TIER 2 -- HIGH RISK (Fix before wider beta)

### H1. SSE streaming (AI Tailor) will break on Vercel
- Vercel serverless functions have a **25-second hard timeout**
- The agentic tailor runs up to 10 LLM iterations -- easily 60-90 seconds
- Next.js rewrites route SSE through a serverless function, which will be killed at 25s
- User sees the tailor modal start, then the connection drops mid-run
- **Fix options:**
  - (a) Set `NEXT_PUBLIC_API_URL` in Vercel to point directly to Render for all calls (bypasses proxy, but requires CORS config on backend)
  - (b) Use Vercel Edge Runtime for the proxy rewrite (no timeout limit)
  - (c) Add `export const maxDuration = 60` to the relevant Next.js route handler
- **Fix time:** 1-2 hours

### H2. Master resume template created without user_id at startup
- `main.py:211`: `ensure_master_exists(db)` called with no user context
- `resume_template_service._read_master_yaml()` falls back to local filesystem which doesn't exist on Render
- Result: a "Master Resume" template row is created in DB with stub YAML and potentially no `user_id`
- New beta users will start setup with an empty master resume
- **Fix:** Audit `ensure_master_exists()` to confirm it handles R2/cloud mode correctly, and ties to a user
- **Fix time:** 1-2 hours

### H3. API docs publicly accessible in production
- `main.py:233-235`: `/docs`, `/redoc`, `/openapi.json` are enabled with no auth
- Any user (including beta testers) who finds the Render URL can browse the full API schema and call endpoints manually
- **Fix:** Disable in cloud mode or protect behind admin auth
```python
docs_url="/docs" if settings.AUTH_MODE == "local" else None,
redoc_url="/redoc" if settings.AUTH_MODE == "local" else None,
openapi_url="/openapi.json" if settings.AUTH_MODE == "local" else None,
```
- **Fix time:** 5 minutes

### H4. `APP_URL` must match actual Vercel domain in Render
- Used as the HTTP `Referer` header in OpenRouter API calls
- If set incorrectly (or to `http://localhost:1235` default), OpenRouter may reject calls
- **Action:** Confirm `APP_URL` in Render dashboard is set to `https://resumate-sigma-sepia.vercel.app` (or whichever domain you use)
- **Fix time:** 2 minutes in Render dashboard

### H5. No rate limiting on `/auth/login`
- No brute-force protection exists -- any IP can try unlimited passwords
- DEPLOYMENT.md noted this as "post-launch" -- it is not implemented
- **Fix:** Add `slowapi` middleware (5 attempts/min/IP)
- **Fix time:** 1 hour

### H6. Health check path not configured on Render
- Render service has `"healthCheckPath": ""` (empty) -- confirmed via MCP
- Render cannot auto-restart the service on failures if no health check is set
- Health endpoint exists at `/api/v1/health`
- **Fix:** Set health check path to `/api/v1/health` in Render dashboard
- **Fix time:** 2 minutes

---

## TIER 3 -- MEDIUM (Track and fix in parallel with beta)

| ID | Issue | Location | Fix Effort |
|---|---|---|---|
| M1 | `resumes` table has no `user_id` -- ownership via JOIN only; optional `user_id` param in service methods | `resume_service.py` | 2 hours |
| M2 | Color field on applications accepts any string -- no hex validation | `applications.py:149` | 30 min |
| M3 | `resume_snapshot_yaml` column is dead code -- wastes storage on every application row | `application.py:45` | 1 hour (migration) |
| M4 | `ghost_disabled` is a double negative -- confusing naming | `application.py:41` | Rename in next major refactor |
| M5 | Bootstrap admin password `qwerty1234` in local .env -- confirm it was overridden in Render | `render.yaml` | 2 min check |
| M6 | PDF preview during setup wizard writes to Render ephemeral disk -- lost on restart | `setup.py:257` | 2-4 hours |
| M7 | Auto-save clears PDF metadata on every save -- rapid saves trigger repeated renders | `resume_service.py` | 1 hour |
| M8 | `uq_context_files_user_filename` constraint prevents re-uploading same filename -- needs upsert | `context_files` table | 1 hour |
| M9 | JWT expiry is 7 days with no token revocation on logout | `config.py:48`, `auth.py` | 2 hours |
| M10 | Setup status check catches ALL errors and sends to `/setup` -- 500 errors look like first-time user | `page.tsx:30-33` | 30 min |

---

## TIER 4 -- LOW / BEST PRACTICES

| ID | Issue | Fix |
|---|---|---|
| L1 | No error tracking -- all errors go to `print()` | Add Sentry (in progress, see below) |
| L2 | No database backup strategy -- Neon free tier has 6h history only | Set up nightly pg_dump to R2 |
| L3 | Ghost detection background task swallows errors silently | Add asyncio done-callback |
| L4 | API pagination max is 1000 | Cap at 100 |
| L5 | `_local_user_cache` is a process singleton -- stale if user is updated | Low risk (local mode only) |

---

## PENDING MANUAL CONFIRMATION (Check these yourself)

Go to **Render dashboard** -> resumate-ws0y -> Environment:

- [ ] `JWT_SECRET_KEY` -- is it set and NOT `"dev-insecure-change-me"`?
- [ ] `CSRF_SECRET_KEY` -- is it set and NOT `"dev-insecure-change-me"`?
- [ ] `ENCRYPTION_KEY` -- is it set and non-empty?
- [ ] `APP_URL` -- is it set to the production Vercel URL?
- [ ] `BOOTSTRAP_ADMIN_PASSWORD` -- what was set? (not `qwerty1234`)
- [ ] `DATABASE_URL` -- confirm it uses the `-pooler` endpoint (not direct)

Go to **Vercel dashboard** -> resumate -> Settings -> Environment Variables:

- [ ] `BACKEND_URL` -- is it set to `https://resumate-ws0y.onrender.com`?
- [ ] `NEXT_PUBLIC_API_URL` -- is this set? (if yes, proxy is bypassed, CORS matters)

Go to **Render dashboard** -> resumate-ws0y -> Settings:

- [ ] Health Check Path -- set to `/api/v1/health`

---

## QUICK WIN CHECKLIST (Under 5 minutes each)

1. [ ] Set `BACKEND_URL=https://resumate-ws0y.onrender.com` in Vercel env vars
2. [ ] Set health check path to `/api/v1/health` in Render settings
3. [ ] Set `APP_URL=https://resumate-sigma-sepia.vercel.app` in Render env vars
4. [ ] Disable API docs in cloud mode (5-line code change, see H3)
5. [ ] Verify `JWT_SECRET_KEY` and `CSRF_SECRET_KEY` are non-default in Render

---

## IN PROGRESS

- [ ] **Sentry error tracking** -- setup steps provided below, integration pending

---

## SENTRY SETUP

See conversation for step-by-step instructions.  
**Backend DSN:** `https://b8e71933cb208445c0933003729ff132@o4511241673310208.ingest.de.sentry.io/4511244545228880`  
**Frontend DSN:** `https://ca73d0feb71633c073ee67d14d3b71c3@o4511241673310208.ingest.de.sentry.io/4511244548112464`

---

## NOTES

- Render auto-deploys from `main` branch on push
- Vercel auto-deploys from `main` branch on push
- Neon is in `aws-ap-southeast-2` (Sydney); R2 bucket is in `OC` (Oceania) -- good co-location
- Render SSH: `ssh srv-d7gshl0sfn5c73e20jeg@ssh.oregon.render.com` (for CLI user creation)
- Render free tier: 512MB ephemeral disk, auto-sleeps after 15min inactivity (spins up in ~30s)
- Do NOT commit `backend/.env` -- confirmed gitignored
