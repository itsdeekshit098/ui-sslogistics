import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";

const BUCKET_NAME = "vehicle-documents";
// Signed URLs expire after 1 hour (3600 seconds)
const SIGNED_URL_EXPIRY = 3600;

/**
 * GET — Generate a signed URL for viewing a private document.
 * Query params: ?filePath=AP-02-X-9999/rc_url.pdf
 */
export async function GET(req: NextRequest) {
    try {
        await requireAdminAuth();
        const filePath = req.nextUrl.searchParams.get("filePath");

        if (!filePath) {
            return NextResponse.json({ error: "Missing filePath query parameter" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

        if (error || !data?.signedUrl) {
            console.error("Signed URL generation error:", error);
            return NextResponse.json({ error: "Failed to generate document URL" }, { status: 500 });
        }

        return NextResponse.json({ signedUrl: data.signedUrl }, { status: 200 });
    } catch (err: unknown) {
        console.error("Document GET API Error:", err);
        if (err instanceof Error && err.message.startsWith("UNAUTHORIZED")) return NextResponse.json({ error: err.message }, { status: 401 });
        if (err instanceof Error && err.message.startsWith("FORBIDDEN")) return NextResponse.json({ error: err.message }, { status: 403 });

        return NextResponse.json({ error: err instanceof Error ? err.message : "Internal Server Error" }, { status: 500 });
    }
}

/**
 * POST — Upload a document to private storage and save the FILE PATH (not public URL) in the database.
 */
export async function POST(req: Request) {
    try {
        const authUser = await requireAdminAuth();
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const vehicleId = formData.get("vehicleId") as string;
        const vehicleNumber = formData.get("vehicleNumber") as string;
        const documentType = formData.get("documentType") as string; // 'rc_url', 'fc_url', etc.

        if (!file || !vehicleId || !vehicleNumber || !documentType) {
            return NextResponse.json({ error: "Missing required fields (file, vehicleId, vehicleNumber, documentType)" }, { status: 400 });
        }

        // 1. ArrayBuffer serialization for Supabase storage
        const buffer = await file.arrayBuffer();
        const fileExtension = file.name.split('.').pop();
        const fileName = `${documentType}.${fileExtension}`;
        // Map buckets logically via Vehicle Numbers
        const filePath = `${vehicleNumber}/${fileName}`;

        // 2. Upload/Optionally Upsert file into Supabase Storage (private bucket)
        const { error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true
            });

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            return NextResponse.json({ error: "Failed to upload file to storage" }, { status: 500 });
        }

        // 3. Store the FILE PATH in the database (NOT a public URL)
        //    Also track who made this update
        const updatePayload: Record<string, unknown> = { [documentType]: filePath };
        updatePayload.updated_by = authUser.id;

        const { error: dbError } = await supabaseAdmin
            .from("vehicles")
            .update(updatePayload)
            .eq("id", vehicleId);

        if (dbError) {
            console.error("Database path update error:", dbError);
            return NextResponse.json({ error: "File uploaded but database sync failed" }, { status: 500 });
        }

        // 4. Log the activity — use after() so the log survives Vercel's function teardown
        after(() =>
            logActivity({
                action: "UPLOAD_DOCUMENT",
                userId: authUser.id,
                userEmail: authUser.email,
                tableName: "vehicles",
                recordId: Number(vehicleId),
                details: {
                    vehicle_number: vehicleNumber,
                    document_type: documentType,
                    file_name: file.name,
                    file_size_bytes: file.size,
                },
            })
        );

        return NextResponse.json({ message: "Document saved", filePath }, { status: 201 });
    } catch (err: unknown) {
        console.error("Document upload API Error:", err);
        if (err instanceof Error && err.message.startsWith("UNAUTHORIZED")) return NextResponse.json({ error: err.message }, { status: 401 });
        if (err instanceof Error && err.message.startsWith("FORBIDDEN")) return NextResponse.json({ error: err.message }, { status: 403 });

        return NextResponse.json({ error: err instanceof Error ? err.message : "Internal Server Error" }, { status: 500 });
    }
}

/**
 * DELETE — Remove a document from private storage and clear the database column.
 */
export async function DELETE(req: Request) {
    try {
        const authUser = await requireAdminAuth();
        const body = await req.json();
        const { vehicleId, documentType, filePath } = body;

        if (!vehicleId || !documentType || !filePath) {
            return NextResponse.json({ error: "Missing vehicleId, documentType, or filePath" }, { status: 400 });
        }

        // 1. Delete file from the private Storage Bucket
        const { error: deleteError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .remove([filePath]);

        if (deleteError) {
             console.error("Failed executing storage removal for ", filePath, deleteError);
             return NextResponse.json({ error: "Failed to delete from storage" }, { status: 500 });
        }

        // 2. Erase Database Column value + track who did it
        const updatePayload: Record<string, unknown> = { [documentType]: null };
        updatePayload.updated_by = authUser.id;

        const { error: dbError } = await supabaseAdmin
            .from("vehicles")
            .update(updatePayload)
            .eq("id", vehicleId);

        if (dbError) {
            console.error("Database wipe fail:", dbError);
            return NextResponse.json({ error: "Deleted storage asset but failed UI database clear" }, { status: 500 });
        }

        // 3. Log the activity — use after() so the log survives Vercel's function teardown
        after(() =>
            logActivity({
                action: "DELETE_DOCUMENT",
                userId: authUser.id,
                userEmail: authUser.email,
                tableName: "vehicles",
                recordId: Number(vehicleId),
                details: {
                    document_type: documentType,
                    file_path: filePath,
                },
            })
        );

        return NextResponse.json({ message: "Document deleted successfully" }, { status: 200 });

    } catch (err: unknown) {
        console.error("Document delete API Error:", err);
        if (err instanceof Error && err.message.startsWith("UNAUTHORIZED")) return NextResponse.json({ error: err.message }, { status: 401 });
        if (err instanceof Error && err.message.startsWith("FORBIDDEN")) return NextResponse.json({ error: err.message }, { status: 403 });

        return NextResponse.json({ error: err instanceof Error ? err.message : "Internal Server Error" }, { status: 500 });
    }
}
