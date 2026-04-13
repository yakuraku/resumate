import subprocess
import shutil
import tempfile
import uuid
import sys
import os
from pathlib import Path

def _strip_rendercv_preamble(output: str) -> str:
    """
    RenderCV 2.3 always prints a version-notice + welcome-banner to stdout before
    any step output or error table. The useful content starts at the first step
    box, which contains "Validating the input file has started".

    Strategy: find that marker and back up to the +---+ box border that wraps it.
    If the marker is absent (unexpected output format), return the original string
    so we still surface something rather than nothing.
    """
    marker = "Validating the input file has started"
    idx = output.find(marker)
    if idx == -1:
        return output
    # Walk back to the opening +---+ border of the step box
    box_start = output.rfind("+---", 0, idx)
    return output[box_start:] if box_start != -1 else output[idx:]


class RenderCVService:
    def __init__(self):
        pass

    async def render_yaml_to_pdf(self, yaml_content: str, output_path: Path) -> tuple[bool, str]:
        """
        Renders YAML content to PDF using RenderCV CLI via subprocess.
        Returns (Success, LogOutput).
        """
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
            process = await asyncio.to_thread(
                subprocess.run,
                cmd,
                cwd=str(temp_dir),
                capture_output=True,
                text=True,
                encoding="utf-8"
            )
            
            # subprocess.run returns a CompletedProcess object
            stdout_str = process.stdout or ""
            stderr_str = process.stderr or ""
            
            # Log output to console for debugging
            print(f"[RenderCV] STDOUT: {stdout_str[:200]}...") # Log first 200 chars
            if stderr_str:
                print(f"[RenderCV] STDERR: {stderr_str}")

            log_output = f"STDOUT:\n{stdout_str}\n\nSTDERR:\n{stderr_str}"
            
            if process.returncode != 0:
                print(f"[RenderCV] Failed with exit code {process.returncode}")
                return False, log_output
                
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

    async def validate_yaml(self, yaml_content: str) -> tuple[bool, str]:
        """
        Validates YAML by running RenderCV render without keeping the output.
        Returns (True, "OK") on success, or (False, error_message) on failure.
        Uses sys.executable to ensure the same venv/rendercv version (2.3).
        """
        import uuid, shutil, asyncio, subprocess, sys
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
