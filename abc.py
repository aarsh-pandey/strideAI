import os
from typing import List, TypedDict
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv
load_dotenv(override=True)

# --- 1. Define the State ---
# This object is passed between agents, carrying the plan as it grows.
class AgentState(TypedDict):
    resolution: str
    monthly_plan: List[str]
    weekly_plan: List[str]
    daily_plan: List[str]
    target_month: int # Which month are we currently detailing?

# --- 2. Define Structured Output Schemas ---
class MonthBreakdown(BaseModel):
    months: List[str] = Field(description="12 monthly goals")

class WeekBreakdown(BaseModel):
    weeks: List[str] = Field(description="4 weekly focus areas for the chosen month")

class DayBreakdown(BaseModel):
    days: List[str] = Field(description="7 daily tasks for the chosen week")

# --- 3. The Agents (Nodes) ---
llm = ChatOpenAI(base_url=os.getenv('BASE_URL'),
                    api_key=os.getenv('API_KEY'),
                    model=os.getenv('MODEL_NAME'), 
                    temperature=0.1)


def milestone_agent(state: AgentState):
    """Breaks the resolution into 12 months."""
    structured_llm = llm.with_structured_output(MonthBreakdown)
    response = structured_llm.invoke(f"Break this resolution into 12 monthly milestones: {state['resolution']}")
    return {"monthly_plan": response.months}

def weekly_agent(state: AgentState):
    """Breaks a specific month into 4 weeks."""
    month_goal = state['monthly_plan'][state['target_month'] - 1]
    structured_llm = llm.with_structured_output(WeekBreakdown)
    response = structured_llm.invoke(f"The goal for Month {state['target_month']} is: {month_goal}. Break it into 4 weeks.")
    return {"weekly_plan": response.weeks}

def daily_agent(state: AgentState):
    """Breaks the first week into 7 daily tasks."""
    week_goal = state['weekly_plan'][0] # Detailing the first week of that month
    structured_llm = llm.with_structured_output(DayBreakdown)
    response = structured_llm.invoke(f"The goal for this week is: {week_goal}. Give me 7 daily actionable tasks.")
    return {"daily_plan": response.days}

# --- 4. Building the Graph ---
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("milestone_planner", milestone_agent)
workflow.add_node("weekly_planner", weekly_agent)
workflow.add_node("daily_planner", daily_agent)

# Define the flow (The sequence)
workflow.set_entry_point("milestone_planner")
workflow.add_edge("milestone_planner", "weekly_planner")
workflow.add_edge("weekly_planner", "daily_planner")
workflow.add_edge("daily_planner", END)

# Compile
app = workflow.compile()

# --- 5. Execution ---
if __name__ == "__main__":
    inputs = {
        "resolution": "Master Python and build 5 AI projects",
        "target_month": 2  # We want to detail the first month
    }
    
    for output in app.stream(inputs):
        for key, value in output.items():
            print(f"\n--- Output from {key} ---")
            print(value)