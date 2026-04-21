"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Package, Eye, ExternalLink, Upload, X } from "lucide-react";
import { toast } from "sonner";

interface Price {
  id: string;
  amount: number;
  currency: string;
  type: string;
  interval: string | null;
  intervalCount: number | null;
  isActive: boolean;
  isDefault: boolean;
}

interface Product {
  id: string;
  name: string;
  shortDescription: string | null;
  fullDescription: string | null;
  imageUrl: string | null;
  stripeProductId: string | null;
  isPublic: boolean;
  status: string;
  createdAt: string;
  prices: Price[];
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function formatBilling(type: string, interval: string | null, count: number | null) {
  if (type === "one_time") return "One-time";
  if (!interval) return "Subscription";
  const labels: Record<string, string> = { day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" };
  if (count && count > 1) return `Every ${count} ${interval}s`;
  return labels[interval] || interval;
}

export default function ProductsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [productList, setProductList] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Create dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  // Price state
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("THB");
  const [priceType, setPriceType] = useState("one_time");
  const [priceInterval, setPriceInterval] = useState("month");

  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/admin/products");
      if (res.status === 401) {
        router.replace("/dashboard");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setProductList(data.products || []);
      }
    } catch {
      console.error("Failed to fetch products");
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setName("");
    setShortDescription("");
    setFullDescription("");
    setIsPublic(true);
    setPriceAmount("");
    setPriceCurrency("THB");
    setPriceType("one_time");
    setPriceInterval("month");
    setImagePreview(null);
    setImageFile(null);
    setDialogOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, GIF, and WebP are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum 5MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Product name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          shortDescription: shortDescription.trim() || null,
          fullDescription: fullDescription.trim() || null,
          isPublic,
          status: "active",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const productId = data.product?.id;

        // Upload image if selected
        if (imageFile && productId) {
          const formData = new FormData();
          formData.append("file", imageFile);
          formData.append("productId", productId);
          await fetch("/api/admin/products/upload-image", {
            method: "POST",
            body: formData,
          });
        }

        // Create price if amount was provided
        const amountCents = Math.round(parseFloat(priceAmount) * 100);
        if (productId && !isNaN(amountCents) && amountCents > 0) {
          await fetch(`/api/admin/products/${productId}/prices`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: amountCents,
              currency: priceCurrency,
              type: priceType,
              interval: priceType === "subscription" ? priceInterval : null,
              intervalCount: priceType === "subscription" ? 1 : null,
              isDefault: true,
            }),
          });
        }

        toast.success("Product created");
        setDialogOpen(false);
        router.push(`/admin/products/${productId}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create product");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const getDefaultPrice = (p: Product) => {
    return p.prices.find((pr) => pr.isDefault && pr.isActive)
      || p.prices.find((pr) => pr.isActive);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage products synced with Stripe ({productList.length} total)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.open("/products", "_blank")}>
            <Eye className="h-4 w-4 mr-2" />
            View Public Catalog
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Product
          </Button>
        </div>
      </div>

      {productList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No products yet. Create your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {productList.map((p) => {
            const defaultPrice = getDefaultPrice(p);
            return (
              <Card
                key={p.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => router.push(`/admin/products/${p.id}`)}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {p.imageUrl ? (
                      <div className="h-12 w-12 rounded overflow-hidden flex-shrink-0">
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                          {p.name}
                        </h3>
                        {p.isPublic ? (
                          <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">
                            Public
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-gray-400 text-gray-500">
                            Hidden
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        {defaultPrice ? (
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatPrice(defaultPrice.amount, defaultPrice.currency)}
                            {defaultPrice.type === "subscription" && (
                              <span className="text-muted-foreground font-normal ml-1">
                                {formatBilling(defaultPrice.type, defaultPrice.interval, defaultPrice.intervalCount)}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">No price set</span>
                        )}
                        {p.prices.length > 1 && (
                          <span>{p.prices.length} prices</span>
                        )}
                        <span className="hidden sm:inline">
                          Created {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    title="View public page"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/products/${p.id}`, "_blank");
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Product</DialogTitle>
            <DialogDescription>
              Create a new product with an initial price.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prodName">Name *</Label>
              <Input
                id="prodName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pro Plan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prodShortDesc">Short Description</Label>
              <Input
                id="prodShortDesc"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Brief description shown on catalog cards"
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prodFullDesc">Full Description</Label>
              <Textarea
                id="prodFullDesc"
                value={fullDescription}
                onChange={(e) => setFullDescription(e.target.value)}
                placeholder="Detailed description (optional)"
                rows={4}
              />
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label>Product Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleImageSelect}
              />
              {imagePreview ? (
                <div className="relative">
                  <div className="w-full h-40 rounded-md overflow-hidden border">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-md flex flex-col items-center justify-center gap-2 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload (max 5MB)</span>
                </button>
              )}
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label>Price</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                  placeholder="0.00"
                />
                <Select value={priceCurrency} onValueChange={setPriceCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="THB">THB (&#3647;)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (&euro;)</SelectItem>
                    <SelectItem value="GBP">GBP (&pound;)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Billing Type</Label>
              <Select value={priceType} onValueChange={setPriceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time Payment</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {priceType === "subscription" && (
              <div className="space-y-2">
                <Label>Billing Interval</Label>
                <Select value={priceInterval} onValueChange={setPriceInterval}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label>Public Visibility</Label>
                <p className="text-sm text-muted-foreground">
                  {isPublic ? "Shown on public catalog" : "Hidden from public catalog"}
                </p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Creating..." : "Create Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
