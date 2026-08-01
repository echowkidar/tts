import React, { useState } from "react";
import { X, Mail, Lock, User as UserIcon, LogIn, UserPlus, Sparkles, AlertCircle } from "lucide-react";
import { focusRing } from "@/lib/theme";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, pass: string) => Promise<any>;
  onRegister: (email: string, pass: string, name?: string) => Promise<any>;
  onGoogleLogin?: (token: string) => Promise<any>;
  isDark: boolean;
}

export function AuthModal({ isOpen, onClose, onLogin, onRegister, isDark }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === "login") {
        await onLogin(email, password);
      } else {
        await onRegister(email, password, fullName);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check details.");
    } finally {
      setLoading(false);
    }
  };

  const bg = isDark ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-200 text-gray-900";
  const inputBg = isDark ? "bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500" : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400";
  const cardBorder = isDark ? "border-zinc-800" : "border-gray-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${bg}`}>
        {/* Header */}
        <div className="p-6 pb-4 border-b flex items-start justify-between border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold">Welcome to Voice Studio</h2>
            </div>
            <p className={`mt-1 text-xs ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
              {tab === "login" ? "Sign in to access your TTS credits & models" : "Create an account to start generating TTS audio"}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-gray-100 text-gray-500"}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 flex border-b border-zinc-800">
          <button
            onClick={() => { setTab("login"); setError(null); }}
            className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
              tab === "login" ? "border-orange-500 text-orange-500" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
          <button
            onClick={() => { setTab("register"); setError(null); }}
            className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
              tab === "register" ? "border-orange-500 text-orange-500" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Create Account
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Google Sign In */}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setError(null);
              const gClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || "";
              if (window.google?.accounts?.id && gClientId) {
                setLoading(true);
                try {
                  window.google.accounts.id.initialize({
                    client_id: gClientId,
                    callback: async (response: any) => {
                      if (response?.credential && onGoogleLogin) {
                        try {
                          await onGoogleLogin(response.credential);
                          onClose();
                        } catch (err: any) {
                          setError(err.message || "Google Sign-In failed");
                        } finally {
                          setLoading(false);
                        }
                      }
                    },
                  });
                  window.google.accounts.id.prompt();
                } catch (e: any) {
                  setLoading(false);
                  setError("Google Sign-In error: " + (e.message || "Invalid Client ID"));
                }
              } else {
                // If Google Client ID is not configured yet, notify user or use direct email sign in tab
                setTab("login");
                setError("Google Client ID is not set in environment variables yet. Please sign in with email/password below or configure GOOGLE_CLIENT_ID in Portainer.");
              }
            }}
            className={`w-full py-2.5 px-4 rounded-xl border font-medium text-sm flex items-center justify-center gap-3 transition-all ${
              isDark
                ? "bg-zinc-800/60 border-zinc-700 hover:bg-zinc-800 text-zinc-200"
                : "bg-white border-gray-300 hover:bg-gray-50 text-gray-700 shadow-sm"
            } ${focusRing}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-2">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-[11px] uppercase tracking-wider text-zinc-500">Or email</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {tab === "register" && (
              <div>
                <label className="block text-xs font-medium mb-1 text-zinc-400">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border ${inputBg} ${focusRing}`}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1 text-zinc-400">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border ${inputBg} ${focusRing}`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-zinc-400">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border ${inputBg} ${focusRing}`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-2 py-3 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 ${
                loading ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : tab === "login" ? (
                "Sign In to Account"
              ) : (
                "Create Free Account"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
