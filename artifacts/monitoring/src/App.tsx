import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useUserAccess, hasFunction } from "@/hooks/use-user-access";
import { PaywallScreen } from "@/components/paywall-screen";

setAuthTokenGetter(() => localStorage.getItem("token"));

import Login from "./pages/login";
import Register from "./pages/register";
import Dashboard from "./pages/dashboard";
import AlertsAdd from "./pages/alerts-add";
import AlertsList from "./pages/alerts-list";
import AlertsResults from "./pages/alerts-results";
import Assessment from "./pages/assessment";
import License from "./pages/license";
import Opposition from "./pages/opposition";
import Proprietor from "./pages/proprietor";
import SearchB2B from "./pages/search-b2b";
import SocialList from "./pages/social-list";
import SocialResults from "./pages/social-results";
import DomainList from "./pages/domain-list";
import DomainResults from "./pages/domain-results";
import TmWatchAdd from "./pages/tm-watch-add";
import TmWatchImport from "./pages/tm-watch-import";
import TmWatchImportFailed from "./pages/tm-watch-import-failed";
import TmWatchList from "./pages/tm-watch-list";
import TmWatchView from "./pages/tm-watch-view";
import TmWatchExport from "./pages/tm-watch-export";
import TmWatchSettings from "./pages/tm-watch-settings";
import LogoView from "./pages/logo-view";
import LogoAdd from "./pages/logo-add";
import LogoResults from "./pages/logo-results";
import ImageWatch from "./pages/image-watch";
import ImageWatchImport from "./pages/image-watch-import";
import Files from "./pages/files";
import Clients from "./pages/clients";
import Profile from "./pages/profile";
import BillingInvoices from "./pages/billing-invoices";
import Organization from "./pages/organization";
import AdminUsers from "./pages/admin-users";
import AdminUserDetails from "./pages/admin-user-details";
import AdminSettings from "./pages/admin-settings";
import AdminKeywordLogs from "./pages/admin-keyword-logs";
import AdminQueryLogs from "./pages/admin-query-logs";
import AdminUserStats from "./pages/admin-user-stats";
import AdminTemplates from "./pages/admin-templates";
import AdminRoles from "./pages/admin-roles";
import AdminGroups from "./pages/admin-groups";
import AdminCommunicationLogs from "./pages/admin-communication-logs";
import AdminOrganizations from "./pages/admin-organizations";
import AdminProducts from "./pages/admin-products";
import AdminCoupons from "./pages/admin-coupons";
import ProductsList from "./pages/products";
import BillingPay from "./pages/billing-pay";
import SettingsPdf from "./pages/settings-pdf";
import SettingsEmail from "./pages/settings-email";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, adminOnly, ...rest }: any) {
  const { token, isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!token) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && user?.role !== "admin") {
    return <Redirect to="/" />;
  }

  return <Route {...rest} component={Component} />;
}

/**
 * FunctionRoute — like ProtectedRoute but also checks that the user has
 * an active/trial subscription covering the required product function(s).
 *
 * Mirrors PHP: UserHasAccess middleware + ProductPermissions::isFuncsAllowed()
 *
 * `requiredFunctions` is an OR list — user needs at least ONE of them.
 * If not, PaywallScreen is shown (mirrors not_active_product.blade.php).
 */
function FunctionRoute({ component: Component, requiredFunctions, ...rest }: any) {
  const { token, isLoading: authLoading, user } = useAuth();
  const { allowedFunctions, isLoading: accessLoading } = useUserAccess();

  if (authLoading || accessLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!token) {
    return <Redirect to="/login" />;
  }

  // Admins bypass all function checks (mirrors PHP: if admin → return true)
  const isAdmin = user?.role === "admin";
  if (!isAdmin && !hasFunction(allowedFunctions, ...requiredFunctions)) {
    return <Route {...rest} component={() => <PaywallScreen />} />;
  }

  return <Route {...rest} component={Component} />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      <ProtectedRoute path="/" component={Dashboard} />

      <ProtectedRoute path="/alerts" component={AlertsAdd} />
      <ProtectedRoute path="/alerts/list" component={AlertsList} />
      <ProtectedRoute path="/alerts/results" component={AlertsResults} />

      {/* function_Assessment (60) — mirrors PHP: /assessment */}
      <FunctionRoute path="/assessment" component={Assessment} requiredFunctions={[60]} />

      <ProtectedRoute path="/license" component={License} />
      <ProtectedRoute path="/search_opposition" component={Opposition} />

      {/* function_ProprietorSearch (110) — mirrors PHP: /proprietor */}
      <FunctionRoute path="/proprietor" component={Proprietor} requiredFunctions={[110]} />

      <ProtectedRoute path="/search" component={SearchB2B} />

      {/* function_SocialWatch (100) — mirrors PHP: /social-watch/* */}
      <FunctionRoute path="/social-watch/list"    component={SocialList}    requiredFunctions={[100]} />
      <FunctionRoute path="/social-watch/results" component={SocialResults} requiredFunctions={[100]} />

      {/* function_DomainMonitoring (30) — mirrors PHP: /domain-monitoring/* */}
      <FunctionRoute path="/domain-monitoring"         component={DomainList}    requiredFunctions={[30]} />
      <FunctionRoute path="/domain-monitoring/results" component={DomainResults} requiredFunctions={[30]} />

      {/* function_AllCountriesMonitoring (10) + SpecificCountries (20) — mirrors PHP: /tm-watch/* */}
      <FunctionRoute path="/tm-watch/add"           component={TmWatchAdd}          requiredFunctions={[10, 20]} />
      <FunctionRoute path="/tm-watch/import"        component={TmWatchImport}       requiredFunctions={[10, 20]} />
      <FunctionRoute path="/tm-watch/import-failed" component={TmWatchImportFailed} requiredFunctions={[10, 20]} />
      <FunctionRoute path="/tm-watch/list"          component={TmWatchList}         requiredFunctions={[10, 20]} />
      <FunctionRoute path="/tm-watch/view"          component={TmWatchView}         requiredFunctions={[10, 20]} />
      <FunctionRoute path="/tm-watch/export"        component={TmWatchExport}       requiredFunctions={[10, 20]} />
      <ProtectedRoute path="/tm-watch/settings" component={TmWatchSettings} adminOnly />

      {/* function_AllCountriesVisualSearch (40) + SpecificCountries (50) — mirrors PHP: /logo/* */}
      <FunctionRoute path="/logo"         component={LogoView}    requiredFunctions={[40, 50]} />
      <FunctionRoute path="/logo/add"     component={LogoAdd}     requiredFunctions={[40, 50]} />
      <FunctionRoute path="/logo/results" component={LogoResults} requiredFunctions={[40, 50]} />

      <ProtectedRoute path="/image-watch" component={ImageWatch} />
      <ProtectedRoute path="/image-watch/import" component={ImageWatchImport} />

      <ProtectedRoute path="/files" component={Files} />
      <ProtectedRoute path="/user/contacts" component={Clients} />
      <ProtectedRoute path="/user/profile" component={Profile} />
      <ProtectedRoute path="/user/profile/:id" component={Profile} />
      <ProtectedRoute path="/billing/invoices" component={BillingInvoices} />
      <ProtectedRoute path="/products" component={ProductsList} />
      {/* /products/list MUST come before /products/:id so "list" isn't captured as :id */}
      <ProtectedRoute path="/products/list" component={AdminProducts} adminOnly />
      <ProtectedRoute path="/products/:id" component={BillingPay} />
      <ProtectedRoute path="/organization" component={Organization} />

      <ProtectedRoute path="/user/list" component={AdminUsers} adminOnly />
      <ProtectedRoute path="/user/list/:id" component={AdminUserDetails} adminOnly />
      <ProtectedRoute path="/admin/groups" component={AdminGroups} adminOnly />
      <ProtectedRoute path="/settings" component={AdminSettings} adminOnly />
      <ProtectedRoute path="/settings/roles" component={AdminRoles} adminOnly />
      <ProtectedRoute path="/settings/pdf" component={SettingsPdf} adminOnly />
      <ProtectedRoute path="/settings/email" component={SettingsEmail} adminOnly />
      <ProtectedRoute path="/keyword-logs" component={AdminKeywordLogs} adminOnly />
      <ProtectedRoute path="/query-logs" component={AdminQueryLogs} adminOnly />
      <ProtectedRoute path="/user_stats" component={AdminUserStats} adminOnly />
      <ProtectedRoute path="/templates" component={AdminTemplates} adminOnly />
      <ProtectedRoute path="/reporting/logs" component={AdminCommunicationLogs} adminOnly />
      <ProtectedRoute path="/organizations" component={AdminOrganizations} adminOnly />
      <ProtectedRoute path="/coupon/list" component={AdminCoupons} adminOnly />

      <Route>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800">404</h1>
            <p className="text-gray-600 mt-2">Page not found</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
