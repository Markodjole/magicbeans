"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createApp } from "@/lib/actions/developer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIES = [
  "Productivity",
  "Health & Fitness",
  "Education",
  "Wellness",
  "Finance",
  "Lifestyle",
  "Photo & Video",
  "Other",
];

const SELECT_CLASSES =
  "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

const TEXTAREA_CLASSES =
  "flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

const initialState: { error?: string; appId?: string } = {};

export function CreateAppForm() {
  const [state, formAction, pending] = useActionState(createApp, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.appId) {
      router.push(`/developer/apps/${state.appId}`);
    }
  }, [state.appId, router]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">App name</Label>
        <Input id="name" name="name" required maxLength={120} placeholder="e.g. Focus Timer" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">Category</Label>
        <select id="category" name="category" required defaultValue={CATEGORIES[0]} className={SELECT_CLASSES}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          placeholder="What does your app do?"
          className={TEXTAREA_CLASSES}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="appStoreUrl">App Store URL</Label>
          <Input id="appStoreUrl" name="appStoreUrl" type="url" placeholder="https://apps.apple.com/..." />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="googlePlayUrl">Google Play URL</Label>
          <Input id="googlePlayUrl" name="googlePlayUrl" type="url" placeholder="https://play.google.com/..." />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pricingModel">Pricing model</Label>
          <select id="pricingModel" name="pricingModel" required defaultValue="subscription" className={SELECT_CLASSES}>
            <option value="subscription">Subscription</option>
            <option value="one_time">One-time purchase</option>
            <option value="freemium">Freemium</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subscriptionPrice">Price ($/mo, if applicable)</Label>
          <Input id="subscriptionPrice" name="subscriptionPrice" type="number" min={0} step="0.01" placeholder="9.99" />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending} size="lg">
        {pending ? "Creating…" : "Create app"}
      </Button>
    </form>
  );
}
