import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

// On Vercel, the bundled client's __dirname-based engine lookup resolves to
// the wrong directory (it points at the .next server chunk, not
// src/generated/prisma) once Next.js bundles this module into a chunk. This
// explicit override is only read at engine-init time, never during `prisma
// generate`, so it's safe to always set — process.cwd() is the deployed
// function's root on Vercel, where outputFileTracingIncludes places the
// engine binary.
if (process.env.VERCEL) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(
    process.cwd(),
    "src/generated/prisma/libquery_engine-rhel-openssl-3.0.x.so.node",
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
