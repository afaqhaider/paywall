"use client";

import { CustomerProvider } from "../../lib/customer-context";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <CustomerProvider>{children}</CustomerProvider>;
}
