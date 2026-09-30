"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BellRing, Palette, ShieldCheck, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useSessionUser } from "../../_components/auth-gate";
import { AppearanceSettings } from "./appearance-settings";
import { NotificationSettings } from "./notification-settings";
import { SecuritySettings } from "./security-settings";
export type SettingsSection = "security" | "notifications" | "appearance";
const links = [
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "notifications", label: "Notifications", icon: BellRing },
  { id: "appearance", label: "Appearance", icon: Palette },
] as const;
export function SettingsPanel({ section }: { section: SettingsSection }) {
  const user = useSessionUser();
  const router = useRouter();
  const Section = { security: SecuritySettings, notifications: NotificationSettings, appearance: AppearanceSettings }[
    section
  ];
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback>{(user?.name ?? user?.email ?? "MP").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-semibold">{user?.name ?? "Your account"}</p>
              <p className="break-all text-muted-foreground text-sm">{user?.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{user?.roles.includes("ADMIN") ? "Administrator" : "Personal workspace"}</Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/profile">
                <UserRound data-icon="inline-start" />
                Edit profile
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="sm:hidden">
        <Select value={section} onValueChange={(value) => router.push(`/dashboard/settings/${value}`)}>
          <SelectTrigger className="w-full" aria-label="Settings section">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {links.map(({ id, label }) => (
                <SelectItem value={id} key={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <nav aria-label="Settings sections" className="hidden flex-wrap gap-2 border-b pb-3 sm:flex">
        {links.map(({ id, label, icon: Icon }) => (
          <Button asChild variant={section === id ? "secondary" : "ghost"} key={id}>
            <Link href={`/dashboard/settings/${id}`} aria-current={section === id ? "page" : undefined}>
              <Icon data-icon="inline-start" />
              {label}
            </Link>
          </Button>
        ))}
      </nav>
      <Section />
    </div>
  );
}
