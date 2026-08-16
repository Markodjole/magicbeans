import { describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockFindUniqueInvestor = vi.fn();
const mockFindUniqueDeveloper = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    investorProfile: { findUnique: (...args: unknown[]) => mockFindUniqueInvestor(...args) },
    developerProfile: { findUnique: (...args: unknown[]) => mockFindUniqueDeveloper(...args) },
  },
}));

const { requireRole, requireInvestorProfile, requireDeveloperProfile, UnauthorizedError, ForbiddenError } = await import(
  "@/lib/authz"
);

describe("Server-side role authorization (defense in depth beyond route-level proxy)", () => {
  it("requireRole throws UnauthorizedError when there is no session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    await expect(requireRole("INVESTOR")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("requireRole throws ForbiddenError when the session role doesn't match and isn't ADMIN", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1", role: "DEVELOPER" } });
    await expect(requireRole("INVESTOR")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requireRole allows a matching role", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1", role: "INVESTOR" } });
    await expect(requireRole("INVESTOR")).resolves.toEqual({ id: "u1", role: "INVESTOR" });
  });

  it("requireRole allows ADMIN to act as any role", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "admin1", role: "ADMIN" } });
    await expect(requireRole("DEVELOPER")).resolves.toEqual({ id: "admin1", role: "ADMIN" });
  });

  it("requireInvestorProfile throws ForbiddenError when the user has no investor profile row", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u2", role: "INVESTOR" } });
    mockFindUniqueInvestor.mockResolvedValueOnce(null);
    await expect(requireInvestorProfile()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requireInvestorProfile returns the profile when it exists", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u3", role: "INVESTOR" } });
    mockFindUniqueInvestor.mockResolvedValueOnce({ id: "profile1", userId: "u3" });
    await expect(requireInvestorProfile()).resolves.toEqual({ id: "profile1", userId: "u3" });
  });

  it("requireDeveloperProfile rejects an investor session outright, never reaching the DB lookup", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u4", role: "INVESTOR" } });
    await expect(requireDeveloperProfile()).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockFindUniqueDeveloper).not.toHaveBeenCalled();
  });
});
