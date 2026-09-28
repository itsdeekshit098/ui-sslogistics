"use client";

import { useCallback, useEffect, useState } from "react";
import { UploadCloudIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface AppVersionConfig {
  minAndroidVersionCode: number | null;
  forceUpdateMessage: string | null;
}

export function AppVersionSettings() {
  const [config, setConfig] = useState<AppVersionConfig | null>(null);
  const [versionCode, setVersionCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/app-version");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load app version settings");
      }
      setConfig(json.data);
      setVersionCode(json.data.minAndroidVersionCode?.toString() ?? "");
      setMessage(json.data.forceUpdateMessage || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load app version settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const save = async (nextVersionCode: number | null) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/app-version", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minAndroidVersionCode: nextVersionCode,
          message: message || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update app version settings");
      }
      setConfig({
        minAndroidVersionCode: nextVersionCode,
        forceUpdateMessage: message || null,
      });
      setVersionCode(nextVersionCode?.toString() ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update app version settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoadingSkeleton variant="admin" />;
  if (error && !config) return <ErrorState description={error} onRetry={fetchConfig} />;

  const isOn = !!config?.minAndroidVersionCode;
  const parsedVersionCode = versionCode.trim() === "" ? null : Number(versionCode);
  const isValidVersionCode =
    parsedVersionCode === null || (Number.isInteger(parsedVersionCode) && parsedVersionCode > 0);

  return (
    <Card className="max-w-2xl" data-testid="app-version-settings-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl">
          <UploadCloudIcon size={20} />
          Force App Update
        </CardTitle>
        <CardDescription>
          Blocks the Android app with a non-dismissible update popup for anyone on a build older
          than the minimum version code below. Leave blank to disable enforcement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={
            isOn
              ? "rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
              : "rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          }
          data-testid="app-version-status-banner"
        >
          {isOn
            ? `Force update is ON — builds below versionCode ${config?.minAndroidVersionCode} are blocked.`
            : "Force update is OFF — no minimum version enforced."}
        </div>

        <div className="space-y-2">
          <Label htmlFor="min-version-code">Minimum Android versionCode</Label>
          <Input
            id="min-version-code"
            type="number"
            min={1}
            step={1}
            placeholder="e.g. 5"
            value={versionCode}
            onChange={(e) => setVersionCode(e.target.value)}
            disabled={saving}
          />
          {!isValidVersionCode && (
            <p className="text-sm text-destructive">Must be a positive whole number, or blank.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="app-version-message">Message shown to users (optional)</Label>
          <Textarea
            id="app-version-message"
            placeholder="A new version is available. Please update to continue."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={saving}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="gap-3">
        <Button
          variant="default"
          onClick={() => save(parsedVersionCode)}
          disabled={saving || !isValidVersionCode}
          data-testid="app-version-save"
        >
          Save
        </Button>
        {isOn && (
          <Button
            variant="destructive"
            onClick={() => save(null)}
            disabled={saving}
            data-testid="app-version-clear"
          >
            Clear (disable enforcement)
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
