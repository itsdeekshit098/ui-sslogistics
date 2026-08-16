-- loan_installment_state (sql/31_add_loans.sql) summed *every* loan_payments
-- row tied to an installment_id into that installment's amount_paid, with no
-- payment_type filter. loan_balances.total_paid, right next to it in the same
-- file, explicitly excludes CHARGE ("Charges ... never reduce the
-- outstanding"). The two views disagreed: a CHARGE payment optionally
-- attached to an installment (a bounce fee "for context", see
-- src/app/api/loans/[id]/payments/route.ts) could flip that installment to
-- PARTIAL/PAID and shrink its amount_remaining, while the loan's real
-- outstanding balance was untouched — and a small enough charge could push an
-- installment to PAID, dropping it out of installments_left and the EMI
-- calendar entirely.
--
-- Fix: exclude CHARGE from the amount_paid lateral here too, so this view's
-- notion of "paid" agrees with loan_balances'.

create or replace view loan_installment_state
with (security_invoker = on) as
select
  i.id,
  i.loan_id,
  i.installment_no,
  i.due_date,
  i.amount_due,
  i.manual_status,
  i.notes,
  coalesce(p.amount_paid, 0) as amount_paid,
  greatest(i.amount_due - coalesce(p.amount_paid, 0), 0) as amount_remaining,
  case
    when i.manual_status is not null                  then i.manual_status
    when coalesce(p.amount_paid, 0) >= i.amount_due   then 'PAID'
    when coalesce(p.amount_paid, 0) > 0               then 'PARTIAL'
    when i.due_date < current_date                    then 'OVERDUE'
    else 'PENDING'
  end as status
from loan_installments i
left join lateral (
  select sum(lp.amount) as amount_paid
  from loan_payments lp
  where lp.installment_id = i.id
    and lp.payment_type <> 'CHARGE'
    and lp.reverses_payment_id is null
    and not exists (
      select 1 from loan_payments r where r.reverses_payment_id = lp.id
    )
) p on true;

-- ---------------------------------------------------------------------
-- DOWN (manual rollback — uncomment to run; restores the pre-fix view from
-- sql/31_add_loans.sql, CHARGE included in amount_paid)
-- ---------------------------------------------------------------------
-- create or replace view loan_installment_state
-- with (security_invoker = on) as
-- select
--   i.id,
--   i.loan_id,
--   i.installment_no,
--   i.due_date,
--   i.amount_due,
--   i.manual_status,
--   i.notes,
--   coalesce(p.amount_paid, 0) as amount_paid,
--   greatest(i.amount_due - coalesce(p.amount_paid, 0), 0) as amount_remaining,
--   case
--     when i.manual_status is not null                  then i.manual_status
--     when coalesce(p.amount_paid, 0) >= i.amount_due   then 'PAID'
--     when coalesce(p.amount_paid, 0) > 0               then 'PARTIAL'
--     when i.due_date < current_date                    then 'OVERDUE'
--     else 'PENDING'
--   end as status
-- from loan_installments i
-- left join lateral (
--   select sum(lp.amount) as amount_paid
--   from loan_payments lp
--   where lp.installment_id = i.id
--     and lp.reverses_payment_id is null
--     and not exists (
--       select 1 from loan_payments r where r.reverses_payment_id = lp.id
--     )
-- ) p on true;
