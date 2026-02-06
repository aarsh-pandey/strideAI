from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv
import httpx

# Load environment variables
load_dotenv()

app = FastAPI(title="StrideAI Resolution Quest API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure OpenRouter API
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY not found in environment variables")

OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-exp:free")

print("✓ Environment loaded")
print(f"✓ Using model: {OPENROUTER_MODEL}")

class ResolutionRequest(BaseModel):
    goal: str
    category: str
    deadline: Optional[str] = None

class ResolutionResponse(BaseModel):
    feedback: str

@app.get("/")
def read_root():
    return {"message": "StrideAI Resolution Quest API", "status": "running"}

@app.post("/api/generate-roadmap", response_model=ResolutionResponse)
async def generate_roadmap(request: ResolutionRequest):
    """Generate an action plan roadmap for a New Year resolution using OpenRouter AI."""
    try:
        if not request.goal.strip():
            raise HTTPException(status_code=400, detail="Goal cannot be empty")
        
        # Create the prompt
        deadline_text = f"by {request.deadline}" if request.deadline else "as soon as possible"
        prompt = (
            f"I have a New Year resolution for 2026 in the category of {request.category}: "
            f'"{request.goal}". I want to achieve this {deadline_text}. '
            f"Please analyze this and give me 3 specific, small steps I can take next week to start, "
            f"and one possible obstacle to watch out for given the timeline."
        )
        
        # Call OpenRouter API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ]
                },
                timeout=30.0
            )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"OpenRouter API error: {response.text}"
            )
        
        data = response.json()
        response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        if not response_text:
            raise HTTPException(status_code=500, detail="No response from AI model")
        
        return ResolutionResponse(feedback=response_text)
    
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to AI model timed out")
    except Exception as e:
        print(f"Error generating roadmap: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating feedback: {str(e)}")

@app.get("/health")
def health_check():
    return {"status": "healthy"}

print("✓ Server module loaded successfully")
