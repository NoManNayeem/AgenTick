// frontend/app/dashboard/page.js
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FaSignOutAlt,
  FaCircle,
  FaRobot,
  FaArrowUp,
  FaSpinner,
  FaComments,
} from "react-icons/fa";
import { motion } from "framer-motion";
import ChatWindow from "../components/ChatWindow";
import ChatInput from "../components/ChatInput";

export default function DashboardPage() {
  const router = useRouter();
  const ws = useRef(null);

  // — IDs —
  const [wsConvId, setWsConvId] = useState(null);         // WebSocket conversation
  const [activeConvId, setActiveConvId] = useState(null); // Which one we’re viewing

  // — Message stores —
  const [history, setHistory] = useState([]);   // loaded from BE for activeConvId
  const [sessionMsgs, setSessionMsgs] = useState([]); // live chat on wsConvId

  // — Conversation list —
  const [convs, setConvs] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(false);

  // — Pagination for history —
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const lastLoaded = useRef(null);

  // — UI states —
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  // — Auth check & restore last active —
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return router.replace("/");

    const storedActive = localStorage.getItem("activeConvId");
    if (storedActive) setActiveConvId(Number(storedActive));

    const storedSession = localStorage.getItem("sessionMsgs");
    if (storedSession) setSessionMsgs(JSON.parse(storedSession));

    fetchConversations(token);
  }, [router]);

  // — Persist activeConvId & sessionMsgs —
  useEffect(() => {
    if (activeConvId != null) {
      localStorage.setItem("activeConvId", activeConvId);
    }
  }, [activeConvId]);

  useEffect(() => {
    localStorage.setItem("sessionMsgs", JSON.stringify(sessionMsgs));
  }, [sessionMsgs]);

  // — Fetch conversation list —
  async function fetchConversations(token) {
    setLoadingConvs(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = await res.json();
      setConvs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConvs(false);
    }
  }

  // — Load paginated history for activeConvId —
  async function loadHistory(offset = 0) {
    if (!activeConvId) return;
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/conversations/${activeConvId}/messages?skip=${offset}&limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("History fetch failed");
      const { messages: msgs, has_more } = await res.json();
      setHistory(prev => [...msgs, ...prev]);
      setSkip(offset + msgs.length);
      setHasMore(has_more);
      if (offset === 0) setHistoryLoaded(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  }

  // — On activeConvId change, load first page once —
  useEffect(() => {
    if (
      activeConvId != null &&
      lastLoaded.current !== activeConvId
    ) {
      setHistory([]);
      setSkip(0);
      setHasMore(false);
      loadHistory(0);
      lastLoaded.current = activeConvId;
    }
  }, [activeConvId]);

  // — Open WS for new chat conv —
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const socket = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}?token=${token}`
    );
    ws.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onmessage = evt => {
      // init message
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "init") {
          setWsConvId(data.convId);
          // if no active set yet, default to this
          if (activeConvId == null) setActiveConvId(data.convId);
          return;
        }
      } catch {}
      // real agent reply
      setIsWaiting(false);
      setSessionMsgs(prev => [...prev, { from: "agent", text: evt.data }]);
    };
    socket.onerror = () => setConnected(false);
    socket.onclose = () => setConnected(false);
    return () => socket.close();
    // we only want this once
  }, []);

  // — Send a new message on WS —
  function handleSend(text) {
    if (ws.current && connected) {
      setSessionMsgs(prev => [...prev, { from: "user", text }]);
      setIsWaiting(true);
      ws.current.send(text);
    } else {
      setSessionMsgs(prev => [
        ...prev,
        { from: "system", text: "Connection lost. Please logout & retry." },
      ]);
    }
  }

  // — Switch view to an existing conversation —
  function viewConversation(id) {
    setActiveConvId(id);
  }

  // — Logout & cleanup —
  function handleLogout() {
    ws.current?.close();
    localStorage.clear();
    router.push("/");
  }

  // — Build final message array —
  const displayedMessages =
    activeConvId === wsConvId
      ? [...history, ...sessionMsgs]
      : history;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r overflow-y-auto">
        <div className="p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-1">
            <FaComments /> <span>Conversations</span>
          </h3>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-red-500"
          >
            <FaSignOutAlt />
          </button>
        </div>
        {loadingConvs ? (
          <div className="p-4 text-center text-gray-500">
            <FaSpinner className="animate-spin mx-auto" />
            Loading…
          </div>
        ) : (
          <ul>
            {convs.map((c) => (
              <li
                key={c.id}
                onClick={() => viewConversation(c.id)}
                className={`cursor-pointer px-4 py-2 hover:bg-blue-50 flex justify-between items-center ${
                  c.id === activeConvId
                    ? "bg-blue-100 text-blue-800 font-medium"
                    : "text-gray-700"
                }`}
              >
                <span>Chat #{c.id}</span>
                <span className="text-xs text-gray-500">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white px-6 py-4 shadow flex items-center justify-between">
          <motion.h2
            className="text-2xl font-bold text-blue-800 flex items-center space-x-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <FaRobot className="text-blue-500" />
            <span>AgenTick Chat</span>
          </motion.h2>
          <div className="flex items-center space-x-4">
            <motion.div
              className="flex items-center text-sm"
              animate={{
                scale: connected ? [1, 1.2, 1] : [1, 0.8, 1],
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <FaCircle
                className={`mr-1 ${
                  connected ? "text-green-500" : "text-red-400"
                }`}
              />
              <span
                className={
                  connected ? "text-green-600" : "text-red-600"
                }
              >
                {connected ? "Live" : "Offline"}
              </span>
            </motion.div>
          </div>
        </header>

        {/* Load earlier messages */}
        {hasMore && (
          <div className="flex justify-center p-2">
            <motion.button
              onClick={() => loadHistory(skip)}
              disabled={loadingHistory}
              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {loadingHistory ? (
                <FaSpinner className="animate-spin" />
              ) : (
                <FaArrowUp />
              )}
              <span>
                {loadingHistory ? "Loading..." : "Load earlier messages"}
              </span>
            </motion.button>
          </div>
        )}

        {/* Chat window or loader */}
        {!historyLoaded ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <FaSpinner className="animate-spin mr-2" />
            <span>Loading conversation…</span>
          </div>
        ) : (
          <ChatWindow
            messages={displayedMessages}
            isThinking={activeConvId === wsConvId && isWaiting}
          />
        )}

        {/* Input only for live conversation */}
        {historyLoaded && activeConvId === wsConvId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-gray-200"
          >
            <ChatInput onSend={handleSend} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
