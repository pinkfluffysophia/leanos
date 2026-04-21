"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Package,
  MessageSquare,
  ClipboardList,
  Mail,
  SendHorizonal,
  Settings,
  FileText,
  Tag,
  CreditCard,
  Wallet,
  Cog,
  ArrowLeft,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Back to Dashboard", icon: ArrowLeft, separator: true },
  { href: "/admin/dashboard", label: "Admin Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/messenger", label: "Messenger", icon: MessageSquare },
  { href: "/admin/waitlists", label: "Waitlists", icon: ClipboardList },
  { href: "/admin/email-templates", label: "Email Templates", icon: Mail },
  { href: "/admin/test-emails", label: "Test Emails", icon: SendHorizonal },
  { href: "/admin/email-config", label: "Email Config", icon: Settings },
  { href: "/admin/email-logs", label: "Email Logs", icon: FileText },
  { href: "/admin/tags", label: "Tags", icon: Tag },
  { href: "/admin/transactions", label: "Transactions", icon: Wallet },
  { href: "/admin/stripe", label: "Stripe Integration", icon: CreditCard },
  { href: "/admin/system-settings", label: "System Settings", icon: Cog },
];

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ mobileOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-200 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between flex-shrink-0 h-16 px-4">
          <Link href="/admin/dashboard" className="text-xl font-bold text-gray-900 dark:text-white">
            LeanOS <span className="text-sm font-normal text-red-500">Admin</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-grow flex flex-col overflow-y-auto">
          <nav className="flex-1 px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <div key={item.href}>
                  {item.separator && <div className="mb-2" />}
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-5 w-5 flex-shrink-0",
                        isActive
                          ? "text-gray-900 dark:text-white"
                          : "text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300"
                      )}
                    />
                    {item.label}
                  </Link>
                  {item.separator && <div className="my-2 border-t border-gray-200 dark:border-gray-800" />}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
