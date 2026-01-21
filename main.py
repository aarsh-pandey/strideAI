import os
from typing import List
from pydantic import BaseModel, Field
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain.tools import tool
from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
load_dotenv(override=True)
# --- 1. Database Persistence (SQLAlchemy) ---
Base = declarative_base()

class ResolutionEntry(Base):
    __tablename__ = 'resolution_plans'
    id = Column(Integer, primary_key=True)
    resolution = Column(String(500))
    plan_json = Column(Text)

engine = create_engine('sqlite:///stride_resolutions.db')
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)


@tool
def save_resolution_to_db(resolution: str, plan_summary: str) -> str:
    """Saves the resolution and the generated milestones to the database."""
    session = Session()
    try:
        new_entry = ResolutionEntry(resolution=resolution, plan_json=plan_summary)
        session.add(new_entry)
        session.commit()
        return "Successfully saved to database."
    except Exception as e:
        session.rollback()
        return f"Error saving to database: {str(e)}"
    finally:
        session.close()

# --- 2. Structured Output Schema ---
class Milestone(BaseModel):
    period: str = Field(description="The timeframe (e.g., 'Month 1', 'Week 1', 'Daily')")
    task: str = Field(description="The specific actionable milestone or habit")
    focus: str = Field(description="The primary objective for this unit")

class CalendarPlan(BaseModel):
    monthly_milestones: List[Milestone] = Field(description="12 monthly high-level goals")
    weekly_breakdown: List[Milestone] = Field(description="Weekly focus areas for the first month")
    daily_habits: List[str] = Field(description="Consistent daily actions to maintain momentum")

# --- 3. Agent Configuration ---
def run_resolution_agent(user_resolution: str):
    # Initialize the model (v1 uses improved content blocks)
    llm = ChatOpenAI(base_url=os.getenv('BASE_URL'),
                     api_key=os.getenv('API_KEY'),
                     model=os.getenv('MODEL_NAME'), 
                     temperature=0.1)

    # create_agent is the v1 standard for building ReAct-style agents
    agent = create_agent(
        model=llm,
        tools=[save_resolution_to_db],
        system_prompt=(
            "You are a strategic planning agent. Your goal is to take a user's "
            "New Year's resolution and decompose it into a structured calendar. "
            "First, save the resolution and a brief summary of the plan using the provided tool. "
            "Then, return the full structured calendar plan to the user."
        ),
        response_format=CalendarPlan  # Ensures the agent returns the exact Pydantic schema
    )

    # Execution using the v1 invoke pattern
    # The 'messages' key is the standard input for v1 agents
    result = agent.invoke({
        "messages": [
            {"role": "user", "content": f"My resolution is: {user_resolution}"}
        ]
    })

    return result["structured_response"]

# --- 4. Main Execution ---
if __name__ == "__main__":
    goal = "I want to become proficient in Python for AI development by June."
    print(f"Plan for: {goal}\n")
    
    final_plan = run_resolution_agent(goal)
    
    print("--- Monthly Milestones ---")
    for m in final_plan.monthly_milestones:
        print(f"[{m.period}] {m.task} - Focus: {m.focus}")

    print("\n--- Weekly Breakdown (Month 1) ---")
    for w in final_plan.weekly_breakdown:
        print(f"[{w.period}] {w.task} - Focus: {w.focus}")
    
    print("\n--- Daily Habits ---")
    for habit in final_plan.daily_habits:
        print(f"* {habit}")