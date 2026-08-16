"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setIntegrationMode, triggerManualSync } from "@/lib/actions/admin-actions";
import { Button } from "@/components/ui/button";
import type { IntegrationMode } from "@/generated/prisma/client";

const MODES: IntegrationMode[] = ["LIVE", "MOCK", "DISCONNECTED", "ERROR"];

export function IntegrationModeControl({
  connectionId,
  appId,
  currentMode,
}: {
  connectionId: string;
  appId: string;
  currentMode: IntegrationMode;
}) {
  const router = useRouter();
  const [isModePending, startModeTransition] = useTransition();
  const [isSyncPending, startSyncTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  function handleModeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const mode = e.target.value as IntegrationMode;
    setError(null);
    startModeTransition(async () => {
      try {
        await setIntegrationMode(connectionId, mode);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update mode");
      }
    });
  }

  function handleSync() {
    setError(null);
    setSyncMessage(null);
    startSyncTransition(async () => {
      try {
        await triggerManualSync(appId);
        setSyncMessage("Sync complete.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sync failed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          value={currentMode}
          onChange={handleModeChange}
          disabled={isModePending}
          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs disabled:opacity-50"
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" onClick={handleSync} disabled={isSyncPending}>
          {isSyncPending ? "Syncing…" : "Sync now"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {syncMessage && <p className="text-xs text-emerald-700">{syncMessage}</p>}
    </div>
  );
}
