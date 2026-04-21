# Resume Tailor Helper

> Read this at the start of every tailoring run. It contains RenderCV structure rules,
> common syntax gotchas, ATS strategies, and learnings from previous runs.
> This file lives in your data/ folder and accumulates personalised learnings over time.

---

## RenderCV 2.3 -- YAML Structure Reference

### Valid Structure
```yaml
cv:
  name: "Full Name"
  location: "City, State/Country"
  email: "email@example.com"
  phone: "+1 234 567 8900"
  website: "https://website.com"
  social_networks:
    - network: LinkedIn
      username: your-username
    - network: GitHub
      username: your-username
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
          - "Achievement 1 with quantified impact"
          - "Achievement 2 with technology and result"
    Education:
      - institution: "University Name"
        area: "Field of Study"
        degree: "Bachelor of Science"
        start_date: "2018-08"
        end_date: "2022-05"
    Projects:
      - name: "Project Name"
        date: "2023"
        highlights:
          - "What the project did and what you built"
          - "Technologies used and impact achieved"
        url: "https://github.com/username/repo"
    Skills:
      - label: "Languages"
        details: "Python, JavaScript, TypeScript, SQL"
design:
  theme: classic
  page:
    show_last_updated_date: false
```

### Syntax Rules (validate_yaml will catch these)
1. **Colons in strings** -- always quote: `"Title: Subtitle"`
2. **Special characters** -- quote strings with `&`, `#`, `*`, etc.
3. **Indentation** -- 2 spaces only, never tabs
4. **Dates** -- use `YYYY-MM` format or `"present"`
5. **Empty highlights** -- omit `highlights: []`, never include empty arrays
6. **Section names** -- must match exactly what is in the input resume

### Page Length Guidelines
- **1 page** -- approx 400-500 words, 3-4 sections, 3 bullets per entry
- **2 pages** -- approx 800-1000 words, 5-6 sections, 4-5 bullets per entry

---

## ATS Keyword Strategy

- Place priority keywords in: Summary, first bullet of each experience entry, Skills section
- Use exact phrases from the JD when the candidate has that skill
- 2-3 mentions of each key term is sufficient -- avoid keyword stuffing
- Match job title keywords in the Summary/designation

---

## Tailoring Workflow

1. Call `read_tailor_helper()` -- you are doing this now
2. Call `list_context_files()` -- see what personal context is available
3. Read relevant files (always read `work_experience.md` if present; read project files relevant to the JD)
4. Draft the tailored YAML using original resume + context + JD
5. Call `validate_yaml(yaml_content)` -- fix any reported errors
6. Call `submit_tailored_resume(yaml_content, reasoning)` -- only after validation passes

---

## Keyword to Context File Routing

When P1 or P2 keywords from the JD match skills in your context files, read those files
before writing YAML. This section is personalised as the agent learns your background.

Add entries here using this format as you discover which files cover which skills:

| JD Keywords | File to read |
|---|---|
| (Add entries as you tailor resumes -- the agent will append these over time) | |

---

## Learnings from Previous Runs

New learnings are appended here automatically after each tailoring run.

| Date | Company | Role | Key Learnings |
|------|---------|------|---------------|
| (No runs yet -- learnings will appear here after your first tailoring session) | | | |
