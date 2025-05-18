"use client";

import React, { useEffect, useRef, useState } from "react";
import { FaRobot, FaUserCircle } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

// Typing indicator: three animated dots
function TypingIndicator() {
  return (
    <div className="flex items-center space-x-1 p-2">
      <FaRobot className="text-2xl text-gray-500 mr-2" />
      <div className="flex space-x-1">
        {[0, 1, 2].map((idx) => (
          <motion.span
            key={idx}
            className="block w-2 h-2 rounded-full bg-gray-500"
            animate={{
              opacity: [0.2, 1, 0.2],
              y: [0, -4, 0]
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: idx * 0.2
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatWindow({ messages }) {
  const containerRef = useRef(null);
  const [displayed, setDisplayed] = useState([]);
  const [botThinking, setBotThinking] = useState(false);

  // Queue messages and simulate agent "thinking"
  useEffect(() => {
    const pending = messages.slice(displayed.length);
    if (!pending.length) return;

    const nextMsg = pending[0];
    if (nextMsg.from === "agent") {
      setBotThinking(true);
      const thinkDelay = 500 + Math.random() * 500;
      const timer = setTimeout(() => {
        setDisplayed((prev) => [...prev, nextMsg]);
        setBotThinking(false);
      }, thinkDelay);
      return () => clearTimeout(timer);
    } else {
      setDisplayed((prev) => [...prev, nextMsg]);
    }
  }, [messages, displayed]);

  // Auto-scroll on new message or typing indicator change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [displayed, botThinking]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto p-4 space-y-4 bg-gray-100"
    >
      <AnimatePresence initial={false} exitBeforeEnter>
        {displayed.map((msg, idx) => {
          const isAgent = msg.from === "agent";
          return (
            <motion.div
              key={`${msg.from}-${idx}-${msg.text}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className={`flex items-end ${isAgent ? "justify-start" : "justify-end"}`}
            >
              {isAgent && <FaRobot className="text-2xl text-gray-500 mr-2" />}
              <motion.div
                className={`max-w-[70%] p-3 rounded-lg transform transition-transform duration-300 ease-out hover:scale-[1.01] ${
                  isAgent ? "bg-white text-gray-800 shadow" : "bg-blue-500 text-white shadow-lg"
                }`}
                whileHover={{ scale: 1.02 }}
              >
                {msg.text}
              </motion.div>
              {!isAgent && <FaUserCircle className="text-2xl text-blue-500 ml-2" />}
            </motion.div>
          );
        })}

        {botThinking && (
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
