# Spark Studio: Enterprise Migration & Deployment Playbook

This document provides the exact integration paths and cloud architecture requirements for migrating the Spark Studio platform to a managed enterprise GCP environment.

## 1. Cloud Architecture & Infrastructure Requirements
*   **Compute**: Google Cloud Run (Fully managed, serverless execution). See `Dockerfile`.
*   **Database**: Cloud SQL for PostgreSQL (Enterprise/Developer tier for rapid autoscaling and native query logging).
*   **Authentication & Stateful Permissions**: Firebase Authentication bound to Google Cloud Identity (Google Workspace). 
*   **AI Backend**: Vertex AI (Enterprise Gemini).

## 2. Vertex AI (Enterprise Gemini) Setup
To transition from the public Gemini API to your organization's Vertex AI:
1. Ensure the Google Cloud Project has the Vertex AI API enabled.
2. Ensure the Cloud Run service account has `roles/aiplatform.user`.
3. In `src/engine/aiService.ts` (or backend equivalents), initialize the SDK utilizing Vertex AI configurations rather than raw API keys:

```typescript
import { GoogleGenAI } from '@google/genai';

// Application Default Credentials (ADC) will be utilized automatically in Cloud Run
const ai = new GoogleGenAI({
  vertexai: {
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
  }
});
```

## 3. Environment Variables (Secret Manager)
Bind these environment variables directly to Google Cloud Secret Manager for the deployment target:

```env
NODE_ENV=production
GOOGLE_CLOUD_PROJECT=your-org-gcp-project
GOOGLE_CLOUD_LOCATION=us-central1
DATABASE_URL=postgres://[DB_USER]:[DB_PASS]@[DB_HOST]:5432/[DB_NAME]
```

## 4. Continuous Integration / Continuous Deployment (CI/CD)
Use Cloud Build or GitHub Actions with Workload Identity Federation (WIF). 
*   **Build**: standard `docker build` using the provided `Dockerfile`.
*   **Migrate**: Run Drizzle migrations in the CI pipeline prior to traffic switching.
*   **Deploy**: `gcloud run deploy spark-studio --image [IMAGE_URI] --region us-central1 --service-account [RUNTIME_SA]`
