import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  Cpu,
  HelpCircle,
  LayoutGrid,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";

export function BrokerMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`broker-brand ${small ? "small" : ""}`}>
      <span className="brand-symbol">
        <Cpu size={21} strokeWidth={1.7} />
      </span>
      <span>
        GPU<span className="brand-light">Broker</span>
        <span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export function Shell({
  email,
  children,
  isAdmin = false,
  admin = false,
}: {
  email: string;
  isAdmin?: boolean;
  admin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <Link href={admin ? "/admin" : "/"} aria-label="GPU Broker home">
            <BrokerMark />
          </Link>
          <div className="header-divider" />
          <Link
            className={`nav-link ${!admin ? "active" : ""}`}
            href="/"
            aria-current={!admin ? "page" : undefined}
          >
            <LayoutGrid size={16} /> Workspace
          </Link>
          {isAdmin && (
            <Link
              className={`nav-link ${admin ? "active" : ""}`}
              href="/admin"
              aria-current={admin ? "page" : undefined}
            >
              <ShieldCheck size={16} /> Admin review
            </Link>
          )}
          <div className="header-right">
            <span className="researcher-tag">
              {admin ? "Admin workspace" : "Researcher workspace"}
            </span>
            <details className="account-menu">
              <summary>
                <span className="avatar">{email[0]?.toUpperCase() || "R"}</span>
                <span className="account-name">{email.split("@")[0]}</span>
                <ChevronDown size={14} />
              </summary>
              <div className="account-dropdown">
                <span className="eyebrow">SIGNED IN AS</span>
                <p>{email}</p>
                <LogoutButton />
              </div>
            </details>
          </div>
        </div>
      </header>
      <main className="workspace-main">{children}</main>
      <footer className="workspace-footer">
        <span>
          <span className="live-dot" /> Built for your next breakthrough.
        </span>
        <Link href="/help">
          <HelpCircle size={14} /> How it works <ArrowUpRight size={12} />
        </Link>
      </footer>
    </div>
  );
}
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <Link href="/">
          <BrokerMark />
        </Link>
        <div className="auth-story-copy">
          <span className="eyebrow">LESS SETUP. MORE DISCOVERY.</span>
          <h1>
            Big ideas.
            <br />
            The right compute.
          </h1>
          <p>
            Describe your research. Find the GPU configuration that fits. Get
            back to the work that matters.
          </p>
          <div className="auth-illustration" aria-hidden="true">
            <div className="gpu-drawing">
              <Cpu size={92} strokeWidth={0.6} />
              <div>
                <i />
                <i />
                <i />
              </div>
              <span>COMPUTE, CONSIDERED.</span>
            </div>
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
          </div>
        </div>
        <div className="auth-footnote">
          <span className="live-dot" /> Your research starts here.
        </div>
      </aside>
      <section className="auth-content">
        <div className="auth-mobile-brand">
          <Link href="/">
            <BrokerMark />
          </Link>
        </div>
        <div className="auth-form-container">{children}</div>
        <span className="auth-bottom">
          <Mail size={13} /> A workspace for researchers, by design.
        </span>
      </section>
    </div>
  );
}
