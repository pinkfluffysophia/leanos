"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UserPlus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Settings {
  registrationOpen: string;
}

export default function SystemSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    registrationOpen: "true",
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/system-settings")
      .then((res) => {
        if (res.status === 401) {
          router.replace("/dashboard");
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (data?.settings) setSettings(data.settings);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/system-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        toast.success("Settings saved");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save settings");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Settings</h1>
          <p className="text-gray-500 dark:text-gray-400">Configure platform-wide settings</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Registration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Registration</CardTitle>
              <CardDescription>Control whether new users can sign up</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Open Registration</p>
              <p className="text-xs text-muted-foreground">When disabled, no new accounts can be created</p>
            </div>
            <Switch
              checked={settings.registrationOpen === "true"}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, registrationOpen: checked ? "true" : "false" })
              }
            />
          </div>
          {settings.registrationOpen === "false" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Registration is closed. New users cannot sign up.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
