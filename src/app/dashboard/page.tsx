import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const ROLE_HOME: Record<string, string> = {
  INVESTOR: "/investor",
  DEVELOPER: "/developer",
  ADMIN: "/admin",
};

export default async function DashboardRedirectPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");
  redirect(ROLE_HOME[session.user.role] ?? "/");
}
