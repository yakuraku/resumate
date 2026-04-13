import json
import os
from pathlib import Path


def get_project_root() -> Path:
    """Returns the root directory of the project (ResuMate).

    In Docker the container layout mirrors the repo:
      /app/backend/app/utils/filesystem.py  ->  parents[3] == /app
    Locally:
      .../ResuMate/backend/app/utils/filesystem.py  ->  parents[3] == ResuMate/

    Override by setting the APP_ROOT environment variable (absolute path).
    """
    env_root = os.environ.get("APP_ROOT", "").strip()
    if env_root:
        return Path(env_root).resolve()
    current_file = Path(__file__).resolve()
    # Go up 3 levels: utils -> app -> backend -> project root
    return current_file.parents[3]


def get_data_dir() -> Path:
    """Returns the data directory (contains DB, PDFs, config, tailor helper)."""
    return get_project_root() / "data"


def get_resumes_dir() -> Path:
    """Returns the resumes directory specific to applications."""
    return get_data_dir() / "resumes"


def get_tailored_resumes_dir() -> Path:
    """Returns the tailored resumes directory (anchored to project root, not CWD)."""
    return get_data_dir() / "tailored_resumes"


def get_master_resume_path() -> Path:
    """Returns the path to the master resume file.

    In Docker (APP_ROOT env var is set): lives inside the persistent data/
    volume so users can upload it through the UI and it survives rebuilds.

    In local dev (no APP_ROOT): falls back to the project root, preserving
    the existing dev workflow of placing the file next to docker-compose.yml.
    """
    env_root = os.environ.get("APP_ROOT", "").strip()
    if env_root:
        return get_data_dir() / "master-resume_CV.yaml"
    return get_project_root() / "master-resume_CV.yaml"


def get_tailor_helper_path() -> Path:
    """Returns the path to the per-user resume-tailor-helper.md (inside data/).

    This file accumulates learnings from past tailoring runs and is personal to
    each user. It is initialized from the shipped template on first startup.
    """
    return get_data_dir() / "resume-tailor-helper.md"


def ensure_directory(path: Path):
    """Ensures a directory exists."""
    path.mkdir(parents=True, exist_ok=True)


def read_file(path: Path) -> str:
    """Reads a file and returns its content."""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_file(path: Path, content: str):
    """Writes content to a file."""
    ensure_directory(path.parent)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def get_context_folder() -> Path:
    """Returns the configured context folder, defaulting to <project_root>/my_info.

    If a path is stored in data/context_config.json but no longer exists (e.g.
    after switching between local and Docker environments), silently falls back
    to the default rather than crashing.
    """
    config_path = get_data_dir() / "context_config.json"
    if config_path.exists():
        try:
            config = json.loads(config_path.read_text(encoding="utf-8"))
            folder_str = config.get("folder_path", "")
            if folder_str:
                folder = Path(folder_str)
                if folder.is_absolute() and folder.exists():
                    return folder
        except Exception:
            pass
    return get_project_root() / "my_info"
