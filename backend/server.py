from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import os
from dotenv import load_dotenv
import opik
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langchain.agents import create_agent
from langchain.tools import tool


from opik import configure 
from opik.integrations.langchain import OpikTracer 

configure() 
opik_tracer = OpikTracer(thread_id='strideAI_thread') 

# Load environment variables
load_dotenv()

app = FastAPI(title="strideAI API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure OpenRouter API
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY not found in environment variables")

OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-exp:free")

# Initialize LangChain ChatOpenAI with OpenRouter
llm = ChatOpenAI(
    model=OPENROUTER_MODEL,
    openai_api_key=OPENROUTER_API_KEY,
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0.1,
)

# Configure Opik for observability
# OPIK_API_KEY = os.getenv("OPIK_API_KEY")
# OPIK_WORKSPACE = os.getenv("OPIK_WORKSPACE")
# opik_tracer = None

# if OPIK_API_KEY:
#     try:
#         if OPIK_WORKSPACE:
#             opik.configure(api_key=OPIK_API_KEY, workspace=OPIK_WORKSPACE)
#         else:
#             opik.configure(api_key=OPIK_API_KEY)
#         opik_tracer = OpikTracer(thread_id='resolution_quest')
#         print(f"✓ Opik observability enabled")
#     except Exception as e:
#         print(f"⚠ Opik configuration failed: {e}")

# Tool for getting current time
@tool
def current_time(tz: str = "UTC") -> str:
    """Get the current date/time in ISO format for a given IANA timezone."""
    return datetime.now(ZoneInfo(tz)).isoformat()

# Structured Output Schemas
class DailyTask(BaseModel):
    day: int = Field(description="Day number (1, 2, 3, etc.)")
    date: str = Field(description="The specific date (YYYY-MM-DD)")
    tasks: List[str] = Field(description="List of specific tasks for this day")

class CalendarPlan(BaseModel):
    overview: str = Field(description="Brief 2-3 sentence overview of the plan")
    daily_schedule: List[DailyTask] = Field(description="An entry for EVERY single day from start to end")
    total_days: int = Field(description="Total number of days in the plan")

class ResolutionRequest(BaseModel):
    goal: str
    category: str
    deadline: Optional[str] = None

class ResolutionResponse(BaseModel):
    feedback: str
    full_plan: str

class ConversationRequest(BaseModel):
    conversation: str

class ConversationResponse(BaseModel):
    goal: str

@app.get("/")
def read_root():
    return {"message": "strideAI API", "status": "running"}

@app.post("/api/summarize-conversation", response_model=ConversationResponse)
async def summarize_conversation(request: ConversationRequest):
    """
    Summarize a voice conversation into a clear, concise goal statement using an agent.
    """
    try:
        if not request.conversation.strip():
            raise HTTPException(status_code=400, detail="Conversation cannot be empty")
        
        # Create an agent for conversation summarization
        conversation_agent = create_agent(
            model=llm,
            tools=[current_time],
            system_prompt="""You are a goal extraction specialist. Based on conversations about 2026 goals,
extract and create clear, concise goal statements that capture the main objective.

The goal should be:
- Specific and actionable
- In 1-2 sentences maximum
- Written from the user's perspective (first person)
- Focus on the core objective they want to achieve"""
        )
        
        # Invoke the agent
        result = conversation_agent.invoke({
            "messages": [{
                "role": "user", 
                "content": f"Extract the goal from this conversation:\n\n{request.conversation}"
            }],
        },config={"callbacks": [opik_tracer]})
        
        # Extract the goal from the agent's response
        goal = result['messages'][-1].content.strip()
        
        # Remove quotes if LLM wrapped the response in them
        if goal.startswith('"') and goal.endswith('"'):
            goal = goal[1:-1]
        if goal.startswith("'") and goal.endswith("'"):
            goal = goal[1:-1]
        
        return ConversationResponse(goal=goal)
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error summarizing conversation: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error summarizing conversation: {str(e)}")

@app.post("/api/generate-roadmap", response_model=ResolutionResponse)
async def generate_roadmap(request: ResolutionRequest):
    """
    Generate an action plan roadmap for a New Year resolution using AI.
    """
    try:
        if not request.goal.strip():
            raise HTTPException(status_code=400, detail="Goal cannot be empty")
        
        # Get current date using the tool
        current_date_str = current_time.invoke({"tz": "UTC"})
        current_date = datetime.fromisoformat(current_date_str.replace('Z', '+00:00'))
        
        # Calculate days until deadline
        if request.deadline:
            deadline_date = datetime.fromisoformat(request.deadline.replace('Z', '+00:00'))
            # Ensure deadline is timezone-aware
            if deadline_date.tzinfo is None:
                deadline_date = deadline_date.replace(tzinfo=ZoneInfo("UTC"))
            days_until_deadline = (deadline_date - current_date).days
            if days_until_deadline < 1:
                days_until_deadline = 1  # At least 1 day
        else:
            # Default to 30 days (1 month) if no deadline
            days_until_deadline = 30
            deadline_date = current_date + timedelta(days=30)
        
        # Limit to reasonable number of days
        max_days = min(days_until_deadline, 90)
        
        print(f"Generating plan from {current_date.strftime('%Y-%m-%d')} to {deadline_date.strftime('%Y-%m-%d')} ({max_days} days)")
        
        # Generate date list for each day
        date_list = [(current_date + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(max_days)]
        
        # Generate plan in chunks if needed for large timelines
        if max_days <= 30:
            # Generate in one go for shorter timelines
            full_plan = await generate_daily_plan(request.goal, request.category, current_date, max_days, 1, max_days, date_list)
        else:
            # Generate in chunks for longer timelines
            chunks = []
            chunk_size = 15
            for start_day in range(1, max_days + 1, chunk_size):
                end_day = min(start_day + chunk_size - 1, max_days)
                chunk_plan = await generate_daily_plan(request.goal, request.category, current_date, max_days, start_day, end_day, date_list)
                chunks.append(chunk_plan)
            full_plan = "\n\n".join(chunks)
        
        # Ensure we have all days
        lines = full_plan.split('\n')
        found_days = set()
        for line in lines:
            if line.strip().startswith('## Day'):
                try:
                    day_num = int(line.strip().split('Day')[1].strip().split()[0])
                    found_days.add(day_num)
                except:
                    pass
        
        # Fill in any missing days
        missing_days = set(range(1, max_days + 1)) - found_days
        if missing_days:
            print(f"Filling in {len(missing_days)} missing days")
            additional_days = []
            for day in sorted(missing_days):
                day_date = date_list[day - 1]
                additional_days.append(f"\n## Day {day} ({day_date})")
                additional_days.append(f"- Continue practicing {request.goal}")
                additional_days.append(f"- Review concepts from previous days")
                additional_days.append(f"- Complete exercises and projects")
            full_plan += "\n" + "\n".join(additional_days)
        
        # Generate a brief summary using an agent
        try:
            summary_agent = create_agent(
                model=llm,
                tools=[],
                system_prompt="You are a motivational coach. Create brief, inspiring 2-3 sentence summaries for goal achievement plans."
            )
            
            summary_result = summary_agent.invoke({
                "messages": [{
                    "role": "user",
                    "content": f"Create a motivational summary for a {max_days}-day plan to achieve: {request.goal}"
                }]
            },config={"callbacks": [opik_tracer]})
            summary = summary_result['messages'][-1].content
        except:
            summary = f"Your {max_days}-day action plan for '{request.goal}' is ready! Download the calendar to see your daily tasks."
        
        print(f"Generated plan with {len(found_days)} days (filled {len(missing_days)} missing days)")
        
        return ResolutionResponse(feedback=summary, full_plan=full_plan)
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating roadmap: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating feedback: {str(e)}")

async def generate_daily_plan(goal: str, category: str, start_date: datetime, total_days: int, start_day: int, end_day: int, date_list: List[str]) -> str:
    """Generate a daily plan for a specific range of days using an agent."""
    
    num_days = end_day - start_day + 1
    
    # Create an agent for planning with access to current_time tool
    planning_agent = create_agent(
        model=llm,
        tools=[current_time],
        system_prompt="""You are an expert goal planning assistant. You create detailed, actionable daily plans 
that help people achieve their goals through progressive, structured learning and practice.

Your plans must:
- Include EVERY single day in the specified range with NO gaps
- Format each day as: ## Day X (YYYY-MM-DD)
- Provide 2-4 specific, concrete, actionable tasks per day
- Build progressive difficulty from basics to advanced
- Each day should logically build on previous days
- Tasks must be specific (e.g., "Complete 5 coding exercises on loops" NOT "practice loops")"""
    )
    
    # Create example days with actual dates
    example_days = []
    for i in range(min(3, num_days)):
        day_num = start_day + i
        day_date = date_list[day_num - 1] if day_num <= len(date_list) else "TBD"
        example_days.append(f"## Day {day_num} ({day_date})")
    
    prompt = f"""Create a detailed daily plan for days {start_day} to {end_day} of a {total_days}-day journey to achieve: "{goal}" (Category: {category})

Current Date: {start_date.strftime('%Y-%m-%d')}
Total Duration: {total_days} days

You MUST create entries for EVERY SINGLE DAY from Day {start_day} to Day {end_day}.

Format each day EXACTLY like this with the actual date:

## Day {start_day} ({date_list[start_day-1] if start_day <= len(date_list) else 'TBD'})
- [Specific actionable task 1]
- [Specific actionable task 2]
- [Specific actionable task 3]

## Day {start_day + 1} ({date_list[start_day] if start_day < len(date_list) else 'TBD'})
- [Specific actionable task 1]
- [Specific actionable task 2]
- [Specific actionable task 3]

...continue for ALL days through Day {end_day}

Example for "Learn Python" (Days 1-3):

## Day 1 (2026-02-05)
- Install Python 3.11, VS Code, and configure environment
- Learn print(), input(), variables, and basic data types
- Write 3 programs: calculator, name greeter, age calculator

## Day 2 (2026-02-06)
- Study lists, tuples, dictionaries, and sets
- Practice 10 data structure manipulation exercises
- Build a contact manager using dictionaries

## Day 3 (2026-02-07)
- Master if/else/elif and comparison operators
- Learn boolean logic with and/or/not operators
- Create a grade calculator and number guessing game

Now create a similarly detailed plan for "{goal}" covering ALL days from {start_day} to {end_day}.
Each day MUST include the actual date from the list provided."""

    result = planning_agent.invoke({
        "messages": [{"role": "user", "content": prompt}]
    },config={"callbacks": [opik_tracer]})
    
    return result['messages'][-1].content

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.on_event("startup")
async def startup_event():
    print("\n" + "="*60)
    print("🚀 strideAI Backend")
    print("="*60)
    print(f"✓ Server running at: http://localhost:8000")
    print(f"✓ Health check: http://localhost:8000/health")
    print(f"✓ API endpoint: http://localhost:8000/api/generate-roadmap")
    print("="*60 + "\n")

if __name__ == "__main__":
    import uvicorn
    print("Starting server...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
