"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { toast } from "sonner";

interface Price {
  id: string;
  amount: number;
  currency: string;
  type: string;
  interval: string | null;
  intervalCount: number | null;
  isDefault: boolean;
}

interface Product {
  id: string;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
  prices: Price[];
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function formatBilling(type: string, interval: string | null, count: number | null) {
  if (type === "one_time") return "One-time payment";
  if (!interval) return "Subscription";
  const labels: Record<string, string> = { day: "day", week: "week", month: "month", year: "year" };
  const unit = labels[interval] || interval;
  if (count && count > 1) return `Every ${count} ${unit}s`;
  return `Per ${unit}`;
}

function getDefaultPrice(prices: Price[]) {
  return prices.find((p) => p.isDefault) || prices[0];
}

export default function ProductsCatalogPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch {
        console.error("Failed to fetch products");
      } finally {
        setLoaded(true);
      }
    };
    fetchProducts();
  }, []);

  const handleBuy = async (productId: string, priceId?: string) => {
    setBuyingId(productId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, priceId }),
      });

      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Failed to start checkout");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setBuyingId(null);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-14">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
          Our Products
        </h1>
        <p className="text-base text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          Discover our range of products designed to help you succeed. Choose the perfect solution for your needs.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Package className="h-14 w-14 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No products available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {products.map((p) => {
            const defaultPrice = getDefaultPrice(p.prices);
            return (
              <Card key={p.id} className="flex flex-col overflow-hidden">
                {/* Image */}
                <div className="w-full h-52 bg-gray-100 dark:bg-gray-800">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Package className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <CardContent className="flex flex-col flex-1 p-5">
                  {/* Title + Price */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2">
                      {p.name}
                    </h3>
                    {defaultPrice && (
                      <div className="text-right flex-shrink-0">
                        <Badge variant="outline" className="text-sm font-semibold whitespace-nowrap">
                          {formatPrice(defaultPrice.amount, defaultPrice.currency)}
                        </Badge>
                        {defaultPrice.type === "subscription" && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatBilling(defaultPrice.type, defaultPrice.interval, defaultPrice.intervalCount)}
                          </p>
                        )}
                        {p.prices.length > 1 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p.prices.length} pricing options
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Short description */}
                  {p.shortDescription && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
                      {p.shortDescription}
                    </p>
                  )}
                  {!p.shortDescription && <div className="flex-1" />}

                  {/* Actions */}
                  <div className="flex gap-3 mt-auto pt-4">
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => router.push(`/products/${p.id}`)}
                    >
                      View Details
                    </Button>
                    {defaultPrice ? (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleBuy(p.id, defaultPrice.id)}
                        disabled={buyingId === p.id}
                      >
                        {buyingId === p.id ? "Loading..." : "Buy Now"}
                      </Button>
                    ) : (
                      <Button variant="outline" className="flex-1" disabled>
                        Unavailable
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
