import { useCallback, useEffect, useState } from "react";
import {
  PlanInfo,
  Subscription,
  UsageInfo,
  fetchMySubscription,
  fetchMyUsage,
  fetchPlans,
  submitPaymentUTR,
} from "@/lib/auth";

export function useSubscription(isLoggedIn: boolean) {
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const refreshData = useCallback(async () => {
    try {
      const pList = await fetchPlans();
      setPlans(pList);
    } catch {
      // Ignore
    }

    if (isLoggedIn) {
      setLoading(true);
      try {
        const [sub, usg] = await Promise.all([fetchMySubscription(), fetchMyUsage()]);
        setSubscription(sub);
        setUsage(usg);
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    } else {
      setSubscription(null);
      setUsage(null);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const submitUTR = useCallback(
    async (planTier: string, amountInr: number, utrNumber: string) => {
      const res = await submitPaymentUTR(planTier, amountInr, utrNumber);
      await refreshData();
      return res;
    },
    [refreshData],
  );

  return {
    plans,
    subscription,
    usage,
    loading,
    refreshSubscription: refreshData,
    submitUTR,
  };
}
