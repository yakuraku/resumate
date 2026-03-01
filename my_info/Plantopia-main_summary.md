# Plantopia - Technical Summary

## Overview
Plantopia is a full-stack climate-aware plant recommendation and tracking platform that helps Melbourne-area users discover optimal plants for their gardens based on real-time environmental data, personal preferences, and Urban Heat Island (UHI) analysis. The system integrates live weather, air quality, and UV radiation APIs with an AI-powered chat assistant (Google Gemini) and a scientific quantification engine that estimates each plant's environmental impact (CO2 absorption, cooling effect, biodiversity contribution).

## Project Type
Full-Stack Web Application | Climate Data Platform | AI-Integrated Recommendation Engine

## Tech Stack

### Languages
- **Python 3.10**: Backend API, recommendation engine, data pipelines, quantification algorithms
- **TypeScript**: Frontend application, type-safe Vue components, routing, state management
- **JavaScript**: Image utility helpers
- **SQL**: Database migrations, schema definitions (via Alembic)

### Frameworks & Libraries
- **FastAPI**: Async Python backend framework with automatic OpenAPI documentation
- **Vue 3 (Composition API)**: Reactive frontend framework with single-file components
- **Vite 7**: Frontend build tool with hot module replacement
- **Pinia**: Centralized state management for Vue (auth store)
- **Vue Router**: Client-side routing with navigation guards for auth-protected routes
- **Bootstrap 5**: Responsive CSS framework for UI layout
- **SQLAlchemy 2.0**: Async ORM with relationship mapping and query optimization
- **Pydantic**: Request/response validation schemas with type enforcement
- **Pandas**: Data loading, normalization, and CSV processing for plant datasets
- **Pillow (PIL)**: Image processing for AI chat image uploads
- **Marked**: Client-side markdown rendering for plant care guides
- **Heroicons**: SVG icon system for the UI

### Databases & Storage
- **PostgreSQL (Supabase)**: Primary relational database with 13 tables, async connection pooling (pool_size=20, max_overflow=10)
- **Alembic**: Database migration management with 8 versioned migration scripts
- **Google Cloud Storage**: CDN-backed image storage for plant photography
- **In-Memory TTL Cache**: Custom caching layer (cachetools) with 1000-item capacity, hit/miss tracking, and cache warming

### Cloud & DevOps
- **Google Cloud Platform (GCP)**: Production VM hosting with Supervisor process management
- **Supabase**: Managed PostgreSQL with auth integration
- **Vercel**: Frontend deployment with preview deployments for PRs
- **GitHub Actions**: CI/CD pipeline for automated deployment to GCP via SSH
- **Uvicorn**: ASGI server with auto-reload for development
- **GZip Middleware**: HTTP response compression (60-80% size reduction for responses >1KB)

### APIs & Integrations
- **Google Gemini 2.5 Flash-Lite**: AI-powered plant chat with agriculture guardrails, image analysis, and multi-key rotation with rate limiting
- **Open-Meteo API**: Real-time weather data (temperature, humidity, rainfall, wind speed)
- **WAQI (World Air Quality Index)**: Air quality monitoring (PM2.5, PM10, ozone, NO2, SO2, CO)
- **ARPANSA**: UV radiation index and protection category data
- **Google OAuth 2.0**: User authentication with JWT token management (HS256, 7-day expiry)
- **Google Drive API**: Plant image asset management

## Architecture Highlights
- **Repository Pattern with Service Layer**: Clean separation of concerns — 8 repositories abstract database queries, 12 service classes encapsulate business logic, 13 endpoint routers handle HTTP concerns
- **Async-First Design**: Full async/await stack from FastAPI endpoints through SQLAlchemy async sessions to asyncpg database driver, enabling high concurrency on a single server
- **Multi-Factor Recommendation Engine**: Custom scoring algorithm with hard filtering (season, sun, container, indoor), soft scoring across 6 weighted dimensions (season, sun, maintainability, site fit, preferences, eco bonus), category diversity enforcement, and progressive filter relaxation when candidates are insufficient
- **Scientific Quantification Framework**: Physics-based plant impact modeling using Leaf Area Index (LAI) proxies, canopy area calculations, transpiration classification, and Z-score normalization to estimate cooling effect, CO2 absorption, air quality improvement, and biodiversity contribution
- **Smart CORS Middleware**: Custom middleware with wildcard pattern matching for Vercel preview deployments, dynamic origin validation, and 24-hour preflight caching
- **API Key Rotation**: Gemini API service implements multi-key management with per-key usage tracking, daily request counting, and automatic key rotation

## Key Features Implemented
1. **Plant Recommendation Engine**: Multi-stage pipeline that loads 3 CSV datasets (~3.4MB of plant data across flowers, herbs, vegetables), applies hard filters based on climate zone and user constraints, scores candidates using weighted multi-factor algorithms, deduplicates by scientific/common name, enforces category diversity (max 2 per category), and generates contextual "why" explanations for each recommendation
2. **Climate Action Quantification**: Calculates per-plant environmental impact metrics including temperature reduction (°C), CO2 absorption (g/year), water cycling (L/week), air quality improvement points, biodiversity/pollinator support scores, and community-scale impact projections using biophysics-derived models
3. **AI Plant Chat (Gemini Integration)**: Two-mode conversational AI — general agriculture Q&A and plant-specific chat with full growing context injection (stage, progress, care tips). Features 120K token limit per session, 6-hour auto-expiration, message history buffering (30 messages), base64 image upload support, and agriculture-only guardrail system prompt
4. **Plant Growth Tracking System**: Users create plant instances with nicknames and locations, track growth through stages (germination → maturity), complete requirement checklists, log progress, and receive stage-appropriate care tips generated by Gemini AI
5. **Urban Heat Island (UHI) Analysis**: Melbourne-specific heat mapping with suburb-level heat categories (Low/Moderate/High/Extreme), GeoJSON boundary data, and heat intensity visualization — factored into plant recommendations and quantification models
6. **User Authentication & Profiles**: Google OAuth flow with JWT tokens, user profile management (experience level, garden type, space, sun exposure, budget), favorites system for both plants and guides, and email-based user identification
7. **Real-Time Climate Data Integration**: Aggregates weather (Open-Meteo), air quality (WAQI), and UV (ARPANSA) data per suburb with daily caching, API status tracking, and graceful degradation on API failures
8. **Markdown Guide System**: Dynamic content delivery of gardening guides organized by category (companion planting, composting, pests/diseases, fertilizer) with favorites support and structured markdown rendering
9. **In-Memory Caching Layer**: Custom async-safe TTL cache decorator with MD5-based key generation, Pydantic model serialization support, cache invalidation patterns, performance statistics tracking (hit rate, evictions), and cache warming capability

## Technical Complexity Indicators
- **Codebase Scale**: Large — 33,400+ lines of source code across 60 Python backend files, 28 TypeScript/Vue frontend files, 26 test files, and 9 utility scripts
- **API Surface**: 82 REST API endpoints across 13 router modules (plant tracking: 18, markdown content: 13, guides: 9, UHI: 8, plant chat: 6, auth: 5, plants: 5, favorites: 5, climate: 3, recommendations: 3, quantification: 3, admin: 3, health: 1)
- **Integration Complexity**: 6 external API integrations (Gemini AI, Open-Meteo, WAQI, ARPANSA, Google OAuth, Google Cloud Storage) with key rotation, rate limiting, and fallback handling
- **Data Complexity**: 13 database models with complex relationships (User → Profile, Favorites, PlantInstances → ProgressTracking, ChatSessions → Messages), 8 Alembic migrations, 728 data files including 3 CSV datasets and 66+ plant problem image categories
- **Testing**: pytest (unit + integration), Vitest (Vue unit tests), Playwright (E2E), with 26 test files covering auth flows, endpoint validation, repository logic, and live API testing
- **CI/CD**: GitHub Actions pipeline with SSH-based deployment to GCP, automated database migrations (Alembic), Supervisor process management, and health check verification with retry logic

## Quantifiable Metrics (Estimated)
- **82 REST API endpoints** serving plant data, recommendations, tracking, chat, climate, and UHI analysis
- **13 database models** with 8 migration versions managing schema evolution
- **3.4MB+ plant dataset** spanning 3 categories (flowers, herbs, vegetables) with 30+ attributes per plant
- **728 data files** including CSVs, GeoJSON maps, problem diagnosis images, and markdown guides
- **6 external API integrations** with key rotation and rate-limiting logic
- **120K token budget** per AI chat session with 6-hour auto-expiration
- **33,400+ lines** of source code across Python, TypeScript, Vue, and SQL

## Resume-Ready Bullet Points
> These are draft bullet points optimized for ATS and impact. Use as starting points.

- Engineered a full-stack climate-aware plant recommendation platform using **FastAPI**, **Vue 3**, **TypeScript**, and **PostgreSQL (Supabase)**, serving **82 REST API endpoints** with async request handling and GZip compression middleware
- Designed and implemented a **multi-factor recommendation engine** in Python that processes 3.4MB of plant data through hard/soft filtering, weighted scoring across 6 dimensions, deduplication, and category diversity enforcement to deliver personalized plant suggestions
- Built a **climate action quantification framework** using physics-based models (LAI proxies, canopy area, transpiration classification, Z-score normalization) to calculate per-plant environmental impact metrics including CO2 absorption, temperature reduction, and biodiversity scores
- Integrated **Google Gemini 2.5 Flash-Lite AI** for a conversational plant care assistant supporting text and image analysis, with context injection from live plant tracking data, 120K-token session management, agriculture guardrails, and multi-key API rotation
- Developed a **real-time environmental data pipeline** aggregating weather (Open-Meteo), air quality (WAQI), and UV radiation (ARPANSA) APIs with per-suburb caching, API health monitoring, and graceful degradation for Melbourne-area climate context
- Architected a **repository-service-controller pattern** with 8 repositories, 12 services, and 13 endpoint routers, backed by **SQLAlchemy 2.0 async sessions** (asyncpg) and **Alembic** migrations across 13 database models
- Implemented **Google OAuth 2.0** authentication with **JWT** token management, user profile personalization, plant favorites, and guide bookmarking — securing all routes via Vue Router navigation guards and backend token validation
- Created an **Urban Heat Island (UHI) analysis module** with Melbourne suburb-level GeoJSON heat mapping, intensity categorization, and integration into recommendation scoring and quantification models
- Built an **in-memory caching layer** with TTL-based eviction, async-safe locking, MD5 key generation, Pydantic model serialization, cache warming, and hit-rate performance monitoring — reducing database load without external infrastructure
- Established a **CI/CD pipeline** using **GitHub Actions** for automated deployment to **GCP** via SSH, including database migrations, Supervisor process restarts, and health check verification with retry logic

## Keywords for ATS
FastAPI, Vue 3, TypeScript, Python, PostgreSQL, Supabase, SQLAlchemy, Alembic, Pydantic, Pinia, Vue Router, Vite, Bootstrap, REST API, Async/Await, Google Gemini AI, Google OAuth 2.0, JWT Authentication, Google Cloud Platform (GCP), Google Cloud Storage, Vercel, GitHub Actions, CI/CD, Uvicorn, ASGI, Pandas, Pillow, GeoJSON, Urban Heat Island, Recommendation Engine, Machine Learning Pipeline, Natural Language Processing, Image Analysis, Real-Time Data Integration, Caching, TTL Cache, CORS, GZip Compression, Database Migrations, Repository Pattern, Service Layer Architecture, Multi-Factor Scoring, Z-Score Normalization, Biophysics Modeling, WebSocket, Playwright, Vitest, pytest, E2E Testing, Integration Testing, Unit Testing, Environment Variables, API Key Rotation, Rate Limiting, Markdown Rendering, Responsive Design, Single Page Application (SPA), Full-Stack Development, Agile/Iterative Development

## Notes for Resume Tailoring
- **Best suited for roles involving**: Full-stack web development, Python backend engineering, climate/sustainability tech, AI/ML integration, data-driven applications, GCP cloud deployment
- **Strongest demonstration of**: End-to-end system design (API + frontend + database + external integrations), scientific/algorithmic thinking (quantification engine, recommendation scoring), and production deployment with CI/CD
- **Potential talking points for interviews**:
  - How the recommendation engine's progressive filter relaxation ensures sufficient results while maintaining quality (relaxing season by ±1 month, then expanding sun tolerance)
  - Architecture decisions around async-first design with SQLAlchemy 2.0 + asyncpg vs. traditional sync approaches
  - The climate quantification framework's use of biophysics proxies (LAI, canopy area, transpiration class) to estimate real-world environmental impact
  - Trade-offs in choosing in-memory TTL caching over Redis for a single-server deployment
  - Gemini AI guardrail system design to keep conversations agriculture-focused while supporting multimodal (text + image) input
  - Managing 6 external API integrations with different rate limits, data freshness requirements, and failure modes
