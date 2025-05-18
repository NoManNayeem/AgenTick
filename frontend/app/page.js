// frontend/app/page.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaUser, FaLock, FaSpinner, FaSignInAlt, FaUserPlus } from "react-icons/fa";
import { motion } from "framer-motion";

export default function HomePage() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");

      localStorage.setItem("token", data.access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row items-center justify-center bg-gradient-to-br from-indigo-100 via-blue-200 to-indigo-300">
      {/* Branding column */}
      <div className="hidden md:flex flex-col items-center justify-center w-full md:w-1/2 h-full px-10 text-center">
        <motion.img
          src="/agentic_logo.png"
          alt="AgenTick Logo"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-40 h-40 object-contain mb-6"
        />
        <h1 className="text-5xl font-bold text-indigo-700 mb-2">AgenTick</h1>
        <p className="text-indigo-600 text-lg max-w-md">Your intelligent agent companion. Fast. Accurate. Reliable.</p>
      </div>

      {/* Auth form column */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-200 m-6"
      >
        <div className="md:hidden flex justify-center mb-4">
          <img src="/agentic_logo.png" alt="AgenTick Logo" className="w-16 h-16 object-contain" />
        </div>

        <h2 className="text-3xl font-bold text-center mb-6 text-indigo-600">
          {mode === "login" ? "Welcome Back" : "Create Your Account"}
        </h2>

        <div className="flex justify-center space-x-8 mb-6">
          {[
            { tab: "login", icon: <FaSignInAlt /> },
            { tab: "register", icon: <FaUserPlus /> },
          ].map(({ tab, icon }) => (
            <button
              key={tab}
              onClick={() => {
                setMode(tab);
                setError("");
              }}
              className={`flex items-center space-x-2 pb-1 transition duration-200 font-medium ${mode === tab ? "border-b-2 border-indigo-500 text-indigo-600" : "text-gray-500 hover:text-indigo-500"}`}
            >
              {icon}
              <span className="capitalize">{tab}</span>
            </button>
          ))}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 bg-red-100 text-red-600 p-3 rounded-lg text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <FaUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full pl-10 py-2.5 pr-4 border rounded-lg border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 transition outline-none"
              required
            />
          </div>

          <div className="relative">
            <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-10 py-2.5 pr-4 border rounded-lg border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 transition outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-lg flex items-center justify-center transition duration-200 shadow disabled:opacity-50"
          >
            {loading && <FaSpinner className="animate-spin mr-2" />}
            {mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
