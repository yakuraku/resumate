import subprocess
import shutil
import tempfile
import uuid
import sys
import os
from pathlib import Path


# Fields under design.page that were valid in one RenderCV major version but
# removed or renamed in another. We're pinned to 2.3 (see pyproject.toml), so
# today this map is empty: `show_last_updated_date` is a valid 2.3 field and
# passes through unchanged. If we ever upgrade to 2.4+, add mappings here --
# 2.4 renamed `show_last_updated_date` to `show_top_note`, so that entry
# would go back. Kept as a named extension point so future renames don't
# require redesigning the sanitizer.
_LEGACY_PAGE_FIELD_MAP: dict[str, str] = {}


def _sanitize_yaml(yaml_content: str) -> str:
    """Translate known-renamed fields before passing YAML to RenderCV.

    Currently a near no-op for 2.3; the RenderCV subprocess is the source
    of truth for validation. The translation path exists so future schema
    drift across RenderCV versions is handled in one place.
    """
    if not _LEGACY_PAGE_FIELD_MAP:
        return yaml_content
    try:
        import yaml as _yaml
        data = _yaml.safe_load(yaml_content)
        if isinstance(data, dict):
            page = data.get("design", {}).get("page")
            if isinstance(page, dict):
                translated: list[str] = []
                for legacy, canonical in _LEGACY_PAGE_FIELD_MAP.items():
                    if legacy in page:
                        value = page.pop(legacy)
                        # Don't overwrite an explicit user value on the canonical field.
                        page.setdefault(canonical, value)
                        translated.append(f"{legacy}->{canonical}")
                if translated:
                    print(f"[RenderCV] Translated legacy design.page fields: {translated}")
        return _yaml.dump(data, allow_unicode=True, sort_keys=False)
    except Exception:
        return yaml_content


def _strip_rendercv_preamble(output: str) -> str:
    """
    Strip RenderCV's welcome banner from the start of its output.

    The banner structure is stable across all invocations:
      - an optional "A new version of RenderCV is available!" notice
      - a "Welcome to RenderCV!" line
      - a rich "useful links" table, closed by a `└...┘` border

    Everything after the table's closing border is real content -- a
    validation table, a YAML parse error, a Typst compilation error, a
    step-progress box, etc. Strip by structure (find the banner and
    skip past it) rather than by matching every possible error phrase,
    so new RenderCV error types don't silently regress this helper.
    """
    welcome_idx = output.find("Welcome to RenderCV")
    if welcome_idx == -1:
        return output
    # The banner always ends with the bottom-left corner `└` of the links
    # table, followed by the row of horizontal bars and a `┘` closing.
    corner_idx = output.find("└", welcome_idx)
    if corner_idx == -1:
        return output
    newline_idx = output.find("\n", corner_idx)
    if newline_idx == -1:
        return output
    return output[newline_idx + 1:].lstrip("\n")


class RenderCVService:
    def __init__(self):
        pass

    async def render_yaml_to_pdf(self, yaml_content: str, output_path: Path) -> tuple[bool, str]:
        """
        Renders YAML content to PDF using RenderCV CLI via subprocess.
        Returns (Success, LogOutput).
        """
        yaml_content = _sanitize_yaml(yaml_content)
        run_id = str(uuid.uuid4())
        # Use a temp directory inside the project to avoid permission issues
        temp_dir = Path(tempfile.gettempdir()) / "rendercv_renders" / f"render_{run_id}"
        temp_dir.mkdir(parents=True, exist_ok=True)

        yaml_file = temp_dir / "cv.yaml"
        log_output = ""
        
        try:
            # Write YAML
            yaml_file.write_text(yaml_content, encoding="utf-8")
            
            # Run RenderCV
            cmd = [sys.executable, "-m", "rendercv", "render", "cv.yaml"]
            
            print(f"[RenderCV] Running command: {' '.join(cmd)}")
            print(f"[RenderCV] Working directory: {temp_dir}")
            
            # Use to_thread to run blocking subprocess in a thread
            # This avoids asyncio.create_subprocess_exec/Windows SelectorEventLoop issues
            import asyncio
            try:
                process = await asyncio.to_thread(
                    subprocess.run,
                    cmd,
                    cwd=str(temp_dir),
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=90,
                )
            except subprocess.TimeoutExpired:
                return False, "RenderCV timed out after 90s"

            # subprocess.run returns a CompletedProcess object
            stdout_str = process.stdout or ""
            stderr_str = process.stderr or ""

            # Log output to console for debugging
            print(f"[RenderCV] STDOUT: {stdout_str[:200]}...") # Log first 200 chars
            if stderr_str:
                print(f"[RenderCV] STDERR: {stderr_str}")

            if process.returncode != 0:
                print(f"[RenderCV] Failed with exit code {process.returncode}")
                # Strip the ~1100-char version-notice + welcome banner that
                # RenderCV always writes to stdout before any real output,
                # so the caller's truncation budget goes to the actual error.
                useful = _strip_rendercv_preamble(stdout_str) or stderr_str
                return False, useful
                
            # Find PDF in the output folder. 
            render_output = temp_dir / "rendercv_output"
            # RenderCV v1.6+ sometimes outputs directly or in subfolder, check logic:
            if not render_output.exists():
                 print(f"[RenderCV] Output folder {render_output} not found, checking root {temp_dir}")
                 render_output = temp_dir
            
            # Look for any PDF
            pdf_files = list(render_output.rglob("*.pdf"))
            print(f"[RenderCV] Found PDF files: {pdf_files}")
            
            if not pdf_files:
                msg = f"No PDF found in output.\n{log_output}"
                return False, msg
                
            # Use the first PDF found
            src_pdf = pdf_files[0]
            
            output_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(src_pdf, output_path)
            
            return True, ""
            
        except Exception as e:
            import traceback
            err_msg = f"Error rendering PDF: {str(e)}\n{traceback.format_exc()}"
            print(err_msg)
            return False, err_msg
        finally:
            # Cleanup
            if temp_dir.exists():
                try:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                except Exception as e:
                    print(f"Cleanup warning: {e}")

    async def render_yaml_to_bytes(self, yaml_content: str) -> tuple[bool, bytes | str]:
        """Render YAML to PDF and return the raw bytes.

        Returns (True, pdf_bytes) on success, (False, error_log_str) on failure.
        Suitable for use with user-scoped binary storage: caller uploads the
        bytes and never touches a filesystem path.
        """
        import uuid, shutil, asyncio, subprocess, sys
        yaml_content = _sanitize_yaml(yaml_content)
        run_id = str(uuid.uuid4())
        temp_dir = Path(tempfile.gettempdir()) / "rendercv_renders" / f"render_{run_id}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        yaml_file = temp_dir / "cv.yaml"
        try:
            yaml_file.write_text(yaml_content, encoding="utf-8")
            cmd = [sys.executable, "-m", "rendercv", "render", "cv.yaml"]
            try:
                process = await asyncio.to_thread(
                    subprocess.run,
                    cmd,
                    cwd=str(temp_dir),
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=90,
                )
            except subprocess.TimeoutExpired:
                return False, "RenderCV timed out after 90s"
            if process.returncode != 0:
                # Strip the preamble banner so the actionable error survives
                # the caller's truncation budget.
                stdout = _strip_rendercv_preamble(process.stdout or "")
                stderr = (process.stderr or "").strip()
                return False, stdout or stderr or f"RenderCV exited with code {process.returncode}"
            render_output = temp_dir / "rendercv_output"
            if not render_output.exists():
                render_output = temp_dir
            pdfs = list(render_output.rglob("*.pdf"))
            if not pdfs:
                return False, "RenderCV produced no PDF output"
            return True, pdfs[0].read_bytes()
        except Exception as e:
            import traceback
            return False, f"Render error: {e}\n{traceback.format_exc()}"
        finally:
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)

    async def validate_yaml(self, yaml_content: str) -> tuple[bool, str]:
        """
        Validates YAML by running RenderCV render without keeping the output.
        Returns (True, "OK") on success, or (False, error_message) on failure.
        Uses sys.executable to ensure the same venv/rendercv version (2.3).
        """
        import uuid, shutil, asyncio, subprocess, sys
        yaml_content = _sanitize_yaml(yaml_content)
        run_id = str(uuid.uuid4())
        temp_dir = Path(tempfile.gettempdir()) / "rendercv_renders" / f"validate_{run_id}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        yaml_file = temp_dir / "cv.yaml"
        try:
            yaml_file.write_text(yaml_content, encoding="utf-8")
            cmd = [sys.executable, "-m", "rendercv", "render", "cv.yaml"]
            process = await asyncio.to_thread(
                subprocess.run,
                cmd,
                cwd=str(temp_dir),
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=60,
            )
            if process.returncode == 0:
                return True, "OK"
            # RenderCV writes everything to stdout; stderr is typically empty.
            # stdout starts with a version-notice + welcome-banner preamble (~1100 chars)
            # before the actual error table. Strip that noise so the agent gets
            # actionable information rather than "A new version is available!".
            stderr = (process.stderr or "").strip()
            stdout = (process.stdout or "").strip()
            raw = stderr or stdout or f"RenderCV exited with code {process.returncode}"
            raw = _strip_rendercv_preamble(raw)
            return False, raw[:1500]
        except Exception as e:
            return False, f"Validation error: {str(e)}"
        finally:
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)


rendercv_service = RenderCVService()
