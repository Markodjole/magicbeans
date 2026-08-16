import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "INVESTOR" | "DEVELOPER" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    role: "INVESTOR" | "DEVELOPER" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: "INVESTOR" | "DEVELOPER" | "ADMIN";
  }
}
