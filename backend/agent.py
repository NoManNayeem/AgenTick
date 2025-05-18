from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.memory.v2.db.sqlite import SqliteMemoryDb
from agno.memory.v2.memory import Memory
from agno.storage.sqlite import SqliteStorage
from agno.tools.reasoning import ReasoningTools

# Set up database file for memory and storage
db_file = "tmp/agent.db"

# Initialize memory
memory = Memory(
    model=OpenAIChat(id="gpt-4"),
    db=SqliteMemoryDb(table_name="user_memories", db_file=db_file),
)

# Initialize storage for chat history
storage = SqliteStorage(table_name="agent_sessions", db_file=db_file)

# Initialize the conversational agent
agent = Agent(
    model=OpenAIChat(id="gpt-4"),
    tools=[ReasoningTools(add_instructions=True)],
    # Memory configuration
    memory=memory,
    enable_agentic_memory=True,
    enable_user_memories=True,
    # Storage configuration
    storage=storage,
    add_history_to_messages=True,
    num_history_runs=3,
    # Other settings
    markdown=True,
    show_tool_calls=True
)