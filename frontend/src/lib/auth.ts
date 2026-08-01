/** Frontend API Client for Authentication, Subscriptions, Payments, and Admin functions. */

export interface User {
  id: number;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_admin: boolean;
  role: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Subscription {
  tier: "free" | "starter" | "pro" | "ultra";
  status: "active" | "expired" | "pending";
  daily_char_limit: number;
  allowed_models: string[];
  expires_at?: string;
}

export interface UsageInfo {
  usage_date: string;
  chars_used_today: number;
  daily_limit: number;
  chars_remaining: number;
  percentage_used: number;
}

export interface PlanInfo {
  tier: "free" | "starter" | "pro" | "ultra";
  name: string;
  price_inr: number;
  daily_char_limit: number;
  allowed_models: string[];
  features: string[];
}

export interface PaymentRequest {
  id: number;
  user_id: number;
  user_email?: string;
  plan_tier: string;
  amount_inr: number;
  utr_number: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at?: string;
}

const TOKEN_KEY = "vs_auth_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function extractErrorMessage(err: any, fallback: string): string {
  if (!err) return fallback;
  if (typeof err.detail === "string") return err.detail;
  if (Array.isArray(err.detail)) {
    return err.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(", ");
  }
  if (typeof err.detail === "object" && err.detail !== null) {
    return err.detail.msg || err.detail.message || JSON.stringify(err.detail);
  }
  if (typeof err.message === "string") return err.message;
  return fallback;
}

export async function fetchMe(): Promise<User | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch("/api/auth/me", { headers: authHeaders() });
    if (!res.ok) {
      clearAuthToken();
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

export async function loginEmail(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(extractErrorMessage(err, "Invalid email or password"));
  }
  const data: TokenResponse = await res.json();
  setAuthToken(data.access_token);
  return data;
}

export async function registerEmail(email: string, password: string, full_name?: string): Promise<TokenResponse> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(extractErrorMessage(err, "Failed to register account"));
  }
  const data: TokenResponse = await res.json();
  setAuthToken(data.access_token);
  return data;
}

export async function loginGoogleToken(googleToken: string): Promise<TokenResponse> {
  const res = await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: googleToken }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(extractErrorMessage(err, "Google authentication failed"));
  }
  const data: TokenResponse = await res.json();
  setAuthToken(data.access_token);
  return data;
}

export async function fetchPlans(): Promise<PlanInfo[]> {
  const res = await fetch("/api/subscriptions/plans");
  if (!res.ok) throw new Error("Failed to load subscription plans");
  return await res.json();
}

export async function fetchMySubscription(): Promise<Subscription | null> {
  const token = getAuthToken();
  if (!token) return null;
  const res = await fetch("/api/subscriptions/my", { headers: authHeaders() });
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchMyUsage(): Promise<UsageInfo | null> {
  const token = getAuthToken();
  if (!token) return null;
  const res = await fetch("/api/subscriptions/usage", { headers: authHeaders() });
  if (!res.ok) return null;
  return await res.json();
}

export async function submitPaymentUTR(plan_tier: string, amount_inr: number, utr_number: string): Promise<PaymentRequest> {
  const res = await fetch("/api/subscriptions/payment/utr", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ plan_tier, amount_inr, utr_number }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(extractErrorMessage(err, "Failed to submit transaction UTR"));
  }
  return await res.json();
}

export async function fetchAdminPayments(status = "pending"): Promise<PaymentRequest[]> {
  const res = await fetch(`/api/admin/payments?status_filter=${status}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load admin payments");
  return await res.json();
}

export async function approveAdminPayment(payment_id: number, action: "approve" | "reject", admin_notes?: string): Promise<PaymentRequest> {
  const res = await fetch("/api/admin/payments/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ payment_id, action, admin_notes }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(extractErrorMessage(err, "Failed to process payment approval"));
  }
  return await res.json();
}

export async function fetchAdminUsers(): Promise<any[]> {
  const res = await fetch("/api/admin/users", { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load users list");
  return await res.json();
}

export async function deleteAdminUser(user_id: number): Promise<void> {
  const res = await fetch(`/api/admin/users/${user_id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(extractErrorMessage(err, "Failed to delete user"));
  }
}

export async function updateAdminUserRole(user_id: number, role: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${user_id}/role?role=${encodeURIComponent(role)}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(extractErrorMessage(err, "Failed to update user role"));
  }
}

export async function updateAdminUserTier(user_id: number, tier: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${user_id}/tier?tier=${encodeURIComponent(tier)}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(extractErrorMessage(err, "Failed to update user tier"));
  }
}
