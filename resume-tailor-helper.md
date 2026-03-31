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

#### 2026-03-20
**2026-03-20**: I used work_experience.md and Plantopia-main_summary.md as primary sources for technical and project details. I rewrote bullets to match REA Graduate streams by prioritizing TypeScript, cloud-native, full-stack and data engineering keywords and emphasised collaborative, agile and learning-focused summary.

#### 2026-03-21
**2026-03-21**: Used work_experience.md and Plantopia-main_summary.md as primary sources; emphasized full-stack product ownership, AI-native workflows, LLM/RAG experience, cloud/serverless skills, and Melbourne timezone ownership to match the job description; reordered skills to prioritise Full-Stack, Cloud, and LLM keywords for ATS alignment.

#### 2026-03-24
**2026-03-24**: Used work_experience.md, Plantopia-main_summary.md, and teaching_smaller_models_how_to_think_summary.md to extract relevant experience and keywords. Rewrote bullets to emphasize LLM fine-tuning, data curation, coding problem design, code review, and remote flexible work fit. Reordered skills to prioritize Python, TypeScript, LLM toolchain, and model evaluation for ATS alignment.

#### 2026-03-25
**2026-03-25**: I used work_experience.md, Plantopia-main_summary.md, and BirdTag-AWS-main_summary.md to extract QA-relevant tasks, manual testing experience, test automation exposure, and CI/CD/testing tools. I rewrote bullets to match the QA internship JD emphasizing manual testing, edge case thinking, collaboration with engineers and product managers, and openness to learn automation; skills and summary were reordered to prioritize QA keywords.

#### 2026-03-25
**2026-03-25**: Keyword analysis summary: P1 keywords (appearing repeatedly or required) identified from the JD are: "manual testing", "test cases"/"test case design", "edge cases"/"edge case analysis", "regression testing", "collaborate with engineers/product managers" (teamwork/communication), and "QA"/"quality assurance". P2 keywords (important but less repeated): "test automation", "Selenium", "API testing", "performance/load testing", "CI/CD", "acceptance criteria", and "healthcare/clinician-facing product". Implicit P3 signals: curiosity, proactive learning, clear communication, and product-impact focus.

Context files used: projects.md and work_experience.md were primary sources. BirdTag-AWS-main_summary.md and Plantopia-main_summary.md provided project-level details relevant to manual testing, test panels, presigned URL flows, and CI/CD testing. These files contained concrete examples of manual QA practices, API validation, load testing, and cross-team collaboration which map directly to Heidi's QA internship requirements.

Project selection rationale: I kept BirdTag and Plantopia projects because they demonstrate hands-on manual test design, edge-case discovery in multimodal processing, API and upload validation, and CI/CD-supported regression suites. The AWS Serverless project bullets emphasize load testing and release checklists relevant to stability and release support.

Key tailoring decisions: Reordered and renamed skills to lead with QA/Testing and included exact JD phrases such as "manual testing", "test case design", "regression testing", and "edge case analysis" in the skills section, first bullets of experience entries, and project bullets to satisfy ATS rules. Experience bullets were rewritten to emphasize manual testing, test documentation, collaboration with engineers and product managers, and openness to learn automation. Quantified metrics from source files were preserved (e.g., 500K+ records, 1000+ concurrent users, 92% coverage). I avoided using em dashes as requested.

Notable gaps and mitigations: The JD emphasizes healthcare domain experience and clinician-facing products. The candidate has strong ML and production engineering experience but limited explicit healthcare product exposure. To mitigate, I framed test impact in terms of user safety, data quality, and production stability and highlighted collaboration and learning mindset. If the candidate has any clinical coursework or volunteer experience, adding it would strengthen alignment.


#### 2026-03-25
**2026-03-25**: Keyword analysis summary: P1 keywords targeted from the PsiQuantum internship JD were: manual testing, test case design, regression testing, edge case analysis, simulation validation, collaboration with engineers and product teams, and lab operations support. P2 keywords included test automation (Selenium, Locust), API testing, performance and load testing, CI/CD, and technical reporting. Implicit P3 signals addressed: curiosity, clear communication, reproducible research, and documentation skills.

Context files used: projects.md and work_experience.md were read first. I then opened Plantopia-main_summary.md and BirdTag-AWS-main_summary.md for concrete examples of test automation, presigned URL upload validation, load testing, CI/CD, and monitoring. These provided the details needed to position the candidate as a strong fit for lab-oriented software and testing internships.

Project selection rationale: I prioritized Plantopia and BirdTag projects because they demonstrate end-to-end validation of production systems, API and upload flow testing, CI/CD-based regression checks, load testing, and model monitoring. The Spark streaming project was included to show experience with streaming validation, alerting, and reproducible experiment reporting, which maps to data science and data visualisation internship streams.

Key tailoring decisions: I created a dedicated "Testing & Validation" skills category and moved QA-related keywords to the top of the skills list. I rewrote experience bullets to surface manual testing, test case design, regression testing ownership at ADP, and simulation-driven validation at Monash MCAV. Project bullets were rewritten to include exact JD phrases such as "manual testing", "test case design", "regression testing", "edge case analysis", and "simulation validation" while preserving factual accuracy. Quantitative metrics from the original documents were preserved and highlighted for impact. CI/CD, runbooks, and technical reporting were emphasized to show readiness for lab operations and research reporting tasks.

Notable gaps: The JD values prior quantum computing knowledge for some projects. The candidate does not list explicit quantum computing experience in the available context. To mitigate, I emphasized simulation-driven validation, lab operations support, reproducible experiment reporting, and strong cross-disciplinary collaboration. If the candidate has any coursework or small projects in quantum computing or physics, adding them would strengthen alignment.

I followed the mandatory user rule to never use em dash characters anywhere in the resume.

#### 2026-03-25
**2026-03-25**: Keyword analysis summary: P1 keywords from the GHD Graduate JD are: "Software Development", "Data Analytics", "Data Management", "AI", "manual testing", "test case design", "regression testing", "edge case analysis", and "collaboration". P2 keywords include: "API testing", "load testing", "CI/CD", "cloud (GCP/AWS)", and "Spark/ETL". Implicit P3 signals: curiosity, cross-disciplinary collaboration, client-facing communication, and eagerness to learn in a consulting environment.

Context files used: I read projects.md and work_experience.md first, then opened Plantopia-main_summary.md and BirdTag-AWS-main_summary.md because they contained concrete examples of full-stack delivery, API testing, presigned URL flows, serverless deployments, CI/CD, and load testing that map directly to GHD graduate streams in Software Development, Data Analytics and AI.

Project selection rationale: I kept Plantopia and BirdTag as primary projects because they demonstrate cloud-native full-stack development, API design, integrations and testing practices. I included the Spark streaming project to highlight data analytics and ETL strengths which align with GHD Data Analytics and Data Management streams. The Parkinson project shows reproducible analytics and reporting relevant to client-facing consulting work.

Key tailoring decisions: Reordered and renamed skills categories to match GHD streams (Software Development, Data Analytics, AI). Added a Testing & Quality skill category and surfaced exact JD phrases such as "manual testing", "test case design", "regression testing", and "edge case analysis" in the skills and experience first bullets to satisfy ATS placement rules. Rewrote experience bullets to highlight manual testing leadership and collaboration with cross-functional teams and to quantify impact where the source files provided metrics.

Notable gaps and mitigations: The JD is open to students or early career applicants for a 2027 graduate program. The candidate is already in a Master program and has substantial production experience. Gaps include explicit consulting or client-facing project descriptions in Australia; to mitigate I emphasised cross-team collaboration, documentation, and production delivery. I also avoided using em dash characters as requested.
