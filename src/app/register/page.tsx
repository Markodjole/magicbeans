import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { registerUser } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; role?: string }>;
}) {
  const params = await searchParams;
  const defaultRole = params.role === "DEVELOPER" ? "DEVELOPER" : "INVESTOR";

  async function registerAction(formData: FormData) {
    "use server";
    const result = await registerUser({}, formData);
    if (result.error) {
      redirect(`/register?error=${encodeURIComponent(result.error)}`);
    }
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/dashboard",
      });
    } catch (err) {
      if (err instanceof AuthError) redirect("/login");
      throw err;
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-24">
      <Card>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Run campaigns and get paid per subscriber as a marketer, or post an offer as a developer.</CardDescription>
        </CardHeader>
        <CardContent>
          {params.error && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
          )}
          <form action={registerAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" required autoComplete="name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>I am a...</Label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="role" value="INVESTOR" defaultChecked={defaultRole === "INVESTOR"} />
                  Marketer
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="role" value="DEVELOPER" defaultChecked={defaultRole === "DEVELOPER"} />
                  Developer
                </label>
              </div>
            </div>
            <Button type="submit" className="mt-2">
              Create account
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-slate-900 underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
