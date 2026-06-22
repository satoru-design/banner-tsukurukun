/**
 * Thin wrapper around getCurrentUser() for use in route handlers.
 * Returns the user's id or null if not authenticated.
 * Uses the same auth mechanism as other API routes (NextAuth v5 via getCurrentUser).
 */
import { getCurrentUser } from "@/lib/auth/get-current-user";

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user.userId;
}
