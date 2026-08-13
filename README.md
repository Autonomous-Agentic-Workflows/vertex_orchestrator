# vertex_orchestrator

Unified orchestration of CrewAI, AutoGen, and Aider via Google Vertex AI.

Routes tasks to the appropriate agent framework:
- **ANALYSIS** → CrewAI (structured analysis, auditing)
- **CONVERSATION** → AutoGen (multi-agent dialogue)
- **EDIT** → Aider (direct file editing)

All backed by Google Cloud Vertex AI with enterprise IP protection.

## Usage

```python
from vertex_orchestrator.config import VertexAIConfig
from vertex_orchestrator.orchestrator import Orchestrator, TaskType

config = VertexAIConfig(project_id="your-project", location="us-central1")
orch = Orchestrator(config=config)

result = orch.execute(task_type=TaskType.ANALYSIS, task="Audit code for IP leakage")
```

## Backend Server

```bash
PYTHONPATH=src python -m vertex_orchestrator.server
```

Serves REST API on port 8000 for the DevGate Android app bridge.

## Testing

```bash
pytest tests/ -q
```

31 tests covering config, all 3 runners, and the unified orchestrator.

## License

MIT