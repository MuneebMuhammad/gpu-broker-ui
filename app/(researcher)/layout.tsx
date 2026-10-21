import { Suspense } from "react";
import { pageContext } from "@/lib/requests";
import { hasAdminAccess } from "@/lib/admin";
import { Shell } from "@/components/broker/shell";
async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const context = await pageContext();
  const isAdmin = await hasAdminAccess(context);
  return (
    <Shell email={context.user.email || "Researcher"} isAdmin={isAdmin}>
      {children}
    </Shell>
  );
}
export default function ResearcherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="page-loading">
          <span className="loading-mark" />
          Opening your workspace…
        </div>
      }
    >
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
