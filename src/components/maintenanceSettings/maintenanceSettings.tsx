"use client";

import { useCallback, useEffect, useState } from "react";
import { WrenchIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { ErrorState } from "@/components/errorState";

interface MaintenanceStatus {
  maintenanceMode: boolean;
  message: string | null;
}

export function MaintenanceSettings() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/maintenance");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load maintenance status");
      }
      setStatus(json.data);
      setMessage(json.data.message || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load maintenance status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const toggle = async (next: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceMode: next, message: message || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update maintenance mode");
      }
      setStatus(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update maintenance mode");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoadingSkeleton variant="admin" />;
  if (error && !status) return <ErrorState description={error} onRetry={fetchStatus} />;

  const isOn = !!status?.maintenanceMode;

  return (
    <Card className="max-w-2xl" data-testid="maintenance-settings-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl">
          <WrenchIcon size={20} />
          Maintenance Mode
        </CardTitle>
        <CardDescription>
          Blocks all non-admin access on web and mobile immediately — use this before making
          risky changes so no one can act on stale data mid-change.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={
            isOn
              ? "rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
              : "rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          }
          data-testid="maintenance-status-banner"
        >
          {isOn ? "Maintenance mode is ON — the app is blocked for everyone but admins." : "Maintenance mode is OFF — the app is live."}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maintenance-message">Message shown to users (optional)</Label>
          <Textarea
            id="maintenance-message"
            placeholder="We're performing scheduled maintenance. Please check back shortly."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={saving}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="gap-3">
        {isOn ? (
          <Button
            variant="default"
            onClick={() => toggle(false)}
            disabled={saving}
            data-testid="maintenance-toggle-off"
          >
            Turn maintenance mode off
          </Button>
        ) : (
          <Button
            variant="destructive"
            onClick={() => toggle(true)}
            disabled={saving}
            data-testid="maintenance-toggle-on"
          >
            Turn maintenance mode on
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
