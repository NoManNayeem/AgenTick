# main.py
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, select, Session
from datetime import datetime
from database import engine, get_session
from models import User, Conversation, Message
from auth import hash_password, verify_password, create_access_token, decode_access_token
from pydantic import BaseModel
from agent import agent

# Initialize DB tables
SQLModel.metadata.create_all(engine)

app = FastAPI(title="AgenTick Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Schemas
class RegisterRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

@app.post("/register", response_model=TokenResponse)
def register(data: RegisterRequest, session: Session = Depends(get_session)):
    if session.exec(select(User).where(User.username == data.username)).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    user = User(username=data.username, hashed_password=hash_password(data.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    token = create_access_token(sub=user.username)
    return {"access_token": token}

@app.post("/login", response_model=TokenResponse)
def login(data: RegisterRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == data.username)).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(sub=user.username)
    return {"access_token": token}

@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket, token: str):
    # Authenticate
    await websocket.accept()
    username = decode_access_token(token)
    if not username:
        await websocket.close(code=1008)
        return

    # Create DB session and conversation
    session = Session(engine)
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        await websocket.close(code=1008)
        return
    conv = Conversation(user_id=user.id)
    session.add(conv)
    session.commit()
    session.refresh(conv)

    try:
        while True:
            user_msg = await websocket.receive_text()
            # Persist user message
            session.add(
                Message(
                    conversation_id=conv.id,
                    sender="user",
                    content=user_msg,
                    timestamp=datetime.utcnow()
                )
            )
            session.commit()

            # Generate response
            try:
                response = agent.run(
                    message=user_msg,
                    stream=False,
                    tools=None
                )
                text = getattr(response, "content", str(response))

                # Persist agent message
                session.add(
                    Message(
                        conversation_id=conv.id,
                        sender="agent",
                        content=text,
                        timestamp=datetime.utcnow()
                    )
                )
                session.commit()

                await websocket.send_text(text)

            except Exception:
                await websocket.send_text(
                    "⚠️ Sorry, I couldn't generate a response. Please try again."
                )
    except WebSocketDisconnect:
        session.close()
    except Exception:
        try:
            await websocket.send_text("❌ Unexpected server error.")
        except:
            pass
        await websocket.close(code=1011)
        session.close()

# New endpoint to fetch conversation history
@app.get("/conversations/{conv_id}/messages")
def get_conversation_messages(conv_id: int, session: Session = Depends(get_session)):
    msgs = session.exec(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.timestamp)
    ).all()
    return [
        {"from": msg.sender, "text": msg.content, "timestamp": msg.timestamp.isoformat()}
        for msg in msgs
    ]

# Optional: list all user conversations
@app.get("/conversations")
def list_conversations(session: Session = Depends(get_session), token: str = ""):
    username = decode_access_token(token)
    user = session.exec(select(User).where(User.username == username)).first()
    convs = session.exec(
        select(Conversation).where(Conversation.user_id == user.id)
    ).all()
    return [ {"id": c.id, "created_at": c.created_at.isoformat()} for c in convs ]
