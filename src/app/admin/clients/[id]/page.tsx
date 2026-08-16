import { notFound } from "next/navigation";
import { ClientDetailPage } from "@/components/clientDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clientId = Number(id);

  if (!Number.isFinite(clientId)) notFound();

  return <ClientDetailPage clientId={clientId} />;
}
