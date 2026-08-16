import Link from "next/link";
import { requireDeveloperProfile } from "@/lib/authz";
import { CreateAppForm } from "@/components/developer/create-app-form";

export default async function NewAppPage() {
  await requireDeveloperProfile();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/developer" className="text-sm font-medium text-slate-600 hover:text-slate-900">
        ← Back to your apps
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">Add an app</h1>
      <p className="mt-2 text-slate-600">
        Tell us about your app. Once it&apos;s created you&apos;ll connect data sources and can raise campaign
        funding.
      </p>

      <div className="mt-10">
        <CreateAppForm />
      </div>
    </div>
  );
}
