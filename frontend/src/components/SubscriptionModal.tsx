import React, { useState } from "react";
import { X, Check, QrCode, Zap, Sparkles, ShieldCheck, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { PlanInfo, Subscription, UsageInfo } from "@/lib/auth";
import { focusRing } from "@/lib/theme";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  plans: PlanInfo[];
  currentSub: Subscription | null;
  usage: UsageInfo | null;
  onSubmitUTR: (planTier: string, amountInr: number, utrNumber: string) => Promise<any>;
  isDark: boolean;
}

export function SubscriptionModal({
  isOpen,
  onClose,
  plans,
  currentSub,
  usage,
  onSubmitUTR,
  isDark,
}: Props) {
  const [selectedPlan, setSelectedPlan] = useState<PlanInfo | null>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const bg = isDark ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-200 text-gray-900";
  const cardBg = isDark ? "bg-zinc-950 border-zinc-800" : "bg-gray-50 border-gray-200";

  const handlePayClick = (plan: PlanInfo) => {
    setSelectedPlan(plan);
    setUtrNumber("");
    setError(null);
    setSubmittedSuccess(false);
  };

  const handleUTRSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    if (!utrNumber || utrNumber.trim().length < 6) {
      setError("Please enter a valid 12-digit UPI UTR / Transaction Reference ID.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmitUTR(selectedPlan.tier, selectedPlan.price_inr, utrNumber.trim());
      setSubmittedSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit UTR reference.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className={`relative w-full max-w-4xl max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${bg}`}>
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20">
              <Zap className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold">Subscription & Character Limits</h2>
              <p className={`text-xs ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
                Upgrade your plan for higher character limits, faster generation & all TTS models.
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

        {/* Current Usage Status Bar */}
        {usage && (
          <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-4 text-xs ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-orange-500/5 border-orange-500/10"}`}>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {currentSub?.tier || "Free"} Plan
              </span>
              <span className={isDark ? "text-zinc-300" : "text-gray-700"}>
                <strong>{usage.chars_used_today.toLocaleString()}</strong> /{" "}
                {usage.daily_limit === -1 ? "Unlimited" : `${usage.daily_limit.toLocaleString()} chars today`}
              </span>
            </div>
            {usage.daily_limit !== -1 && (
              <div className="flex items-center gap-3 w-full sm:w-48">
                <div className="h-2 flex-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      usage.percentage_used > 80 ? "bg-red-500" : "bg-orange-500"
                    }`}
                    style={{ width: `${usage.percentage_used}%` }}
                  />
                </div>
                <span className="font-mono text-zinc-400">{usage.percentage_used}%</span>
              </div>
            )}
          </div>
        )}

        {/* Main Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {!selectedPlan ? (
            /* Plan Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((p) => {
                const isCurrent = currentSub?.tier === p.tier;
                const isPro = p.tier === "pro";

                return (
                  <div
                    key={p.tier}
                    className={`relative rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 hover:scale-[1.02] ${
                      isPro
                        ? "border-orange-500/50 bg-gradient-to-b from-orange-500/10 to-zinc-950 shadow-xl shadow-orange-500/10"
                        : cardBg
                    }`}
                  >
                    {isPro && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-white shadow-md">
                        Most Popular
                      </span>
                    )}

                    <div>
                      <h3 className="text-lg font-bold">{p.name}</h3>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold">₹{p.price_inr}</span>
                        <span className="text-xs text-zinc-400">/ month</span>
                      </div>

                      <div className="mt-4 pt-4 border-t border-zinc-800/60 space-y-2">
                        {p.features.map((f, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-zinc-300">
                            <Check className="w-4 h-4 text-orange-400 shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      disabled={isCurrent}
                      onClick={() => handlePayClick(p)}
                      className={`mt-6 w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        isCurrent
                          ? "bg-zinc-800 text-zinc-500 cursor-default"
                          : isPro
                          ? "bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20"
                          : "bg-zinc-800 hover:bg-zinc-700 text-white"
                      }`}
                    >
                      {isCurrent ? "Current Active Plan" : p.price_inr === 0 ? "Default Plan" : "Upgrade via UPI QR"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            /* UPI QR Code Payment Screen */
            <div className="max-w-xl mx-auto space-y-6">
              <button
                onClick={() => setSelectedPlan(null)}
                className="text-xs text-orange-400 hover:underline flex items-center gap-1"
              >
                ← Back to Plans
              </button>

              <div className={`p-6 rounded-2xl border text-center ${cardBg}`}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-semibold">
                  <Sparkles className="w-4 h-4" />
                  Upgrading to {selectedPlan.name} (₹{selectedPlan.price_inr}/mo)
                </div>

                {!submittedSuccess ? (
                  <>
                    <p className="mt-3 text-xs text-zinc-400">
                      Scan the QR Code with <strong>GPay, PhonePe, Paytm, or BHIM UPI</strong> to pay ₹{selectedPlan.price_inr}.
                    </p>

                    {/* QR Image */}
                    <div className="my-5 flex flex-col items-center">
                      <div className="p-3 bg-white rounded-2xl shadow-xl">
                        <img
                          src={`/api/subscriptions/qr?plan_tier=${selectedPlan.tier}&amount_inr=${selectedPlan.price_inr}`}
                          alt="UPI QR Code"
                          className="w-48 h-48 rounded-xl object-contain"
                        />
                      </div>
                      <span className="mt-2 font-mono text-xs text-zinc-400">UPI ID: <strong>echowkidar@upi</strong></span>
                    </div>

                    {error && (
                      <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 text-left">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* UTR Submit Form */}
                    <form onSubmit={handleUTRSubmit} className="space-y-3 text-left">
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1">
                          Enter 12-Digit UTR / Transaction Reference Number
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 423187654321"
                          value={utrNumber}
                          onChange={(e) => setUtrNumber(e.target.value)}
                          className={`w-full px-4 py-2.5 text-sm rounded-xl border ${
                            isDark ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-300"
                          } ${focusRing}`}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            Submit UTR for Verification <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  </>
                ) : (
                  /* Success Notice */
                  <div className="py-8 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-bold text-green-400">Payment Request Submitted!</h4>
                    <p className="text-xs text-zinc-300 max-w-md mx-auto">
                      Your UTR Reference (<strong>{utrNumber}</strong>) has been submitted for verification. Admin will approve your subscription within minutes.
                    </p>
                    <button
                      onClick={onClose}
                      className="mt-4 px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold"
                    >
                      Done & Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
