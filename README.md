# ResuMate Career OS

> **The Ultimate AI-Powered Career Operating System**

ResuMate is a comprehensive platform designed to streamline your job application process. It serves as a central hub for managing your professional identity, tailoring resumes to specific job descriptions using AI, and preparing for interviews.

## 🚀 Key Features

*   **Resume Tailoring Agent:** Automatically adapts your master resume (YAML) to match specific job descriptions using advanced LLMs.
*   **Context-Aware:** intelligently uses your personal career history stored in `my_info/` to generate relevant and truthful resume content.
*   **Live Preview:** Real-time PDF generation and preview of your tailored resume.
*   **Modern Interface:** A sleek, responsive frontend built with Next.js and Tailwind CSS.
*   **Interview Prep:** (In Progress) Intelligent interview simulator based on your resume and target job.

## 🛠️ Tech Stack

### Backend
*   **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
*   **Database:** SQLite (via `aiosqlite`)
*   **ORM:** SQLAlchemy + Alembic for migrations
*   **Resume Generaton:** [RenderCV](https://github.com/mina-sami/rendercv)
*   **AI/LLM:** OpenAI / Anthropic integration

### Frontend
*   **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS 4 + `tw-animate-css`
*   **Icons:** Lucide React
*   **Components:** Radix UI primitives

## 📂 Project Structure

```bash
ResuMate/
├── backend/                # FastAPI Backend
│   ├── app/                # Application source code
│   ├── alembic/            # Database migrations
│   ├── data/               # SQLite database storage
│   └── tests/              # Pytest suite
├── frontend/               # Next.js Frontend
│   ├── src/                # Source code (app, components, lib)
│   ├── public/             # Static assets
│   └── e2e/                # Playwright end-to-end tests
├── my_info/                # USER CONTEXT: Markdown files with your career history
├── master-resume_CV.yaml   # SOURCE OF TRUTH: Your master resume data
└── resume-tailor-helper.md # Prompt engineering context for the AI
```

## ⚡ Getting Started

### Prerequisites
*   Python 3.10+
*   Node.js 18+ & npm

### 1. Backend Setup

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    # Windows:
    .\venv\Scripts\activate
    # Mac/Linux:
    source venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install .
    ```
4.  Set up environment variables:
    Create a `.env` file in the `backend/` directory:
    ```ini
    PROJECT_NAME="ResuMate Career OS"
    API_V1_STR="/api/v1"
    
    # AI Provider Keys
    OPENAI_API_KEY=your_openai_key_here
    OPENAI_MODEL=gpt-5-mini
    # OR
    OPENROUTER_API_KEY=your_openrouter_key_here
    DEFAULT_MODEL=anthropic/claude-sonnet-4
    ```
5.  Run Database Migrations:
    ```bash
    alembic upgrade head
    ```
6.  Start the Server:
    ```bash
    uvicorn app.main:app --reload --port 8921
    ```
    The API will be available at `http://localhost:8921`. Docs at `/docs`.

### 2. Frontend Setup

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Development Server:
    ```bash
    npm run dev
    ```
    The application will be running at `http://localhost:1234`.

## 🧪 Development Workflow

*   **Database:** The SQLite database is located at `backend/data/resumate.db`. Use Alembic for any schema changes.
*   **Resume Data:** The `master-resume_CV.yaml` file in the root is the core data source. The backend reads this file to generate PDFs.
*   **Personal Context:** Add markdown files to `my_info/` describing your projects, work experience, or skills. The Tailor Service reads all `.md` files in this directory to provide context to the LLM.
    *   **Adding new context files:** Drop a `.md` file into `my_info/`, then add a corresponding entry in `my_info/projects.md` with a brief summary and a `**Relevant for:**` line so the AI agent knows when to read it.

## 📝 License
Proprietary - Internal Use Only.
