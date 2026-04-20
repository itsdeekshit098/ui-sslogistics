import { after } from "next/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";

export async function GET() {
  try {
    await requireAdminAuth();

    const { data, error } = await supabaseAdmin
      .from("vehicles")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof Error && err.message.startsWith("FORBIDDEN"))
      return NextResponse.json({ error: err.message }, { status: 403 });

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();

    // Nullify empty strings securely
    const payload = Object.fromEntries(
      Object.entries(body).map(([k, v]) => [k, v === "" ? null : v]),
    );

    // Attach who created this record
    payload.created_by = authUser.id;
    payload.updated_by = authUser.id;

    const { data, error } = await supabaseAdmin
      .from("vehicles")
      .insert([payload])
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the activity — use after() so the log survives Vercel's function teardown
    after(() =>
      logActivity({
        action: "CREATE_VEHICLE",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "vehicles",
        recordId: data?.id || null,
        details: {
          vehicle_number: payload.vehicle_number,
          vehicle_type: payload.vehicle_type,
          company: payload.company,
          model: payload.model,
        },
      })
    );

    return NextResponse.json(
      { message: "Vehicle created successfully" },
      { status: 201 },
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof Error && err.message.startsWith("FORBIDDEN"))
      return NextResponse.json({ error: err.message }, { status: 403 });

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();
    const { id, ...updatePayload } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing vehicle ID" },
        { status: 400 },
      );
    }

    // Track who made this update
    updatePayload.updated_by = authUser.id;

    const { error } = await supabaseAdmin
      .from("vehicles")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the activity — use after() so the log survives Vercel's function teardown
    after(() =>
      logActivity({
        action: "UPDATE_VEHICLE",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "vehicles",
        recordId: id,
        details: {
          changes: updatePayload,
        },
      })
    );

    return NextResponse.json(
      { message: "Vehicle updated successfully" },
      { status: 200 },
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof Error && err.message.startsWith("FORBIDDEN"))
      return NextResponse.json({ error: err.message }, { status: 403 });

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing vehicle ID" },
        { status: 400 },
      );
    }

    // Fetch vehicle details before deleting (for the audit log)
    const { data: vehicle } = await supabaseAdmin
      .from("vehicles")
      .select("vehicle_number, vehicle_type, company, model")
      .eq("id", id)
      .single();

    const { error } = await supabaseAdmin
      .from("vehicles")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the activity — use after() so the log survives Vercel's function teardown
    after(() =>
      logActivity({
        action: "DELETE_VEHICLE",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "vehicles",
        recordId: Number(id),
        details: {
          vehicle_number: vehicle?.vehicle_number,
          vehicle_type: vehicle?.vehicle_type,
          company: vehicle?.company,
          model: vehicle?.model,
        },
      })
    );

    return NextResponse.json(
      { message: "Vehicle deleted successfully" },
      { status: 200 },
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED"))
      return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof Error && err.message.startsWith("FORBIDDEN"))
      return NextResponse.json({ error: err.message }, { status: 403 });

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
