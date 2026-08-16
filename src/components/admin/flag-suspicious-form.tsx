"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flagSuspicious } from "@/lib/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FlagSuspiciousForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await flagSuspicious(entityType, entityId, reason);
        setMessage("Flagged and logged to the audit trail.");
        setEntityType("");
        setEntityId("");
        setReason("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to flag");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entityType">Entity type</Label>
        <Input
          id="entityType"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          placeholder="App, Investment, User…"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entityId">Entity ID</Label>
        <Input id="entityId" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="cuid…" required />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="reason">Reason</Label>
        <Input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why this looks suspicious"
          required
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-4">
        <Button type="submit" disabled={isPending} variant="destructive">
          {isPending ? "Flagging…" : "Flag as suspicious"}
        </Button>
        {message && <p className="text-sm text-emerald-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}
