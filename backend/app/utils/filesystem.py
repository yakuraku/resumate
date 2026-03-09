import json
import os
from pathlib import Path

def get_project_root() -> Path:
    """Returns the root directory of the project (ResuMate)."""
    # Assuming this file is in backend/app/utils/filesystem.py
    current_file = Path(__file__).resolve()
    # Go up 3 levels: utils -> app -> backend -> ResuMate
    return current_file.parents[3]

def get_data_dir() -> Path:
    """Returns the data directory."""
    return get_project_root() / "data"

def get_resumes_dir() -> Path:
    """Returns the resumes directory specific to applications."""
    return get_data_dir() / "resumes"

def get_tailored_resumes_dir() -> Path:
    """Returns the tailored resumes directory (anchored to project root, not CWD)."""
    return get_data_dir() / "tailored_resumes"

def get_master_resume_path() -> Path:
    """Returns the path to the master resume file."""
    return get_project_root() / "master-resume_CV.yaml"

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
    """Returns the configured context folder, defaulting to <project_root>/my_info."""
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
