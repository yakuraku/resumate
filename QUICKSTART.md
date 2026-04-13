# ResuMate — Quick Start Guide

ResuMate is an AI-powered job application tracker with resume tailoring.
This guide gets you from zero to running in under 10 minutes.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- At least one LLM API key (OpenAI, OpenRouter, or Google Gemini)

---

## Step 1 — Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/ResuMate.git
cd ResuMate
```

---

## Step 2 — Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in at least one API key:

```env
# Pick one (or more):
OPENAI_API_KEY=sk-proj-...
OPENROUTER_API_KEY=sk-or-...
GEMINI_API_KEY=AIza...
```

Everything else can stay as-is for a local setup.

---

## Step 3 — Add your master resume

```bash
cp master-resume_CV.yaml.example master-resume_CV.yaml
```

Edit `master-resume_CV.yaml` and replace the example content with your real
name, contact details, work experience, projects, and skills.

This file is your "source of truth" resume — all tailored versions are
generated from it. The more detail you add, the better the AI tailoring.

> This file is git-ignored and will never be committed to the repo.

---

## Step 4 — (Optional) Add personal context for better tailoring

The `my_info/` folder holds extra context the AI agent reads when tailoring
your resume. Copy the example files and fill them in:

```bash
cp my_info/work_experience.md.example my_info/work_experience.md
cp my_info/projects.md.example        my_info/projects.md
cp my_info/additional_info.md.example my_info/additional_info.md
```

These files unlock the agentic tailoring mode — the AI reads them to write
richer, more targeted resume bullets. All three are git-ignored.

---

## Step 5 — Start the app

```bash
docker compose up --build
```

The first build takes 2–4 minutes (downloads base images, installs dependencies).
Subsequent starts are fast.

Once you see `Application startup complete` in the logs, open:

**http://localhost:1235**

> To run in the background: `docker compose up --build -d`
> To stop: `docker compose down`

---

## Step 6 — Finish setup in the UI

1. Go to **Settings → AI & Resume**
2. Select your LLM provider and model
3. Click **Test Connection** — you should see a green checkmark
4. Optionally set a **default tailoring mode** (Agentic is recommended)

---

## Step 7 — Create your first application

1. Click **New Application** on the dashboard
2. Enter the company name, role, and job description
3. Open the application → click **AI Tailor Resume**
4. Watch the agent read your context and generate a tailored resume
5. Download the PDF or save it to a folder (configure in **Settings → Data**)

---

## Data & Persistence

All your data lives in the `data/` folder (created automatically on first run):

```
data/
  resumate.db              # SQLite database (all applications, versions, settings)
  tailored_resumes/        # Generated PDF files
  resume-tailor-helper.md  # AI agent's growing knowledge base (auto-created)
```

The `data/` folder is git-ignored. Back it up if you want to preserve your history.

---

## Changing the Port

The app runs on port **1235** by default. To change it:

```bash
FRONTEND_PORT=8080 docker compose up
```

Or set `FRONTEND_PORT=8080` in a `.env` file at the project root.

---

## PDF Save-to-Folder (optional)

By default, PDFs are downloaded through the browser.

To save PDFs directly to a folder on your host machine:

1. Edit `docker-compose.yml` and add a volume under the `backend` service:
   ```yaml
   volumes:
     - ./data:/app/data
     - ./my_info:/app/my_info
     - ./master-resume_CV.yaml:/app/master-resume_CV.yaml:ro
     - /path/to/your/save/folder:/app/pdf_output   # add this line
   ```
2. Go to **Settings → Data → PDF Downloads**
3. Enable "Save to folder" and set the path to `/app/pdf_output`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 1235 already in use | Set `FRONTEND_PORT=8080` (or any free port) |
| "Master resume not found" warning | Ensure `master-resume_CV.yaml` exists at project root |
| AI Tailor returns an error | Check Settings → AI & Resume → Test Connection |
| PDF generation hangs | RenderCV takes 5–15 s on first run; wait for it |
| Container won't start | Run `docker compose logs backend` to see the error |

---

## Updating

```bash
git pull
docker compose up --build
```

Your data in `data/` is preserved — `docker compose up --build` only rebuilds
the app images, it does not touch the volume.
