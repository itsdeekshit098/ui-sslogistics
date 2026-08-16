import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";

// One client's profile: who they are, what they owe, who to call, and what runs
// for them. The statement itself is paginated on its own route — a long-running
// account grows without limit, so it must never be loaded whole.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return apiError("Invalid client ID", 400);
    }

    const { data: client, error } = await supabaseAdmin
      .from("clients")
      .select(
        "*, entities:entity_id (id, name, entity_kind, phone, email), bank_accounts:receiving_account_id (id, bank_name, account_number, account_type, nickname, entities:holder_entity_id (name))",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) return serverError(error);
    if (!client) return apiError("Client not found", 404);

    const [
      { data: balance },
      { data: contacts, error: contactsErr },
      { data: deployments, error: deploymentsErr },
    ] = await Promise.all([
      supabaseAdmin
        .from("client_balances")
        .select("*")
        .eq("client_id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("client_contacts")
        .select("*")
        .eq("client_id", id)
        // Primary first, so the person to actually ring is at the top.
        .order("is_primary", { ascending: false })
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("client_deployments")
        .select("*, vehicles:vehicle_id (id, vehicle_number, company, model)")
        .eq("client_id", id)
        .order("is_active", { ascending: false })
        .order("vehicle_type", { ascending: true }),
    ]);

    if (contactsErr) return serverError(contactsErr);
    if (deploymentsErr) return serverError(deploymentsErr);

    // Fleet mix rolls linked vehicles and declared buckets into one count per
    // type, which is how the user thinks about it ("4 buses, 2 containers").
    const fleetMix: Record<string, number> = {};
    for (const row of deployments ?? []) {
      if (!row.is_active) continue;
      const type = row.vehicle_type as string;
      fleetMix[type] = (fleetMix[type] ?? 0) + (Number(row.quantity) || 0);
    }

    return apiSuccess({
      client,
      balance: balance ?? null,
      contacts: contacts ?? [],
      deployments: deployments ?? [],
      fleet_mix: fleetMix,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
