"use client";

import React, { useState, useRef } from "react";
import { FaPaperPlane, FaSpinner } from "react-icons/fa";
import { motion } from "framer-motion";

export default function ChatInput({ onSend }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      onSend(trimmed);
      setText("");
      inputRef.current?.focus();
    } catch (err) {
      console.error("Send failed", err);
    } finally {
      // ensure spinner shows briefly
      setTimeout(() => setSending(false), 300);
    }
  };

  return (
    <div className="p-4 bg-white flex items-center space-x-2 shadow-inner">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
        placeholder="Type a message..."
        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition disabled:opacity-50"
        disabled={sending}
        aria-label="Message input"
      />
      <motion.button
        onClick={handleSend}
        disabled={!text.trim() || sending}
        whileTap={{ scale: sending ? 1 : 0.9 }}
        className="p-3 bg-blue-500 rounded-full text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-transform duration-200 transform"
        aria-label="Send message"
      >
        {sending ? <FaSpinner className="animate-spin" /> : <FaPaperPlane />}
      </motion.button>
    </div>
  );
}
