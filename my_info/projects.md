# Projects Index

This file is your primary navigation guide. Read it first to decide which project files to read,this file provides a brief reference for what each project file contains and what it demonstrates.

---

### `teaching_smaller_models_how_to_think_summary.md`
End-to-end LLM fine-tuning project. Fine-tuned Qwen2.5-3B-Instruct using LoRA (rank 64) with 4-bit quantization (QLoRA) to teach Chain-of-Thought reasoning. Built a multi-stage data curation pipeline that distilled 75,000+ synthetic prompts from 5+ LLMs (Claude, Gemini, Grok, ChatGPT, GLM) down to ~8,000 gold-standard training examples across 7 reasoning categories. Used Unsloth for memory-efficient training (~30% VRAM reduction). Deployed both LoRA adapters and a merged 16-bit model to Hugging Face Hub. Originally built for the Google Tunix Hackathon on Kaggle.
**Demonstrates:** LLM fine-tuning, LoRA/QLoRA/PEFT, supervised fine-tuning (SFT), Chain-of-Thought training, large-scale data curation and quality filtering, memory-efficient deep learning, model deployment to Hugging Face Hub.
**Relevant for:** AI Engineer, ML Engineer, LLM Engineer, NLP Engineer, Applied AI, Generative AI, Deep Learning Engineer, ML Infrastructure.

---

### `kaggle-mcp-main_summary.md`
Production-ready MCP (Model Context Protocol) server that bridges Claude AI to the full Kaggle API via 50+ registered tools. Modular architecture with 8 domain-specific tool modules (auth, competitions, datasets, kernels, models, config, metadata, notebook editing). Features exponential-backoff kernel polling, automated error analysis, an iterative push→run→analyze→fix workflow engine, programmatic Jupyter notebook editing (JSON Patch / RFC 6902), and dual-transport support (stdio + SSE). ~3,200 lines of Python. Cross-platform install scripts (Bash + PowerShell).
**Demonstrates:** MCP protocol and AI tool integration, API wrapping and developer tooling, Python packaging, agentic workflow design, Jupyter notebook manipulation, CLI tooling, open-source project structure.
**Relevant for:** AI Engineer (tooling/agents), Developer Tooling Engineer, Platform Engineer, ML Infrastructure, Python Backend Engineer, any role involving AI agents or tool-use systems.

*(Note: `kaggle_mcp.md` in this folder is just the project's README/setup guide — the structured summary with bullet points and metrics is in `kaggle-mcp-main_summary.md`.)*

---

### `needle_in_the_hashtag_hackathon.md`
**Ranked 4th place** in the eSafety Hackathon run by MLAI, eSafety Commissioner, and University of Melbourne. Built a multi-label NLP classifier to detect harmful online content across 13 persona classes (bullying, hate speech, extremism, misinfo, etc.). Fine-tuned DeBERTa-v3-large with 5-fold stratified cross-validation, weighted BCE loss for class imbalance, and OOF threshold optimization. Ensemble of fold models. Custom risk-aware scoring metric: 0.70 × Risk_Tier_F1 + 0.30 × Persona_F1.
**Demonstrates:** NLP / transformer fine-tuning, multi-label classification, handling class imbalance, cross-validation and ensembling, PyTorch training pipelines, real-world competitive ML.
**Relevant for:** AI Engineer, NLP Engineer, ML Engineer, Data Scientist, Trust & Safety / Content Moderation, any role involving text classification or fine-tuning pre-trained models.

---

### `BirdTag-AWS-main_summary.md`
Serverless AI-powered bird detection and media management platform on AWS. Custom-trained YOLOv8 deployed in a containerized Lambda (Docker/ECR) triggered by S3 upload events. Processes images (YOLO detection), video (ByteTrack object tracking, frame-sampled), and audio (BirdNET). 10-endpoint REST API via API Gateway, DynamoDB dual-index schema, Cognito OAuth2, presigned URL uploads up to 100MB, SNS notifications, and a SPA frontend.
**Demonstrates:** AWS serverless architecture (Lambda, S3, DynamoDB, API Gateway, Cognito, SNS, ECR), ML model deployment to production (containerized Lambda), event-driven system design, computer vision (YOLOv8, ByteTrack), multi-modal data processing, full-stack development.
**Relevant for:** Cloud Engineer (AWS), ML/AI Engineer, Computer Vision Engineer, Backend/Serverless Engineer, Full-Stack Developer, MLOps.

---

### `Note-Flow-main_summary.md`
AI music composition system. Character-level LSTM (23.2M parameters, 2,048 hidden units) trained on 8,886 Irish folk tunes in ABC notation. Generates original musical compositions via temperature-controlled autoregressive sampling. Complete 4-stage audio pipeline: generated text → ABC file → MIDI (abcmidi) → WAV (timidity) → IPython playback. Trained on Google Colab with PyTorch; data sourced from HuggingFace Datasets.
**Demonstrates:** Building neural network architectures from scratch in PyTorch (LSTM), sequence modeling, generative AI, temperature sampling, end-to-end ML pipeline (data → training → generation → audio output), Google Colab + HuggingFace ecosystem.
**Relevant for:** ML Engineer, Deep Learning Engineer, Generative AI, NLP/Sequence Modeling, Audio AI, any role involving RNNs or sequence generation.

---

### `Parkinson_Disease_Predictor_using_R-main_summary.md`
ML classification pipeline in R for Parkinson's disease prediction from biomedical voice measurements. Trains and compares four models — Decision Tree, Random Forest (81.58% accuracy), SVM with RBF kernel (81.58% accuracy, 100% specificity), and XGBoost — with 5-fold cross-validated hyperparameter tuning. LASSO (glmnet) reduces 23 features to 3 key biomarkers. Full EDA suite (ggplot2, corrplot), confusion matrix analysis, and a reproducible R Markdown report with serialized RDS model artifacts.
**Demonstrates:** R and the R ML ecosystem (caret, glmnet, randomForest, e1071, xgboost), classical ML model comparison, LASSO feature selection, statistical evaluation (sensitivity/specificity), reproducible research with R Markdown.
**Relevant for:** Data Scientist, Statistical Modeler, Healthcare/Biomedical Analytics, Bioinformatics, any role that values R or systematic ML evaluation methodology.

---

### `Plantopia-main_summary.md`
Full-stack climate-aware plant recommendation platform. FastAPI async backend (Python) + Vue 3 TypeScript frontend. PostgreSQL via Supabase, 82 REST API endpoints, 13 database models with Alembic migrations. Integrates Google Gemini 2.5 Flash-Lite for a conversational plant care assistant (guardrails, multi-key rotation, image upload, 120K token sessions). Aggregates real-time weather (Open-Meteo), air quality (WAQI), and UV (ARPANSA) data. Multi-factor scoring recommendation engine, Urban Heat Island (UHI) GeoJSON analysis, in-memory TTL caching layer. Deployed on GCP + Vercel with GitHub Actions CI/CD. 33,400+ lines of source code.
**Demonstrates:** Full-stack web development, async Python backend (FastAPI + SQLAlchemy 2.0), Vue 3 + TypeScript frontend, PostgreSQL schema design and migrations, AI/LLM product integration (Gemini), REST API design, GCP deployment, CI/CD, multi-factor algorithm design, external API orchestration.
**Relevant for:** Full-Stack Engineer, Python Backend Engineer, Software Engineer (general), AI product engineering, any role mentioning FastAPI / Vue / TypeScript / PostgreSQL / GCP.

---

### `Asteroid-Shooter-main_summary.md`
Feature-rich 2D space shooter game in Python using Pygame. Implements 8 sprite classes with pixel-perfect mask collision detection, delta-time physics, a real-time 3D perspective-projected starfield (up to 5,000 objects), a 5-screen game state machine, an in-game credits economy with JSON persistence, and a full audio system. ~1,200 lines, single-module architecture.
**Demonstrates:** Python, object-oriented design, Pygame, real-time rendering, physics simulation, state machine architecture, persistent data handling, game development fundamentals.
**Relevant for:** Game Developer, Python Developer, Software Engineering roles where a creative personal project demonstrates programming ability.
