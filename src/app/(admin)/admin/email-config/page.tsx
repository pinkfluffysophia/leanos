"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Mail } from "lucide-react";
import { toast } from "sonner";

interface EmailConfigData {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  isActive: boolean;
}

export default function EmailConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState<EmailConfigData>({
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    smtpFrom: "",
    isActive: false,
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    fetch("/api/admin/email-config")
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
          setHasPassword(!!data.smtpPassword);
          setConfig({ ...data, smtpPassword: "" });
          setLoaded(true);
        }
      })
      .catch(() => setLoaded(true));
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      // Only send password if user typed a new one
      if (!payload.smtpPassword) {
        payload.smtpPassword = "••••••••";
      }
      const response = await fetch("/api/admin/email-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success("Email configuration saved");
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Configuration</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Configure SMTP settings for sending emails
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>SMTP Settings</CardTitle>
              <CardDescription>Enter your email provider&apos;s SMTP credentials</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">SMTP Host</Label>
              <Input
                id="smtpHost"
                value={config.smtpHost}
                onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">SMTP Port</Label>
              <Input
                id="smtpPort"
                type="number"
                value={config.smtpPort}
                onChange={(e) => setConfig({ ...config, smtpPort: parseInt(e.target.value) || 587 })}
                placeholder="587"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtpUser">SMTP Username</Label>
              <Input
                id="smtpUser"
                value={config.smtpUser}
                onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
                placeholder="your@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPassword">SMTP Password</Label>
              <Input
                id="smtpPassword"
                type="password"
                value={config.smtpPassword}
                onChange={(e) => setConfig({ ...config, smtpPassword: e.target.value })}
                placeholder={hasPassword ? "Password saved — leave blank to keep" : "App password or SMTP password"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtpFrom">From Address</Label>
            <Input
              id="smtpFrom"
              value={config.smtpFrom}
              onChange={(e) => setConfig({ ...config, smtpFrom: e.target.value })}
              placeholder="noreply@yourdomain.com"
            />
            <p className="text-xs text-muted-foreground">
              The email address that will appear as the sender
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Enable Email Sending</p>
              <p className="text-xs text-muted-foreground">
                Toggle to activate or deactivate email sending
              </p>
            </div>
            <Switch
              checked={config.isActive}
              onCheckedChange={(checked) => setConfig({ ...config, isActive: checked })}
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
