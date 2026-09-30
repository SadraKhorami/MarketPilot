import type { ReactNode } from "react";

import { AdminGate } from "../_components/auth-gate";
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
