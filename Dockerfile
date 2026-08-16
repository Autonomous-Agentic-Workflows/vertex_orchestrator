# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for git (Aider) and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY pyproject.toml ./
COPY src/ ./src/
COPY tests/ ./tests/

# Install the package with dev dependencies
RUN pip install --no-cache-dir -e ".[dev]"

# Expose the orchestrator API port
EXPOSE 8000

# Set defaults — override at deploy time
ENV ORCHESTRATOR_HOST=0.0.0.0 \
    ORCHESTRATOR_PORT=8000 \
    ORCHESTRATOR_FALLBACK=true

# Run the server
CMD ["python", "-m", "vertex_orchestrator.server"]