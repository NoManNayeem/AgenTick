"use client";

import React, { useEffect, useRef } from "react";
import { FaRobot, FaUserCircle } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

// Typing indicator: three animated dots
function TypingIndicator() {
  return (
    <div className="flex items-center space-x-2 p-2">
      <FaRobot className="text-2xl text-gray-500" />
      <div className="flex space-x-1">
        {[0, 1, 2].map((idx) => (
          <motion.span
            key={idx}
            className="block w-2 h-2 rounded-full bg-gray-500"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: idx * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Props:
 * - messages: Array of { id?, from: "user"|"agent"|"system", text: string, timestamp?: ISOString }
 * - isThinking: boolean flag to show the bot typing indicator
 */
export default function ChatWindow({ messages = [], isThinking = false }) {
  const containerRef = useRef(null);

  // Scroll to bottom whenever messages or typing indicator change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isThinking]);

  // Sort by timestamp (if provided)
  const sorted = [...messages].sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    }
    return 0;
  });

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto p-4 space-y-4 bg-gray-100 overscroll-contain"
    >
      <AnimatePresence initial={false} exitBeforeEnter>
        {sorted.map((msg, idx) => {
          const isAgent = msg.from === "agent";
          const key = msg.id || msg.timestamp || `${msg.from}-${idx}`;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`flex items-end ${
                isAgent ? "justify-start" : "justify-end"
              }`}
            >
              {isAgent && (
                <FaRobot className="text-2xl text-gray-500 mr-2 flex-shrink-0" />
              )}
              <div
                className={`break-words max-w-full sm:max-w-[70%] p-3 rounded-2xl transform transition-transform duration-200 ease-out hover:scale-[1.02] ${
                  isAgent
                    ? "bg-white text-gray-800 shadow-md"
                    : "bg-blue-500 text-white shadow-lg"
                }`}
              >
                {msg.text}
              </div>
              {!isAgent && (
                <FaUserCircle className="text-2xl text-blue-500 ml-2 flex-shrink-0" />
              )}
            </motion.div>
          );
        })}

        {isThinking && (
          <motion.div
            key="typing-indicator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TypingIndicator />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
