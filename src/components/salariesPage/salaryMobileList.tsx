"use client";

import React from "react";
import { ChevronRightIcon, HandCoinsIcon } from "@/components/ui/icon";
import { formatCurrency } from "@/lib/format";
import { Money } from "@/components/ui/money";
import type { SalaryRow, SalarySheet } from "./salariesPage.types";

/**
 * The month's totals as one card on a phone: the figure that matters on top,
 * and the three things it is made of underneath. Four separate stat cards
 * took a whole screen before the first driver appeared.
 */
export function SalaryMobileSummary({ sheet }: { sheet: SalarySheet }) {
  const { totals } = sheet;
  const parts = [
    { label: "Salaries", value: totals.monthly_salary, minus: false },
    { label: "Absence cuts", value: totals.attendance_cut, minus: true },
    { label: "Advances & other", value: totals.advances + totals.deductions, minus: true },
  ];

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="px-4 pb-3 pt-3.5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Net payable
          {sheet.is_provisional && (
            <span className="font-normal normal-case tracking-normal"> · so far this month</span>
          )}
        </p>
        <Money
          value={totals.net_pay}
          tone={totals.net_pay < 0 ? "negative" : "neutral"}
          className="mt-0.5 block text-[1.75rem] font-bold leading-tight tracking-tight"
        />
      </div>
      <dl className="grid grid-cols-3 divide-x divide-border border-t border-border">
        {parts.map((part) => (
          <div key={part.label} className="min-w-0 px-3 py-2.5">
            <dt className="truncate text-[0.6875rem] text-muted-foreground">{part.label}</dt>
            <dd className="truncate text-sm font-semibold tabular-nums text-foreground">
              {part.minus && part.value > 0 ? "− " : ""}
              {formatCurrency(part.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** What was taken off this driver's salary, as one short line. */
function cutsLine(row: SalaryRow): string[] {
  const parts: string[] = [];
  if (row.unpaid_days > 0) {
    parts.push(
      `${row.unpaid_days} unpaid ${row.unpaid_days === 1 ? "day" : "days"} − ${formatCurrency(row.attendance_cut)}`,
    );
  }
  if (row.advances > 0) parts.push(`Advance ${formatCurrency(row.advances)}`);
  if (row.deductions > 0) parts.push(`Deduction ${formatCurrency(row.deductions)}`);
  return parts;
}

/**
 * The sheet as a list on a phone: one slim row per driver, net pay on the
 * right, and a second line only for drivers who had something taken off.
 * With 30–40 drivers, a labelled card per driver was mostly dashes.
 */
export function SalaryMobileList({
  rows,
  onOpen,
  onAddAdvance,
}: {
  rows: SalaryRow[];
  onOpen: (driverId: number) => void;
  onAddAdvance: (row: SalaryRow) => void;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {rows.map((row) => {
        const hasSalary = row.monthly_salary != null;
        const cuts = hasSalary ? cutsLine(row) : [];
        const unmarked =
          hasSalary && row.unmarked_days > 0 ? `${row.unmarked_days} not marked` : null;
        const under = [row.place, !row.is_active && "Inactive", unmarked]
          .filter(Boolean)
          .join(" · ");

        return (
          <li key={row.driver_id} className="flex items-center">
            <button
              type="button"
              data-testid={`salary-row-${row.driver_id}`}
              onClick={() => onOpen(row.driver_id)}
              className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left active:bg-muted/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                {under && <p className="truncate text-xs text-muted-foreground">{under}</p>}
                {/* Wraps rather than truncating: a cut-off amount is worse than a second line. */}
                {cuts.length > 0 && (
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    {cuts.map((part) => (
                      <span key={part} className="whitespace-nowrap">
                        {part}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </button>
            <button
              type="button"
              aria-label={`Add advance for ${row.name}`}
              data-testid={`salary-add-advance-${row.driver_id}`}
              onClick={(e) => {
                e.stopPropagation();
                onAddAdvance(row);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground active:bg-muted/60"
            >
              <HandCoinsIcon size={18} />
            </button>
            <button
              type="button"
              data-testid={`salary-row-net-${row.driver_id}`}
              onClick={() => onOpen(row.driver_id)}
              className="flex shrink-0 items-center gap-2 py-3 pl-1 pr-3.5 text-left active:bg-muted/60"
            >
              {hasSalary ? (
                <div className="shrink-0 text-right">
                  <Money
                    value={row.net_pay}
                    tone={(row.net_pay ?? 0) < 0 ? "negative" : "neutral"}
                    className="block text-sm font-bold"
                  />
                  {row.net_pay !== row.monthly_salary && (
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      of {formatCurrency(row.monthly_salary)}
                    </span>
                  )}
                </div>
              ) : (
                <span className="shrink-0 text-[13px] font-semibold text-primary">Set salary</span>
              )}
              <ChevronRightIcon size={16} className="shrink-0 text-muted-foreground" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
