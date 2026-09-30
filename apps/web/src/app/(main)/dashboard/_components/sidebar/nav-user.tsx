"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { EllipsisVertical, LogOut, Settings2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { apiRequest } from "@/lib/api/client";

export function NavUser() {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const logout = async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
      router.replace("/auth/v2/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label="Open account menu">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">MP</AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">My account</span>
                <span className="truncate text-muted-foreground text-xs">MarketPilot</span>
              </span>
              <EllipsisVertical className="ml-auto size-4" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-52" side={isMobile ? "bottom" : "right"} align="end">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <UserRound /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/appearance">
                <Settings2 /> Workspace settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void logout()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
