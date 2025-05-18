# agent.py

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.memory.v2.db.sqlite import SqliteMemoryDb
from agno.memory.v2.memory import Memory
from agno.storage.sqlite import SqliteStorage
from agno.tools.reasoning import ReasoningTools
from typing import Dict, Optional
from sqlmodel import Session, select

# Shared database file for all conversations
DB_FILE = "tmp/agent.db"

# Cache agents per conversation to reuse connections
_AGENT_REGISTRY: Dict[int, Agent] = {}

def get_agent_for_conversation(conv_id: int, session: Optional[Session] = None) -> Agent:
    """
    Return (and cache) an Agent instance configured
    with memory and storage scoped to the given conversation ID.
    
    If session is provided, initializes agent with recent message history.
    """
    if conv_id in _AGENT_REGISTRY:
        return _AGENT_REGISTRY[conv_id]

    # Per-conversation memory table
    memory_db = SqliteMemoryDb(
        table_name=f"user_memories_{conv_id}",
        db_file=DB_FILE
    )
    memory = Memory(
        model=OpenAIChat(id="gpt-4"),
        db=memory_db
    )

    # Per-conversation chat history storage
    storage = SqliteStorage(
        table_name=f"agent_sessions_{conv_id}",
        db_file=DB_FILE
    )

    agent = Agent(
        model=OpenAIChat(id="gpt-4"),
        tools=[ReasoningTools(add_instructions=True)],
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
    
    # Initialize with conversation history if session is provided
    if session:
        # Import here to avoid circular imports
        from models import Message
        
        # Get the last 6 messages (3 exchanges = 3 pairs of user+agent messages)
        recent_messages = session.exec(
            select(Message)
            .where(Message.conversation_id == conv_id)
            .order_by(Message.timestamp)
            .limit(6)
        ).all()
        
        # Add messages to agent's storage to initialize history
        for msg in recent_messages:
            role = "user" if msg.sender == "user" else "assistant"
            # Use storage's add method to insert messages into history
            storage.add({"role": role, "content": msg.content})

    _AGENT_REGISTRY[conv_id] = agent
    return agent
