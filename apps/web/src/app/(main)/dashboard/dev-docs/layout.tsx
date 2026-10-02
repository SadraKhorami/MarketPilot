import type { ReactNode } from "react";

import { notFound } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Development docs · MarketPilot",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <div className="@container/main mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-5 md:gap-6">
      <h1 className="sr-only">Development docs</h1>
      {children}
    </div>
  );
}
