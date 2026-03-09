# Resume Tailor Helper

> Read this at the start of every tailoring run. It contains RenderCV structure rules, common mistakes, ATS strategies, and learnings from previous runs.

---

## RenderCV 2.3 — YAML Structure Reference

### Valid Structure
```yaml
cv:
  name: "Full Name"
  location: "City, State/Country"
  email: "email@example.com"
  phone: "+1 234 567 8900"  # optional
  website: "https://website.com"  # optional
  social_networks:
    - network: LinkedIn
      username: username
    - network: GitHub
      username: username
  sections:
    Summary:
      - "Your professional summary here"
    Experience:
      - company: "Company Name"
        position: "Job Title"
        location: "City, State"
        start_date: "2022-01"
        end_date: "present"
        highlights:
          - "Achievement 1"
          - "Achievement 2"
    Education:
      - institution: "University"
        area: "Field"
        degree: "Degree Type"
        start_date: "2018-08"
        end_date: "2022-05"
    Projects:
      - name: "Project Name"
        date: "2023"
        highlights:
          - "Description"
        url: "https://github.com/..."
    Skills:
      - label: "Languages"
        details: "Python, JavaScript, etc."
design:
  theme: classic
  page:
    show_last_updated_date: false
```

### Syntax Rules (validate_yaml will catch these)
1. **Colons in strings** — Always quote: `"Title: Subtitle"`
2. **Special characters** — Quote strings with `&`, `#`, `*`, etc.
3. **Indentation** — 2 spaces only, never tabs
4. **Dates** — Use `YYYY-MM` format or `"present"`
5. **Empty highlights** — Omit `highlights: []`, don't include empty arrays
6. **Section names** — Must be capitalized exactly (e.g., `Experience`, not `experience`)

### Page Length Guidelines
- **1 page** ≈ 400–500 words, 3–4 sections, 3 bullets per entry
- **2 pages** ≈ 800–1000 words, 5–6 sections, 4–5 bullets per entry

---

## ATS Keyword Strategy

- Place priority keywords in: Summary, first bullet of each experience entry, Skills section
- Use exact phrases from the JD when the candidate has that skill
- 2–3 mentions of key terms is sufficient — avoid stuffing
- Match job title keywords in the Summary/designation

---

## Tailoring Workflow

1. Call `read_tailor_helper()` — you are doing this now
2. Call `list_context_files()` — see what personal context is available
3. Read relevant files (always read `work_experience.md` if present; read project files relevant to the JD)
4. Draft the tailored YAML using original resume + context + JD
5. Call `validate_yaml(yaml_content)` — fix any errors reported
6. Call `submit_tailored_resume(yaml_content, reasoning)` — only after validation passes

---

## Learnings from Previous Runs

| Date | Company | Role | Key Learnings |
|------|---------|------|---------------|
| 2026-01-31 | Monash University | Research Software Engineer | Academic roles: prioritize domain-aligned projects over pure technical complexity. Lead summary with research mission alignment. Emphasize multi-disciplinary collaboration. |

### Detailed Learnings

#### 2026-01-31 — Monash University Research Software Engineer
- Repositioned Plantopia project as primary (environmental research alignment)
- Added "Research & Environmental Tech" skills category for domain signaling
- For research roles: state passion/motivation explicitly in summary
- Transferable skills (Docker, CI/CD) bridged gaps for Ansible/Terraform requirements
- Demonstrated cloud breadth (GCP + AWS) over depth in one platform

---

*New learnings are appended below after each run.*

#### 2026-03-09
**2026-03-09**: Used work_experience.md, Plantopia-main_summary.md and teaching_smaller_models_how_to_think_summary.md to prioritize LLM, RAG, LoRA and quantization experience. Rewrote bullets to match Binance JD keywords, emphasized end-to-end LLM pipelines, prompt engineering, evaluation and multi-GPU inference while keeping only factual items from provided files.
