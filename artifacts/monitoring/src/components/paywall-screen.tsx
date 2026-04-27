/**
 * PaywallScreen
 *
 * Shown when a user tries to access a feature their subscription doesn't cover,
 * or their trial has expired.
 *
 * Mirrors PHP: resources/views/pages/not_active_product.blade.php
 *   "Trial period is end. Make a payment." → link to /billing/invoices
 */

import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import { Layout } from "./layout";

export function PaywallScreen() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertTriangle className="w-16 h-16 text-yellow-400 mb-4" />

        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          This product is not activated.
        </h2>

        <p className="text-gray-500 mb-6 max-w-md">
          Your trial period has ended or you don't have an active subscription
          for this feature. Please make a payment to continue.
        </p>

        <div className="flex gap-3">
          <Link href="/billing/invoices">
            <a className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded transition-colors">
              Make a payment
            </a>
          </Link>
          <Link href="/products">
            <a className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-6 py-2.5 rounded transition-colors">
              Browse plans
            </a>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
