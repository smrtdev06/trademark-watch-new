/**
 * useUserAccess
 *
 * Fetches the list of product function IDs the current user is allowed to use,
 * based on their active or in-trial subscriptions.
 *
 * Mirrors PHP:
 *   - ProductPermissions::isFuncsAllowed()
 *   - UserProduct::scopeActivated()
 *   - helpers.php: functionActive()
 *
 * Function ID constants (mirror PHP Product::function_*):
 *   10  = All Countries Monitoring
 *   20  = Specific Countries Monitoring
 *   30  = Domain Monitoring
 *   40  = All Countries Visual Search
 *   50  = Specific Countries Visual Search
 *   60  = Assessment
 *  100  = Social Watch
 *  110  = Proprietor Search
 */

import { useState, useEffect } from "react";
import { useAuth } from "./use-auth";

export const FN_ALL_COUNTRIES_MONITORING     = 10;
export const FN_SPECIFIC_COUNTRIES_MONITORING = 20;
export const FN_DOMAIN_MONITORING            = 30;
export const FN_ALL_COUNTRIES_VISUAL_SEARCH  = 40;
export const FN_SPECIFIC_COUNTRIES_VISUAL_SEARCH = 50;
export const FN_ASSESSMENT                   = 60;
export const FN_SOCIAL_WATCH                 = 100;
export const FN_PROPRIETOR_SEARCH            = 110;

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

interface UserAccessState {
  allowedFunctions: number[];
  isLoading: boolean;
}

export function useUserAccess(): UserAccessState {
  const { token } = useAuth();
  const [state, setState] = useState<UserAccessState>({ allowedFunctions: [], isLoading: true });

  useEffect(() => {
    if (!token) {
      setState({ allowedFunctions: [], isLoading: false });
      return;
    }

    fetch(`${API_BASE}/user/access`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: { allowedFunctions?: number[] }) => {
        setState({ allowedFunctions: data.allowedFunctions ?? [], isLoading: false });
      })
      .catch(() => {
        setState({ allowedFunctions: [], isLoading: false });
      });
  }, [token]);

  return state;
}

/** Returns true if the user has at least one of the given function IDs active. */
export function hasFunction(allowedFunctions: number[], ...fns: number[]): boolean {
  return fns.some(fn => allowedFunctions.includes(fn));
}
