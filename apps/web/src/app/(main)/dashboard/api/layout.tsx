import type { ReactNode } from "react";

import { ApiNavigation } from "./_components/api-navigation";

export default function ApiLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <ApiNavigation />
      {children}
    </div>
  );
}
