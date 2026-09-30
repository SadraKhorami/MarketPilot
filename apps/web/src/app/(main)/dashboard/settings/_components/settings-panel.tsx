"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { BellRing, Monitor, Moon, Palette, ShieldCheck, Sun } from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

export type SettingsSection = "security" | "notifications" | "appearance";

const sectionLinks: Array<{ id: SettingsSection; label: string; icon: typeof BellRing }> = [
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "notifications", label: "Notifications", icon: BellRing },
  { id: "appearance", label: "Appearance", icon: Palette },
];

export function SettingsPanel({ section }: { section: SettingsSection }) {
  let content = <AppearanceSettings />;
  if (section === "security") content = <SecuritySettings />;
  else if (section === "notifications") content = <NotificationSettings />;

  return (
    <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="grid grid-cols-2 gap-2 xl:flex xl:flex-col" aria-label="Settings sections">
        {sectionLinks.map(({ id, label, icon: Icon }) => (
          <Button key={id} variant={section === id ? "secondary" : "ghost"} className="justify-start" asChild>
            <Link href={`/dashboard/settings/${id}`}>
              <Icon />
              {label}
            </Link>
          </Button>
        ))}
      </nav>
      {content}
    </div>
  );
}

function SecuritySettings() {
  const [sessions, setSessions] = useState<
    Array<{ id: string; createdAt: string; lastSeenAt: string | null; expiresAt: string; current: boolean }>
  >([]);
  useEffect(() => {
    apiRequest<ApiEnvelope<typeof sessions>>("/auth/sessions")
      .then(({ data }) => setSessions(data))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not load sessions."));
  }, []);
  const revokeSession = async (id: string) => {
    try {
      await apiRequest(`/auth/sessions/${id}`, { method: "DELETE" });
      setSessions((current) => current.filter((session) => session.id !== id));
      toast.success("Session revoked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke session.");
    }
  };
  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Sign-in security</CardTitle>
          <CardDescription>Your account uses an HTTP-only browser session.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <ShieldCheck aria-hidden="true" />
            <AlertTitle>Session authentication is active</AlertTitle>
            <AlertDescription>
              Sessions expire after 14 days. Password reset, password changes, and multi-factor authentication are not
              available yet.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Active session</CardTitle>
          <CardDescription>This browser has an authenticated server-side session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.map((session) => (
            <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">
                  {session.current ? "This browser" : `Session ${session.id.slice(0, 8)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(session.createdAt).toLocaleString()} · expires{" "}
                  {new Date(session.expiresAt).toLocaleDateString()}
                </p>
              </div>
              {session.current ? (
                <Badge variant="secondary">Current</Badge>
              ) : (
                <Button variant="outline" size="sm" onClick={() => void revokeSession(session.id)}>
                  Revoke
                </Button>
              )}
            </div>
          ))}
          {sessions.length === 0 ? <p className="text-muted-foreground text-sm">No active sessions.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationSettings() {
  const [preferences, setPreferences] = useState({ inAppEnabled: true, emailEnabled: false });
  useEffect(() => {
    apiRequest<
      ApiEnvelope<{
        channels: Array<{ provider: string; preferences: { inAppEnabled?: boolean; emailEnabled?: boolean } }>;
      }>
    >("/settings")
      .then(({ data }) => {
        const channel = data.channels.find((item) => item.provider === "WEB");
        if (channel?.preferences) setPreferences((current) => ({ ...current, ...channel.preferences }));
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Could not load notification settings."),
      );
  }, []);

  const save = (id: keyof typeof preferences, checked: boolean) => {
    const previous = preferences;
    const next = { ...preferences, [id]: checked };
    setPreferences(next);
    void apiRequest("/settings/notifications", { method: "PATCH", body: JSON.stringify(next) })
      .then(() => toast.success("Notification preferences saved."))
      .catch((error: unknown) => {
        setPreferences(previous);
        toast.error(error instanceof Error ? error.message : "Could not save settings.");
      });
  };
  const options: Array<{ id: keyof typeof preferences; label: string; detail: string }> = [
    {
      id: "inAppEnabled",
      label: "In-app notifications",
      detail: "Show alert events in your dashboard when evaluation is available.",
    },
    {
      id: "emailEnabled",
      label: "Email notifications",
      detail: "Preference is saved; outbound email delivery is not configured.",
    },
  ];
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Notification preferences</CardTitle>
        <CardDescription>
          Your preferences are saved to your account. Delivery services are not connected.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {options.map(({ id, label, detail }) => (
          <div key={id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
            <div>
              <Label htmlFor={`notify-${id}`} className="font-medium">
                {label}
              </Label>
              <p className="mt-1 text-muted-foreground text-sm">{detail}</p>
            </div>
            <Switch
              id={`notify-${id}`}
              checked={preferences[id]}
              onCheckedChange={(checked) => save(id, checked)}
              aria-label={`${label} preference`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AppearanceSettings() {
  const { themeMode, setPreference } = usePreferencesStore(
    useShallow((state) => ({ themeMode: state.values.theme_mode, setPreference: state.setPreference })),
  );
  const choices = [
    { value: "light", label: "Light", icon: Sun, detail: "Bright surfaces" },
    { value: "dark", label: "Dark", icon: Moon, detail: "Low-light workspace" },
    { value: "system", label: "System", icon: Monitor, detail: "Follow device preference" },
  ] as const;
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Appearance</CardTitle>
        <CardDescription>Theme selection uses the dashboard's existing theme system.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {choices.map(({ value, label, icon: Icon, detail }) => (
          <button
            key={value}
            type="button"
            aria-pressed={themeMode === value}
            onClick={() => setPreference("theme_mode", value)}
            className={`rounded-xl border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${themeMode === value ? "border-primary bg-primary/5" : ""}`}
          >
            <span className="flex items-center justify-between">
              <Icon className="size-5" aria-hidden="true" />
              {themeMode === value ? <Badge variant="secondary">Selected</Badge> : null}
            </span>
            <span className="mt-4 block font-medium">{label}</span>
            <span className="mt-1 block text-muted-foreground text-sm">{detail}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
