"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/utils";

import { AccountMenuContent } from "../account-menu-content";
import { useSessionUser } from "../auth-gate";

export function ProfileMenu() {
  const user = useSessionUser();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open profile menu">
          <Avatar>
            <AvatarFallback>{getInitials(user?.name?.trim() || user?.email || "MP")}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72 max-w-[calc(100vw-2rem)]">
        <AccountMenuContent />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
