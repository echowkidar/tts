import React, { useState, useEffect } from "react";
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

export function AuthModal({ isOpen, onClose, onLogin, onRegister, onGoogleLogin, isDark }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const gClientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      "51193166575-n2fvtsruk2lejtvjt6hckjg56rtd2ttf.apps.googleusercontent.com";

    const initGoogleBtn = () => {
      if (window.google?.accounts?.id && gClientId) {
        try {
          window.google.accounts.id.initialize({
            client_id: gClientId,
            callback: async (response: any) => {
              if (response?.credential && onGoogleLogin) {
                setLoading(true);
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

          const btnContainer = document.getElementById("google-btn-container");
          if (btnContainer) {
            btnContainer.innerHTML = "";
            window.google.accounts.id.renderButton(btnContainer, {
              theme: isDark ? "filled_black" : "outline",
              size: "large",
              width: "320",
              text: "continue_with",
              shape: "pill",
            });
          }
        } catch (e) {
          console.error("Google button render error:", e);
        }
      }
    };

    const timer = setTimeout(initGoogleBtn, 300);
    return () => clearTimeout(timer);
  }, [isOpen, isDark, onGoogleLogin]);

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

          {/* Native Google Sign In Button Container */}
          <div className="flex justify-center w-full min-h-[44px]">
            <div id="google-btn-container" className="flex justify-center w-full"></div>
          </div>

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
