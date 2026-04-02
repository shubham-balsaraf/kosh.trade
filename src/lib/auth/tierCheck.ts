import { getServerSession } from "next-auth";
import { authOptions } from "./options";

export async function requirePro(): Promise<{
  authorized: boolean;
  userId: string | null;
  tier: string;
  role: string;
}> {
  const session = await getServerSession(authOptions);
  if (!session) return { authorized: false, userId: null, tier: "FREE", role: "USER" };

  const user = session.user as any;
  const isPro = user.role === "ADMIN" || (user.tier === "PRO" && !user.banned);

  return {
    authorized: isPro,
    userId: user.id,
    tier: user.tier || "FREE",
    role: user.role || "USER",
  };
}
