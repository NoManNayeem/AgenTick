"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FaSignOutAlt,
  FaCircle,
  FaComments,
  FaPlus,
  FaSpinner,
  FaRobot,
  FaArrowUp,
  FaRegCommentDots,
  FaEdit,
  FaTrash,
  FaExclamationTriangle
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import ChatWindow from "../components/ChatWindow";
import ChatInput from "../components/ChatInput";

export default function DashboardPage() {
  const router = useRouter();
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const chatContainerRef = useRef(null);

  // — IDs —
  const [wsConvId, setWsConvId] = useState(null);
  const [activeConvId, setActiveConvId] = useState(null);

  // — Data stores —
  const [convs, setConvs] = useState([]);
  const [history, setHistory] = useState([]);
  const [sessionMsgs, setSessionMsgs] = useState([]);

  // — UI states —
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const lastLoaded = useRef(null);
  const [connectionState, setConnectionState] = useState('disconnected'); // 'connecting', 'connected', 'disconnected', 'error'
  const [isWaiting, setIsWaiting] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [editingConv, setEditingConv] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

  // Add this helper function in your DashboardPage component
  const truncateTitle = (title, maxLength) => {
    if (title.length > maxLength) {
      return title.substring(0, maxLength) + '...'; // Add ellipsis if truncated
    }
    return title;
  };

  // — Auth & initial load —
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/");
      return;
    }
    
    // Validate token before proceeding
    validateToken(token).then(valid => {
      if (valid) {
        loadConversations(token);
      } else {
        handleLogout();
      }
    });
  }, [router]);

  // Validate the stored token
  async function validateToken(token) {
    try {
      // Using conversations endpoint to check if token is valid
      const res = await fetch(`${API}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch (e) {
      console.error("Token validation failed:", e);
      return false;
    }
  }

  // — Fetch or auto-create conversations —
  async function loadConversations(token) {
    setLoadingConvs(true);
    setError(null);
    
    try {
      const res = await fetch(`${API}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        throw new Error(`Failed to load conversations: ${res.status}`);
      }
      
      const list = await res.json();
      
      if (list.length === 0) {
        const timestamp = new Date().toLocaleString();
        const title = `New Conversation – ${timestamp}`;
        
        const cRes = await fetch(`${API}/conversations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title, topic: null }),
        });
        
        if (!cRes.ok) {
          throw new Error(`Failed to create conversation: ${cRes.status}`);
        }
        
        const created = await cRes.json();
        setConvs([created]);
        setActiveConvId(created.id);
      } else {
        setConvs(list);
        const stored = localStorage.getItem("activeConvId");
        const storedId = stored ? Number(stored) : null;
        
        // Check if stored ID exists in loaded conversations
        const validStoredId = storedId && list.some(conv => conv.id === storedId);
        setActiveConvId(validStoredId ? storedId : list[0].id);
      }
    } catch (e) {
      console.error("Conversations load/create error:", e);
      setError("Failed to load conversations. Please refresh or try again later.");
    } finally {
      setLoadingConvs(false);
    }
  }

  // — Create new conversation manually —
  async function createConversation() {
    const title = prompt("Title for your new chat:", "");
    if (title === null) return;
    
    const token = localStorage.getItem("token");
    setError(null);
    
    try {
      const res = await fetch(`${API}/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: title || `New Conversation (${new Date().toLocaleString()})`, topic: null }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to create conversation: ${res.status}`);
      }
      
      const conv = await res.json();
      
      // Update local conversations list without reload
      setConvs(prev => [conv, ...prev]);
      setActiveConvId(conv.id);
    } catch (e) {
      console.error("Create conversation error:", e);
      setError("Could not create conversation. Please try again.");
    }
  }

  // — Update conversation title —
  async function updateConversation(id, newTitle) {
    if (!newTitle.trim() || !id) {
      setEditingConv(null);
      return;
    }
    
    const token = localStorage.getItem("token");
    
    try {
      const res = await fetch(`${API}/conversations/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to update: ${res.status}`);
      }
      
      const updated = await res.json();
      
      setConvs(prev => prev.map(c => 
        c.id === id ? { ...c, title: updated.title, topic: updated.topic } : c
      ));
    } catch (e) {
      console.error("Update conversation error:", e);
      setError("Failed to update conversation title.");
    } finally {
      setEditingConv(null);
    }
  }

  // — Delete conversation —
  async function deleteConversation(id) {
    const token = localStorage.getItem("token");
    setError(null);
    
    try {
      const res = await fetch(`${API}/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        throw new Error(`Failed to delete: ${res.status}`);
      }
      
      // Update locally
      const newConvs = convs.filter(c => c.id !== id);
      setConvs(newConvs);
      
      // If deleted the active conversation, switch to another one
      if (activeConvId === id) {
        if (newConvs.length > 0) {
          setActiveConvId(newConvs[0].id);
        } else {
          // Create a new conversation if none left
          await createConversation();
        }
      }
    } catch (e) {
      console.error("Delete conversation error:", e);
      setError("Failed to delete conversation.");
    } finally {
      setDeleteConfirm(null);
    }
  }

  // — Select conversation —
  function selectConversation(id) {
    if (id === activeConvId) return;
    
    setActiveConvId(id);
    setHistory([]);
    setSkip(0);
    setHasMore(false);
    setSessionMsgs([]);
    setWsConvId(null);
    setHistoryLoaded(false);
    setError(null);
    localStorage.setItem("activeConvId", id);
  }

  // — Load history —
  async function loadHistory(offset = 0) {
    if (!activeConvId) return;
    
    setLoadingHistory(true);
    setError(null);
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API}/conversations/${activeConvId}/messages?skip=${offset}&limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!res.ok) {
        throw new Error(`Failed to load messages: ${res.status}`);
      }
      
      const data = await res.json();
      const { messages: msgs = [], has_more } = data;
      
      if (offset === 0) {
        setHistory(msgs);
      } else {
        setHistory(prev => [...msgs, ...prev]);
      }
      
      setSkip(offset + (msgs?.length || 0));
      setHasMore(has_more);
      
      if (offset === 0) {
        setHistoryLoaded(true);
      }
    } catch (e) {
      console.error("History load error:", e);
      setError("Failed to load conversation history.");
    } finally {
      setLoadingHistory(false);
    }
  }

  // — Initial history load per conversation —
  useEffect(() => {
    if (activeConvId != null && lastLoaded.current !== activeConvId) {
      loadHistory(0);
      lastLoaded.current = activeConvId;
    }
  }, [activeConvId]);

  // — WebSocket connection management —
  useEffect(() => {
    // Clear any existing connections and timers
    wsRef.current?.close();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    setConnectionState('disconnected');
    setWsConvId(null);
    
    if (!activeConvId) return;
    
    const token = localStorage.getItem("token");
    if (!token) return;

    function connect() {
      setConnectionState('connecting');
      
      // FIXED: Ensure correct WebSocket URL - don't duplicate path segments
      const wsUrl = `${WS_BASE}?token=${token}&convId=${activeConvId}`;
      console.log("Connecting to WebSocket:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log("WebSocket connected successfully");
        setConnectionState('connected');
        setReconnectAttempts(0);
      };
      
      ws.onmessage = evt => {
        try {
          // Try to parse as JSON first (for init message)
          const data = JSON.parse(evt.data);
          if (data.type === "init") {
            setWsConvId(data.convId);
            return;
          }
        } catch {
          // Not JSON, treat as plain text message
          setIsWaiting(false);
          setSessionMsgs(prev => [...prev, { 
            from: "agent", 
            text: evt.data, 
            timestamp: new Date().toISOString() 
          }]);
        }
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionState('error');
      };
      
      ws.onclose = (event) => {
        setConnectionState('disconnected');
        console.log("WebSocket closed with code:", event.code);
        
        // Try to reconnect if not a normal closure and we're still on the same conversation
        if (event.code !== 1000 && event.code !== 1001 && activeConvId) {
          const attempts = reconnectAttempts + 1;
          setReconnectAttempts(attempts);
          
          // Exponential backoff with maximum of 10 seconds
          const delay = Math.min(Math.pow(1.5, attempts) * 1000, 10000);
          console.log(`Scheduling reconnection attempt in ${delay}ms`);
          
          reconnectTimerRef.current = setTimeout(() => {
            if (document.visibilityState !== 'hidden') {
              connect();
            }
          }, delay);
        }
      };
    }
    
    connect();
    
    // Clean up on unmount or when activeConvId changes
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [activeConvId, WS_BASE, reconnectAttempts]);

  // Visibility change handler for reconnection
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && 
          activeConvId && 
          connectionState !== 'connected' && 
          connectionState !== 'connecting') {
        // Force reconnect when tab becomes visible again
        wsRef.current?.close();
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        setConnectionState('connecting');
        const token = localStorage.getItem("token");
        
        // FIXED: Ensure correct WebSocket URL - don't duplicate path segments
        const wsUrl = `${WS_BASE}?token=${token}&convId=${activeConvId}`;
        console.log("Visibility change - connecting to WebSocket:", wsUrl);
        
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          console.log("WebSocket reconnected on visibility change");
          setConnectionState('connected');
        };
        
        wsRef.current.onmessage = evt => {
          try {
            const data = JSON.parse(evt.data);
            if (data.type === "init") {
              setWsConvId(data.convId);
              return;
            }
          } catch {}
          setIsWaiting(false);
          setSessionMsgs(prev => [...prev, { 
            from: "agent", 
            text: evt.data, 
            timestamp: new Date().toISOString() 
          }]);
        };
        
        wsRef.current.onerror = () => setConnectionState('error');
        wsRef.current.onclose = () => setConnectionState('disconnected');
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeConvId, connectionState, WS_BASE]);

  // — Auto-scroll to bottom when new messages arrive —
  useEffect(() => {
    if (chatContainerRef.current && (history.length > 0 || sessionMsgs.length > 0)) {
      const element = chatContainerRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [history, sessionMsgs]);

  // — Send handler —
  function handleSend(text) {
    if (!text.trim()) return;
    
    if (wsRef.current && connectionState === 'connected') {
      const timestamp = new Date().toISOString();
      setSessionMsgs(prev => [...prev, { from: "user", text, timestamp }]);
      setIsWaiting(true);
      wsRef.current.send(text);
    } else {
      setSessionMsgs(prev => [
        ...prev,
        { 
          from: "system", 
          text: "Connection lost. Please wait for reconnection or refresh the page.", 
          timestamp: new Date().toISOString() 
        },
      ]);
      
      // Try to reconnect immediately
      wsRef.current?.close();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      
      reconnectTimerRef.current = setTimeout(() => {
        const token = localStorage.getItem("token");
        if (token && activeConvId) {
          setConnectionState('connecting');
          // FIXED: Ensure correct WebSocket URL - don't duplicate path segments
          const wsUrl = `${WS_BASE}?token=${token}&convId=${activeConvId}`;
          console.log("Manual reconnect - connecting to WebSocket:", wsUrl);
          
          wsRef.current = new WebSocket(wsUrl);
          
          wsRef.current.onopen = () => {
            console.log("Manual reconnection successful");
            setConnectionState('connected');
          };
          
          wsRef.current.onmessage = evt => {
            try {
              const data = JSON.parse(evt.data);
              if (data.type === "init") {
                setWsConvId(data.convId);
                return;
              }
            } catch {}
            setIsWaiting(false);
            setSessionMsgs(prev => [...prev, { 
              from: "agent", 
              text: evt.data, 
              timestamp: new Date().toISOString() 
            }]);
          };
          
          wsRef.current.onerror = () => setConnectionState('error');
          wsRef.current.onclose = () => setConnectionState('disconnected');
        }
      }, 1000);
    }
  }

  // — Logout —
  function handleLogout() {
    wsRef.current?.close();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    localStorage.clear();
    router.push("/");
  }

  // — Combined messages for this conversation —
  const displayed = [
    ...history,
    ...(activeConvId === wsConvId ? sessionMsgs : []),
  ];

  // Get connection status display properties
  const connectionDisplay = {
    connected: { color: "text-green-500", text: "Connected" },
    connecting: { color: "text-yellow-500", text: "Connecting..." },
    disconnected: { color: "text-red-500", text: "Disconnected" },
    error: { color: "text-red-500", text: "Connection Error" },
  }[connectionState];

  // Format date helper
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-100 to-blue-50">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r shadow flex flex-col">
        <div className="p-5 flex items-center justify-between border-b">
          <h3 className="text-xl font-semibold flex items-center space-x-2 text-blue-700">
            <FaComments className="text-xl" />
            <span>Chats</span>
          </h3>
          <motion.button
            onClick={createConversation}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 shadow-md"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            disabled={loadingConvs}
            aria-label="Create new conversation"
          >
            {loadingConvs ? <FaSpinner className="animate-spin" /> : <FaPlus />}
          </motion.button>
        </div>

        {loadingConvs ? (
          <div className="p-4 flex justify-center items-center text-gray-500">
            <FaSpinner className="animate-spin mr-2" />
            <span>Loading conversations...</span>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto p-2 space-y-1">
            {convs.length === 0 ? (
              <li className="text-center text-gray-500 py-4">No conversations yet</li>
            ) : (
              convs.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-lg transition duration-150 hover:bg-blue-100 ${
                    c.id === activeConvId ? "bg-blue-200 text-blue-800" : "text-gray-700"
                  }`}
                >
                  <div className="px-4 py-2 flex justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => selectConversation(c.id)}
                    >
                      {editingConv === c.id ? (
                        <input
                          type="text"
                          className="w-full p-1 border rounded"
                          defaultValue={c.title}
                          autoFocus
                          onBlur={(e) => updateConversation(c.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateConversation(c.id, e.target.value);
                            } else if (e.key === 'Escape') {
                              setEditingConv(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-medium truncate">{truncateTitle(c.title, 20)}</span>
                          <span className="text-xs text-gray-500">
                            {formatDate(c.created_at)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {c.id === activeConvId && !editingConv && (
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingConv(c.id);
                          }}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          aria-label="Edit conversation title"
                        >
                          <FaEdit size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(c.id);
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          aria-label="Delete conversation"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Delete confirmation */}
                  {deleteConfirm === c.id && (
                    <div className="bg-red-50 p-2 border-t border-red-200 text-sm">
                      <p className="font-medium text-red-700 mb-2">Delete this conversation?</p>
                      <div className="flex space-x-2 justify-end">
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteConversation(c.id)}
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        )}

        <button
          onClick={handleLogout}
          className="m-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition shadow flex items-center justify-center"
        >
          <FaSignOutAlt className="mr-2" /> Logout
        </button>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white px-6 py-4 shadow flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FaRobot className="text-blue-500 text-3xl" />
            <h2 className="text-2xl font-semibold text-blue-800 truncate">
              {activeConvId
                ? convs.find((c) => c.id === activeConvId)?.title || "Loading..."
                : "Select a conversation"}
            </h2>
          </div>
          <div className="flex items-center text-sm">
            <FaCircle
              className={`mr-1 ${
                connectionState === 'connecting' ? "animate-pulse" : ""
              } ${connectionDisplay.color}`}
            />
            <span className={connectionDisplay.color}>
              {connectionDisplay.text}
            </span>
          </div>
        </header>

        {/* Error message display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 flex justify-between items-center m-2 rounded"
            >
              <div className="flex items-center">
                <FaExclamationTriangle className="mr-2" />
                <span>{error}</span>
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-red-700 hover:text-red-900"
                aria-label="Dismiss error"
              >
                &times;
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Load Earlier Messages Button */}
        {hasMore && (
          <div className="flex justify-center p-2">
            <motion.button
              onClick={() => loadHistory(skip)}
              disabled={loadingHistory}
              className="flex items-center space-x-2 bg-blue-100 hover:bg-blue-200 text-blue-600 px-4 py-2 rounded-full shadow-sm disabled:opacity-50 transition"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {loadingHistory ? <FaSpinner className="animate-spin mr-2" /> : <FaArrowUp className="mr-2" />}
              <span>{loadingHistory ? "Loading..." : "Load earlier messages"}</span>
            </motion.button>
          </div>
        )}

        {/* Chat content */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto"
        >
          {!historyLoaded ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 h-full">
              <FaSpinner className="animate-spin mr-2" />
              <span>Loading conversation…</span>
            </div>
          ) : history.length === 0 && sessionMsgs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-3 h-full">
              <FaRegCommentDots className="text-5xl" />
              <p className="text-lg">No messages yet.</p>
              <p className="text-sm">Start your conversation below!</p>
            </div>
          ) : (
            <ChatWindow 
              messages={displayed} 
              isThinking={isWaiting} 
              connectionState={connectionState}
            />
          )}
        </div>

        {/* Chat input */}
        {activeConvId && (
          <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border-t bg-white p-4"
            >
              <ChatInput 
                onSend={handleSend}
                disabled={connectionState !== 'connected'} 
                placeholder={
                  connectionState === 'connected' 
                    ? "Type your message here..." 
                    : "Waiting for connection..."
                }
                isConnected={connectionState === 'connected'}
              />
              {connectionState !== 'connected' && (
                <div className="text-center mt-2 text-sm text-amber-600">
                  {connectionState === 'connecting' 
                    ? "Establishing connection..." 
                    : "Connection lost. Trying to reconnect..."}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
