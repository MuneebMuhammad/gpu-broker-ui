import { Suspense } from "react";
import type { Metadata } from "next";
import { adminPageContext } from "@/lib/admin";
import { Shell } from "@/components/broker/shell";
export const metadata: Metadata = { title: "GPU Broker · Admin review" };
async function AdminShell({ children }: { children: React.ReactNode }) {
  const { user } = await adminPageContext();
  return (
    <Shell email={user.email || "Admin"} isAdmin admin>
      {children}
    </Shell>
  );
}
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={<div className="page-loading">Opening admin review…</div>}
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
