// frontend/components/ChatInput.js
"use client";

import React, { useState } from "react";
import { FaPaperPlane } from "react-icons/fa";

export default function ChatInput({ onSend }) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const message = text.trim();
    if (!message) return;
    onSend(message);
    setText("");
  };

  return (
    <div className="p-4 bg-white flex items-center space-x-2 shadow-inner">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
        placeholder="Type a message..."
        className="
          flex-1
          px-4 py-2
          border border-gray-300 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
          transition
        "
        aria-label="Message input"
      />
      <button
        onClick={handleSend}
        disabled={!text.trim()}
        aria-label="Send message"
        className="
          p-3
          bg-blue-500 rounded-full text-white
          hover:bg-blue-600
          transition-transform duration-200
          transform hover:scale-110
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        <FaPaperPlane />
      </button>
    </div>
  );
}
