
import json
import re
from typing import Dict, Any, Optional

from app.services.llm_service import llm_service
from app.services.prompts import (
    JOB_PARSING_SYSTEM_PROMPT,
    JOB_PARSING_USER_PROMPT_TEMPLATE,
    JOB_ANALYSIS_WITH_RESUME_SYSTEM_PROMPT,
    JOB_ANALYSIS_WITH_RESUME_USER_PROMPT_TEMPLATE,
    RESUME_TAILORING_SYSTEM_PROMPT,
    RESUME_TAILORING_USER_PROMPT_TEMPLATE
)

class TailorService:
    @staticmethod
    def _clean_json_response(response: str) -> str:
        """Helper to extract JSON from markdown code blocks if present."""
        response = response.strip()
        if "```json" in response:
            match = re.search(r"```json\s*(.*?)\s*```", response, re.DOTALL)
            if match:
                return match.group(1)
        elif "```" in response:
             match = re.search(r"```\s*(.*?)\s*```", response, re.DOTALL)
             if match:
                return match.group(1)
        return response

    async def parse_job_description(self, job_text: str) -> Dict[str, Any]:
        """
        Analyzes the job description and returns structured data with keywords and summary.
        """
        messages = [
            {"role": "system", "content": JOB_PARSING_SYSTEM_PROMPT},
            {"role": "user", "content": JOB_PARSING_USER_PROMPT_TEMPLATE.format(job_description_text=job_text)}
        ]

        response = await llm_service.get_completion(
            messages=messages,
            temperature=0.2,
            max_tokens=3000,
            json_mode=True
        )

        try:
            json_str = self._clean_json_response(response)
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            print(f"Error parsing JD JSON: {e}")
            return {
                "error": "Failed to parse analysis results",
                "raw_response": response,
            }

    async def analyze_job_with_resume(self, job_text: str, resume_yaml: str) -> Dict[str, Any]:
        """
        Analyzes job description AND computes match scores against the resume.
        Returns categorized keywords with in_resume flags and overall/category scores.
        """
        # Step 1: Parse JD
        jd_analysis = await self.parse_job_description(job_text)
        if "error" in jd_analysis:
            return jd_analysis

        # Step 2: Match against resume
        messages = [
            {"role": "system", "content": JOB_ANALYSIS_WITH_RESUME_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": JOB_ANALYSIS_WITH_RESUME_USER_PROMPT_TEMPLATE.format(
                    jd_analysis_json=json.dumps(jd_analysis, indent=2),
                    resume_yaml=llm_service.truncate_text(resume_yaml, 2000),
                )
            }
        ]

        response = await llm_service.get_completion(
            messages=messages,
            temperature=0.1,
            max_tokens=3000,
            json_mode=True
        )

        try:
            json_str = self._clean_json_response(response)
            matched = json.loads(json_str)
            # Merge with original analysis data
            jd_analysis.update(matched)
            return jd_analysis
        except json.JSONDecodeError as e:
            print(f"Error parsing JD match JSON: {e}")
            # Return JD analysis without match scores as fallback
            return jd_analysis

    async def tailor_resume(self, resume_yaml: str, job_text: str, rules: list[str] | None = None, system_prompt: str | None = None) -> str:
        """
        Tailors the resume YAML to match the job description.
        Returns the new YAML string.
        """
        # Load user context from configured context folder
        from app.utils.filesystem import get_context_folder, get_project_root

        context_parts = []
        try:
            context_dir = get_context_folder()
            if context_dir.exists():
                for file_path in sorted(context_dir.glob("*.md")):
                    content = file_path.read_text(encoding="utf-8")
                    context_parts.append(f"### {file_path.stem}\n{content}")
        except Exception as e:
            print(f"Error loading context folder: {e}")

        # Load resume-tailor-helper.md (separate system prompt helper)
        try:
            helper_path = get_project_root() / "resume-tailor-helper.md"
            if helper_path.exists():
                content = helper_path.read_text(encoding="utf-8")
                context_parts.append(f"### resume-tailor-helper\n{content}")
        except Exception as e:
            print(f"Error loading helper: {e}")

        user_context = "\n\n".join(context_parts)

        # Build tailor rules section
        tailor_rules_text = ""
        if rules:
            rules_list = "\n".join(f"- {r}" for r in rules)
            tailor_rules_text = f"\n\nUser-Defined Tailoring Rules (MUST follow these):\n{rules_list}"
            print(f"[Tailor] Injecting {len(rules)} tailor rules into prompt")

        messages = [
            {"role": "system", "content": system_prompt or RESUME_TAILORING_SYSTEM_PROMPT},
            {"role": "user", "content": RESUME_TAILORING_USER_PROMPT_TEMPLATE.format(
                resume_yaml=resume_yaml,
                job_description_text=job_text,
                user_context=user_context,
                tailor_rules=tailor_rules_text
            )}
        ]
        
        response = await llm_service.get_completion(
            messages=messages,
            temperature=0.4, # Balanced creativity/precision
            json_mode=True
        )
        
        try:
            json_str = self._clean_json_response(response)
            data = json.loads(json_str)
            tailored_content = data.get("tailored_yaml_content", "")
            if not tailored_content:
                 # fallback to raw if key missing but valid json?
                 return json_str
            return tailored_content
            
        except json.JSONDecodeError:
            # If JSON parsing fails, check if the response itself looks like YAML
            # often LLMs might just return the YAML if they ignore the JSON instruction
            cleaned_resp = self._clean_json_response(response) # In case it was wrapped in ```yaml
            if "cv:" in cleaned_resp or "name:" in cleaned_resp:
                return cleaned_resp
            
            print(f"Error parsing Tailoring JSON: {response[:100]}...")
            return resume_yaml # Return original on failure as fallback (or raise error)

tailor_service = TailorService()
