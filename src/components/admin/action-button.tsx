"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Generic wrapper around a server action for admin controls: calls the
 * action, shows a pending state, surfaces any thrown error inline, and
 * refreshes the route on success so the server-rendered data reflects
 * the mutation (the actions already call revalidatePath internally).
 */
export function ActionButton({
  action,
  children,
  pendingLabel,
  confirmMessage,
  className,
  variant,
  size,
}: {
  action: () => Promise<unknown>;
  children: React.ReactNode;
  pendingLabel?: string;
  confirmMessage?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button type="button" onClick={handleClick} disabled={isPending} variant={variant} size={size} className={className}>
        {isPending ? (pendingLabel ?? "Working…") : children}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
