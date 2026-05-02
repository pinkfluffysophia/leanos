"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  ArrowLeft,
  Eye,
  Link2,
  Package,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { SessionGuard } from "@/components/shared/session-guard";
import { ProductFilesSection } from "@/components/admin/product-files-section";

interface Price {
  id: string;
  productId: string;
  amount: number;
  currency: string;
  type: string;
  interval: string | null;
  intervalCount: number | null;
  stripePriceId: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
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

function copyFallback(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  toast.success("Checkout link copied");
}

export default function AdminProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [product, setProduct] = useState<Product | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Edit product dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editShortDesc, setEditShortDesc] = useState("");
  const [editFullDesc, setEditFullDesc] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  // Image
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Price dialog
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<Price | null>(null);
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [priceType, setPriceType] = useState("one_time");
  const [priceInterval, setPriceInterval] = useState("month");
  const [priceIsDefault, setPriceIsDefault] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);

  // Delete dialogs
  const [deleteProductOpen, setDeleteProductOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [priceToDelete, setPriceToDelete] = useState<Price | null>(null);
  const [deletingPrice, setDeletingPrice] = useState(false);

  const fetchProduct = async () => {
    try {
      const res = await fetch(`/api/admin/products/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProduct(data.product);
      }
    } catch {
      console.error("Failed to fetch product");
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // === Product Edit ===
  const openEditProduct = () => {
    if (!product) return;
    setEditName(product.name);
    setEditShortDesc(product.shortDescription || "");
    setEditFullDesc(product.fullDescription || "");
    setEditIsPublic(product.isPublic);
    setImagePreview(product.imageUrl);
    setImageFile(null);
    setEditOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (!imageFile) return null;
    const formData = new FormData();
    formData.append("file", imageFile);
    formData.append("productId", productId);
    const res = await fetch("/api/admin/products/upload-image", {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      return data.imageUrl;
    }
    return null;
  };

  const saveProduct = async () => {
    if (!product || !editName.trim()) {
      toast.error("Product name is required");
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          shortDescription: editShortDesc.trim() || null,
          fullDescription: editFullDesc.trim() || null,
          isPublic: editIsPublic,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update product");
        return;
      }

      if (imageFile) {
        await uploadImage(product.id);
      }

      toast.success("Product updated");
      setEditOpen(false);
      fetchProduct();
    } catch {
      toast.error("An error occurred");
    } finally {
      setEditSaving(false);
    }
  };

  // === Price Add/Edit ===
  const openAddPrice = () => {
    setEditingPrice(null);
    setPriceAmount("");
    setPriceCurrency("USD");
    setPriceType("one_time");
    setPriceInterval("month");
    setPriceIsDefault(false);
    setPriceDialogOpen(true);
  };

  const openEditPrice = (price: Price) => {
    setEditingPrice(price);
    setPriceAmount(String(price.amount / 100));
    setPriceCurrency(price.currency);
    setPriceType(price.type);
    setPriceInterval(price.interval || "month");
    setPriceIsDefault(price.isDefault);
    setPriceDialogOpen(true);
  };

  const savePrice = async () => {
    const amountCents = Math.round(parseFloat(priceAmount) * 100);
    if (isNaN(amountCents) || amountCents < 1) {
      toast.error("Price must be at least 0.01");
      return;
    }

    setPriceSaving(true);
    try {
      const payload = {
        amount: amountCents,
        currency: priceCurrency,
        type: priceType,
        interval: priceType === "subscription" ? priceInterval : null,
        intervalCount: priceType === "subscription" ? 1 : null,
        isDefault: priceIsDefault,
      };

      const url = editingPrice
        ? `/api/admin/products/${id}/prices/${editingPrice.id}`
        : `/api/admin/products/${id}/prices`;

      const res = await fetch(url, {
        method: editingPrice ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save price");
        return;
      }

      toast.success(editingPrice ? "Price updated" : "Price added");
      setPriceDialogOpen(false);
      fetchProduct();
    } catch {
      toast.error("An error occurred");
    } finally {
      setPriceSaving(false);
    }
  };

  // === Delete Price ===
  const confirmDeletePrice = async () => {
    if (!priceToDelete) return;
    setDeletingPrice(true);
    try {
      const res = await fetch(`/api/admin/products/${id}/prices/${priceToDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Price deleted");
        setPriceToDelete(null);
        fetchProduct();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete price");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setDeletingPrice(false);
    }
  };

  // === Delete Product ===
  const confirmDeleteProduct = async () => {
    if (!product) return;
    setDeletingProduct(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Product deleted");
        router.push("/admin/products");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete product");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setDeletingProduct(false);
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
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-20">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Product not found</p>
          <Button onClick={() => router.push("/admin/products")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  const defaultPrice = product.prices.find((p) => p.isDefault && p.isActive)
    || product.prices.find((p) => p.isActive);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <SessionGuard requireAdmin />

      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-6"
        onClick={() => router.push("/admin/products")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Products
      </Button>

      {/* Product Header + Pricing */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold truncate">{product.name}</h1>
                  <Badge variant={product.isPublic ? "outline" : "secondary"}>
                    {product.isPublic ? "Public" : "Hidden"}
                  </Badge>
                </div>
                {product.shortDescription && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {product.shortDescription}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/products/${product.id}`, "_blank")}
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
              <Button variant="outline" size="sm" onClick={openEditProduct}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>

          {/* Pricing */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Pricing</h2>
              <Button size="sm" onClick={openAddPrice}>
                <Plus className="h-4 w-4 mr-2" />
                Add Price
              </Button>
            </div>

          {product.prices.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No prices yet. Add a price to make this product available for purchase.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {product.prices.map((price) => (
                <div
                  key={price.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {formatPrice(price.amount, price.currency)}
                    </span>
                    {price.isDefault && (
                      <Badge variant="outline" className="text-xs">
                        Default
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {formatBilling(price.type, price.interval, price.intervalCount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Copy checkout link for this price"
                      onClick={() => {
                        const url = `${window.location.origin}/buy/${product.id}?price=${price.id}`;
                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(url).then(() => {
                            toast.success("Checkout link copied");
                          }).catch(() => {
                            copyFallback(url);
                          });
                        } else {
                          copyFallback(url);
                        }
                      }}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditPrice(price)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setPriceToDelete(price)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Files */}
      <ProductFilesSection productId={product.id} />

      {/* Info Footer */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Product ID: {product.id}</span>
            <span>Created: {new Date(product.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-destructive mb-2">Danger Zone</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Deleting this product will archive it on Stripe and remove it from your catalog.
          </p>
          <Button variant="destructive" onClick={() => setDeleteProductOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Product
          </Button>
        </CardContent>
      </Card>

      {/* === Edit Product Dialog === */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product details.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Product name"
              />
            </div>

            <div>
              <Label>Short Description</Label>
              <Input
                value={editShortDesc}
                onChange={(e) => setEditShortDesc(e.target.value)}
                placeholder="Brief description (shown on cards)"
                maxLength={500}
              />
            </div>

            <div>
              <Label>Full Description</Label>
              <Textarea
                value={editFullDesc}
                onChange={(e) => setEditFullDesc(e.target.value)}
                placeholder="Detailed description (optional)"
                rows={4}
              />
            </div>

            <div>
              <Label>Product Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleImageSelect}
              />
              {imagePreview ? (
                <div className="relative mt-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  className="mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload image</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Public Visibility</Label>
                <p className="text-xs text-muted-foreground">Show on public catalog</p>
              </div>
              <Switch checked={editIsPublic} onCheckedChange={setEditIsPublic} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveProduct} disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Price Dialog (Add/Edit) === */}
      <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPrice ? "Edit Price" : "Add Price"}</DialogTitle>
            <DialogDescription>
              {editingPrice
                ? "Update this pricing option. Note: This creates a new Stripe price since Stripe prices are immutable."
                : "Add a new pricing option for this product."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={priceCurrency} onValueChange={setPriceCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (&euro;)</SelectItem>
                    <SelectItem value="GBP">GBP (&pound;)</SelectItem>
                    <SelectItem value="THB">THB (&#3647;)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
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
              <p className="text-xs text-muted-foreground mt-1">
                Choose how customers will be charged for this price option
              </p>
            </div>

            {priceType === "subscription" && (
              <div>
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
                <Label>Set as Default</Label>
                <p className="text-xs text-muted-foreground">Shown on catalog cards</p>
              </div>
              <Switch checked={priceIsDefault} onCheckedChange={setPriceIsDefault} />
            </div>

            {editingPrice && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-400 text-sm">
                      Important: Price Update Behavior
                    </p>
                    <ul className="mt-1 text-xs text-amber-700 dark:text-amber-500 space-y-0.5 list-disc list-inside">
                      <li>A new Stripe price will be created (Stripe prices are immutable)</li>
                      <li>The old price will be deactivated automatically</li>
                      <li>Existing customers on subscriptions will continue with the old price</li>
                      <li>New customers will see the updated price</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePrice} disabled={priceSaving}>
              {priceSaving ? "Saving..." : editingPrice ? "Update Price" : "Add Price"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Delete Price Dialog === */}
      <Dialog open={!!priceToDelete} onOpenChange={(open) => !open && setPriceToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Price</DialogTitle>
            <DialogDescription>
              Are you sure? This will archive the price on Stripe and remove it from this product.
              {priceToDelete?.isDefault && " A new default price will be set automatically."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeletePrice}
              disabled={deletingPrice}
            >
              {deletingPrice ? "Deleting..." : "Delete Price"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Delete Product Dialog === */}
      <Dialog open={deleteProductOpen} onOpenChange={setDeleteProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{product.name}&quot;? This will archive it on
              Stripe and remove all associated prices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProductOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProduct}
              disabled={deletingProduct}
            >
              {deletingProduct ? "Deleting..." : "Delete Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
