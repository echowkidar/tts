import { useCallback, useEffect, useState } from "react";
import {
  User,
  clearAuthToken,
  fetchMe,
  getAuthToken,
  loginEmail,
  loginGoogleToken,
  registerEmail,
} from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const me = await fetchMe();
    setUser(me);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, pass: string) => {
      const res = await loginEmail(email, pass);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const register = useCallback(
    async (email: string, pass: string, fullName?: string) => {
      const res = await registerEmail(email, pass, fullName);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const googleLogin = useCallback(
    async (googleToken: string) => {
      const res = await loginGoogleToken(googleToken);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
  }, []);

  return {
    user,
    loading,
    isLoggedIn: !!user,
    isAdmin: !!user?.is_admin || user?.role === "admin",
    login,
    register,
    googleLogin,
    logout,
    refreshUser,
  };
}
