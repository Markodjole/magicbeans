import fs from "node:fs";
import path from "node:path";

export async function GET() {
  const report: Record<string, unknown> = {
    cwd: process.cwd(),
    dirname: __dirname,
  };
  const candidates = [
    path.join(process.cwd(), "src/generated/prisma"),
    path.join(__dirname, ""),
    "/var/task/src/generated/prisma",
    "/var/task/.next/server/src/generated/prisma",
  ];
  for (const dir of candidates) {
    try {
      report[dir] = fs.readdirSync(dir);
    } catch (e) {
      report[dir] = `ERROR: ${(e as Error).message}`;
    }
  }
  return Response.json(report);
}
