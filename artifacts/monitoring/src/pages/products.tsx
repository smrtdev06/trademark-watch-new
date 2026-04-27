import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListProducts } from "@workspace/api-client-react";
import { Loader2, ShoppingCart, CheckCircle } from "lucide-react";

const PAYMENT_RAZORPAY = 25;
const PAYMENT_PAYPAL = 15;

function paymentMethodLabels(methods: number[] | null | undefined): string {
  if (!methods?.length) return "";
  const names: string[] = [];
  if (methods.includes(PAYMENT_RAZORPAY)) names.push("Razorpay");
  if (methods.includes(PAYMENT_PAYPAL)) names.push("PayPal");
  return names.join(", ");
}

export default function ProductsList() {
  const { data, isLoading } = useListProducts();
  const products: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  // API already filters status=1 for non-admin users
  const activeProducts = products;

  return (
    <Layout>
      <div className="mb-6">
        <h4 className="text-xl font-semibold">Plans &amp; Pricing</h4>
        <p className="text-sm text-gray-500 mt-1">Choose a plan to get started.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : activeProducts.length === 0 ? (
        <div className="bg-white rounded shadow-sm border p-12 text-center text-gray-500">
          No plans available at this time.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeProducts.map((product: any) => {
            const hasTrial = product.freeTrial || product.free_trial;
            const trialDays = product.freeTrialDays ?? product.free_trial_days ?? 0;
            const validDays = product.daysValidAfterPayment ?? product.days_valid_after_payment ?? 365;
            const paymentMethods = paymentMethodLabels(product.allowedPaymentMethods ?? product.allowed_payment_methods);
            const finalPrice = product.finalPrice ?? product.final_price;
            const taxPct = product.tax ?? 0;
            const feePct = product.transactionFee ?? product.transaction_fee ?? 0;

            return (
              <div key={product.id} className="bg-white rounded-lg shadow-sm border flex flex-col">
                {/* Header */}
                <div className="p-5 border-b">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 text-base">{product.name}</h3>
                    {hasTrial && (
                      <span className="shrink-0 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                        {trialDays}d Free Trial
                      </span>
                    )}
                  </div>
                  {product.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                  )}
                </div>

                {/* Price */}
                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">
                      {product.currency ?? "INR"} {(product.price ?? 0).toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-400">/ {validDays} days</span>
                  </div>
                  {(taxPct > 0 || feePct > 0) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {taxPct > 0 ? `+${taxPct}% tax` : ""}
                      {taxPct > 0 && feePct > 0 ? " · " : ""}
                      {feePct > 0 ? `+${feePct}% fee` : ""}
                    </p>
                  )}
                </div>

                {/* Features */}
                <div className="px-5 pb-4 flex-1">
                  <ul className="space-y-1.5 text-sm text-gray-600">
                    {(product.allowedAmountOfKeywords ?? product.allowed_amount_of_keywords) > 0 && (
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        {product.allowedAmountOfKeywords ?? product.allowed_amount_of_keywords} keywords
                      </li>
                    )}
                    {(product.allowedAmountOfDomains ?? product.allowed_amount_of_domains) > 0 && (
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        {product.allowedAmountOfDomains ?? product.allowed_amount_of_domains} domains
                      </li>
                    )}
                    {(product.allowedAmountOfAssessments ?? product.allowed_amount_of_assessments) > 0 && (
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        {product.allowedAmountOfAssessments ?? product.allowed_amount_of_assessments} assessments
                      </li>
                    )}
                    {(product.allowedAmountOfImageUploads ?? product.allowed_amount_of_image_uploads) > 0 && (
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        {product.allowedAmountOfImageUploads ?? product.allowed_amount_of_image_uploads} image uploads
                      </li>
                    )}
                    {paymentMethods && (
                      <li className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                        Accepts: {paymentMethods}
                      </li>
                    )}
                  </ul>
                </div>

                {/* CTA */}
                <div className="px-5 pb-5">
                  <Link href={`/products/${product.id}`}>
                    <a className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-2.5 rounded text-sm font-medium hover:bg-blue-700 transition-colors">
                      <ShoppingCart className="w-4 h-4" />
                      {hasTrial ? `Start ${trialDays}-day Free Trial` : "Buy Now"}
                    </a>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
