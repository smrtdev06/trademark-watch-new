import { ReactNode, useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Home, AlertOctagon, Search, Layers, Globe, Eye, Image,
  FileText, Settings as SettingsIcon, Users, ChevronDown, LogOut, User, File, Mail, Menu, X
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useGetMe } from "@workspace/api-client-react";
import {
  mainMenu,
  filterMainMenuByPermissions,
  toLayoutMenuItem,
} from "@/lib/menuDef";
interface MenuItem {
  key: string;
  label: string;
  href?: string;
  children?: MenuItem[];
  adminOnly?: boolean;
}

function DropdownMenu({ item, isActive }: { item: MenuItem; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!item.children) {
    return (
      <li>
        <Link key={item.key} href={item.href || "/"}>
          <span className={`nav-link ${isActive ? "active" : ""}`}>{item.label}</span>
        </Link>
      </li>
    );
  }

  return (
    <li ref={ref} className="relative">
      <button
        className={`nav-link flex items-center gap-1 ${isActive ? "active" : ""}`}
        onClick={() => setOpen(!open)}
      >
        {item.label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-0 bg-white border rounded shadow-lg min-w-[180px] z-50 py-1">
          {item.children.map((child) => (
            <Link key={child.key} href={child.href || "/"}>
              <div
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                onClick={() => setOpen(false)}
              >
                {child.label}
              </div>
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const { data: user } = useGetMe();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === "admin";
  const me = user as
    | { groupId?: number | null; groupPermissions?: Record<string, boolean> | null }
    | undefined;
  const menuDefs =
    isAdmin
      ? mainMenu
      : me?.groupId != null && me.groupId !== undefined
        ? filterMainMenuByPermissions(me.groupPermissions ?? null)
        : mainMenu;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const menuItems: MenuItem[] = menuDefs.map(toLayoutMenuItem);

  const adminMenu: MenuItem = {
    key: "admin",
    label: "Admin",
    adminOnly: true,
    children: [
      { key: "admin.organizations", label: "Organizations", href: "/organizations" },
      { key: "admin.products", label: "Products", href: "/products/list" },
      { key: "admin.coupons", label: "Coupon List", href: "/coupon/list" },
      { key: "admin.pdf", label: "PDF Settings", href: "/settings/pdf" },
      { key: "admin.email", label: "Email Settings", href: "/settings/email" },
      { key: "admin.users", label: "Users", href: "/user/list" },
      { key: "admin.settings", label: "Settings", href: "/settings" },
      { key: "admin.groups", label: "Groups", href: "/admin/groups" },
      { key: "admin.keyword_logs", label: "Keyword Logs", href: "/keyword-logs" },
      { key: "admin.query_logs", label: "Query Logs", href: "/query-logs" },
      { key: "admin.user_stats", label: "User Stats", href: "/user_stats" },
      { key: "admin.templates", label: "Action & Templates", href: "/templates" },
      { key: "admin.roles", label: "Roles & Permissions", href: "/settings/roles" },
      { key: "admin.tm_settings", label: "Monitoring Settings", href: "/tm-watch/settings" },
      { key: "admin.comm_logs", label: "Communication Logs", href: "/reporting/logs" },
      { key: "admin.latest_journals", label: "Latest Journals", href: "/debug/latest-journals" },
      { key: "admin.keyword_test", label: "Keyword Test", href: "/debug/keyword-test" },
    ],
  };

  if (isAdmin) {
    menuItems.push(adminMenu);
  }

  function isMenuActive(item: MenuItem): boolean {
    if (item.href) {
      if (item.href === "/") return location === "/";
      return location === item.href || location.startsWith(item.href + "/");
    }
    if (item.children) return item.children.some((c) => {
      if (!c.href) return false;
      if (c.href === "/") return location === "/";
      return location === c.href || location.startsWith(c.href + "/");
    });
    return false;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="container-fluid mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link href="/">
                <div className="flex items-center gap-2 cursor-pointer">
                  <Eye className="w-6 h-6 text-blue-600" />
                  <span className="font-bold text-lg text-gray-800">TMPilot WTW</span>
                </div>
              </Link>
              <button
                className="lg:hidden ml-2 p-1"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div ref={profileRef} className="relative">
                <button
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                  onClick={() => setProfileOpen(!profileOpen)}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="hidden md:inline">{user?.name || "User"}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 bg-white border rounded shadow-lg min-w-[180px] z-50 py-1">
                    <div className="px-4 py-2 border-b">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <Link href="/user/profile">
                      <div
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                        onClick={() => setProfileOpen(false)}
                      >
                        <User className="w-4 h-4" /> My Profile
                      </div>
                    </Link>
                    <Link href="/products">
                      <div
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                        onClick={() => setProfileOpen(false)}
                      >
                        <FileText className="w-4 h-4" /> Browse Plans
                      </div>
                    </Link>
                    <Link href="/billing/invoices">
                      <div
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                        onClick={() => setProfileOpen(false)}
                      >
                        <FileText className="w-4 h-4" /> My Subscriptions
                      </div>
                    </Link>
                    <Link href="/organization">
                      <div
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                        onClick={() => setProfileOpen(false)}
                      >
                        <Users className="w-4 h-4" /> Your Organization
                      </div>
                    </Link>
                    <div className="border-t">
                      <div
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                        onClick={() => { setProfileOpen(false); logout(); }}
                      >
                        <LogOut className="w-4 h-4" /> Logout
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-sm border-b hidden lg:block">
        <div className="container-fluid mx-auto px-4">
          <ul className="flex items-center gap-0 h-11 text-sm">
            {menuItems.map((item) => (
              <DropdownMenu key={item.key} item={item} isActive={isMenuActive(item)} />
            ))}
          </ul>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b shadow-sm max-h-[70vh] overflow-y-auto">
          <div className="px-4 py-2">
            {menuItems.map((item) => (
              <div key={item.key} className="mb-1">
                {item.children ? (
                  <MobileDropdown item={item} onClose={() => setMobileMenuOpen(false)} />
                ) : (
                  <Link href={item.href || "/"}>
                    <div
                      className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </div>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="content-page">
        <div className="container-fluid mx-auto px-4 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function MobileDropdown({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center justify-between"
        onClick={() => setOpen(!open)}
      >
        {item.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && item.children && (
        <div className="ml-4">
          {item.children.map((child) => (
            <Link key={child.key} href={child.href || "/"}>
              <div
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
                onClick={onClose}
              >
                {child.label}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
