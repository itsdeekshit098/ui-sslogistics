"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { PlusIcon, Trash2Icon, SlidersIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/loadingSpinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LookupOption } from "@/components/lookupSelect";

const ConfirmModal = dynamic(
  () => import("@/components/confirmModal/confirmModal"),
  { ssr: false },
);

// The lists exposed for management here. A category only needs adding to this
// array to become editable — the table and the API are generic
// (see sql/29_add_lookup_options.sql).
const CATEGORIES = [
  { key: "loan_type", label: "Loan Types" },
  { key: "client_type", label: "Client Types" },
  { key: "contact_role", label: "Contact Roles" },
  { key: "payment_method", label: "Payment Methods" },
];

export function ListSettings() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].key);
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<LookupOption | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchOptions = useCallback(async (category: string) => {
    setLoading(true);
    setError(null);
    try {
      // include_inactive so switched-off options remain manageable here, even
      // though the pickers elsewhere hide them.
      const res = await fetch(
        `/api/lookups?category=${encodeURIComponent(category)}&include_inactive=true`,
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load list");
      }
      setOptions(json.data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOptions(activeCategory);
  }, [activeCategory, fetchOptions]);

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;

    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: activeCategory, label }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to add option");
      }
      setOptions((prev) => [...prev, json.data.option]);
      setNewLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add option");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (option: LookupOption) => {
    setBusyId(option.id);
    setError(null);
    try {
      const res = await fetch("/api/lookups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: option.id, is_active: !option.is_active }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update option");
      }
      setOptions((prev) =>
        prev.map((o) => (o.id === option.id ? json.data.option : o)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update option");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/lookups?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        setDeleteError(json.error || "Failed to delete");
        return;
      }
      setOptions((prev) => prev.filter((o) => o.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersIcon size={18} />
          Dropdown Lists
        </CardTitle>
        <CardDescription>
          Options behind the app&rsquo;s configurable dropdowns. New options can
          also be added directly from any dropdown that uses them. Built-in
          options can be turned off but not deleted, since existing records may
          reference them.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs
          idPrefix="lists"
          items={CATEGORIES}
          value={activeCategory}
          onValueChange={setActiveCategory}
        />

        <div
          role="tabpanel"
          id={`lists-panel-${activeCategory}`}
          aria-labelledby={`lists-tab-${activeCategory}`}
          className="space-y-4"
        >
          <div className="flex gap-2">
            <Input
              value={newLabel}
              disabled={adding}
              placeholder="Add an option…"
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
            />
            <Button onClick={handleAdd} disabled={adding || !newLabel.trim()}>
              {adding ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <PlusIcon size={16} style={{ marginRight: "0.5rem" }} />
              )}
              Add
            </Button>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : options.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No options in this list yet.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border">
              {options.map((option) => (
                <li
                  key={option.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={
                        option.is_active
                          ? "truncate font-medium text-foreground"
                          : "truncate text-muted-foreground line-through"
                      }
                    >
                      {option.label}
                    </span>
                    {option.is_system && <Badge variant="outline">Built-in</Badge>}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === option.id}
                      onClick={() => handleToggleActive(option)}
                    >
                      {option.is_active ? "Turn off" : "Turn on"}
                    </Button>
                    {!option.is_system && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(option)}
                        aria-label={`Delete ${option.label}`}
                      >
                        <Trash2Icon size={14} />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Delete Option"
        description={`Delete "${deleteTarget?.label}"? Records already using it keep their value, but it won't be offered again.`}
        confirmText="Delete"
        isLoading={deleteLoading}
        error={deleteError}
      />
    </Card>
  );
}
