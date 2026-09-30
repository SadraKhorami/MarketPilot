"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BellRing,
  CircleAlert,
  KeyRound,
  ListChecks,
  Loader2,
  Palette,
  Pencil,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

type Profile = { id: string; email: string; name: string | null; status: string; createdAt: string };
type Watchlist = { items: Array<{ id: string }> };
type AlertRule = { id: string };
type ApiKey = { id: string; revokedAt: string | null; expiresAt: string | null };

export function ProfileWorkspace() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [counts, setCounts] = useState<{ markets: number | null; alerts: number | null; keys: number | null } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.allSettled([
      apiRequest<ApiEnvelope<Profile>>("/users/me"),
      apiRequest<ApiEnvelope<Watchlist[]>>("/watchlists"),
      apiRequest<ApiEnvelope<AlertRule[]>>("/alerts"),
      apiRequest<ApiEnvelope<ApiKey[]>>("/api-keys"),
    ]).then(([profileResult, watchlistResult, alertResult, keyResult]) => {
      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value.data);
        setName(profileResult.value.data.name ?? "");
      } else
        setError(
          profileResult.reason instanceof Error ? profileResult.reason.message : "Could not load account details.",
        );
      setCounts({
        markets:
          watchlistResult.status === "fulfilled"
            ? watchlistResult.value.data.reduce((sum, list) => sum + list.items.length, 0)
            : null,
        alerts: alertResult.status === "fulfilled" ? alertResult.value.data.length : null,
        keys:
          keyResult.status === "fulfilled"
            ? keyResult.value.data.filter(
                (key) => !key.revokedAt && (!key.expiresAt || new Date(key.expiresAt) > new Date()),
              ).length
            : null,
      });
      setLoading(false);
    });
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await apiRequest<ApiEnvelope<Pick<Profile, "name" | "email">>>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setProfile((current) => (current ? { ...current, ...data } : current));
      setName(data.name ?? "");
      toast.success("Profile saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile?.name?.trim() || "MarketPilot member";
  const initials =
    profile?.name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() ||
    profile?.email.slice(0, 2).toUpperCase() ||
    "MP";

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]">
      <Card className="bg-gradient-to-r from-muted/50 to-card py-0 shadow-none lg:col-span-2">
        <CardContent className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          {loading ? (
            <Skeleton className="size-16 rounded-full" />
          ) : (
            <Avatar className="size-20 border-4 border-background ring-1 ring-border">
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0 flex-1">
            {loading ? (
              <>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-2 h-4 w-56" />
              </>
            ) : (
              <>
                <h2 className="truncate font-semibold text-xl tracking-tight">{displayName}</h2>
                <p className="mt-1 truncate text-muted-foreground text-sm">{profile?.email}</p>
                <p className="mt-2 text-muted-foreground text-xs">Your personal market intelligence workspace</p>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {profile ? (
              <Badge variant="outline">
                <span
                  className={`size-1.5 rounded-full ${profile.status === "ACTIVE" ? "bg-emerald-500" : "bg-muted-foreground"}`}
                />
                {formatStatus(profile.status)}
              </Badge>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={!profile}
              onClick={() => document.getElementById("profile-name")?.focus()}
            >
              <Pencil />
              Edit profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Personal details</CardTitle>
            <CardDescription>Update the name shown across your MarketPilot account.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && !profile ? (
              <div className="mb-4 flex gap-2 rounded-lg border border-destructive/30 p-3 text-sm" role="alert">
                <CircleAlert className="size-4 shrink-0 text-destructive" />
                {error}
              </div>
            ) : null}
            <form onSubmit={save} className="space-y-5">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="profile-name">Display name</FieldLabel>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    maxLength={120}
                    disabled={loading || saving || !profile}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="profile-email">Email address</FieldLabel>
                  <Input id="profile-email" type="email" value={profile?.email ?? ""} autoComplete="email" disabled />
                  <p className="text-muted-foreground text-xs">Email address changes are not available yet.</p>
                </Field>
              </FieldGroup>
              {error && profile ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={loading || saving || !profile || name.trim() === (profile.name ?? "")}>
                {saving ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Account overview</CardTitle>
            <CardDescription>Saved to your MarketPilot account</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <AccountMetric
              label="Markets followed"
              value={loading ? "…" : formatCount(counts?.markets)}
              icon={ListChecks}
            />
            <AccountMetric
              label="Saved alert rules"
              value={loading ? "…" : formatCount(counts?.alerts)}
              icon={BellRing}
            />
            <AccountMetric label="Active API keys" value={loading ? "…" : formatCount(counts?.keys)} icon={KeyRound} />
            <div className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="text-muted-foreground">Member since</span>
              <span className="font-medium tabular-nums">
                {profile
                  ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Account settings</CardTitle>
            <CardDescription>Review the controls for your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <ProfileLink
              href="/dashboard/settings/security"
              icon={ShieldCheck}
              title="Security"
              detail="Review your active sessions"
            />
            <ProfileLink
              href="/dashboard/settings/notifications"
              icon={BellRing}
              title="Notifications"
              detail="Manage saved preferences"
            />
            <ProfileLink
              href="/dashboard/settings/appearance"
              icon={Palette}
              title="Appearance"
              detail="Choose light, dark, or system theme"
            />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function AccountMetric({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ProfileLink({
  href,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-sm">{title}</span>
        <span className="block truncate text-muted-foreground text-xs">{detail}</span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? "Unavailable" : String(value);
}

function formatStatus(status: string) {
  return status.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}
