import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  Search,
} from "lucide-react";
import {
  STATUS,
  formatDate,
  parseAgentResult,
  requestName,
  shortId,
  type RequestRow,
} from "@/lib/broker";

export function AdminHome({
  rows,
  emails,
  count,
  page,
  filter,
  search,
  error,
}: {
  rows: RequestRow[];
  emails: Record<string, string | null>;
  count: number;
  page: number;
  filter: string;
  search: string;
  error?: string;
}) {
  const link = (p: number, f = filter) =>
    `/admin?page=${p}&status=${f}${search ? `&q=${encodeURIComponent(search)}` : ""}`;
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">PLATFORM REVIEW</span>
          <h1>Research, ready for review.</h1>
          <p>
            Review submitted workloads and decide which requests to approve.
          </p>
        </div>
        <span className="draft-indicator">
          <ClipboardCheck size={16} /> Admin workspace
        </span>
      </div>
      <section className="requests-section">
        <div className="section-heading">
          <div>
            <h2>
              Submitted requests <span>{count}</span>
            </h2>
            <p>Drafts remain private to their researchers.</p>
          </div>
        </div>
        <div className="list-toolbar">
          <nav className="filter-tabs" aria-label="Filter admin requests">
            {[
              ["pending", "Awaiting decision"],
              ["all", "All submitted"],
              ["approved", "Approved"],
              ["rejected", "Rejected"],
            ].map(([value, label]) => (
              <Link
                key={value}
                href={link(1, value)}
                className={filter === value ? "active" : ""}
                aria-current={filter === value ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <form className="request-search">
            <input type="hidden" name="status" value={filter} />
            <Search size={15} />
            <input
              name="q"
              aria-label="Search full request ID"
              placeholder="Find a full request ID…"
              defaultValue={search}
            />
            <button aria-label="Search">
              <ArrowRight size={14} />
            </button>
          </form>
        </div>
        {error || !rows.length ? (
          <div className="empty-state" role={error ? "alert" : undefined}>
            <ClipboardCheck size={32} />
            <h3>{error ? "Requests unavailable" : "No matching requests."}</h3>
            <p>
              {error ||
                "Submitted requests will appear here. Try another filter or request ID."}
            </p>
            <Link
              className="secondary-button"
              href={error ? link(page) : "/admin?status=all"}
            >
              {error ? "Try again" : "View all submitted"}
            </Link>
          </div>
        ) : (
          <>
            <div className="requests-table-scroll">
              <table className="requests-table admin-table">
                <thead>
                  <tr>
                    <th>WORKLOAD</th>
                    <th>RESEARCHER</th>
                    <th>CONFIGURATION</th>
                    <th>STATUS</th>
                    <th>DATES</th>
                    <th>
                      <span className="sr-only">Review request</span>
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
                            className="request-title"
                            href={`/admin/requests/${row.request_id}`}
                          >
                            <span>
                              <strong>{requestName(row)}</strong>
                              <small title={row.request_id}>
                                {shortId(row.request_id)}
                              </small>
                            </span>
                          </Link>
                        </td>
                        <td>
                          <span
                            className="researcher-identity"
                            title={row.user_id || undefined}
                          >
                            {(row.user_id && emails[row.user_id]) ||
                              row.user_id ||
                              "Unknown researcher"}
                          </span>
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
                            <span className="table-muted">Unavailable</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${status?.className || "unknown"}`}
                          >
                            <span />
                            {status?.label || "Unknown"}
                          </span>
                        </td>
                        <td className="table-date">
                          <span>
                            Updated{" "}
                            {formatDate(row.updated_at || row.created_at)}
                          </span>
                          <small className="table-subtext">
                            Created {formatDate(row.created_at)}
                          </small>
                        </td>
                        <td>
                          <Link
                            className="row-open"
                            href={`/admin/requests/${row.request_id}`}
                            aria-label={`Review ${row.request_id}`}
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
                {page > 1 && (
                  <Link href={link(page - 1)}>
                    <ArrowLeft size={13} /> Previous
                  </Link>
                )}
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
      <p className="admin-footnote">
        Approval records a review decision. This workspace does not provision
        GPU resources.
      </p>
    </>
  );
}
