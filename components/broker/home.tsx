import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Cpu,
  Layers3,
  MessageSquarePlus,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import {
  STATUS,
  formatDate,
  parseAgentResult,
  requestName,
  shortId,
  type RequestRow,
} from "@/lib/broker";

export function RequestHome({
  rows,
  count,
  page,
  filter,
  search,
  error,
}: {
  rows: RequestRow[];
  count: number;
  page: number;
  filter: string;
  search: string;
  error?: string;
}) {
  const link = (p: number, f = filter) =>
    `/?page=${p}${f !== "all" ? `&status=${f}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}`;
  return (
    <>
      <div className="home-intro">
        <div>
          <span className="eyebrow">YOUR RESEARCH. YOUR WORKSPACE.</span>
          <h1>
            Good ideas need
            <br className="mobile-hide" /> the right compute
            <span className="brand-dot">.</span>
          </h1>
          <p>
            From a workload description to a configuration that fits.
            <br className="mobile-hide" /> Manage your GPU requests in one
            place.
          </p>
        </div>
        <Link href="/requests/new" className="new-request-card">
          <div className="new-request-card-top">
            <span className="new-card-icon">
              <MessageSquarePlus size={22} strokeWidth={1.5} />
            </span>
            <ArrowUpRight size={22} />
          </div>
          <h2>Start with a conversation.</h2>
          <p>
            Tell the assistant what you’re building.
            <br />
            We’ll help you find the right fit.
          </p>
          <span className="new-card-cta">
            New GPU request <Plus size={17} />
          </span>
        </Link>
      </div>
      <section className="requests-section">
        <div className="section-heading">
          <div>
            <h2>
              Your requests <span>{count}</span>
            </h2>
            <p>A little less setup. A little more research.</p>
          </div>
          <Link href="/requests/new" className="primary-button">
            <Plus size={16} /> New request
          </Link>
        </div>
        <div className="list-toolbar">
          <nav className="filter-tabs" aria-label="Filter requests">
            {[
              { value: "all", label: "All requests" },
              { value: "draft", label: "Drafts" },
              { value: "submitted", label: "Submitted" },
            ].map((f) => (
              <Link
                key={f.value}
                href={link(1, f.value)}
                className={filter === f.value ? "active" : ""}
                aria-current={filter === f.value ? "page" : undefined}
              >
                {f.label}
              </Link>
            ))}
          </nav>
          <form className="request-search">
            <input type="hidden" name="status" value={filter} />
            <Search size={15} />
            <input
              name="q"
              aria-label="Search full request ID"
              defaultValue={search}
              placeholder="Find a full request ID…"
            />
            <button aria-label="Search">
              <ArrowRight size={14} />
            </button>
          </form>
        </div>
        {error ? (
          <div className="empty-state" role="alert">
            <Cpu size={30} />
            <h3>We couldn’t load your requests.</h3>
            <p>{error}</p>
            <Link href={link(page)} className="secondary-button">
              Try again
            </Link>
          </div>
        ) : !rows.length ? (
          <div className="empty-state">
            <span className="empty-icon">
              <Layers3 size={30} strokeWidth={1.2} />
            </span>
            <h3>
              {filter !== "all" || search
                ? "No matching requests."
                : "A clean slate for your next big idea."}
            </h3>
            <p>
              {filter !== "all" || search
                ? "Try another filter or full request ID."
                : "Start a conversation about your model and workload. Your first request will appear here."}
            </p>
            <Link
              href={filter !== "all" || search ? "/" : "/requests/new"}
              className="secondary-button"
            >
              {filter !== "all" || search
                ? "View all requests"
                : "Create your first request"}
              <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <>
            <div className="requests-table-scroll">
              <table className="requests-table">
                <thead>
                  <tr>
                    <th>WORKLOAD</th>
                    <th>CONFIGURATION</th>
                    <th>STATUS</th>
                    <th>LAST UPDATED</th>
                    <th>
                      <span className="sr-only">Open request</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const result = parseAgentResult(row.agent_result);
                    const status =
                      STATUS[row.request_state as keyof typeof STATUS];
                    return (
                      <tr key={row.request_id}>
                        <td>
                          <Link
                            href={`/requests/${row.request_id}`}
                            className="request-title"
                          >
                            <span className="request-icon">
                              <Cpu size={18} strokeWidth={1.4} />
                            </span>
                            <span>
                              <strong>{requestName(row)}</strong>
                              <small>{shortId(row.request_id)}</small>
                            </span>
                          </Link>
                        </td>
                        <td>
                          {result?.gpu_configuration ? (
                            <>
                              <strong className="table-config">
                                {result.gpu_configuration.gpu_count} ×{" "}
                                {result.gpu_configuration.gpu}
                              </strong>
                              <small className="table-subtext">
                                {result.gpu_configuration.instance}
                              </small>
                            </>
                          ) : (
                            <span className="table-muted">
                              Still taking shape
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${status?.className || "unknown"}`}
                          >
                            <span />
                            {status?.label || "Unknown status"}
                          </span>
                        </td>
                        <td className="table-date">
                          {formatDate(row.updated_at || row.created_at)}
                        </td>
                        <td>
                          <Link
                            className="row-open"
                            href={`/requests/${row.request_id}`}
                            aria-label={`Open ${requestName(row)}`}
                          >
                            <ArrowUpRight size={18} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, count)} of{" "}
                {count} requests
              </span>
              <div>
                {page > 1 && <Link href={link(page - 1)}>Previous</Link>}
                {page * 20 < count && (
                  <Link href={link(page + 1)}>
                    Next <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </section>
      <div className="home-footnote">
        <Sparkles size={14} />
        <span>
          Recommendations are estimates. Your platform team reviews every
          submitted request.
        </span>
      </div>
    </>
  );
}
