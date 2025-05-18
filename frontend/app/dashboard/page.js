// frontend/app/dashboard/page.js
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaSignOutAlt, FaCircle } from "react-icons/fa";
import ChatWindow from "../components/ChatWindow";
import ChatInput from "../components/ChatInput";

export default function DashboardPage() {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const ws = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/");
      return;
    }

    // open websocket
    const socket = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}?token=${token}`
    );

    socket.onopen = () => setConnected(true);
    socket.onmessage = (event) =>
      setMessages((prev) => [...prev, { from: "agent", text: event.data }]);
    socket.onerror = () => {
      console.error("WebSocket error");
      setConnected(false);
    };
    socket.onclose = () => setConnected(false);

    ws.current = socket;
    return () => socket.close();
  }, [router]);

  const handleSend = (text) => {
    if (ws.current && connected) {
      setMessages((prev) => [...prev, { from: "user", text }]);
      ws.current.send(text);
    } else {
      setMessages((prev) => [
        ...prev,
        { from: "system", text: "Connection lost. Please logout & retry." },
      ]);
    }
  };

  const handleLogout = () => {
    if (ws.current) ws.current.close();
    localStorage.removeItem("token");
    router.push("/");
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white px-6 py-4 shadow flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-800">AgenTick Chat</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-sm text-gray-600">
            <FaCircle
              className={`mr-1 ${
                connected ? "text-green-500 animate-pulse" : "text-red-400"
              }`}
            />
            {connected ? "Live" : "Offline"}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-transform hover:scale-105"
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <ChatWindow messages={messages} />

      <ChatInput onSend={handleSend} />
    </div>
  );
}
