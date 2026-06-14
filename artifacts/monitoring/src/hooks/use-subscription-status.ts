import { useState, useEffect } from "react";
import { useAuth } from "./use-auth";

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

interface SubscriptionStatusState {
  hasActiveSubscription: boolean;
  isLoading: boolean;
}

export function isBillingPath(path: string): boolean {
  return path.startsWith("/products") || path.startsWith("/billing/invoices");
}

export function useSubscriptionStatus(): SubscriptionStatusState {
  const { token, user } = useAuth();
  const [state, setState] = useState<SubscriptionStatusState>({
    hasActiveSubscription: true,
    isLoading: true,
  });

  useEffect(() => {
    if (!token) {
      setState({ hasActiveSubscription: false, isLoading: false });
      return;
    }

    if (user?.role === "admin") {
      setState({ hasActiveSubscription: true, isLoading: false });
      return;
    }

    fetch(`${API_BASE}/user/subscription-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { hasActiveSubscription?: boolean }) => {
        setState({
          hasActiveSubscription: data.hasActiveSubscription ?? false,
          isLoading: false,
        });
      })
      .catch(() => {
        setState({ hasActiveSubscription: false, isLoading: false });
      });
  }, [token, user?.role]);

  return state;
}
