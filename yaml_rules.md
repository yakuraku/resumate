# Master Resume YAML Rules

This document lists **every rule** you must follow when writing or editing your
master resume (or any resume template) in ResuMate. The resume is stored as a
YAML file and rendered to a PDF by **RenderCV v2.3**. If any rule is broken, the
PDF will fail to render and you will see an error in the editor.

The single most common mistake is the **colon-space rule** (Rule 2.1). Read that
one first.

---

## 0. How the file is processed

1. You type YAML in the editor.
2. When you preview or save, the YAML text is parsed into data.
3. RenderCV validates that data against its schema (v2.3).
4. If validation passes, a PDF is produced. If it fails, RenderCV returns an
   error table that the editor shows you (you can copy it for debugging).

Two different things can go wrong:

- **YAML syntax / parsing** errors: the text is not valid YAML, or it parses
  into the wrong shape (a string silently becomes a key-value pair). See
  Section 2.
- **Schema validation** errors: the YAML is valid, but a field is missing,
  misspelled, has the wrong type, or an entry does not match its section type.
  See Sections 3 to 8.

---

## 1. File structure (top-level keys)

The file has up to four top-level keys. Only `cv` is practically required for a
usable resume.

```yaml
cv:        # your content (name, contact, sections). Required.
design:    # theme and layout. Optional (defaults to "classic").
locale:    # language and date words. Optional.
rendercv:  # render settings. Optional.
```

Rules:

1.1. `cv`, `design`, `locale`, and `rendercv` must be at the **far left margin**
(column 0), with no indentation.

1.2. Do **not** invent other top-level keys. Unknown top-level keys are rejected.

1.3. The first line may be a schema comment. It is optional and is ignored by the
renderer, but keep it for editor autocompletion:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/rendercv/rendercv/refs/tags/v2.3/schema.json
```

---

## 2. YAML syntax rules (read these carefully)

These are general YAML rules, but they are the rules that break resumes most
often. RenderCV cannot fix them for you because the broken text is still
"valid" YAML, just not the shape it expects.

### 2.1. Colon-space turns text into a key-value pair (MOST IMPORTANT)

Inside an unquoted value, a colon **followed by a space** (`: `) is read as a
mapping separator, not as plain text. This silently turns a single bullet string
into a key-value pair and breaks the render.

WRONG (this becomes `{ "Shipped two deployment paths": "a local stack and a cloud stack" }`):

```yaml
highlights:
  - Shipped two deployment paths: a local stack and a cloud stack
```

RIGHT (quote the whole value so the colon is treated as text):

```yaml
highlights:
  - "Shipped two deployment paths: a local stack and a cloud stack"
```

Also acceptable: remove the colon, or write it without a trailing space
(`paths:a` is fine but reads badly). The cleanest fix is always to wrap the line
in double quotes.

Rule: **Any value that contains a colon-space (`: `) must be wrapped in quotes.**
This applies to highlights, summaries, names, titles, locations, coursework
lines, and every other free-text value.

### 2.2. Other characters that require quoting

Wrap the value in quotes if it **starts with** any of these characters, or
contains them in a way that confuses the parser:

- `:` colon (anywhere it is followed by a space, see 2.1)
- `#` hash. A space followed by `#` starts a comment, so `5 # of teams` loses
  everything from `#` onward. Quote it: `"5 # of teams"`.
- `-` a dash followed by a space at the start (`- text`) starts a new list item.
- `@`, `` ` ``, `%`, `&`, `*`, `!`, `|`, `>`, `?`, `{`, `}`, `[`, `]`, `,` at the
  **start** of a value.
- Quotes themselves (`"` or `'`) inside a value (see 2.4).

When in doubt, quote the value. Quoting never hurts.

### 2.3. Values that look like booleans, numbers, or null

Unquoted `yes`, `no`, `true`, `false`, `on`, `off`, `null`, `~`, `Y`, `N` are
read as booleans or null, not as text. If you mean the literal word, quote it:

```yaml
details: "No"          # the string "No", not the boolean false
```

A value like `3.0` is read as a number. If you need it as text (for example a
version), quote it: `"3.0"`.

### 2.4. Quoting rules: single vs double quotes

- **Double quotes** (`"..."`) allow escapes like `\n` and are the safest default.
- **Single quotes** (`'...'`) treat everything literally. To put a single quote
  inside a single-quoted value, double it: `'O''Brien'`.
- If a value contains a double quote, either use single quotes around it or
  escape the inner quote: `"She said \"hi\""`.
- A value that starts with a quote character must be quoted.

### 2.5. Indentation

- Use **spaces only. Never use the Tab key.** A literal tab character is a YAML
  syntax error.
- Indentation must be **consistent**. The convention in this project is **2
  spaces per level**. Nested items add 2 more spaces.
- List items (`-`) under a key must be indented further than the key.

### 2.6. List items and mappings

- A list item begins with `- ` (dash, then a space).
- A key-value pair is `key: value` (colon, then a space).
- Do not mix list items and key-value pairs at the same indentation under one
  key.

### 2.7. No empty (null) values where text is expected

- A list entry cannot be empty / null. `- ` on its own line creates a null item
  and is rejected.
- Do not leave a required field blank. Either give it a value or remove the line
  entirely (optional fields fall back to their default when removed).

### 2.8. Special characters in text are fine once quoted

`%`, `&`, `$`, `+`, `/`, parentheses `()`, and accented letters are all allowed
inside text. Quote the value if it also trips one of the rules above. Markdown
is supported in text (see Section 7).

---

## 3. The `cv` section

```yaml
cv:
  name: Your Name
  location: City, Country
  email: you@example.com
  phone: '+61 451 035 604'
  website: https://example.com
  social_networks:
    - network: LinkedIn
      username: your-handle
  sections:
    ...
```

Rules for each `cv` field:

3.1. `name` (optional but expected): a string. Quote it if it contains a colon
or other special character.

3.2. `location` (optional): a string.

3.3. `email` (optional): must be a **valid email address** (for example
`you@example.com`). An invalid email is rejected.

3.4. `phone` (optional): must be a **valid international phone number including
the country code**, for example `'+61 451 035 604'`. Because it starts with `+`,
**wrap it in quotes**. A number without a country code is rejected.

3.5. `website` (optional): must be a **full URL including `https://`**, for
example `https://www.example.com`. A bare `example.com` is rejected.

3.6. `photo` (optional): a path to an image relative to the file. Leave this out
unless you are providing an image file.

3.7. `social_networks` (optional): a list of network entries. See Section 4.

3.8. `sections` (optional but expected): a mapping of section titles to lists of
entries. See Section 5.

3.9. `sort_entries` (optional): one of `reverse-chronological`, `chronological`,
or `none`. Defaults to `none`.

3.10. Do not add unknown fields directly under `cv` other than the ones above.
RenderCV allows extra keys here but they are ignored, so a typo such as `emial`
will silently drop your email.

---

## 4. Social networks

```yaml
social_networks:
  - network: LinkedIn
    username: your-handle
  - network: GitHub
    username: your-handle
```

4.1. Each item needs exactly two fields: `network` and `username`.

4.2. `network` must be **one of these exact values** (case-sensitive):

`LinkedIn`, `GitHub`, `GitLab`, `IMDB`, `Instagram`, `ORCID`, `Mastodon`,
`StackOverflow`, `ResearchGate`, `YouTube`, `Google Scholar`, `Telegram`,
`Leetcode`, `X`.

Any other value (for example `Twitter`, `Portfolio`, `Email`) is rejected. Use
the `website` field for a personal site.

4.3. `username` is just the handle. The full URL is generated automatically, so
do **not** paste a full URL. For LinkedIn use `your-handle`, not
`linkedin.com/in/your-handle`.

4.4. Format requirements for specific networks:

- **LinkedIn / GitHub / GitLab / Instagram / Telegram / Leetcode / X / Google
  Scholar / ResearchGate**: the plain handle.
- **YouTube**: the handle **without** a leading `@`.
- **Mastodon**: must be `@username@domain` (for example `@me@mastodon.social`).
- **StackOverflow**: must be `user_id/username` (for example `12345/jane`).
- **ORCID**: must be `XXXX-XXXX-XXXX-XXX` (digits, last char may be `X`).
- **IMDB**: must be `nmXXXXXXX` (the letters `nm` then 7 digits).

---

## 5. Sections and entry types (the big one)

`sections` is a mapping. Each **key** is a section title; each **value** is a
**list of entries**.

```yaml
sections:
  experience:
    - company: ...
      position: ...
  skills:
    - label: ...
      details: ...
```

5.1. The section title (the key) becomes the heading in the PDF. Underscores
become spaces and the title is capitalized, so `work_experience` renders as
"Work Experience". You can name sections anything (`experience`, `skills`,
`projects`, `education`, `publications`, `certifications`, etc.).

5.2. Every section value **must be a list** (each item starts with `- `). A
section that is not a list is rejected.

5.3. **All entries in one section must be the same entry type.** RenderCV looks
at the first usable entry to decide the section's type, then requires every other
entry in that section to match it. You cannot mix, for example, an
`ExperienceEntry` and a `OneLineEntry` in the same section. Put different shapes
in different sections.

5.4. An entry is identified by the **fields it contains**. Each entry type has
one or more identifying fields. Include exactly the identifying field(s) of the
type you want, plus that type's optional fields. The types are below.

### Entry types and their fields

**TextEntry** (a plain string, for a paragraph or a single bullet)

```yaml
sections:
  summary:
    - A short paragraph written as a plain quoted string.
```

- The entry is just a string. No fields. Quote it if it contains a colon-space.

**OneLineEntry** (identified by `label` + `details`) - used for skills

```yaml
- label: Languages
  details: Python, Java, TypeScript
```

- `label` (required): string.
- `details` (required): string.

**BulletEntry** (identified by `bullet`)

```yaml
- bullet: A single bullet point.
```

- `bullet` (required): string.

**NumberedEntry** (identified by `number`) and **ReversedNumberedEntry**
(identified by `reversed_number`)

```yaml
- number: A numbered list item.
```

- `number` or `reversed_number` (required): string.

**NormalEntry** (identified by `name`) - used for projects

```yaml
- name: Project Name
  date: '2024-01'            # optional
  start_date: 2023-01        # optional
  end_date: 2023-06          # optional
  location: Remote           # optional
  summary: One-line summary. # optional
  highlights:                # optional
    - First achievement.
    - Second achievement.
```

- `name` (required): string.
- All other fields optional (see Sections 6 and 7).

**ExperienceEntry** (identified by `company` + `position`) - used for work
experience

```yaml
- company: Acme Corp
  position: Software Engineer
  start_date: 2022-01
  end_date: 2024-02
  location: Sydney, Australia   # optional
  summary: ...                  # optional
  highlights:                   # optional
    - ...
```

- `company` (required): string.
- `position` (required): string.
- `date`, `start_date`, `end_date`, `location`, `summary`, `highlights`:
  optional.

**EducationEntry** (identified by `institution` + `area`) - used for education

```yaml
- institution: Monash University
  area: Data Science
  degree: Master           # optional
  grade: 'GPA: 3.9/4.0'    # optional, note the quotes (colon-space)
  start_date: 2024-02
  end_date: 2025-12
  location: Clayton, Australia  # optional
  highlights:                   # optional
    - ...
```

- `institution` (required): string.
- `area` (required): string.
- `degree` (optional): string such as `BS`, `MS`, `PhD`, `Master`.
- `grade` (optional): string. Almost always contains a colon, so **quote it**.
- `date`, `start_date`, `end_date`, `location`, `summary`, `highlights`:
  optional.

**PublicationEntry** (identified by `title` + `authors`)

```yaml
- title: Paper Title
  authors:
    - Jane Doe
    - John Smith
  doi: 10.48550/arXiv.2310.03138   # optional
  url: https://example.com/paper   # optional, ignored if doi is set
  journal: Journal Name            # optional
  date: 2023-10                    # optional
```

- `title` (required): string.
- `authors` (required): a **list** of strings.
- `doi` (optional): must start with `10.`.
- `url` (optional): full URL. Ignored if `doi` is given.
- `journal` (optional): string.

5.5. Common entry mistakes:

- Misspelling an identifying field (`comapny` instead of `company`) means
  RenderCV cannot detect the type, or detects the wrong type, and rejects the
  section.
- Forgetting a required field (an `ExperienceEntry` with `company` but no
  `position`) fails validation.
- Mixing types in one section (Rule 5.3).
- Putting a field on the wrong type (for example `highlights` on a
  `PublicationEntry`, which does not support it). Extra keys are ignored on some
  types and rejected on others, so do not rely on them.

---

## 6. Date rules

Dates appear as `date`, `start_date`, and `end_date` on the entry types that
support them.

6.1. Accepted formats for `start_date` and `end_date`:

- `YYYY-MM-DD` (for example `2024-03-15`)
- `YYYY-MM` (for example `2024-03`)
- `YYYY` (for example `2024`)
- `end_date` may also be the literal `present` (quote it or not, both work) to
  mean ongoing.

6.2. The `date` field (single-date entries like projects and publications)
accepts the three numeric formats above **or** an arbitrary string such as
`Fall 2023` or a markdown link. Quote arbitrary strings.

6.3. If you give only `start_date` and no `end_date`, the entry is treated as
ongoing (`present`).

6.4. `start_date` must **not** be after `end_date`. This is checked and rejected.

6.5. If you provide `date`, it takes priority and any `start_date` / `end_date`
are ignored.

6.6. A four-digit year written without quotes is read as a number, which is fine
for dates. Do not write a partial date like `2024-3` (use `2024-03`).

---

## 7. Highlights, summaries, and markdown

7.1. `highlights` is a **list of strings**. Each item starts with `- `.

```yaml
highlights:
  - "Built X, achieving Y: a measurable result."   # quoted: contains colon-space
  - Reduced runtime by 60 percent.
```

7.2. The colon-space rule (2.1) is the number one cause of broken highlights.
**Quote any highlight that contains a colon-space.**

7.3. `summary` is a single string, not a list.

7.4. Markdown is supported inside text fields:

- `**bold**`, `*italic*`
- links: `[label](https://example.com)`
- A literal `- ` inside a highlight creates a nested sub-bullet, so avoid stray
  ` - ` unless you want a nested bullet.

7.5. Do not leave a highlight item empty (Rule 2.7).

---

## 8. The `design` section

```yaml
design:
  theme: sb2nov
  page:
    show_last_updated_date: false
```

8.1. `theme` (optional) must be one of the built-in themes:

`classic`, `sb2nov`, `moderncv`, `engineeringclassic`, `engineeringresumes`.

Any other name is treated as a custom theme and requires theme files that this
project does not ship, so it will fail. Stick to the list above.

8.2. `page.show_last_updated_date` is a valid field in v2.3. If you upgrade
RenderCV later, this field was renamed, so keep the app on v2.3.

8.3. Other `design` options (colors, fonts, spacing) exist but are theme-specific.
If you do not need them, leave `design` with just `theme`, or omit `design`
entirely to use the default theme.

---

## 9. The `locale` section (optional)

```yaml
locale:
  language: en
```

9.1. `language` (optional): a language code such as `en`.

9.2. You can override the words used for months and the "present" label here.
Leave it out unless you need to.

---

## 10. Known-good minimal template

Copy this as a safe starting point. It renders without errors.

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/rendercv/rendercv/refs/tags/v2.3/schema.json
cv:
  name: Your Name
  location: City, Country
  email: you@example.com
  phone: '+61 400 000 000'
  website: https://www.example.com
  social_networks:
    - network: LinkedIn
      username: your-handle
    - network: GitHub
      username: your-handle
  sections:
    skills:
      - label: Languages
        details: Python, Java, TypeScript
    experience:
      - company: Acme Corp
        position: Software Engineer
        start_date: 2022-01
        end_date: present
        location: Sydney, Australia
        highlights:
          - "Delivered feature X, cutting load time: from 5s to 1s."
          - Led a team of 4 engineers.
    education:
      - institution: Example University
        area: Computer Science
        degree: Master
        start_date: 2020-02
        end_date: 2021-12
        location: City, Country
        highlights:
          - "Relevant coursework: Machine Learning, Databases, Networks."
design:
  theme: sb2nov
  page:
    show_last_updated_date: false
locale:
  language: en
```

---

## 11. Quick pre-save checklist

Before you save, check:

- [ ] No Tab characters anywhere (spaces only, 2 per level).
- [ ] Every value that contains a colon-space (`: `) is wrapped in quotes.
- [ ] `phone` starts with `+` and is quoted; `email` is a real address;
      `website` starts with `https://`.
- [ ] Each `social_networks.network` is one of the allowed names; `username` is a
      handle, not a URL.
- [ ] Every section is a list; all entries in a section are the same type.
- [ ] Each entry has its required identifying field(s) spelled correctly.
- [ ] Dates use `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`; `start_date` is not after
      `end_date`.
- [ ] No empty list items (`- ` on its own line).
- [ ] `design.theme` is one of the five built-in themes.

If the render still fails, the editor shows the exact RenderCV error. Read the
**Location** column (for example `cv.sections.projects.1.highlights.4`): it
points to the section, the entry number (starting at 0), and the field that is
wrong. Copy the full error if you need to investigate further.
