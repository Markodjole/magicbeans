import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { InvestmentStatus } from "@/generated/prisma/client";

const STATUS_VARIANT: Record<InvestmentStatus, NonNullable<BadgeProps["variant"]>> = {
  PENDING: "warning",
  ACTIVE: "live",
  COMPLETED: "success",
  CANCELLED: "destructive",
  REFUNDED: "destructive",
};

export function InvestmentStatusBadge({ status }: { status: InvestmentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}
