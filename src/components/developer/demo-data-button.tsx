"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { connectDemoIntegration } from "@/lib/actions/developer-actions";
import type { IntegrationCategory, IntegrationProvider } from "@/generated/prisma/client";

/**
 * The working "Use Demo Data" action for a given app/category/provider.
 * connectDemoIntegration takes explicit positional args rather than
 * FormData, so we call it directly from an event handler (wrapped in
 * useTransition for pending state) instead of binding it as a <form
 * action> — binding would pass a FormData object into its campaignName
 * parameter, which is the wrong shape.
 */
export function DemoDataButton({
  appId,
  category,
  provider,
  campaignName,
  dailyBudget,
  label = "Use Demo Data",
}: {
  appId: string;
  category: IntegrationCategory;
  provider: IntegrationProvider;
  campaignName?: string;
  dailyBudget?: number;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await connectDemoIntegration(appId, category, provider, campaignName, dailyBudget);
              setConnected(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to connect demo data");
            }
          });
        }}
      >
        {isPending ? "Connecting…" : connected ? "Connected" : label}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
