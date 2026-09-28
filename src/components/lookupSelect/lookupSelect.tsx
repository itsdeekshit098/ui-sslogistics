"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Typeahead, typeaheadFooterActionClassName } from "@/components/typeahead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { PlusIcon } from "@/components/ui/icon";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import type { LookupOption, LookupSelectProps } from "./lookupSelect.types";

/**
 * Dropdown backed by the `lookup_options` registry, with an inline
 * "+ Add new …" action in the list footer.
 *
 * This is the piece that keeps configurable lists from calcifying: adding a
 * loan type or a contact role is one INSERT made from the dropdown itself,
 * not a Postgres enum change plus a TS constant plus a deploy (compare
 * vehicle_type, which is spelled out in three places — see
 * sql/11_enums_for_vehicle_types.sql). Structural enums stay as they are;
 * this is for label-only lists.
 */
const LookupSelect: React.FC<LookupSelectProps> = ({
  category,
  value,
  onValueChange,
  id,
  placeholder = "Select…",
  addLabel = "option",
  allowAdd = true,
  disabled = false,
  invalid = false,
  clearable = true,
  className,
}) => {
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/lookups?category=${encodeURIComponent(category)}`,
      );
      const payload = await response.json();
      if (response.ok) {
        setOptions(payload.data?.data ?? []);
      }
    } catch {
      // A failed list leaves the dropdown empty rather than breaking the form
      // around it; the user can retry by reopening it.
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  // A newly added option is appended and selected straight away, so the user
  // never has to reopen the list to pick what they just typed.
  const handleAdded = useCallback(
    (option: LookupOption) => {
      setOptions((prev) =>
        [...prev, option].sort(
          (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
        ),
      );
      onValueChange(option.value);
      setShowAdd(false);
    },
    [onValueChange],
  );

  return (
    <>
      <Typeahead<LookupOption>
        id={id}
        options={options}
        value={value}
        onValueChange={(next) => onValueChange(next)}
        getOptionLabel={(option) => option.label}
        getOptionValue={(option) => option.value}
        placeholder={loading ? "Loading…" : placeholder}
        emptyMessage={`No ${addLabel}s found.`}
        disabled={disabled || loading}
        invalid={invalid}
        clearable={clearable}
        className={className}
        footer={
          allowAdd ? (
            <Button
              variant="ghost"
              className={typeaheadFooterActionClassName}
              // Without this the listbox's outside-click handler fires first
              // and unmounts the button before the click lands.
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setShowAdd(true)}
            >
              <PlusIcon size={16} />
              Add new {addLabel}
            </Button>
          ) : undefined
        }
      />

      {showAdd && (
        <AddLookupOptionModal
          category={category}
          addLabel={addLabel}
          onClose={() => setShowAdd(false)}
          onSuccess={handleAdded}
        />
      )}
    </>
  );
};

interface AddLookupOptionModalProps {
  category: string;
  addLabel: string;
  onClose: () => void;
  onSuccess: (option: LookupOption) => void;
}

/** Nested so it stacks correctly when opened from a dropdown inside a modal. */
const AddLookupOptionModal: React.FC<AddLookupOptionModalProps> = ({
  category,
  addLabel,
  onClose,
  onSuccess,
}) => {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError(`Enter a ${addLabel} name`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, label: trimmed }),
      });
      const payload = await response.json();

      if (response.ok) {
        onSuccess(payload.data.option);
      } else {
        setError(payload.error || "Failed to add option");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal nested open onOpenChange={(open) => !open && !saving && onClose()}>
      <ModalContent style={{ maxWidth: "24rem", padding: 0 }}>
        <ModalHeader>
          <ModalTitle>Add {addLabel}</ModalTitle>
          <ModalDescription>
            This is added to the list straight away and stays available for
            future records.
          </ModalDescription>
        </ModalHeader>

        <ModalBody>
          <div className="mt-2 flex flex-col gap-2">
            <Label htmlFor="lookup-option-label">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lookup-option-label"
              autoFocus
              disabled={saving}
              value={label}
              placeholder={`e.g. Machinery Loan`}
              onChange={(e) => {
                setLabel(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              className={error ? "border-destructive" : ""}
            />
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <LoadingSpinner size="sm" className="mr-2" />}
            {saving ? "Adding…" : "Add"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export { LookupSelect };
export default LookupSelect;
