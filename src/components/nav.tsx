import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";

const ROLE_HOME: Record<string, string> = {
  INVESTOR: "/investor",
  DEVELOPER: "/developer",
  ADMIN: "/admin",
};

export async function Nav() {
  const session = await auth();

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            GrowthFund
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <Link href="/opportunities" className="hover:text-slate-900">
              Opportunities
            </Link>
            <Link href="/how-it-works" className="hover:text-slate-900">
              How it works
            </Link>
            <Link href="/compliance" className="hover:text-slate-900">
              Compliance
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link href={ROLE_HOME[session.user.role] ?? "/"}>
                <Button variant="outline" size="sm">
                  Dashboard
                </Button>
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
