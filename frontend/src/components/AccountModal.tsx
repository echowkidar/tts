import React from "react";
import { X, User as UserIcon, Mail, Shield, Crown, Zap, LogOut, Sparkles, ArrowRight } from "lucide-react";
import { User, Subscription, UsageInfo } from "@/lib/auth";
import { focusRing } from "@/lib/theme";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  subscription: Subscription | null;
  usage: UsageInfo | null;
  onOpenSubscription: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
  isDark: boolean;
}

export function AccountModal({
  isOpen,
  onClose,
  user,
  subscription,
  usage,
  onOpenSubscription,
  onOpenAdmin,
  onLogout,
  isDark,
}: Props) {
  if (!isOpen || !user) return null;

  const tier = subscription?.tier || "free";
  const limit = usage?.daily_limit ?? 5000;
  const used = usage?.chars_used_today ?? 0;
  const pct = usage?.percentage_used ?? 0;
  const isUnlimited = limit === -1;
  const isAdmin = user.is_admin || user.role === "admin";

  const bg = isDark ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-200 text-gray-900";
  const cardBg = isDark ? "bg-zinc-950 border-zinc-800" : "bg-gray-50 border-gray-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`relative w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${bg}`}>
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold text-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
              {user.full_name ? user.full_name[0].toUpperCase() : user.email[0].toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-base truncate max-w-[200px]">
                {user.full_name || "User Account"}
              </h3>
              <p className={`text-xs ${isDark ? "text-zinc-400" : "text-gray-500"} truncate max-w-[200px]`}>
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${isDark ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-gray-100 text-gray-500"}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Subscription Tier Box */}
          <div className={`p-4 rounded-2xl border ${cardBg}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-xl ${tier === "ultra" ? "bg-amber-500/20 text-amber-400" : "bg-orange-500/20 text-orange-400"}`}>
                  {tier === "pro" || tier === "ultra" ? <Crown className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                </span>
                <span className="font-bold text-sm uppercase tracking-wider">{tier} Plan</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenSubscription();
                }}
                className="text-xs text-orange-400 hover:underline font-semibold flex items-center gap-1"
              >
                Upgrade <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Daily Usage Progress */}
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Daily Usage</span>
                <span className="font-mono text-zinc-200">
                  {used.toLocaleString()} / {isUnlimited ? "Unlimited" : `${limit.toLocaleString()} chars`}
                </span>
              </div>
              {!isUnlimited && (
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-500" : "bg-orange-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Account Details */}
          <div className={`p-4 rounded-2xl border space-y-2 text-xs ${cardBg}`}>
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-zinc-500" /> Email
              </span>
              <span className="font-medium text-zinc-200">{user.email}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-zinc-500" /> Account Role
              </span>
              <span className="font-medium text-zinc-200 uppercase">{user.role}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            {isAdmin && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdmin();
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <Shield className="w-4 h-4" /> Admin Console
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <LogOut className="w-4 h-4" /> Sign Out / Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
