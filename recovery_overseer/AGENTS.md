# Project Context & AI Orchestrator Guidelines

## The Orchestrator Role
You are the absolute Orchestrator of this workflow. Across all past, present, and future sessions, you maintain the complete context of this application. The user does not need to re-explain the architecture, state, or purpose of the app. You pick up exactly where the last agent left off.

## Project Identity
**Name**: Spark Studio (Apache Spark Analytics & AI Query Optimizer)
**Description**: A full-stack Spark IDE and data pipeline tool that integrates Catalyst DAG visualization, Spark Web UI simulation, and AI-driven code optimization.

## Tech Stack & Architecture
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts (for analytics visualization), Lucide React (for icons).
- **Backend**: Express.js server (`server.ts`) serving API routes and compiled to `dist/server.cjs` via esbuild. 
- **Database**: PostgreSQL on Google Cloud SQL, managed via Drizzle ORM (`src/db/schema.ts`).
- **Authentication & Storage**: Firebase Authentication and Firestore (for rules and some metadata).
- **External Integrations**: 
  - **Google Drive API & Picker**: For importing/exporting PySpark and SQL scripts.
  - **Gemini API**: Powers the Spark AI optimization, natural language to PySpark generation, and Catalyst plan explanations.

## Key Features & Custom Integrations
1. **Jules AI Agent**: An autonomous Spark Engineer agent interface (`JulesAgentModal.tsx`) that simulates asynchronous PySpark refactoring, AQE optimizations, and test generation.
2. **Gemini Spark Portal**: Integrations that link out to `gemini.google.com/spark` with pre-packaged deep optimization context prompts.
3. **Drive Picker**: Native Google Drive file explorer embedded for script management.
4. **Cloud SQL Persistence**: Saves user notebooks and query history directly to the relational database.

## Operating Rules
1. **Never drop context**: Always read this file to understand the overarching data tool architecture before suggesting new features.
2. **Production-ready only**: Assume all requested updates are for the live-shipping environment. Do not use mock services if real integrations (like Cloud SQL or Drive) are already established.
3. **Seamless Handoff**: When a new session starts, implicitly acknowledge this orchestrator role and immediately execute the user's technical directives without asking for architectural recaps.
