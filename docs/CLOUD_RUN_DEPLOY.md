# Cloud Run Deployment — vertex_orchestrator

## Overview

The orchestrator can be deployed to Google Cloud Run as a disaster-recovery (DR)
instance. The Dockerfile in this directory packages the server for
containerized deployment.

## Build & Deploy

```bash
# Set variables
PROJECT_ID=master-recovery-hub-2026
REGION=us-east1
IMAGE=gcr.io/${PROJECT_ID}/vertex-orchestrator
SERVICE=vertex-orchestrator

# Build and push
gcloud builds submit --tag ${IMAGE} --project ${PROJECT_ID}

# Deploy to Cloud Run
gcloud run deploy ${SERVICE} \
  --image ${IMAGE} \
  --region ${REGION} \
  --port 8000 \
  --set-env-vars="ORCHESTRATOR_FALLBACK=false" \
  --set-secrets="ORCHESTRATOR_API_KEY=orchestrator-api-key:latest,GOOGLE_CLOUD_PROJECT=master-recovery-hub-2026" \
  --no-allow-unauthenticated \
  --project ${PROJECT_ID}

# Get the URL
gcloud run services describe ${SERVICE} --region ${REGION} --format='value(status.url)'
```

## Environment Variables

| Variable | Default | Notes |
|----------|---------|-------|
| `ORCHESTRATOR_HOST` | `0.0.0.0` | Bind address (Cloud Run requires 0.0.0.0) |
| `ORCHESTRATOR_PORT` | `8000` | Must match `--port` flag |
| `ORCHESTRATOR_FALLBACK` | `true` | Set to `false` on Cloud Run (no local Ollama) |
| `ORCHESTRATOR_API_KEY` | — | Required — store as Cloud Secret |
| `GOOGLE_CLOUD_PROJECT` | — | Required for Vertex AI access |
| `ORCHESTRATOR_ALLOWED_BASE` | — | Restrict file_path access |

## Secrets

Store sensitive values as Cloud Secrets (not env vars):

```bash
# Create the API key secret
echo -n "your-secure-api-key" | gcloud secrets create orchestrator-api-key \
  --data-file=- --project ${PROJECT_ID}
```

## Health Check

Cloud Run will probe `GET /health` which returns:

```json
{"status": "healthy", "providers": [...], "fallback_enabled": false}
```

## Notes

- Fallback to local Ollama is disabled on Cloud Run (no GPU)
- Vertex AI credentials come from the runtime service account
- The service is deployed as `--no-allow-unauthenticated` — use IAM or
  a Cloud Run invoker token for access