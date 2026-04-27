/**
 * /products/:id  — Product checkout page.
 *
 * Mirrors PHP:
 *   - ProductController::product()   (product detail view)
 *   - ProductController::checkout()  (initiates order + returns Razorpay URL or PayPal plan ID)
 *   - BillingController::savePaypalSubscription() (after PayPal subscription is captured)
 *
 * Flow:
 *   1. User sees product details + coupon field + payment method selector.
 *   2. On "Pay" → POST /products/:id/checkout  → receives razorPaymentUrl or paypalPlanId.
 *   3. Razorpay:  window.location = razorPaymentUrl  (Razorpay hosted page, callback returns to /razor_payment_callback)
 *   4. PayPal:    render PayPal JS SDK subscription button  →  POST /billing/paypal-subscription
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useGetProduct } from "@workspace/api-client-react";
import { Loader2, Tag, CheckCircle, ArrowLeft, CreditCard, Gift } from "lucide-react";

const PAYMENT_RAZORPAY = 25;
const PAYMENT_PAYPAL = 15;

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers ?? {}),
    },
  });
  return res.json();
}

interface CheckoutResult {
  status: number;
  order?: any;
  userProduct?: any;
  razorPaymentUrl?: string | null;
  paypalPlanId?: string | null;
  subtotalAmount?: number;
  currency?: string;
  message?: string;
}

export default function BillingPay() {
  const [, params] = useLocation();
  // Extract numeric :id from the URL — /products/123
  const productId = Number((window.location.pathname.match(/\/products\/(\d+)/) ?? [])[1]);

  // Guard: if id is not a valid number (e.g. path was /products/list), render nothing here
  if (!productId || isNaN(productId)) {
    return null;
  }

  const { data: productData, isLoading } = useGetProduct(productId);
  const product: any = productData ?? null;

  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<{ discount?: number; total?: number; error?: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "paypal" | "">("");
  const [loading, setLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialSuccess, setTrialSuccess] = useState(false);

  const allowedMethods: number[] = product?.allowedPaymentMethods ?? product?.allowed_payment_methods ?? [];
  const hasRazorpay = allowedMethods.includes(PAYMENT_RAZORPAY);
  const hasPaypal = allowedMethods.includes(PAYMENT_PAYPAL);

  // Pre-select the only available method
  useEffect(() => {
    if (!paymentMethod && product) {
      if (hasRazorpay && !hasPaypal) setPaymentMethod("razorpay");
      else if (hasPaypal && !hasRazorpay) setPaymentMethod("paypal");
    }
  }, [product, hasRazorpay, hasPaypal, paymentMethod]);

  const hasTrial = product?.freeTrial || product?.free_trial;
  const trialDays = product?.freeTrialDays ?? product?.free_trial_days ?? 0;
  const validDays = product?.daysValidAfterPayment ?? product?.days_valid_after_payment ?? 365;
  const taxPct = product?.tax ?? 0;
  const feePct = product?.transactionFee ?? product?.transaction_fee ?? 0;

  const basePrice: number = product?.price ?? 0;
  const discount: number = couponResult?.discount ?? 0;
  const subtotalAfterDiscount = basePrice - discount;
  const feeAmount = feePct ? subtotalAfterDiscount * feePct / 100 : 0;
  const taxAmount = taxPct ? basePrice * taxPct / 100 : 0;
  const totalAmount = subtotalAfterDiscount + feeAmount + taxAmount;

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponResult(null);
    try {
      const res = await apiFetch("/products/apply-coupon", {
        method: "POST",
        body: JSON.stringify({ code: couponCode.trim(), productId }),
      });
      if (res.status === 1) {
        setCouponResult({ discount: res.data?.totalDiscount ?? 0, total: res.data?.totalAmount });
      } else {
        setCouponResult({ error: res.message ?? "Invalid coupon" });
      }
    } catch {
      setCouponResult({ error: "Failed to apply coupon" });
    }
  }

  /** Starts a free trial immediately without payment. */
  async function handleStartTrial() {
    setTrialLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/products/${productId}/start-trial`, { method: "POST" });
      if (res.status === 200) {
        setTrialSuccess(true);
        setTimeout(() => { window.location.href = "/billing/invoices"; }, 1500);
      } else {
        setError(res.message ?? "Could not start trial. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setTrialLoading(false);
    }
  }

  async function handleCheckout() {
    if (!paymentMethod) { setError("Please select a payment method."); return; }
    setLoading(true);
    setError(null);
    try {
      const result: CheckoutResult = await apiFetch(`/products/${productId}/checkout`, {
        method: "POST",
        body: JSON.stringify({ couponCode: couponCode.trim() || undefined, paymentMethod }),
      });

      if (result.status !== 200) {
        setError(result.message ?? "Checkout failed. Please try again.");
        return;
      }

      // Razorpay: redirect to the hosted payment page
      if (paymentMethod === "razorpay" && result.razorPaymentUrl) {
        window.location.href = result.razorPaymentUrl;
        return;
      }

      // PayPal: fetch client ID from server (mirrors PHP config/paypal.php mode resolution),
      // then render the subscription button with discount billing-cycle override.
      if (paymentMethod === "paypal" && result.paypalPlanId) {
        let clientId = (import.meta as any).env?.VITE_PAYPAL_CLIENT_ID ?? "";
        try {
          const cfg = await apiFetch("/paypal/config");
          if (cfg?.clientId) clientId = cfg.clientId;
        } catch { /* fallback to VITE_PAYPAL_CLIENT_ID */ }
        renderPayPalButton(
          result.paypalPlanId,
          result.userProduct?.id,
          result.subtotalAmount ?? totalAmount,
          result.currency ?? "USD",
          clientId,
        );
        return;
      }

      setError("Payment gateway error. Please try again or contact support.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Dynamically loads the PayPal JS SDK and renders a subscription button.
   * Mirrors PHP pay.blade.php:
   *  - `vault=true&intent=subscription` SDK params
   *  - createSubscription passes plan_id + overrides billing_cycles[0] pricing_scheme
   *    with the discounted subtotalAmount so coupon discounts are honoured on PayPal's side
   *  - onApprove calls POST /billing/paypal-subscription (mirrors savePaypalSubscription)
   */
  function renderPayPalButton(
    planId: string,
    userProductId: number,
    subtotalAmount: number,
    currency: string,
    clientId: string,
  ) {
    const existingScript = document.getElementById("paypal-sdk");
    if (existingScript) existingScript.remove();

    const script = document.createElement("script");
    script.id = "paypal-sdk";
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription`;
    script.setAttribute("data-sdk-integration-source", "button-factory");
    script.onload = () => {
      const container = document.getElementById("paypal-button-container");
      if (!container || !(window as any).paypal) return;
      container.innerHTML = "";

      (window as any).paypal.Buttons({
        style: { shape: "rect", color: "gold", layout: "vertical", label: "subscribe" },

        createSubscription: (_data: any, actions: any) =>
          actions.subscription.create({
            plan_id: planId,
            // Override the plan's cycle price with the discounted subtotal
            // so coupons are reflected on PayPal's side (mirrors PHP pay.blade.php "discount stuff")
            plan: {
              billing_cycles: [
                {
                  frequency: { interval_unit: "MONTH", interval_count: 1 },
                  sequence: 1,
                  total_cycles: 0,
                  pricing_scheme: {
                    fixed_price: { value: subtotalAmount, currency_code: currency },
                  },
                },
              ],
            },
          }),

        onApprove: async (subscriptionData: any) => {
          setLoading(true);
          try {
            await apiFetch("/billing/paypal-subscription", {
              method: "POST",
              body: JSON.stringify({ id: userProductId, subscriptionId: subscriptionData.subscriptionID }),
            });
            window.location.href = "/billing/invoices?message=Payment+confirmed&status=1";
          } catch {
            setError("PayPal subscription confirmation failed.");
          } finally {
            setLoading(false);
          }
        },

        onError: () => setError("PayPal encountered an error. Please try again."),
      }).render("#paypal-button-container");
    };
    document.body.appendChild(script);
    setLoading(false);
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="bg-white rounded shadow-sm border p-12 text-center text-gray-500">
          Product not found.{" "}
          <Link href="/products"><a className="text-blue-600 hover:underline">Browse plans</a></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-4">
        <Link href="/products">
          <a className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Plans
          </a>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Product summary card */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
              {product.description && (
                <p className="text-sm text-gray-500 mt-1">{product.description}</p>
              )}
              <div className="flex flex-wrap gap-3 mt-3 text-sm">
                {(product.allowedAmountOfKeywords ?? product.allowed_amount_of_keywords) > 0 && (
                  <span className="flex items-center gap-1 text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    {product.allowedAmountOfKeywords ?? product.allowed_amount_of_keywords} keywords
                  </span>
                )}
                {(product.allowedAmountOfDomains ?? product.allowed_amount_of_domains) > 0 && (
                  <span className="flex items-center gap-1 text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    {product.allowedAmountOfDomains ?? product.allowed_amount_of_domains} domains
                  </span>
                )}
                {(product.allowedAmountOfAssessments ?? product.allowed_amount_of_assessments) > 0 && (
                  <span className="flex items-center gap-1 text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    {product.allowedAmountOfAssessments ?? product.allowed_amount_of_assessments} assessments
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-gray-900">
                {product.currency ?? "INR"} {basePrice.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">{validDays} days</p>
              {hasTrial && (
                <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  {trialDays}-day free trial
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Checkout form */}
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-5">
          {/* Coupon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Coupon Code <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={e => { setCouponCode(e.target.value); setCouponResult(null); }}
                placeholder="Enter coupon code"
                className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleApplyCoupon}
                disabled={!couponCode.trim()}
                className="flex items-center gap-1.5 px-4 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <Tag className="w-3.5 h-3.5" /> Apply
              </button>
            </div>
            {couponResult?.error && (
              <p className="text-xs text-red-500 mt-1">{couponResult.error}</p>
            )}
            {couponResult?.discount != null && !couponResult.error && (
              <p className="text-xs text-green-600 mt-1">
                Coupon applied — saving {product.currency ?? "INR"} {couponResult.discount.toFixed(2)}
              </p>
            )}
          </div>

          {/* Payment method */}
          {(hasRazorpay || hasPaypal) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <div className="flex gap-3">
                {hasRazorpay && (
                  <button
                    onClick={() => setPaymentMethod("razorpay")}
                    className={`flex items-center gap-2 px-4 py-2.5 border rounded text-sm transition-colors ${
                      paymentMethod === "razorpay"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" /> Razorpay
                  </button>
                )}
                {hasPaypal && (
                  <button
                    onClick={() => setPaymentMethod("paypal")}
                    className={`flex items-center gap-2 px-4 py-2.5 border rounded text-sm transition-colors ${
                      paymentMethod === "paypal"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 6.082-8.558 6.082H9.833l-1.268 8.04h4.94c.524 0 .97-.382 1.05-.9l.883-5.598c.08-.518.524-.9 1.048-.9h.66c4.298 0 7.664-1.748 8.647-6.797.247-1.27.13-2.326-.571-3.64z"/>
                    </svg>
                    PayPal
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Order summary */}
          <div className="border-t pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{product.currency ?? "INR"} {basePrice.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>− {product.currency ?? "INR"} {discount.toFixed(2)}</span>
              </div>
            )}
            {feeAmount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Transaction fee ({feePct}%)</span>
                <span>{product.currency ?? "INR"} {feeAmount.toFixed(2)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax ({taxPct}%)</span>
                <span>{product.currency ?? "INR"} {taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 border-t pt-2 mt-2">
              <span>Total</span>
              <span>{product.currency ?? "INR"} {totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* ── Free Trial CTA (shown when product has freeTrial=true) ── */}
          {hasTrial && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Gift className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    Start your {trialDays}-day free trial
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    No payment required now. You can pay after the trial ends.
                  </p>
                </div>
              </div>

              {trialSuccess ? (
                <div className="mt-3 flex items-center gap-2 text-green-700 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" /> Trial started! Redirecting…
                </div>
              ) : (
                <button
                  onClick={handleStartTrial}
                  disabled={trialLoading}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {trialLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting trial…</>
                    : <><Gift className="w-4 h-4" /> Start {trialDays}-day Free Trial</>}
                </button>
              )}

              <p className="text-xs text-center text-blue-500 mt-2">
                Or pay now below to skip the trial and get full access immediately.
              </p>
            </div>
          )}

          {/* Divider between trial CTA and payment section */}
          {hasTrial && (hasRazorpay || hasPaypal) && (
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <div className="flex-1 border-t" />
              <span>or pay now</span>
              <div className="flex-1 border-t" />
            </div>
          )}

          {/* Error shown near the payment button where it originates */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {/* PayPal button container (rendered dynamically) */}
          <div id="paypal-button-container" className="min-h-0" />

          {/* Pay button */}
          {(hasRazorpay || hasPaypal) && (
            <button
              onClick={handleCheckout}
              disabled={loading || !paymentMethod}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {paymentMethod === "razorpay" ? "Pay with Razorpay" : paymentMethod === "paypal" ? "Continue to PayPal" : "Select a payment method"}
            </button>
          )}

          <p className="text-xs text-center text-gray-400">
            {hasTrial
              ? "Paying now activates your subscription immediately."
              : "Your payment is processed securely. You will be redirected to the payment gateway."}
          </p>
        </div>
      </div>
    </Layout>
  );
}
