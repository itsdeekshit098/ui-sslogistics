import { notFound } from "next/navigation";
import { LoanDetailPage } from "@/components/loanDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loanId = Number(id);

  if (!Number.isFinite(loanId)) notFound();

  return <LoanDetailPage loanId={loanId} />;
}
