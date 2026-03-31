Generate {num_questions} interview questions for a {interview_type} interview.
The questions should probe the candidate's fit for the following role, considering their background.

Job Description:
{job_description}

Candidate Resume:
{resume_content}

Output the questions as a JSON object with a list of strings under the key "questions".
Example:
{{
  "questions": [
    "Tell me about your experience with Python.",
    "Describe a challenging project you worked on."
  ]
}}
