# Resume Tailor - Helper Document

> **Purpose:** This document serves as persistent memory for the Resume Tailor agent. It accumulates learnings, solutions to errors, successful patterns, and user preferences across runs.
> 
> **Usage:** The agent reads this at the start of each run and appends new learnings at the end (when applicable).

---

## RenderCV Quick Reference

### Valid YAML Structure
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
    show_last_updated_date: false  # mandatory, remove "Last updated" date from PDF
```

### Common Gotchas
1. **Colons in strings** — Always quote: `"Title: Subtitle"`
2. **Special characters** — Quote strings with `&`, `#`, `*`, etc.
3. **Indentation** — 2 spaces only, never tabs
4. **Dates** — Use `YYYY-MM` format or `"present"`
5. **Empty highlights** — Don't use `highlights: []`, omit the key instead

### Page Content Guidelines
- **1 page** ≈ 400-500 words, 3-4 sections, 3 bullets per entry
- **2 pages** ≈ 800-1000 words, 5-6 sections, 4-5 bullets per entry
- **3 pages** ≈ 1200-1500 words (rarely needed)

---

## Known Issues & Solutions

> *This section will be populated as the agent encounters and solves issues.*

### Template
```markdown
### Issue: {Brief description}
**Date Discovered:** {date}
**Error Message:** {if applicable}
**Root Cause:** {what caused it}
**Solution:** {how to fix}
**Prevention:** {how to avoid in future}
```

---

## Successful Patterns

> *Patterns that have worked well for tailoring resumes.*

### Template
```markdown
### Pattern: {Name}
**Use Case:** {when to use this}
**Implementation:** {how to do it}
**Result:** {what outcome it produces}
```

---

## User Preferences

> *Learned preferences about the user's resume style and content.*

### Template
```markdown
### Preference: {description}
**Learned From:** {which run/context}
**Application:** {how to apply this}
```

---

## ATS Keyword Strategies

### General Best Practices
- Place P1 keywords in: Summary, first bullet of each experience, skills section
- Use exact phrases from job description when user has the skill
- Don't keyword stuff — 2-3 mentions of important terms is sufficient
- Match job title keywords in summary/headline

### Industry-Specific Notes

> *To be populated with learnings about specific industries/roles.*

---

## Run History

> *Brief log of tailoring runs for reference.*

| Date | Company | Role | Page Limit | Notes |
|------|---------|------|------------|-------|
| 2026-01-31 | Monash University | Research Software Engineer | 2 pages | Environmental research focus, full-stack + cloud emphasis |
| *Example* | *Google* | *SWE* | *2 pages* | *First run, tested YAML validation* |

---

## Learnings Log

> *Detailed learnings appended by the agent after each run (when applicable).*

---

*End of helper document. New learnings will be appended below this line.*

---

## Learning - 2026-01-31

**Context:** First production run of resume-tailor agent for Monash University Research Software Engineer position (Environmental Informatics Hub)

**Workflow Execution:** Successfully completed all 10 steps without errors

**Key Insights:**
1. **Academic Research Roles Benefit from Domain-Specific Project Highlighting:**
   - Plantopia project was repositioned as the primary project due to its environmental research alignment
   - Added "Research & Environmental Tech" skills category to signal domain expertise
   - Academic roles value demonstrated passion for the research domain, not just technical skills

2. **Multi-Disciplinary Collaboration is a Distinct Skill:**
   - Research software engineering requires different collaboration patterns than typical SWE roles
   - Emphasized "multi-disciplinary" in MCAV experience to show comfort working with non-software specialists
   - Technical documentation and knowledge transfer are key differentiators

3. **Summary Section Strategy for Research Roles:**
   - Leading with "Research Software Engineer" title signals intentional career focus
   - Explicitly mentioning "sustainability and environmental outcomes" shows mission alignment
   - Research roles value stated passion/motivation more than typical industry roles

4. **Infrastructure Automation Tools:**
   - Job mentioned Ansible/Terraform but candidate lacks direct experience
   - Emphasized Docker, CI/CD, and infrastructure-as-code principles as transferable
   - Noted in reasoning.md as a "gap to address" with mitigation strategy

5. **Cloud Platform Flexibility:**
   - Research environments often have flexibility in technology choices
   - Demonstrated breadth (GCP + AWS) rather than depth in one platform
   - Azure gap is acceptable given demonstrated cloud platform competency

**RenderCV Performance:**
- YAML validated successfully on first render
- No syntax errors encountered
- Output generated in ~20 seconds (normal performance)
- PDF generated successfully at 2 pages (72KB file size)

**Future Guidance:**
- For research/academic roles, prioritize projects with domain alignment over pure technical complexity
- Add "Research & Environmental Tech" or similar domain-specific skill category when applicable
- Emphasize collaboration patterns specific to research environments (multi-disciplinary, knowledge transfer, documentation)
- In summary, explicitly state passion for the research domain/mission

---