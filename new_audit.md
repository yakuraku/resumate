# ResuMate Go-Live Audit
**Auditor:** Claude (full-stack engineer onboarded for go-live)
**Date:** 2026-05-05
**Scope:** Confirm the live Vercel + Render + Neon + R2 deployment can host 2-3 invited test users end-to-end (signup → master resume → first application). Identify blockers, gaps, and the exact provisioning steps for test credentials.

---

## 1. Headline summary

The codebase is structurally ready for multi-user cloud operation: per-user models, RLS-equivalent route filtering, encrypted API keys at rest, JWT cookie + CSRF auth, signup gated by access codes. But there are **three blocking issues** that will affect the test-user experience and one **multi-tenant data-leak** issue that must be fixed before sharing accounts.

| # | Severity | Issue | Blocks test-user go-live? |
|---|---|---|---|
| 1 | **Critical** | `llm_service` is a process-global singleton. The last user who saves their API key in Settings replaces the live config for every other user. | Yes (cross-user billing + privacy leak the moment a 2nd user hits AI Tailor) |
| 2 | **Critical** | No admin UI in the frontend. Test users must be provisioned via Render shell or raw API calls with the bootstrap admin's session cookie. | No, but the developer needs to do the provisioning step manually |
| 3 | **High** | The "Generate with AI" path in the setup wizard runs synchronously and can exceed Render's free-tier 60s request budget under cold start. | Possibly — first-time users may see a hang/timeout |
| 4 | **High** | `AUTH_MODE` defaults to `local` in `config.py`. If the Render env var is missing or typo'd, **every** incoming request resolves to the single bootstrap admin and all test users share one account. | Yes if env not set explicitly; render.yaml does set it, but worth verifying live |

Everything else below is either non-blocking or environmental.

---

## 2. New-user path: walkthrough and findings

The path a fresh test user will take:

```
/login  →  /signup (access code required)
        ↓
       POST /auth/signup → cookie set, CSRF returned
        ↓
       /  (root) → SetupService.getStatus()
        ↓
       /setup  (wizard_dismissed=false, master_resume_exists=false)
        ↓
       Welcome → AI Connection → Master Resume → Context Files → Done
        ↓
       /dashboard → Create Application → /applications/[id]
```

### 2.1 What works

- **Signup with access code** (`backend/app/api/v1/auth.py:131`): rate-limited, validates code presence/expiry/use_count, auto-creates `User`, increments `use_count`, sets cookie. Solid.
- **JWT cookie + CSRF flow**: `frontend/src/lib/csrf.ts` plus axios interceptors and `_cookie_kwargs()` correctly produce `SameSite=None; Secure` cookies in cloud mode for cross-origin (Vercel ↔ Render).
- **Setup wizard order** is correct: API key first, then master resume (so the AI generation tab works), then context files.
- **Per-user data scoping** verified across `applications`, `resumes`, `chat`, `interviews`, `credentials`, `questions`, `resume_templates`, `tailor_rules`, `context_files`, `master_resumes`, `tailor_helpers`, `user_settings`. All routes pass `current_user.id` to the service layer; services consistently `where(user_id == ...)`. No cross-user reads found in spot-check.
- **API-key encryption at rest** via Fernet (`encryption_service`), correctly applied to `llm_api_key*` keys in `settings_service._encode_for_write`.
- **Bootstrap admin seeding** (`main.py:_ensure_bootstrap_admin`) refuses to overwrite if any user already exists.

### 2.2 Specific concerns and fixes for new users

1. **Empty master ResumeTemplate stub fails to render**
   - `resume_template_service._read_master_yaml` falls back to `cv:\n  name: Master Resume\nsections: {}\n` when no on-disk file exists.
   - On the public Render deploy `master-resume_CV.yaml` is gitignored, so this stub is what every new user's "Master Resume" template starts as.
   - When they create their first application without first saving their own master resume, the resume editor will load `sections: {}` which RenderCV 2.3 rejects (sections must be a non-empty mapping or omitted). The PDF preview will fail.
   - **Fix:** ship a minimal but renderable starter YAML (e.g. with a one-line `summary` section). Or: gate "Create application" until the user has saved their own master resume.

2. **Setup wizard "Already in folder" tab**
   - The third tab in `MasterResumeStep` instructs users to drop a YAML into `data/` on the host. In cloud mode there is no host; this tab will always say "No master resume found". Cosmetically confusing for testers.
   - **Fix:** hide the "detect" tab when running in cloud mode (frontend can read an env flag, or simpler: drop the tab entirely now that local-mode testers also use the upload tab fine).

3. **AI generation may exceed Render free tier idle/request limits**
   - `POST /setup/generate-resume-yaml` is a single blocking LLM call (up to ~30s for GPT-5 mini) followed by a RenderCV render (5-15s). On a cold-start Render dyno the cumulative time can exceed the 60s default request budget, which presents to the user as a hung wizard.
   - **Mitigation:** UptimeRobot ping (already in DEPLOYMENT.md plan, confirm it's enabled) + show a "this can take up to 30s" hint in the UI.

4. **Setup wizard does not seed a starter `tailor_helper`** for new users (`storage_seed.py` only seeds the bootstrap admin from the on-disk template). Agentic tailor reads/writes this file. First tailor run should auto-create it from the template; verify it does — if not, add the same seed call inside the agent service for any user with no helper row.

5. **`temperature=0.2` is sent to `get_completion` in setup.py:332**
   - This is fine: `_build_payload` discards `temperature` for any reasoning-model prefix (`gpt-5*`, `o1`, `o3`, `o4-mini`). No bug; flagging only because CLAUDE.md rule #1 raised it.

---

## 3. Critical multi-tenant bug: `llm_service` is a process-global singleton

`backend/app/services/llm_service.py` exports a single module-level instance. Every consumer (tailor, agent_tailor, chat, interviews, questions, setup, context_files) imports `from app.services.llm_service import llm_service` and calls into that one instance. The provider, API key, model, base_url, and headers are mutated in place by `settings_service._refresh_llm_service` whenever a user saves their settings.

Concretely:
- User A logs in, saves OpenAI key `sk-A`. The singleton is now `(provider=openai, api_key=sk-A)`.
- User B logs in, saves Gemini key `sk-B`. The singleton is now `(provider=gemini, api_key=sk-B)`.
- User A clicks "Tailor". Their request runs through the singleton → calls **Gemini with sk-B** (User B's account, billed to User B).

This is a **billing leak and a privacy leak** (each user's prompts/resume content go to whichever upstream the singleton currently points at). It will fire the first time two test users are active concurrently.

**Required fix before go-live (one of):**
- (Preferred) Refactor `llm_service` into a per-request factory: `make_llm_client(db, user_id) -> LLMClient`. Pass the client into every service call. Remove the singleton.
- (Quick patch, acceptable for this week) Have every consuming service call `await settings_service._refresh_llm_service(db, current_user.id)` immediately before using `llm_service`. Still not concurrency-safe under load (two simultaneous requests from different users will race), but correct for the small tester pool.

---

## 4. Provisioning the test users: the operational path

There is **no admin UI in the frontend** (verified: nothing imports `/admin/*` endpoints, nothing branches on `is_admin`). All admin actions go through:

- `POST /api/v1/admin/users`              — create a user (any user can be created, no admin-cap restriction)
- `POST /api/v1/admin/access-codes`       — create access codes for self-signup
- `GET /api/v1/admin/users`               — list
- `PATCH /api/v1/admin/users/{id}`        — toggle active, reset password
- `python -m app.cli.manage create-user`  — Render shell only; refuses to create a second `--admin` user

For 2-3 testers there are two viable approaches:

### Option A — Skip the signup flow, create users directly (recommended)

This is the fastest, most controlled path. The developer creates the accounts and shares email + temporary password with each tester.

**Steps:**
1. Confirm Render env vars are set (see §6 checklist below). Confirm the bootstrap admin can log into the live site.
2. Log in to the live frontend as the bootstrap admin. Open DevTools → Application → Cookies, copy the `rm_auth` cookie value. Also grab the CSRF token from a `/auth/csrf` response.
3. From your local machine, for each tester:
   ```bash
   curl -X POST https://<render-host>/api/v1/admin/users \
     -H "Content-Type: application/json" \
     -H "Cookie: rm_auth=<token>" \
     -H "X-CSRF-Token: <csrf>" \
     -d '{"email":"tester1@example.com","password":"<strong-temp-pw>","is_admin":false}'
   ```
4. Send each tester their email + temporary password and the live URL. They log in at `/login` directly (no `/signup`, no access code needed).

Alternatively, run on Render's shell (`Service → Shell`):
```bash
cd backend
python -m app.cli.manage create-user --email tester1@example.com --password <pw>
python -m app.cli.manage create-user --email tester2@example.com --password <pw>
python -m app.cli.manage create-user --email tester3@example.com --password <pw>
python -m app.cli.manage list-users
```

### Option B — Issue access codes, let testers sign up themselves

Useful if you want testers to choose their own passwords.

```bash
# As admin via API:
curl -X POST https://<render-host>/api/v1/admin/access-codes \
  -H "Content-Type: application/json" \
  -H "Cookie: rm_auth=<token>" -H "X-CSRF-Token: <csrf>" \
  -d '{"max_uses":1,"note":"tester1"}'
# Response includes the generated code, e.g. "BETA-XXXX-YYYY".
```
Send the code + live URL to each tester. They go to `/signup`, enter email/password/code.

### Suggested rollout

Use **Option A** for 2-3 invited testers — no signup-form variability, you control the credentials, no email capture issues. Reserve Option B for when you open up beta to a larger group.

---

## 5. Other findings (non-blocking but worth knowing)

### 5.1 Defense-in-depth not implemented
DEPLOYMENT.md §4.5 plans Postgres Row-Level Security as a backstop in case any route forgets `user_id` filtering. **No `middleware/rls.py` exists** and no policies are installed. The route-level filter is the only thing keeping users isolated. Acceptable for 3 testers, but should be added before public beta.

### 5.2 Cookie/CORS coupling is fragile
- The frontend can either talk to Render directly (`NEXT_PUBLIC_API_URL=https://<render>/api/v1`) or via Next.js rewrites (`BACKEND_URL` server-side). The deploy uses the direct cross-origin path (per DEPLOYMENT.md §6). For this to work on the live site:
  - Render env: `APP_URL=https://<vercel-frontend-host>` (allows CORS origin)
  - Render env: `COOKIE_SECURE=true` (already in render.yaml)
  - Vercel env: `NEXT_PUBLIC_API_URL=https://<render-host>/api/v1`
  - Vercel env: should NOT also have `BACKEND_URL` set, or the rewrites will conflict
- If any of these are wrong, login appears to succeed (200 from `/auth/login`) but `/auth/me` fails on the next page navigation because the cookie was rejected. Symptom: infinite redirect to `/login`.

### 5.3 401 retry loop in axios
`frontend/src/lib/axios.ts:39-67` re-checks `/auth/me` on every 401 to distinguish CSRF rotation from real session expiry. The recent commit `84c5271 fix: prevent concurrent 401 session checks` patched a thundering-herd bug here. Looks correct now, but worth a single end-to-end smoke test on the live site.

### 5.4 Render free tier cold starts
60-90s on first request after idle (per DEPLOYMENT.md §7). UptimeRobot needs to actually be configured against `/api/v1/health` on a 5-minute interval, otherwise the first tester to visit on a Monday morning will see a multi-minute hang. Confirm this is set up.

### 5.5 RenderCV subprocess on Render
`rendercv_service` invokes `sys.executable -m rendercv`. `pyproject.toml` pins `rendercv[full]==2.3`. Since both validate-only and full-render paths use `sys.executable`, the venv is consistent. Should work on Render's Python runtime — but **Render free tier has a 512MB memory ceiling** and RenderCV with Typst can spike past that on dense resumes. If a tester's resume is large, the render fails with no clear error. Worth flagging as a known risk; paid tier ($7/mo) eliminates it.

### 5.6 Missing per-user starter content
When a brand-new user finishes the wizard with `wizard_dismissed=true` but skips the master resume, they land on the dashboard, click Create Application, get an editor with the global stub YAML, and get a broken PDF preview (see §2.2 issue #1). Either gate Create Application on `master_resume_exists`, or have the editor surface a clear "Save your master resume first" CTA.

### 5.7 Admin lockout risk
The bootstrap admin seed in `main.py:_ensure_bootstrap_admin` **only seeds when the users table is empty**. If you ever rotate `BOOTSTRAP_ADMIN_EMAIL` to a different value while there are existing users, no new admin is seeded — and there is no UI to promote an existing user to admin (only `PATCH /admin/users/{id}`, which itself requires admin). One person, one path: do not change `BOOTSTRAP_ADMIN_EMAIL` after first deploy without first promoting another user via the API.

---

## 6. Pre-launch checklist

Before sharing credentials with any tester, verify on the **live Render environment**:

- [ ] `AUTH_MODE=cloud` (not "local")
- [ ] `STORAGE_BACKEND=r2`
- [ ] `JWT_SECRET_KEY`, `CSRF_SECRET_KEY`, `ENCRYPTION_KEY` all set to strong random values (NOT the dev defaults). The `_validate_cloud_secrets` startup check will refuse to boot if any are still the placeholder, so a clean boot in the Render logs confirms this.
- [ ] `DATABASE_URL` points to the Neon **pooled** endpoint (`-pooler` in the host).
- [ ] R2 vars (`R2_ACCOUNT_ID`, `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME=resumate-files`).
- [ ] `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD` set; admin actually exists in DB (check `python -m app.cli.manage list-users` from Render shell).
- [ ] `APP_URL` set to the Vercel frontend URL.
- [ ] `COOKIE_SECURE=true`, `COOKIE_DOMAIN` empty (host-only) unless you specifically need a parent domain.
- [ ] `SENTRY_DSN` set if you want error tracking.

On Vercel:

- [ ] `NEXT_PUBLIC_API_URL=https://<render-host>/api/v1`
- [ ] `BACKEND_URL` NOT set (would hijack the same path via Next rewrites)
- [ ] `SENTRY_AUTH_TOKEN` set if Sentry is wanted
- [ ] Latest commit is deployed (the public repo, since both Vercel and Render auto-deploy from `yakuraku/resumate`, not the dev repo)

End-to-end smoke (do this yourself on the live site before sharing):

- [ ] Log in as bootstrap admin → `/dashboard` loads → can create + open an application → AI Tailor produces a valid PDF.
- [ ] Create one throwaway tester via Option A above. Log out. Log in as that tester. Confirm an empty dashboard, run the setup wizard end-to-end including the AI master resume generation. Create one application, run AI Tailor, view PDF.
- [ ] Delete the throwaway tester.

---

## 7. Recommended fixes before sharing credentials (priority order)

1. **Patch the `llm_service` cross-user leak.** Quick mitigation: insert `await settings_service._refresh_llm_service(db, current_user.id)` at the top of every endpoint that subsequently calls `llm_service.*`. Permanent fix: make the LLM client per-request. (See §3.)
2. **Fix the empty master ResumeTemplate stub** so a new user can render their first PDF without first uploading a custom YAML. (See §2.2.1.) Smallest change: stub `sections: {summary: ["Add your professional summary here."]}` in `resume_template_service._read_master_yaml`'s fallback string.
3. **Confirm the env-var checklist in §6 against the live Render and Vercel dashboards.** Specifically `AUTH_MODE=cloud`, `APP_URL`, `NEXT_PUBLIC_API_URL`, and the three secret keys.
4. **Confirm UptimeRobot is pinging `/api/v1/health`** so testers don't catch a 60-90s cold start.
5. **Hide the "Already in folder" tab in the setup wizard for cloud mode.** Cosmetic but confusing.

Once 1-3 are done, Option A in §4 produces working credentials for testers. Items 4-5 improve experience but do not block.

---

## 8. Open questions for the project owner

Before I make any code changes, please confirm:

1. **Live URLs:** what are the exact hostnames? (Vercel frontend + Render backend + R2 bucket endpoint.) I want to verify the env-var checklist against the actual deployment, not my assumptions.
2. **Number and identity of testers:** 2 or 3? Any specific email addresses to provision now?
3. **Provisioning approach:** Option A (admin-creates-credentials) or Option B (access-code self-signup)? My recommendation is A for this small group; please confirm before I script it.
4. **Risk tolerance on the `llm_service` singleton fix:** are you OK with the quick-patch (`_refresh_llm_service` per request) for go-live, or do you want the full refactor to a per-request client now?
5. **Permission to access the live Render shell** if needed (alternative is doing all provisioning via the bootstrap admin's session cookie + the `/admin/*` API).
6. **Should AI tailoring be enabled for testers?** It will burn tokens on whichever LLM key is configured. If yes, whose API key is each tester expected to use — their own (recommended) or a shared developer key (will inflate your bill)?

Awaiting your answers before any code changes go in.
