# main.py

from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import SQLModel, select, Session, func
from datetime import datetime, timezone
from database import engine, get_session
from models import User, Conversation, Message
from auth import hash_password, verify_password, create_access_token, decode_access_token
from pydantic import BaseModel
from agent import agent

# Initialize DB tables
SQLModel.metadata.create_all(engine)

app = FastAPI(title="AgenTick Backend")

# CORS configuration
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency: retrieve current user from OAuth2 Bearer token
def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session)
) -> User:
    username = decode_access_token(token)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# Request/response models
class RegisterRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

@app.post("/register", response_model=TokenResponse)
def register(
    data: RegisterRequest,
    session: Session = Depends(get_session)
):
    """
    Create a new user and return a JWT access token.
    """
    if session.exec(select(User).where(User.username == data.username)).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    user = User(
        username=data.username,
        hashed_password=hash_password(data.password)
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    token = create_access_token(sub=user.username)
    return {"access_token": token}

@app.post("/login", response_model=TokenResponse)
def login(
    data: RegisterRequest,
    session: Session = Depends(get_session)
):
    """
    Validate user credentials and return a JWT access token.
    """
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
    """
    WebSocket endpoint for real-time chat. Accepts a token as query parameter.
    """
    await websocket.accept()
    username = decode_access_token(token)
    if not username:
        await websocket.close(code=1008)
        return

    session = Session(engine)
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        await websocket.close(code=1008)
        session.close()
        return

    # Start a new conversation
    conv = Conversation(user_id=user.id)
    session.add(conv)
    session.commit()
    session.refresh(conv)

    # Send init message with conversation ID
    await websocket.send_json({"type": "init", "convId": conv.id})

    try:
        while True:
            msg = await websocket.receive_text()
            # Save user message
            session.add(
                Message(
                    conversation_id=conv.id,
                    sender="user",
                    content=msg,
                    timestamp=datetime.now(timezone.utc)
                )
            )
            session.commit()

            # Generate and save agent response
            try:
                resp = agent.run(message=msg, stream=False, tools=None)
                text = getattr(resp, "content", str(resp))
            except Exception:
                text = "⚠️ Sorry, I couldn't generate a response. Please try again."
            session.add(
                Message(
                    conversation_id=conv.id,
                    sender="agent",
                    content=text,
                    timestamp=datetime.now(timezone.utc)
                )
            )
            session.commit()

            await websocket.send_text(text)

    except WebSocketDisconnect:
        session.close()
    except Exception:
        try:
            await websocket.send_text("❌ Unexpected server error.")
        except:
            pass
        await websocket.close(code=1011)
        session.close()

@app.get("/conversations/{conv_id}/messages")
def get_conversation_messages(
    conv_id: int,
    skip: int = 0,
    limit: int = 50,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Return paginated chat history for an authenticated user.
    """
    # Ensure user owns the conversation
    conv = session.get(Conversation, conv_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Get total count
    total_count = session.exec(
        select(func.count(Message.id)).where(Message.conversation_id == conv_id)
    ).first() or 0

    # Fetch page
    msgs = session.exec(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.timestamp)
        .offset(skip)
        .limit(limit)
    ).all()
    data = [
        {"from": m.sender, "text": m.content, "timestamp": m.timestamp.isoformat()}
        for m in msgs
    ]
    return {"messages": data, "has_more": total_count > skip + len(data)}

@app.get("/conversations")
def list_conversations(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List all conversations for the authenticated user.
    """
    convs = session.exec(
        select(Conversation).where(Conversation.user_id == current_user.id)
    ).all()
    return [
        {"id": c.id, "created_at": c.created_at.isoformat()}
        for c in convs
    ]
