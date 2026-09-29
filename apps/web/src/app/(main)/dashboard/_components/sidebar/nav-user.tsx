"use client";

import Link from "next/link";

import { EllipsisVertical, Settings2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

export function NavUser() {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label="Open demo workspace menu">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">MP</AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Demo workspace</span>
                <span className="truncate text-muted-foreground text-xs">Frontend preview</span>
              </span>
              <EllipsisVertical className="ml-auto size-4" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-52" side={isMobile ? "bottom" : "right"} align="end">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/profile">
                <Settings2 /> Workspace settings
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
