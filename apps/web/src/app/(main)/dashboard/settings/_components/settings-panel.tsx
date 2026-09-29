"use client";

import { useState } from "react";

import Link from "next/link";

import { Check, Monitor, Moon, Palette, Save, ShieldCheck, Sun, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

export type SettingsSection = "profile" | "security" | "notifications" | "appearance";

const sectionLinks: Array<{ id: SettingsSection; label: string; icon: typeof UserRound }> = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "notifications", label: "Notifications", icon: Check },
  { id: "appearance", label: "Appearance", icon: Palette },
];

export function SettingsPanel({ section }: { section: SettingsSection }) {
  let content = <AppearanceSettings />;
  if (section === "profile") content = <ProfileSettings />;
  else if (section === "security") content = <SecuritySettings />;
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

function ProfileSettings() {
  const [name, setName] = useState("Demo User");
  const [email, setEmail] = useState("preview@marketpilot.local");
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
        <CardDescription>Editable preview fields · not sent to a server</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="max-w-xl space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            toast.info("Profile changes are temporary and were not saved.");
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit">
              <Save /> Save profile
            </Button>
            <Badge variant="outline">Preview only</Badge>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SecuritySettings() {
  const [twoFactor, setTwoFactor] = useState(false);
  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Sign-in security</CardTitle>
          <CardDescription>Authentication controls are not connected</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <ShieldCheck aria-hidden="true" />
            <AlertTitle>No authenticated session</AlertTitle>
            <AlertDescription>
              This frontend preview does not sign in, change passwords, or manage server sessions.
            </AlertDescription>
          </Alert>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <Label htmlFor="two-factor" className="font-medium">
                Two-factor authentication
              </Label>
              <p className="mt-1 text-muted-foreground text-sm">
                Preview toggle only. No security setting will be saved.
              </p>
            </div>
            <Switch id="two-factor" checked={twoFactor} onCheckedChange={setTwoFactor} />
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Active sessions</CardTitle>
          <CardDescription>Session records become available with backend authentication.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No session data is available in this UI phase.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationSettings() {
  const [preferences, setPreferences] = useState({ inApp: true, email: false, telegram: false, discord: false });
  const options: Array<{ id: keyof typeof preferences; label: string; detail: string }> = [
    { id: "inApp", label: "In-app notifications", detail: "Display alert events in the dashboard." },
    { id: "email", label: "Email notifications", detail: "Send security and market alert updates by email." },
    { id: "telegram", label: "Telegram", detail: "Deliver selected updates through a linked bot." },
    { id: "discord", label: "Discord", detail: "Deliver selected updates through a linked bot." },
  ];
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Notification preferences</CardTitle>
        <CardDescription>Temporary local preferences · no notification service is connected</CardDescription>
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
              onCheckedChange={(checked) => setPreferences((current) => ({ ...current, [id]: checked }))}
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
