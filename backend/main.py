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
from agent import get_agent_for_conversation

SQLModel.metadata.create_all(engine)

app = FastAPI(title="AgenTick Backend")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependencies
def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
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

# Auth endpoints
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
            detail="Username already registered",
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

# Conversation management
class ConversationCreate(BaseModel):
    title: str
    topic: str | None = None

class ConversationRead(BaseModel):
    id: int
    title: str
    topic: str | None
    created_at: datetime
    updated_at: datetime

class ConversationUpdate(BaseModel):
    title: str | None = None
    topic: str | None = None

@app.post("/conversations", response_model=ConversationRead)
def create_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    conv = Conversation(user_id=current_user.id, title=data.title, topic=data.topic)
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return conv

@app.get("/conversations", response_model=list[ConversationRead])
def list_conversations(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    convs = session.exec(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    ).all()
    return convs

@app.patch("/conversations/{conv_id}", response_model=ConversationRead)
def update_conversation(
    conv_id: int,
    data: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    conv = session.get(Conversation, conv_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if data.title is not None:
        conv.title = data.title
    if data.topic is not None:
        conv.topic = data.topic
    conv.updated_at = datetime.now(timezone.utc)
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return conv

@app.delete("/conversations/{conv_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    conv = session.get(Conversation, conv_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    session.delete(conv)
    session.commit()
    return

# Message history
@app.get("/conversations/{conv_id}/messages")
def get_conversation_messages(
    conv_id: int,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    conv = session.get(Conversation, conv_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    total_count = session.exec(select(func.count(Message.id)).where(Message.conversation_id == conv_id)).first() or 0

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
    return {"conversation": {"id": conv.id, "title": conv.title, "topic": conv.topic}, "messages": data, "has_more": total_count > skip + len(data)}



# ─── WebSocket Chat ────────────────────────────────────────────────────────────
@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    # Accept and parse query params
    await websocket.accept()
    params = websocket.query_params
    token = params.get("token") or ""
    conv_id = params.get("convId")
    username = decode_access_token(token)
    if not username or not conv_id:
        await websocket.close(code=1008)
        return

    session = Session(engine)
    user = session.exec(select(User).where(User.username == username)).first()
    conv = session.get(Conversation, int(conv_id))
    if not user or not conv or conv.user_id != user.id:
        await websocket.close(code=1008)
        session.close()
        return

    # Send back confirmation
    await websocket.send_json({
        "type": "init",
        "convId": conv.id,
        "title": conv.title,
        "topic": conv.topic,
    })

    try:
        while True:
            text = await websocket.receive_text()
            now = datetime.now(timezone.utc)

            # Save user message and bump conversation
            session.add(Message(conversation_id=conv.id, sender="user", content=text, timestamp=now))
            conv.updated_at = now
            session.add(conv)
            session.commit()

            # Generate and save agent response via per-conv agent
            agent_inst = get_agent_for_conversation(conv.id)
            try:
                resp = agent_inst.run(message=text, stream=False, tools=None)
                reply = getattr(resp, "content", str(resp))
            except:
                reply = "⚠️ Sorry, I couldn't generate a response. Please try again."

            now = datetime.now(timezone.utc)
            session.add(Message(conversation_id=conv.id, sender="agent", content=reply, timestamp=now))
            conv.updated_at = now
            session.add(conv)
            session.commit()

            await websocket.send_text(reply)

    except WebSocketDisconnect:
        session.close()
    except Exception:
        try:
            await websocket.send_text("❌ Unexpected server error.")
        except:
            pass
        await websocket.close(code=1011)
        session.close()
# ────────────────────────────────────────────────────────────────────────────────
