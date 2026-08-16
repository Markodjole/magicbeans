import Link from "next/link";
import { requireDeveloperProfile } from "@/lib/authz";
import { getDeveloperApps } from "@/lib/queries/developer";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConnectionStatusBadge } from "@/components/developer/connection-status-badge";
import { formatCurrency } from "@/lib/utils";

export default async function DeveloperDashboardPage() {
  const profile = await requireDeveloperProfile();
  const apps = await getDeveloperApps(profile.id);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Your apps</h1>
          <p className="mt-2 text-slate-600">Manage integrations, performance, and campaign funding for each app.</p>
        </div>
        <Link href="/developer/apps/new">
          <Button size="lg">Add app</Button>
        </Link>
      </div>

      {apps.length === 0 ? (
        <Card className="mt-10">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-lg font-medium text-slate-900">No apps yet</p>
            <p className="max-w-sm text-sm text-slate-600">
              Add your first app to connect data sources and start raising campaign funding.
            </p>
            <Link href="/developer/apps/new" className="mt-2">
              <Button>Add your first app</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => {
            const totalFunded = app.opportunities.reduce((sum, o) => sum + Number(o.amountFunded), 0);
            const hasOpenTerms = app.opportunities.some((o) => o.status === "OPEN");

            return (
              <Link key={app.id} href={`/developer/apps/${app.id}`} className="block">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{app.name}</CardTitle>
                      <Badge variant={app.approved ? "success" : "warning"}>
                        {app.approved ? "Approved" : "Pending approval"}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">{app.category}</p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-2">
                      {app.integrationConnections.length === 0 ? (
                        <span className="text-xs text-slate-400">No integrations connected</span>
                      ) : (
                        app.integrationConnections.map((connection) => (
                          <div key={connection.id} className="flex items-center gap-1 text-xs text-slate-500">
                            <span>{connection.category}</span>
                            <ConnectionStatusBadge mode={connection.mode} />
                          </div>
                        ))
                      )}
                    </div>

                    {app.opportunities.length > 0 && (
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{hasOpenTerms ? "Open for investment" : "No open terms"}</span>
                        <span>{formatCurrency(totalFunded)} invested</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
