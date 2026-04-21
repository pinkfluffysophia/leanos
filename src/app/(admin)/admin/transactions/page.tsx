"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, ChevronLeft, ChevronRight, DollarSign, Activity, AlertTriangle, ExternalLink, Mail } from "lucide-react";

interface Transaction {
  id: string;
  type: "purchase" | "refund";
  amount: number;
  currency: string;
  status: string;
  stripeTransactionId: string | null;
  createdAt: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  purchaseId: string | null;
  productName: string | null;
  priceType: string | null;
  priceInterval: string | null;
  priceIntervalCount: number | null;
}

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stats, setStats] = useState({ totalRevenue: 0, totalTransactions: 0, failedTransactions: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/transactions?${params}`);
      if (res.status === 401) {
        router.replace("/dashboard");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data?.transactions) {
          setTransactions(data.transactions);
          setTotalPages(data.totalPages);
          setTotal(data.total);
          if (data.stats) setStats(data.stats);
        }
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoaded(true);
    }
  }, [page, debouncedSearch, router]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const formatCurrency = (amount: number, currency: string, type: string) => {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount / 100);
    return type === "refund" ? `-${formatted}` : formatted;
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  };

  const formatBilling = (type: string | null, interval: string | null, count: number | null) => {
    if (!type || type === "one_time") return "One-time";
    if (!interval) return "Subscription";
    const labels: Record<string, string> = { day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" };
    if (count && count > 1) return `Every ${count} ${interval}s`;
    return labels[interval] || interval;
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
        <p className="text-gray-500 dark:text-gray-400">
          View all transactions ({total} total)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(stats.totalRevenue / 100)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalTransactions}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Failed Transactions</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.failedTransactions}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by user name or email..."
        className="w-full sm:max-w-xs"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Page {page} of {totalPages || 1}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {total === 0 && !search
                ? "No transactions yet. Transactions will appear here once purchases are made."
                : "No transactions found matching your search."}
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-6 p-4 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  {/* Transaction ID + type */}
                  <div className="w-32 flex-shrink-0">
                    <p className="text-sm font-mono text-gray-900 dark:text-white truncate">
                      {tx.stripeTransactionId
                        ? tx.stripeTransactionId.replace("pi_", "").slice(0, 10) + "..."
                        : tx.id.slice(0, 8) + "..."}
                    </p>
                    <p className="text-xs text-muted-foreground">{tx.stripeTransactionId ? "stripe" : "manual"}</p>
                  </div>

                  {/* User */}
                  <div className="w-44 flex-shrink-0 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tx.userName}</p>
                    <div className="flex items-center gap-1 min-w-0">
                      <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">{tx.userEmail || "No email"}</p>
                    </div>
                  </div>

                  {/* Product */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {tx.productName || "Unknown product"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBilling(tx.priceType, tx.priceInterval, tx.priceIntervalCount)}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="w-28 flex-shrink-0 text-right">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(tx.amount, tx.currency, tx.type)}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="w-24 flex-shrink-0 text-center">
                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        tx.status === "completed"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      }`}
                    >
                      {tx.status === "completed" ? "Succeeded" : "Failed"}
                    </span>
                  </div>

                  {/* Date + Stripe link */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(tx.createdAt)}
                    </span>
                    {tx.stripeTransactionId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        title="View in Stripe"
                        onClick={() => {
                          const id = tx.stripeTransactionId!;
                          const path = id.startsWith("sub_") ? "subscriptions" : id.startsWith("pi_") ? "payments" : null;
                          if (path) {
                            window.open(`https://dashboard.stripe.com/test/${path}/${id}`, "_blank");
                          } else {
                            window.open("https://dashboard.stripe.com/test/payments", "_blank");
                          }
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
