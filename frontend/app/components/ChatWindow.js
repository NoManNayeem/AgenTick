"use client";

import React, { useEffect, useRef } from "react";
import { FaRobot, FaUserCircle } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

function TypingIndicator() {
  return (
    <div className="flex items-center space-x-2 py-2 px-3 bg-white rounded-full shadow-md max-w-max">
      <FaRobot className="text-xl text-blue-500" />
      <div className="flex space-x-1">
        {[0, 1, 2].map((idx) => (
          <motion.span
            key={idx}
            className="block w-2 h-2 rounded-full bg-blue-400"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: idx * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatWindow({ messages = [], isThinking = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isThinking]);

  const sorted = [...messages].sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    }
    return 0;
  });

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto p-4 space-y-4 bg-gradient-to-t from-gray-50 to-gray-100 overscroll-contain"
    >
      <AnimatePresence initial={false}>
        {sorted.map((msg, idx) => {
          const isAgent = msg.from === "agent";
          const key = msg.id || msg.timestamp || `${msg.from}-${idx}`;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`flex items-end ${
                isAgent ? "justify-start" : "justify-end"
              }`}
            >
              {isAgent && (
                <FaRobot className="text-2xl text-blue-500 mr-2 flex-shrink-0" />
              )}
              <div
                className={`break-words max-w-[80%] sm:max-w-[70%] p-3 rounded-2xl shadow transition-transform duration-200 hover:scale-105 ${
                  isAgent
                    ? "bg-white text-gray-800"
                    : "bg-blue-500 text-white"
                }`}
              >
                {msg.text}
              </div>
              {!isAgent && (
                <FaUserCircle className="text-2xl text-gray-400 ml-2 flex-shrink-0" />
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