import { Badge } from "@/components/ui/badge";
import type { IntegrationMode } from "@/generated/prisma/client";

const VARIANT: Record<IntegrationMode, "live" | "mock" | "outline" | "destructive"> = {
  LIVE: "live",
  MOCK: "mock",
  DISCONNECTED: "outline",
  ERROR: "destructive",
};

export function ConnectionStatusBadge({ mode }: { mode: IntegrationMode }) {
  return <Badge variant={VARIANT[mode]}>{mode}</Badge>;
}
