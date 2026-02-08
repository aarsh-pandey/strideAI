# strideAI Backend - Python FastAPI

## Setup Instructions

### 1. Install uv (if not already installed)

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or with pip
pip install uv
```

### 2. Install Dependencies with uv

```bash
cd backend
uv sync
```

This will create a virtual environment and install all dependencies from `pyproject.toml`.

### 3. Configure API Key

Create a `.env` file in the `backend/` directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```
GEMINI_API_KEY=your_actual_api_key_here
```

### 4. (Optional) Enable Opik Observability

To monitor your LLM calls, add Opik credentials to `.env`:

1. Sign up at [Comet Opik](https://www.comet.com/opik)
2. Get your API key from the Opik dashboard
3. Add to `.env`:

```
OPIK_API_KEY=your_opik_api_key
OPIK_WORKSPACE=default
```

**Benefits of Opik:**

- 📊 Track all LLM requests and responses
- ⏱️ Monitor latency and performance
- 💰 Analyze token usage and costs
- 🔍 Debug prompt effectiveness
- 📈 View analytics in the Opik dashboard

The backend will work without Opik - it's completely optional.

### 5. Run the Backend Server

```bash
uv run python server.py
```

Or activate the virtual environment first:

```bash
source .venv/bin/activate  # On macOS/Linux
# .venv\Scripts\activate   # On Windows
python server.py
```

The server will start at `http://localhost:8000`

### 6. Run the Frontend

In a separate terminal:

```bash
npm run dev
```

## API Endpoints

- `GET /` - API info
- `POST /api/generate-roadmap` - Generate resolution roadmap
- `GET /health` - Health check

## CORS Configuration

The backend is configured to accept requests from:

- `http://localhost:5173` (Vite default)
- `http://localhost:3000` (React default)

Update the `allow_origins` in `server.py` if your frontend runs on a different port.

## Opik Dashboard

When Opik is enabled, you can view traces at:

- https://www.comet.com/opik

Each request will be tracked with:

- Input (goal, category, deadline)
- Prompt sent to Gemini
- Model response
- Latency metrics
- Success/error status
