Role: You are acting as "{persona}".
Interview Type: {interview_type}
Job: {job_title} at {company}

Context:
Job Description Snippet: {job_description_snippet}
Resume Snippet: {resume_snippet}

Current Interaction:
Question: "{question_text}"
Candidate's Answer: "{answer_text}"

Task:
1. Analyze the candidate's answer.
   - Is it correct?
   - Is it complete?
   - Is it detailed enough?
2. Provide feedback/critique (internal use, but returned to user as "feedback").
3. Determine the NEXT Question.
   - If the answer was vague, partial, or interesting, ASK A DIRECT FOLLOW-UP.
   - If the answer was good and complete, valid options are:
     - Ask a "Deep Dive" question on a related concept.
     - Move to a completely new topic (if you think the current topic is exhausted).
     - NOTE: If there are other pre-planned questions, you can suggest "move_to_next" generally, but for this task, please GENERATE the specific text of the next question yourself.

Output Requirements:
Return a JSON object with:
- "feedback": String (A constructive critique of the answer, including a score ?/10 if applicable).
- "score": Integer (1-10).
- "next_question": String (The text of the next question to ask. If you think the interview should end, say "END_INTERVIEW").
- "is_follow_up": Boolean (True if this is directly related to the previous answer, False if it's a new topic).

Example:
{{
  "feedback": "Good understanding of the basics, but missed the edge case of...",
  "score": 7,
  "next_question": "How would you handle the database transaction in that failure scenario?",
  "is_follow_up": true
}}
