import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runFullSyncForApp } from "@/lib/sync/run-sync";

/**
 * Jobs abstraction, phase 1: a plain authenticated API route a platform
 * cron (Vercel Cron, or any external scheduler) can hit hourly, per the
 * spec's sync cadence (advertising/attribution/revenue: hourly). Nothing
 * about the sync logic itself depends on being invoked this way — see
 * runFullSyncForApp in src/lib/sync/run-sync.ts — so swapping this for
 * Trigger.dev/Inngest/Temporal later only touches this file, not the
 * business logic it calls.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = request.headers.get("authorization")?.replace("Bearer ", "");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const apps = await prisma.app.findMany({ where: { approved: true }, select: { id: true } });
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 1);

  const results = [];
  for (const app of apps) {
    try {
      const result = await runFullSyncForApp(app.id, start, end);
      results.push({ appId: app.id, ...result });
    } catch (err) {
      results.push({ appId: app.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
