import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase";
import { requireStrictAdminAuth } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";

// ─── Helpers ───

interface SessionRow {
  session_id: string;
  user_id: string;
  user_email: string;
  user_role: string | null;
  created_at: string;
  updated_at: string;
  user_agent: string | null;
  ip: string | null;
}

/** Parse a user-agent string into a short, readable label. */
function parseDevice(ua: string | null): string {
  if (!ua) return "Unknown device";

  // Mobile detection
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua)) return "Android Phone";
    return "Android Tablet";
  }

  // Desktop browser detection
  if (/Edg\//i.test(ua)) return "Microsoft Edge";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Google Chrome";
  if (/Firefox\//i.test(ua)) return "Mozilla Firefox";
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";

  // OS fallback
  if (/Windows/i.test(ua)) return "Windows Device";
  if (/Mac/i.test(ua)) return "Mac Device";
  if (/Linux/i.test(ua)) return "Linux Device";

  return "Unknown device";
}

// ─── GET — List users with their active sessions ───

export async function GET(req: Request) {
  try {
    await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("perPage") || "20", 10);

    // 1. Get users for the current page
    const { data: usersData, error: usersError } =
      await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

    if (usersError) {
      logger.error("Failed to list users", { message: usersError.message, code: usersError.code });
      return apiError("Failed to load users", 500);
    }

    const allUsers = usersData.users || [];

    // 2. Get all active sessions via RPC
    const { data: sessionsData, error: sessionsError } =
      await supabaseAdmin.rpc("get_active_sessions");

    // Sessions might fail if the RPC hasn't been created yet — gracefully degrade
    const sessions: SessionRow[] =
      !sessionsError && Array.isArray(sessionsData) ? sessionsData : [];

    // 3. Group sessions by user_id
    const sessionsByUser = new Map<string, SessionRow[]>();
    for (const s of sessions) {
      const list = sessionsByUser.get(s.user_id) || [];
      list.push(s);
      sessionsByUser.set(s.user_id, list);
    }

    // 4. Build response
    const users = allUsers.map((u) => {
      const userSessions = sessionsByUser.get(u.id) || [];

      return {
        id: u.id,
        email: u.email || "unknown",
        role: u.app_metadata?.role || null,
        lastSignInAt: u.last_sign_in_at || null,
        createdAt: u.created_at,
        isBanned: !!u.banned_until && new Date(u.banned_until) > new Date(),
        bannedUntil: u.banned_until || null,
        sessions: userSessions.map((s) => ({
          id: s.session_id,
          device: parseDevice(s.user_agent),
          ip: s.ip || "Unknown",
          createdAt: s.created_at,
          lastActiveAt: s.updated_at,
        })),
      };
    });

    return apiSuccess({
      users,
      total: usersData.total || 0,
      page,
      perPage,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT — Ban or unban a user ───

export async function PUT(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const body = await req.json();
    const { userId, action } = body;

    if (!userId || typeof userId !== "string") {
      return apiError("Missing or invalid userId", 400);
    }

    if (action !== "ban" && action !== "unban") {
      return apiError("Action must be 'ban' or 'unban'", 400);
    }

    // Prevent admin from banning themselves
    if (userId === authUser.id) {
      return apiError("You cannot ban your own account", 400);
    }

    // Verify target user exists
    const { data: targetUser, error: fetchError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (fetchError || !targetUser?.user) {
      return apiError("User not found", 404);
    }

    if (action === "ban") {
      const { error: banError } =
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "876600h", // ~100 years = permanent ban
        });

      if (banError) {
        logger.error("Failed to ban user", { userId, message: banError.message, code: banError.code });
        return apiError("Failed to ban user", 500);
      }

      await logActivity({
        action: "BAN_USER",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "auth.users",
        recordId: null,
        details: {
          targetUserId: userId,
          targetEmail: targetUser.user.email,
          targetRole: targetUser.user.app_metadata?.role,
        },
      });

      return apiSuccess(null, "User banned successfully");
    }

    // action === "unban"
    const { error: unbanError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "none",
      });

    if (unbanError) {
      logger.error("Failed to unban user", { userId, message: unbanError.message, code: unbanError.code });
      return apiError("Failed to unban user", 500);
    }

    await logActivity({
      action: "UNBAN_USER",
      userId: authUser.id,
      userEmail: authUser.email,
      tableName: "auth.users",
      recordId: null,
      details: {
        targetUserId: userId,
        targetEmail: targetUser.user.email,
        targetRole: targetUser.user.app_metadata?.role,
      },
    });

    return apiSuccess(null, "User unbanned successfully");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── DELETE — Revoke all sessions for a user ───

export async function DELETE(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return apiError("Missing userId", 400);
    }

    // Prevent admin from revoking their own sessions
    if (userId === authUser.id) {
      return apiError("You cannot revoke your own sessions", 400);
    }

    // Verify target user exists
    const { data: targetUser, error: fetchError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (fetchError || !targetUser?.user) {
      return apiError("User not found", 404);
    }

    // Delete all sessions for this user via RPC
    const { error: revokeError } = await supabaseAdmin.rpc(
      "revoke_user_sessions",
      { target_user_id: userId },
    );

    if (revokeError) {
      logger.error("Failed to revoke user sessions", { userId, message: revokeError.message, code: revokeError.code });
      return apiError("Failed to revoke sessions", 500);
    }

    await logActivity({
      action: "REVOKE_SESSIONS",
      userId: authUser.id,
      userEmail: authUser.email,
      tableName: "auth.sessions",
      recordId: null,
      details: {
        targetUserId: userId,
        targetEmail: targetUser.user.email,
        targetRole: targetUser.user.app_metadata?.role,
      },
    });

    return apiSuccess(null, "All sessions revoked for user");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PATCH — Reset a user's password ───

export async function PATCH(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const body = await req.json();
    const { userId, newPassword } = body;

    if (!userId || typeof userId !== "string") {
      return apiError("Missing or invalid userId", 400);
    }

    if (!newPassword || typeof newPassword !== "string") {
      return apiError("New password is required", 400);
    }

    if (newPassword.length < 6) {
      return apiError("Password must be at least 6 characters", 400);
    }

    // Prevent admin from resetting their own password through this endpoint
    if (userId === authUser.id) {
      return apiError("You cannot reset your own password here", 400);
    }

    // Verify target user exists
    const { data: targetUser, error: fetchError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (fetchError || !targetUser?.user) {
      return apiError("User not found", 404);
    }

    // Update the user's password
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

    if (updateError) {
      logger.error("Failed to reset user password", { userId, message: updateError.message, code: updateError.code });
      return apiError("Failed to reset password", 500);
    }

    // Revoke all sessions for the user (force re-login with new password)
    let sessionsRevoked = true;
    try {
      await supabaseAdmin.auth.admin.signOut(userId, "global");
    } catch {
      sessionsRevoked = false;
      logger.error("Password changed but failed to revoke sessions", { userId });
      // Don't fail the whole request — password was already changed
    }

    await logActivity({
      action: "RESET_PASSWORD",
      userId: authUser.id,
      userEmail: authUser.email,
      tableName: "auth.users",
      recordId: null,
      details: {
        targetUserId: userId,
        targetEmail: targetUser.user.email,
        targetRole: targetUser.user.app_metadata?.role,
        sessionsRevoked,
      },
    });

    return apiSuccess(
      { sessionsRevoked },
      sessionsRevoked
        ? "Password reset and all sessions revoked"
        : "Password reset successfully, but existing sessions could not be revoked",
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
