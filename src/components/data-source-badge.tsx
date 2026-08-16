import { Badge } from "@/components/ui/badge";

/**
 * Every important metric must show where it came from (per spec's
 * "VERIFIED DATA BADGES" requirement). Never render a MOCK number without
 * this — the whole point of the product is that money flow is provable,
 * and that starts with being honest about what's real vs. simulated.
 */
export function DataSourceBadge({ provider, isMock }: { provider: string; isMock: boolean }) {
  if (isMock) {
    return <Badge variant="mock">SIMULATED</Badge>;
  }
  return <Badge variant="live">Verified by {provider}</Badge>;
}
