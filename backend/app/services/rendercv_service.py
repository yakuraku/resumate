import subprocess
import shutil
import tempfile
import uuid
import sys
import os
from pathlib import Path


# design.page field translations applied before every render. The master YAML
# template historically shipped with `show_last_updated_date`, which is NOT a
# RenderCV 2.x field -- the actual toggle is `design.page.show_top_note`. We
# translate so the UI toggle maps to the field RenderCV actually reads,
# without touching stored YAML in Neon.
_LEGACY_PAGE_FIELD_MAP = {"show_last_updated_date": "show_top_note"}


def _sanitize_yaml(yaml_content: str) -> str:
    """Translate/strip known-invalid fields from YAML before passing to RenderCV."""
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


# Markers that signal the START of useful RenderCV output. Anything before
# the earliest match is preamble noise (version-notice + welcome banner,
# ~1100 chars) and must be stripped or the caller's truncation budget is
# spent on the banner rather than the real error.
_RENDERCV_CONTENT_MARKERS = (
    "Validating the input file has started",
    "There are validation errors",
    "RenderCV couldn't render",
    "Rendering the",
)


def _strip_rendercv_preamble(output: str) -> str:
    """
    RenderCV always prints a version-notice + welcome banner before any real
    step or error output. Find the earliest content marker and back up to the
    box border (either `+---` legacy or `╭─` rich panel) that wraps it.
    If no marker is found (unexpected format), return the original so we at
    least surface something.
    """
    earliest = -1
    for marker in _RENDERCV_CONTENT_MARKERS:
        idx = output.find(marker)
        if idx != -1 and (earliest == -1 or idx < earliest):
            earliest = idx
    if earliest == -1:
        return output
    # Walk back to the opening box border preceding the marker. Handle both
    # the legacy `+---` and the rich-panel `╭─` variants.
    box_start = max(
        output.rfind("+---", 0, earliest),
        output.rfind("╭─", 0, earliest),
    )
    return output[box_start:] if box_start != -1 else output[earliest:]


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
