"""
Agentic resume tailoring service.

The LLM is given a set of tools and iterates until it calls submit_tailored_resume().
Progress events are yielded as dicts for the SSE endpoint to stream to the frontend.

Event shapes:
  {"type": "start", "model": "gpt-5-mini"}
  {"type": "tool_call", "tool": "read_context_file", "args": {"filename": "projects.md"}}
  {"type": "tool_result", "tool": "read_context_file", "summary": "Read 2.3 KB"}
  {"type": "tool_result", "tool": "validate_yaml", "summary": "OK — renders successfully", "ok": True}
  {"type": "tool_result", "tool": "validate_yaml", "summary": "Error: ...", "ok": False}
  {"type": "complete", "yaml_content": "...", "reasoning": "..."}
  {"type": "error", "message": "..."}
"""

import json
from pathlib import Path
from typing import AsyncGenerator

from app.services.llm_service import llm_service
from app.services.prompts import AGENT_SYSTEM_PROMPT
from app.services.rendercv_service import rendercv_service
from app.utils.filesystem import get_context_folder, get_project_root

AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_context_files",
            "description": "Lists all available files in the user's personal context folder (my_info/). Returns filenames and sizes. Call this to understand what context is available before choosing what to read.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_context_file",
            "description": "Reads a specific context file from the user's personal info folder. Use this to get work experience details, project descriptions, skills, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Filename to read, e.g. 'work_experience.md' or 'projects.md'",
                    }
                },
                "required": ["filename"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_tailor_helper",
            "description": "Reads resume-tailor-helper.md which contains RenderCV YAML structure rules, common syntax gotchas, ATS strategies, and learnings from previous tailoring runs. Always call this first.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "validate_yaml",
            "description": "Validates the resume YAML by running it through RenderCV 2.3 (same version used to produce the final PDF). Returns 'OK' if it renders successfully, or an error message describing what went wrong. Always validate before submitting.",
            "parameters": {
                "type": "object",
                "properties": {
                    "yaml_content": {
                        "type": "string",
                        "description": "The complete RenderCV YAML to validate",
                    }
                },
                "required": ["yaml_content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "submit_tailored_resume",
            "description": "Submit the final tailored resume. Call this only after validate_yaml returns OK.",
            "parameters": {
                "type": "object",
                "properties": {
                    "yaml_content": {
                        "type": "string",
                        "description": "The complete tailored and validated RenderCV YAML",
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "A moderate paragraph covering: keyword analysis summary (P1/P2 keywords targeted), which context files were most useful, project selection rationale, key tailoring decisions, and any notable gaps between the candidate's profile and the JD.",
                    },
                },
                "required": ["yaml_content", "reasoning"],
            },
        },
    },
]

MAX_ITERATIONS = 10
# Stop the loop early if validation keeps failing so we don't burn API tokens.
# Resets to 0 on any successful validation.
MAX_CONSECUTIVE_VALIDATION_FAILURES = 3


def _execute_tool(name: str, args: dict, context_dir: Path, helper_path: Path) -> str:
    """Execute a tool synchronously. Returns the tool result as a string."""
    if name == "list_context_files":
        if not context_dir.exists():
            return "Context folder not found."
        files = sorted(context_dir.glob("*.md"))
        if not files:
            return "No context files found."
        lines = []
        for f in files:
            size_kb = f.stat().st_size / 1024
            lines.append(f"- {f.name} ({size_kb:.1f} KB)")
        return "\n".join(lines)

    elif name == "read_context_file":
        filename = args.get("filename", "")
        file_path = context_dir / filename
        if not file_path.exists():
            return f"File not found: {filename}"
        try:
            content = file_path.read_text(encoding="utf-8")
            return content
        except Exception as e:
            return f"Error reading {filename}: {e}"

    elif name == "read_tailor_helper":
        if not helper_path.exists():
            return "resume-tailor-helper.md not found."
        try:
            content = helper_path.read_text(encoding="utf-8")
            return content
        except Exception as e:
            return f"Error reading helper: {e}"

    else:
        return f"Unknown tool: {name}"


async def _execute_tool_async(name: str, args: dict, context_dir: Path, helper_path: Path) -> tuple[str, dict]:
    """
    Execute a tool. validate_yaml is async (runs subprocess).
    Returns (result_string, extra_meta) where extra_meta is used for event enrichment.
    """
    if name == "validate_yaml":
        yaml_content = args.get("yaml_content", "")
        ok, msg = await rendercv_service.validate_yaml(yaml_content)
        if ok:
            return "OK — renders successfully with RenderCV 2.3", {"ok": True}
        else:
            return f"Validation failed:\n{msg}", {"ok": False}
    else:
        result = _execute_tool(name, args, context_dir, helper_path)
        return result, {}


def _append_learning_to_helper(helper_path: Path, reasoning: str, date: str) -> None:
    """Append a brief learning entry to the helper file after each run."""
    try:
        entry = f"\n#### {date}\n{reasoning}\n"
        with open(helper_path, "a", encoding="utf-8") as f:
            f.write(entry)
    except Exception as e:
        print(f"[Agent] Could not write to helper: {e}")


async def run_agentic_tailor(
    resume_yaml: str,
    job_description: str,
    rules: list[str],
    system_prompt: str | None,
    model: str,
) -> AsyncGenerator[dict, None]:
    """
    Runs the agentic tailor loop. Yields progress event dicts.
    The final event is either {"type": "complete", "yaml_content": ..., "reasoning": ...}
    or {"type": "error", "message": ...}.
    """
    context_dir = get_context_folder()
    helper_path = get_project_root() / "resume-tailor-helper.md"

    # Build tailor rules section
    rules_text = ""
    if rules:
        rules_list = "\n".join(f"- {r}" for r in rules)
        rules_text = f"\n\nUser-Defined Tailoring Rules (MUST follow these):\n{rules_list}"

    initial_user_content = (
        f"Please tailor my resume to match the following job description.\n\n"
        f"## Current Resume (YAML)\n```yaml\n{resume_yaml}\n```\n\n"
        f"## Job Description\n{job_description}"
        f"{rules_text}"
    )

    messages = [
        {"role": "system", "content": system_prompt or AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": initial_user_content},
    ]

    yield {"type": "start", "model": model}

    from datetime import date as _date
    today = _date.today().isoformat()

    consecutive_validation_failures = 0
    last_validation_error: str | None = None

    for iteration in range(MAX_ITERATIONS):
        try:
            result = await llm_service.get_completion_with_tools(
                messages=messages,
                tools=AGENT_TOOLS,
                model=model,
                temperature=0.4,
            )
        except Exception as e:
            yield {"type": "error", "message": f"LLM call failed: {str(e)}"}
            return

        finish_reason = result.get("finish_reason")
        message = result.get("message", {})

        # Append assistant message to conversation.
        # Do NOT include keys with None/null values — some providers drop the
        # connection when they see "tool_calls": null or "content": null.
        assistant_msg: dict = {"role": "assistant"}
        content_val = message.get("content")
        tool_calls_val = message.get("tool_calls")
        if content_val is not None:
            assistant_msg["content"] = content_val
        if tool_calls_val:
            assistant_msg["tool_calls"] = tool_calls_val
        messages.append(assistant_msg)

        if finish_reason == "stop" or not message.get("tool_calls"):
            # LLM finished without calling submit — treat content as error
            content = message.get("content") or "Agent stopped without submitting a resume."
            yield {"type": "error", "message": content[:500]}
            return

        # Process tool calls
        tool_calls = message.get("tool_calls", [])
        for tc in tool_calls:
            fn = tc.get("function", {})
            tool_name = fn.get("name", "")
            try:
                args = json.loads(fn.get("arguments", "{}"))
            except json.JSONDecodeError:
                args = {}

            call_id = tc.get("id", f"call_{iteration}")

            # Emit tool_call event (don't include full yaml in args for display)
            display_args = {k: v for k, v in args.items() if k != "yaml_content"}
            if "yaml_content" in args:
                display_args["yaml_content"] = f"[{len(args['yaml_content'])} chars]"
            yield {"type": "tool_call", "tool": tool_name, "args": display_args}

            # Handle submit — this ends the loop
            if tool_name == "submit_tailored_resume":
                yaml_content = args.get("yaml_content", "")
                reasoning = args.get("reasoning", "")
                # Append learning to helper (brief, non-blocking)
                _append_learning_to_helper(helper_path, f"**{today}**: {reasoning}", today)
                yield {"type": "complete", "yaml_content": yaml_content, "reasoning": reasoning}
                return

            # Execute the tool
            tool_result, meta = await _execute_tool_async(tool_name, args, context_dir, helper_path)

            # Build summary for the event
            if tool_name == "list_context_files":
                line_count = tool_result.count("\n") + 1
                summary = f"{line_count} files found"
            elif tool_name == "read_context_file":
                size_kb = len(tool_result.encode()) / 1024
                summary = f"Read {size_kb:.1f} KB"
            elif tool_name == "read_tailor_helper":
                summary = "Helper loaded"
            elif tool_name == "validate_yaml":
                summary = meta.get("ok") and "OK — renders successfully" or tool_result[:120]
            else:
                summary = tool_result[:80]

            event = {"type": "tool_result", "tool": tool_name, "summary": summary}
            event.update(meta)
            yield event

            # --- Validation guardrails ---
            if tool_name == "validate_yaml":
                if meta.get("ok"):
                    consecutive_validation_failures = 0
                    last_validation_error = None
                else:
                    # Detect identical repeated error — agent is not making progress
                    if tool_result == last_validation_error:
                        yield {
                            "type": "error",
                            "message": (
                                f"Agent is repeating the same validation error without making progress. "
                                f"Stopping to avoid wasting tokens.\n\nLast error:\n{tool_result[:600]}"
                            ),
                        }
                        return
                    last_validation_error = tool_result
                    consecutive_validation_failures += 1
                    if consecutive_validation_failures >= MAX_CONSECUTIVE_VALIDATION_FAILURES:
                        yield {
                            "type": "error",
                            "message": (
                                f"Validation failed {consecutive_validation_failures} times in a row. "
                                f"Stopping to avoid burning API tokens.\n\nLast error:\n{tool_result[:600]}"
                            ),
                        }
                        return

            # Append tool result to messages
            messages.append({
                "role": "tool",
                "tool_call_id": call_id,
                "content": tool_result,
            })

    yield {"type": "error", "message": f"Agent reached max iterations ({MAX_ITERATIONS}) without submitting."}


agent_tailor_service_instance = None  # Stateless — just use the module-level function
