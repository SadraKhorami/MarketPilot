"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Bell, CreditCard, LoaderCircle, LogOut, Palette, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/api/client";
import { getInitials } from "@/lib/utils";

import { AccountThemeMenu } from "./account-theme-menu";
import { useSessionUser } from "./auth-gate";

export function AccountMenuContent() {
  const user = useSessionUser();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const name = user?.name?.trim() || "My account";
  const isAdmin = user?.roles.includes("ADMIN");

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await apiRequest("/auth/logout", { method: "POST" });
      router.replace("/auth/v2/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
      setSigningOut(false);
    }
  };

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback>{getInitials(user?.name?.trim() || user?.email || "MP")}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate font-medium text-foreground text-sm">{name}</span>
              <span className="truncate font-normal" title={user?.email}>
                {user?.email}
              </span>
            </div>
          </div>
          {isAdmin ? (
            <Badge variant="outline" className="mt-3">
              Administrator
            </Badge>
          ) : null}
        </DropdownMenuLabel>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem asChild className="px-3 py-2">
          <Link href="/dashboard/profile">
            <UserRound /> My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="px-3 py-2">
          <Link href="/dashboard/notifications">
            <Bell /> Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="px-3 py-2">
          <Link href="/dashboard/billing">
            <CreditCard /> Billing & plans
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="px-3 py-2">
          <Link href="/dashboard/settings/security">
            <ShieldCheck /> Account security
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="px-3 py-2">
          <Link href="/dashboard/settings/appearance">
            <Palette /> Appearance & settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      {isAdmin ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild className="px-3 py-2">
              <Link href="/dashboard/admin">
                <ShieldCheck /> Administration
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem
          variant="destructive"
          className="justify-between px-3 py-2"
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            void logout();
          }}
        >
          <span>{signingOut ? "Signing out…" : "Sign out"}</span>
          {signingOut ? <LoaderCircle className="animate-spin" /> : <LogOut />}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <AccountThemeMenu />
    </>
  );
}
