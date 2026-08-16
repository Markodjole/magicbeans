"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const RegisterSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(["INVESTOR", "DEVELOPER"]),
});

export type RegisterState = { error?: string; success?: boolean };

export async function registerUser(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = RegisterSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists" };

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      ...(role === "INVESTOR" ? { investorProfile: { create: { displayName: name } } } : {}),
      ...(role === "DEVELOPER" ? { developerProfile: { create: { displayName: name } } } : {}),
    },
  });

  return { success: true };
}
