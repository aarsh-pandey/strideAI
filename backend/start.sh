#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 Starting StrideAI Backend..."
uv run uvicorn server:app --host 0.0.0.0 --port 8000 --reload
