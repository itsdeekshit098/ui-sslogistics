import { notFound } from "next/navigation";
import { FundingDetailPage } from "@/components/fundingDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fundingId = Number(id);

  if (!Number.isFinite(fundingId)) notFound();

  return <FundingDetailPage fundingId={fundingId} />;
}
