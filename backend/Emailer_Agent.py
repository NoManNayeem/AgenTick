# agent.py

import os
import smtplib
from email.mime.text import MIMEText
import pandas as pd
from dotenv import load_dotenv
from typing import Dict, Optional
from sqlmodel import Session

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.memory.v2.db.sqlite import SqliteMemoryDb
from agno.memory.v2.memory import Memory
from agno.storage.sqlite import SqliteStorage
from agno.tools import tool
from agno.tools.reasoning import ReasoningTools

# --- Load environment variables ---
load_dotenv()
GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# --- Sample user data ---
user_df = pd.DataFrame([
    {"username": "nayeem", "email": "nayeem60151126@gmail.com", "name": "Nayeem"},
    {"username": "ayan", "email": "kf.ayan17@gmail.com", "name": "Ayan"},
    {"username": "abir", "email": "jbc.abeer@gmail.com", "name": "Abir"},
    {"username": "noman", "email": "jbc.nayeem@gmail.com", "name": "NoMan"},
])

# --- Tool: Find customer email ---
@tool
def find_customer_email(name: str) -> str:
    """
    Retrieve the email address of a customer by name from user_df.
    """
    match = user_df[user_df["name"].str.lower() == name.lower()]
    if not match.empty:
        return match.iloc[0]["email"]
    return "Email not found."

# --- Tool: Send email ---
@tool
def send_email(to: str, subject: str, body: str) -> str:
    """
    Send an email using Gmail's SMTP server.
    """
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        return "SMTP credentials are not set properly in the environment."

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = to

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
            server.send_message(msg)
        return "Email sent successfully."
    except Exception as e:
        return f"Failed to send email: {e}"

# --- SQLite setup ---
DB_FILE = "tmp/agent.db"
_AGENT_REGISTRY: Dict[int, Agent] = {}

# --- Get agent per conversation ---
def get_agent_for_conversation(conv_id: int, session: Optional[Session] = None) -> Agent:
    """
    Returns an Agent instance with conversation-scoped memory and session storage.
    """
    if conv_id in _AGENT_REGISTRY:
        return _AGENT_REGISTRY[conv_id]

    memory_table = f"agent_memories_conv_{conv_id}"
    storage_table = f"agent_sessions_conv_{conv_id}"

    instructions=[
        "You are a Frienly AI Assistant and Email Sender that can:",
        "1. You chat with users and answer their queries"
        "2. You can Look up customer email addresses",
        "3. Send emails to specified addresses",
        "4. When asked to send an email:",
        "a. Important: Draft the email professionally and send it to the user",
        "b. Ask for feedback and make any requested changes",
        "c. Important: Confirm the content of the email first and Only send after explicit confirmation. The user must look at the draft version and confirm",
        "d. Use Sender Name 'AgenTick Chatbot' ",
        "e. Be helpful and maintain a professional tone",
        "Use the appropriate tool based on the user's request."
    ],


    memory_db = SqliteMemoryDb(
        table_name=memory_table,
        db_file=DB_FILE,
    )
    memory = Memory(
        model=OpenAIChat(id="gpt-4", api_key=OPENAI_API_KEY),
        db=memory_db,
    )
    storage = SqliteStorage(
        table_name=storage_table,
        db_file=DB_FILE,
    )

    agent = Agent(
        model=OpenAIChat(id="gpt-4", api_key=OPENAI_API_KEY),
        tools=[
            ReasoningTools(add_instructions=True),
            find_customer_email,
            send_email
        ],
        instructions=instructions,
        memory=memory,
        enable_agentic_memory=True,
        enable_user_memories=True,
        storage=storage,
        add_history_to_messages=True,
        num_history_runs=3,
        markdown=True,
        show_tool_calls=True,
    )

    _AGENT_REGISTRY[conv_id] = agent
    return agent
