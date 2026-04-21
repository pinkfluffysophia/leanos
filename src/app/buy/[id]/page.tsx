"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function BuyPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const priceId = searchParams.get("price");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startCheckout = async () => {
      try {
        const payload: Record<string, string> = { productId: id };
        if (priceId) payload.priceId = priceId;

        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok && data.url) {
          window.location.href = data.url;
        } else {
          setError(data.error || "Failed to start checkout");
        }
      } catch {
        setError("An error occurred. Please try again.");
      }
    };

    startCheckout();
  }, [id, priceId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {error ? (
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <a href="/products" className="text-sm text-muted-foreground underline">
            Browse products
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p>Redirecting to checkout...</p>
        </div>
      )}
    </div>
  );
}
