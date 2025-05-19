# agent.py

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.memory.v2.db.sqlite import SqliteMemoryDb
from agno.memory.v2.memory import Memory
from agno.storage.sqlite import SqliteStorage
from agno.tools.reasoning import ReasoningTools
from typing import Dict, Optional
from sqlmodel import Session

# Shared SQLite file
DB_FILE = "tmp/agent.db"

# Agent cache
_AGENT_REGISTRY: Dict[int, Agent] = {}

def get_agent_for_conversation(conv_id: int, session: Optional[Session] = None) -> Agent:
    """
    Returns an Agent instance with conversation-scoped memory and session storage.
    """
    if conv_id in _AGENT_REGISTRY:
        return _AGENT_REGISTRY[conv_id]

    # Scoped table names for isolation
    memory_table = f"agent_memories_conv_{conv_id}"
    storage_table = f"agent_sessions_conv_{conv_id}"

    # Define system instructions
    system_prompt = """You are a helpful AI assistant.

Use your own knowledge to answer questions about books, movies, or other cultural topics.
Avoid calling external tools unless explicitly required by the user."""

    # Memory setup
    memory_db = SqliteMemoryDb(
        table_name=memory_table,
        db_file=DB_FILE,
    )
    memory = Memory(
        model=OpenAIChat(id="gpt-4"),
        db=memory_db,
    )

    # Chat history setup
    storage = SqliteStorage(
        table_name=storage_table,
        db_file=DB_FILE,
    )

    # Build the agent
    agent = Agent(
        model=OpenAIChat(id="gpt-4"),
        tools=[ReasoningTools(add_instructions=True)],
        description=system_prompt,

        # Memory configuration
        memory=memory,
        enable_agentic_memory=True,
        enable_user_memories=True,

        # Chat history configuration
        storage=storage,
        add_history_to_messages=True,
        num_history_runs=3,

        # Presentation settings
        markdown=True,
        show_tool_calls=True,
    )

    _AGENT_REGISTRY[conv_id] = agent
    return agent
