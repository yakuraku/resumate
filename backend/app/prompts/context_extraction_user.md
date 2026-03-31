Analyze the following text and extract key information to store in the User Context.
Ignore irrelevant details. Focus on facts that are useful for job applications and interview prep.

Input Text:
{input_text}

Output Requirements:
Return a JSON object with a list of items.
Each item must have:
- "key": A unique identifier (snake_case), e.g., "years_of_experience", "primary_tech_stack", "salary_expectation".
- "value": The content string.
- "category": One of ["personal", "professional", "preferences", "skills"].
- "description": A brief description of what this key represents.

Example:
{{
  "items": [
    {{
      "key": "years_of_experience",
      "value": "8 years",
      "category": "professional",
      "description": "Total professional experience"
    }},
    {{
      "key": "preferred_locations",
      "value": "Remote, New York, London",
      "category": "preferences",
      "description": "Locations willing to work in"
    }}
  ]
}}
