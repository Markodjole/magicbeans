import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          <strong>Prototype platform.</strong> Displayed returns and projections may contain simulated data and are
          not guarantees of future performance. See{" "}
          <Link href="/compliance" className="underline">
            /compliance
          </Link>{" "}
          for details.
        </div>
        <div className="mt-6 flex flex-col items-start justify-between gap-4 text-sm text-slate-500 sm:flex-row sm:items-center">
          <p>&copy; {new Date().getFullYear()} GrowthFund. This is not an equity marketplace.</p>
          <div className="flex gap-4">
            <Link href="/compliance" className="hover:text-slate-700">
              Compliance
            </Link>
            <Link href="/how-it-works" className="hover:text-slate-700">
              How it works
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
