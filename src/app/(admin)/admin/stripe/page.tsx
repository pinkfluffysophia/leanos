"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";

interface StripeConfigData {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  isConnected: boolean;
}

export default function StripePage() {
  const router = useRouter();
  const [config, setConfig] = useState<StripeConfigData>({
    secretKey: "",
    publishableKey: "",
    webhookSecret: "",
    isConnected: false,
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasSecretKey, setHasSecretKey] = useState(false);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stripe")
      .then((res) => {
        if (res.status === 401) {
          router.replace("/dashboard");
          return null;
        }
        if (!res.ok) throw new Error("Failed to load config");
        return res.json();
      })
      .then((data) => {
        if (data) {
          setHasSecretKey(!!data.secretKey);
          setHasWebhookSecret(!!data.webhookSecret);
          setConfig({
            ...data,
            secretKey: "",
            webhookSecret: "",
          });
          setLoaded(true);
        }
      })
      .catch(() => setLoaded(true));
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      if (!payload.secretKey) payload.secretKey = "••••••••";
      if (!payload.webhookSecret) payload.webhookSecret = "••••••••";

      const response = await fetch("/api/admin/stripe", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success("Stripe configuration saved");
        if (config.secretKey) setHasSecretKey(true);
        if (config.webhookSecret) setHasWebhookSecret(true);
        setConfig({ ...config, secretKey: "", webhookSecret: "" });
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save configuration");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stripe Integration</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Configure Stripe for payment processing
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Stripe API Keys</CardTitle>
              <CardDescription>Enter your Stripe API credentials</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="secretKey">Secret Key</Label>
            <Input
              id="secretKey"
              type="password"
              value={config.secretKey}
              onChange={(e) => setConfig({ ...config, secretKey: e.target.value })}
              placeholder={hasSecretKey ? "Key saved — leave blank to keep" : "sk_live_..."}
            />
            <p className="text-xs text-muted-foreground">
              Found in your Stripe Dashboard under Developers &gt; API Keys
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publishableKey">Publishable Key</Label>
            <Input
              id="publishableKey"
              value={config.publishableKey}
              onChange={(e) => setConfig({ ...config, publishableKey: e.target.value })}
              placeholder="pk_live_..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Webhook Secret</Label>
            <Input
              id="webhookSecret"
              type="password"
              value={config.webhookSecret}
              onChange={(e) => setConfig({ ...config, webhookSecret: e.target.value })}
              placeholder={hasWebhookSecret ? "Secret saved — leave blank to keep" : "whsec_..."}
            />
            <p className="text-xs text-muted-foreground">
              Found in your Stripe Dashboard under Developers &gt; Webhooks
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Enable Stripe</p>
              <p className="text-xs text-muted-foreground">
                Toggle to activate or deactivate payment processing
              </p>
            </div>
            <Switch
              checked={config.isConnected}
              onCheckedChange={(checked) => setConfig({ ...config, isConnected: checked })}
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
