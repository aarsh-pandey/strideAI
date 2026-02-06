<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# StrideAI Resolution Quest

Your AI-powered 2026 New Year resolution companion with voice coaching and strategic planning.

## Project Structure

```
StrideAI-UI/
├── frontend/          # React + TypeScript frontend
│   ├── components/
│   ├── utils/
│   ├── package.json
│   └── vite.config.ts
├── backend/           # Python FastAPI backend
│   ├── server.py
│   ├── requirements.txt
│   └── README.md
└── README.md
```

## Quick Start

### Backend Setup

1. Install uv (if not already installed):

   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. Navigate to backend:

   ```bash
   cd backend
   ```

3. Install dependencies with uv:

   ```bash
   uv sync
   ```

4. Configure environment:

   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

5. Run the backend:
   ```bash
   uv run python server.py
   ```

### Frontend Setup

1. Navigate to frontend:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the frontend:

   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser

## Features

- 🎤 **Live Voice Coach**: Real-time AI conversations about your goals
- 📝 **Strategy Plan**: Get actionable roadmaps with AI-powered insights
- 📅 **Calendar Export**: Download your goals as .ics files
- 📊 **Observability**: Optional Opik integration for monitoring (backend)

## Tech Stack

**Frontend:**

- React + TypeScript
- Vite
- TailwindCSS
- Google GenAI SDK

**Backend:**

- FastAPI
- Python 3.x
- Google Generative AI
- Opik (optional observability)

## View in AI Studio

https://ai.studio/apps/drive/1d70GAdWy0eLoBfpR9S2aQU-QlEG0KoU5
