import React, { useEffect, useState } from "react";
import { X, Shield, CheckCircle, XCircle, Users, CreditCard, RefreshCw, AlertCircle } from "lucide-react";
import { PaymentRequest, approveAdminPayment, fetchAdminPayments, fetchAdminUsers } from "@/lib/auth";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

export function AdminPanelModal({ isOpen, onClose, isDark }: Props) {
  const [tab, setTab] = useState<"payments" | "users">("payments");
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "payments") {
        const p = await fetchAdminPayments("all");
        setPayments(p);
      } else {
        const u = await fetchAdminUsers();
        setUsers(u);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, tab]);

  if (!isOpen) return null;

  const handleApproveReject = async (paymentId: number, action: "approve" | "reject") => {
    setActionLoading(paymentId);
    try {
      await approveAdminPayment(paymentId, action);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const bg = isDark ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-200 text-gray-900";
  const cardBg = isDark ? "bg-zinc-950 border-zinc-800" : "bg-gray-50 border-gray-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`relative w-full max-w-4xl max-h-[85vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${bg}`}>
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Shield className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold">Admin Management Console</h2>
              <p className={`text-xs ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
                Approve UPI Payments & manage user subscription tiers.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className={`p-2 rounded-xl border transition-colors ${isDark ? "border-zinc-800 hover:bg-zinc-800 text-zinc-400" : "border-gray-200 hover:bg-gray-100 text-gray-500"}`}
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${isDark ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-gray-100 text-gray-500"}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex border-b border-zinc-800 shrink-0">
          <button
            onClick={() => setTab("payments")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              tab === "payments" ? "border-indigo-500 text-indigo-400" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Payment Approvals ({payments.filter(p => p.status === "pending").length} Pending)
          </button>
          <button
            onClick={() => setTab("users")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              tab === "users" ? "border-indigo-500 text-indigo-400" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Registered Users ({users.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {tab === "payments" ? (
            payments.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500">No payment requests found.</div>
            ) : (
              <div className="space-y-3">
                {payments.map((p) => (
                  <div key={p.id} className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${cardBg}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{p.user_email || `User #${p.user_id}`}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          {p.plan_tier} Plan (₹{p.amount_inr})
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          p.status === "approved" ? "bg-green-500/10 text-green-400" : p.status === "rejected" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-zinc-400 flex items-center gap-4">
                        <span>UTR / Ref: <strong>{p.utr_number}</strong></span>
                        <span>Date: {new Date(p.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {p.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <button
                          disabled={actionLoading === p.id}
                          onClick={() => handleApproveReject(p.id, "approve")}
                          className="py-1.5 px-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-green-500/10"
                        >
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button
                          disabled={actionLoading === p.id}
                          onClick={() => handleApproveReject(p.id, "reject")}
                          className="py-1.5 px-3 rounded-xl bg-zinc-800 hover:bg-red-900/60 text-zinc-300 hover:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2 px-3">User ID</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Subscription Tier</th>
                    <th className="py-2 px-3">Daily Limit</th>
                    <th className="py-2 px-3">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 px-3 font-mono text-zinc-500">#{u.id}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{u.email}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{u.full_name || "—"}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          {u.subscription_tier}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400">
                        {u.daily_char_limit === -1 ? "Unlimited" : `${u.daily_char_limit.toLocaleString()} chars`}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-500">{u.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
