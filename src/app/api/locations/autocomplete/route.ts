import { requireUserAuth } from "@/lib/auth";
import { apiSuccess, handleApiError } from "@/lib/apiResponse";
import { searchLocations } from "@/lib/geocoding";

export async function GET(req: Request) {
  try {
    await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (q.length < 3) {
      return apiSuccess({ data: [] });
    }

    const suggestions = await searchLocations(q);
    return apiSuccess({ data: suggestions });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
