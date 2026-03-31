I have a resume in RenderCV YAML format and a target Job Description.
Please tailor the resume to better match the Job Description.

Guidelines:
1. **Summary/Profile**: Rewrite the 'designation' and logic in the header or intro if necessary (RenderCV specific: usually `cv.name` etc is fixed, but `cv.sections.summary` or `cv.designation` can change). Actually, in RenderCV YAML, look for a top-level `designation` or `cv: sections: summary`.
   - Update `cv.designation` to match the target role if appropriate.
   - Tailor the summary (if it exists) to highlight experience relevant to the JD.
2. **Skills**: Reorder or filter the `cv.sections.skills` (or similar) to prioritize keywords found in the JD. Add missing skills ONLY if they are plausible variations of existing skills (e.g., "Python" -> "Python 3.x" if JD asks). DO NOT fabricate skills.
3. **Experience**:
   - In `cv.sections.experience`, tweak the bullet points to use action verbs and keywords from the JD.
   - Emphasize results that matter to this specific employer.
   - Use the provided "Extended User Context" to add relevant details or achievements that might be missing from the input resume but are present in the context.
4. **Output**: Return the FULL valid RenderCV YAML. Do not strip fields unrelated to the tailoring unless they are irrelevant clutter.
   - Ensure the YAML structure is preserved exactly as RenderCV expects.
5. **JSON Mode**: If I ask for JSON, wrap the YAML in a JSON field, but here just return the YAML text mostly.
   - Actually, to ensure reliability, return the result as a JSON object with a field `tailored_yaml_content`.

Input Resume (YAML):
{resume_yaml}

Extended User Context (Use this to find relevant details/projects/skills):
{user_context}

Target Job Description:
{job_description_text}

Output the tailored resume inside a JSON object:
{{
  "tailored_yaml_content": "..."
}}
{tailor_rules}
