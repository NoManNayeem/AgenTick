# agent.py

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.memory.v2.db.sqlite import SqliteMemoryDb
from agno.memory.v2.memory import Memory
from agno.storage.sqlite import SqliteStorage
from agno.tools.reasoning import ReasoningTools
from typing import Dict, Optional
from sqlmodel import Session

# Shared database file for all conversations
DB_FILE = "tmp/agent.db"

# Cache agents per conversation to reuse connections
_AGENT_REGISTRY: Dict[int, Agent] = {}

def get_agent_for_conversation(conv_id: int, session: Optional[Session] = None) -> Agent:
    """
    Return (and cache) an Agent instance configured
    with memory and storage scoped to the given conversation ID.
    """
    if conv_id in _AGENT_REGISTRY:
        return _AGENT_REGISTRY[conv_id]

    # Define system instructions
    system_prompt = """You are a helpful AI assistant.

    When answering questions about movies, books, or similar topics, use your general knowledge instead of attempting to call specialized functions.
    Always use your built-in knowledge to answer questions about specific content like movies, TV shows, books, etc."""

    # Per-conversation memory table
    memory_db = SqliteMemoryDb(
        table_name="agent_memories",
        db_file=DB_FILE
    )
    memory = Memory(
        model=OpenAIChat(id="gpt-4"),
        db=memory_db
    )

    # Per-conversation chat history storage
    storage = SqliteStorage(
        table_name="agent_sessions",
        db_file=DB_FILE
    )

    agent = Agent(
        model=OpenAIChat(id="gpt-4"),
        tools=[ReasoningTools(add_instructions=True)],
        system_prompt=system_prompt,
        # Memory config
        memory=memory,
        enable_agentic_memory=True,
        enable_user_memories=True,
        # Storage config
        storage=storage,
        add_history_to_messages=True,
        num_history_runs=3,
        # Presentation
        markdown=True,
        show_tool_calls=True
    )

    _AGENT_REGISTRY[conv_id] = agent
    return agent