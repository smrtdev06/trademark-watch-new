/**
 * PaywallScreen
 *
 * Shown when a user's package/trial has expired or they have no active subscription.
 * Only billing pages remain accessible until payment is completed.
 */

import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";

export function PaywallScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-4">
      <AlertTriangle className="w-16 h-16 text-yellow-400 mb-4" />

      <h2 className="text-2xl font-semibold text-gray-800 mb-2">
        Your subscription has expired
      </h2>

      <p className="text-gray-500 mb-6 max-w-md">
        Your trial or paid package is no longer active. Please choose a plan and
        complete payment to continue using the platform.
      </p>

      <div className="flex gap-3">
        <Link href="/products">
          <a className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded transition-colors">
            Choose a plan
          </a>
        </Link>
        <Link href="/billing/invoices">
          <a className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-6 py-2.5 rounded transition-colors">
            View invoices
          </a>
        </Link>
      </div>
    </div>
  );
}
