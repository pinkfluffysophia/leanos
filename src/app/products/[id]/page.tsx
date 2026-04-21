"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  fullDescription: string | null;
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

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [buying, setBuying] = useState(false);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${id}`);
        if (res.ok) {
          const data = await res.json();
          setProduct(data.product);
          // Select default price
          const defaultPrice = data.product?.prices?.find((p: Price) => p.isDefault)
            || data.product?.prices?.[0];
          if (defaultPrice) setSelectedPriceId(defaultPrice.id);
        }
      } catch {
        console.error("Failed to fetch product");
      } finally {
        setLoaded(true);
      }
    };
    fetchProduct();
  }, [id]);

  const handleBuy = async () => {
    if (!product || !selectedPriceId) return;
    setBuying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, priceId: selectedPriceId }),
      });

      if (res.status === 401) {
        toast.error("Please log in to purchase");
        router.push("/login");
        return;
      }

      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Failed to start checkout");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setBuying(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center py-20">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">Product not found</p>
          <p className="text-muted-foreground mb-6">This product may no longer be available.</p>
          <Button onClick={() => router.push("/products")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  const selectedPrice = product.prices.find((p) => p.id === selectedPriceId);
  const hasMultiplePrices = product.prices.length > 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Button variant="ghost" size="sm" className="mb-8" onClick={() => router.push("/products")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Products
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Image */}
        <div className="w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover min-h-[320px]" />
          ) : (
            <div className="flex items-center justify-center min-h-[320px]">
              <Package className="h-20 w-20 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col justify-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            {product.name}
          </h1>

          {product.shortDescription && (
            <p className="text-muted-foreground text-base mb-6">
              {product.shortDescription}
            </p>
          )}

          {/* Price display / selection */}
          {hasMultiplePrices ? (
            <div className="space-y-2 mb-8">
              <p className="text-sm font-medium text-muted-foreground">Choose a pricing option:</p>
              {product.prices.map((price) => (
                <button
                  key={price.id}
                  onClick={() => setSelectedPriceId(price.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors",
                    selectedPriceId === price.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-gray-400 dark:hover:border-gray-500"
                  )}
                >
                  <span className="font-semibold">
                    {formatPrice(price.amount, price.currency)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatBilling(price.type, price.interval, price.intervalCount)}
                  </span>
                </button>
              ))}
            </div>
          ) : selectedPrice ? (
            <div className="flex items-center gap-3 mb-8">
              <Badge variant="outline" className="text-lg font-semibold px-3 py-1">
                {formatPrice(selectedPrice.amount, selectedPrice.currency)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {formatBilling(selectedPrice.type, selectedPrice.interval, selectedPrice.intervalCount)}
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground mb-8">No pricing available</p>
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={handleBuy}
            disabled={buying || !selectedPrice}
          >
            {buying ? "Loading..." : "Buy Now"}
          </Button>
        </div>
      </div>

      {/* Full Description */}
      {product.fullDescription && (
        <Card className="mt-10">
          <CardContent className="py-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Description</h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {product.fullDescription}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
