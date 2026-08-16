import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Not authorized") {
    super(message);
  }
}

/**
 * The single server-side gate every server action / route handler must
 * call before touching role-scoped data. Never rely on a hidden button or
 * a client-side redirect alone — those are UX, not authorization.
 */
export async function requireRole(role: "INVESTOR" | "DEVELOPER" | "ADMIN") {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.role !== role && session.user.role !== "ADMIN") {
    throw new ForbiddenError(`This action requires the ${role} role`);
  }
  return session.user;
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return session.user;
}

export async function requireInvestorProfile() {
  const user = await requireRole("INVESTOR");
  const profile = await prisma.investorProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new ForbiddenError("No investor profile for this account");
  return profile;
}

export async function requireDeveloperProfile() {
  const user = await requireRole("DEVELOPER");
  const profile = await prisma.developerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new ForbiddenError("No developer profile for this account");
  return profile;
}
