"use client";

import { Building2Icon, TruckIcon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { formatDateCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getLoanStatusLabel, type Loan } from "./loansPage.types";
import { progressPercent, relativeDueLabel } from "./loansPage.utils";

function InfoRow({ icon: Icon, label }: { icon: typeof TruckIcon; label: string }) {
  return (
    <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
      <Icon size={13} className="shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}

/** Phone card for one loan — the Flutter app's LoanCard layout. */
export function LoanMobileCard({ loan }: { loan: Loan }) {
  const { balance } = loan;
  const overdue = balance.overdue_count > 0;
  const collateral = loan.vehicles?.vehicle_number ?? loan.collateral_description ?? "";
  const subtitle = [loan.loan_type, loan.loan_number, collateral].filter(Boolean).join(" · ");

  return (
    <div data-testid={`loan-card-${loan.id}`}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-foreground">
          {loan.lenders?.name ?? loan.loan_type}
        </span>
        <Badge variant={loan.status === "ACTIVE" ? "secondary" : "outline"}>
          {getLoanStatusLabel(loan.status)}
        </Badge>
      </div>
      {loan.entities && <InfoRow icon={Building2Icon} label={loan.entities.name} />}
      {subtitle && <InfoRow icon={TruckIcon} label={subtitle} />}

      <div className="mt-2 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] text-muted-foreground">Outstanding</div>
          <div
            className={cn(
              "text-[15px] font-extrabold",
              overdue ? "text-destructive" : "text-foreground",
            )}
          >
            <Money value={balance.outstanding} />
          </div>
        </div>
        <div className="text-right">
          <div className={cn("text-[10.5px]", overdue ? "text-destructive" : "text-muted-foreground")}>
            {overdue ? "Overdue" : "Next EMI"}
          </div>
          <div
            className={cn(
              "text-xs font-bold",
              overdue ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {balance.next_due_date
              ? `${formatDateCompact(balance.next_due_date)} · ${
                  overdue ? `${balance.overdue_count} overdue` : relativeDueLabel(balance.next_due_date)
                }`
              : "Fully paid"}
          </div>
        </div>
      </div>

      <div className="mt-2 h-[5px] overflow-hidden rounded bg-border">
        <div
          className={cn("h-full rounded", overdue ? "bg-destructive" : "bg-primary")}
          style={{ width: `${progressPercent(balance.installments_paid, loan.total_installments)}%` }}
        />
      </div>
      <div className="mt-[3px] flex justify-between gap-2 text-[10.5px] text-muted-foreground">
        <span>
          {balance.installments_paid}/{loan.total_installments}
          {balance.installments_left > 0 && ` - ${balance.installments_left} rem`}
        </span>
        {balance.final_due_date && <span>Last EMI {formatDateCompact(balance.final_due_date)}</span>}
      </div>
    </div>
  );
}
