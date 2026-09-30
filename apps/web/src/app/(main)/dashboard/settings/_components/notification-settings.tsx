"use client";
import { useEffect, useState } from "react";

import Link from "next/link";

import { BellRing, Mail } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";

import { ResourceState } from "../../_components/resource-state";

interface Preferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
}
interface Settings {
  channels: Array<{ provider: string; preferences: Partial<Preferences> }>;
}
export function NotificationSettings() {
  const resource = useApiResource<Settings>("/settings");
  const [preferences, setPreferences] = useState<Preferences>({ inAppEnabled: true, emailEnabled: false });
  const [saved, setSaved] = useState(preferences);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (resource.data) {
      const channel = resource.data.channels.find((row) => row.provider === "WEB");
      const next = {
        inAppEnabled: channel?.preferences.inAppEnabled ?? true,
        emailEnabled: channel?.preferences.emailEnabled ?? false,
      };
      setPreferences(next);
      setSaved(next);
    }
  }, [resource.data]);
  const dirty = preferences.inAppEnabled !== saved.inAppEnabled || preferences.emailEnabled !== saved.emailEnabled;
  const preferenceStatus = () => {
    if (resource.loading) return "Loading preferences…";
    if (resource.error) return "Preferences could not be loaded";
    if (saving) return "Saving preferences…";
    return dirty ? "Unsaved changes" : "Preferences saved";
  };
  const save = async () => {
    setSaving(true);
    try {
      await apiRequest("/settings/notifications", { method: "PATCH", body: JSON.stringify(preferences) });
      setSaved(preferences);
      toast.success("Notification preferences saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save preferences.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid items-start gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
          <CardDescription>
            Control optional announcements in your notification center. Security and account-access notices always
            remain available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResourceState {...resource} retry={resource.reload} />
          {!resource.loading && !resource.error && (
            <FieldGroup>
              {[
                {
                  id: "inAppEnabled",
                  label: "Product announcements",
                  detail: "Receive optional product messages from the MarketPilot team.",
                  icon: BellRing,
                },
                {
                  id: "emailEnabled",
                  label: "Email updates (coming later)",
                  detail: "Your preference is saved; email delivery is not connected yet.",
                  icon: Mail,
                },
              ].map(({ id, label, detail, icon: Icon }) => {
                const key = id as keyof Preferences;
                return (
                  <Field key={id} orientation="horizontal">
                    <Icon className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    <FieldContent>
                      <FieldLabel htmlFor={`notify-${id}`}>{label}</FieldLabel>
                      <FieldDescription>{detail}</FieldDescription>
                    </FieldContent>
                    <Switch
                      id={`notify-${id}`}
                      checked={preferences[key]}
                      disabled={saving}
                      onCheckedChange={(checked) => setPreferences((current) => ({ ...current, [key]: checked }))}
                    />
                  </Field>
                );
              })}
            </FieldGroup>
          )}
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <span className="text-muted-foreground text-xs" aria-live="polite">
            {preferenceStatus()}
          </span>
          <Button disabled={!dirty || saving || resource.loading || !!resource.error} onClick={() => void save()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Messaging channels</CardTitle>
          <CardDescription>Manage bot connections in one place.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {["Telegram", "Discord"].map((name) => (
            <div key={name} className="flex items-center justify-between gap-2">
              <span className="text-sm">{name}</span>
              <Badge variant="outline">Not connected</Badge>
            </div>
          ))}
          <Button asChild variant="outline">
            <Link href="/dashboard/bots/telegram">Manage channels</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
