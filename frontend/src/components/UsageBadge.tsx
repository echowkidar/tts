import React from "react";
import { Zap, Crown, ArrowUpRight } from "lucide-react";
import { Subscription, UsageInfo } from "@/lib/auth";

interface Props {
  subscription: Subscription | null;
  usage: UsageInfo | null;
  onUpgradeClick: () => void;
  isDark: boolean;
}

export function UsageBadge({ subscription, usage, onUpgradeClick, isDark }: Props) {
  if (!usage) return null;

  const tier = subscription?.tier || "free";
  const limit = usage.daily_limit;
  const isUnlimited = limit === -1;
  const used = usage.chars_used_today;
  const pct = usage.percentage_used;

  return (
    <div
      onClick={onUpgradeClick}
      className={`cursor-pointer px-3 py-1.5 rounded-xl border flex items-center gap-2.5 transition-all hover:border-orange-500/50 ${
        isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-gray-100 border-gray-200 text-gray-700"
      }`}
      title="Click to view subscription & character limits"
    >
      <span className={`p-1 rounded-lg ${tier === "ultra" ? "bg-amber-500/20 text-amber-400" : "bg-orange-500/20 text-orange-400"}`}>
        {tier === "pro" || tier === "ultra" ? <Crown className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
      </span>

      <div className="text-[11px] leading-tight">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="capitalize text-white font-bold">{tier} Plan</span>
          <ArrowUpRight className="w-3 h-3 text-orange-400" />
        </div>
        <div className="text-[10px] text-zinc-400 font-mono">
          {used.toLocaleString()} / {isUnlimited ? "∞" : `${(limit / 1000).toFixed(0)}k`} chars
        </div>
      </div>

      {!isUnlimited && (
        <div className="w-12 h-1.5 rounded-full bg-zinc-800 overflow-hidden shrink-0">
          <div
            className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-500" : "bg-orange-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
