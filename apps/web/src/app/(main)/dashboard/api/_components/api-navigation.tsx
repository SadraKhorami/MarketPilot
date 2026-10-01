"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Activity, BookOpen, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";

const sections = [
  { href: "/dashboard/api/keys", label: "API keys", icon: KeyRound },
  { href: "/dashboard/api/usage", label: "Usage", icon: Activity },
  { href: "/dashboard/api/documentation", label: "Documentation", icon: BookOpen },
];

export function ApiNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Developer API" className="flex flex-wrap gap-1 border-b pb-3">
      {sections.map(({ href, label, icon: Icon }) => (
        <Button key={href} asChild size="sm" variant={pathname === href ? "secondary" : "ghost"}>
          <Link href={href} aria-current={pathname === href ? "page" : undefined}>
            <Icon data-icon="inline-start" />
            {label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
