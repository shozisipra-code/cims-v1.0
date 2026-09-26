"use client";

import { useEffect, useMemo, useState } from "react";
import { CimsSelect } from "@/components/ui/CimsSelect";
import { useRole } from "@/components/layout/RoleContext";
import { formatDateTime } from "@/lib/utils";
import { Printer } from "lucide-react";
import { downloadPdfDocument } from "@/lib/pdf";

type AuditUser = { id: string; name: string; username?: string | null };
type AuditRow = {
  id: string;
  userName?: string | null;
  userRole?: string | null;
  user?: AuditUser | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  timestamp: string;
};
type AuditResponse = {
  success: boolean;
  auditLogs: AuditRow[];
  users: AuditUser[];
  actions: string[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
};
type Filters = { userId: string; action: string; from: string; to: string };

const emptyFilters: Filters = { userId: "", action: "", from: "", to: "" };
const readableAction = (action: string) => action.replaceAll("_", " ");
const actionTone = (action: string) => {
  if (action.includes("DEACTIVATED") || action.includes("DELETED") || action.includes("CANCEL")) return "danger";
  if (action.includes("UPDATE") || action.includes("CHANGED") || action.includes("RESET")) return "warning";
  if (action.includes("CREATE") || action.includes("REACTIVATED") || action.includes("FINALIZE")) return "success";
  return "neutral";
};

export default function AuditLogPage() {
  const { currentUser } = useRole();
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState({ ...emptyFilters, page: 1 });
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(applied.page) });
    if (applied.userId) params.set("userId", applied.userId);
    if (applied.action) params.set("action", applied.action);
    if (applied.from) params.set("from", applied.from);
    if (applied.to) params.set("to", applied.to);
    return params.toString();
  }, [applied]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/audit?${query}`, {
          headers: { "x-cims-user-id": currentUser.id },
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Unable to load audit logs.");
        setData(result);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Unable to load audit logs.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [currentUser.id, query]);

  function applyFilters(page = 1) {
    if (draft.from && draft.to && draft.from > draft.to) {
      setError("The From date must be earlier than or equal to the To date.");
      return;
    }
    setApplied({ ...draft, page });
  }
  function clearFilters() {
    setDraft(emptyFilters);
    setApplied({ ...emptyFilters, page: 1 });
  }

  const logs = data?.auditLogs || [];
  const total = data?.total || 0;
  const pageSize = data?.pageSize || 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const userOptions = [{ value: "", label: "All users" }, ...(data?.users || []).map(user => ({ value: user.id, label: `${user.name}${user.username ? ` (${user.username})` : ""}` }))];
  const actionOptions = [{ value: "", label: "All actions" }, ...(data?.actions || []).map(action => ({ value: action, label: readableAction(action) }))];
  const downloadAudit = () => downloadPdfDocument({
    filename: `audit-log-page-${applied.page}.pdf`, title: "Audit Log", subtitle: `Filtered audit trail - page ${applied.page} of ${totalPages}`, orientation: "landscape",
    metrics: [{ label: "Matching records", value: total }, { label: "Current page", value: `${applied.page} of ${totalPages}` }],
    sections: [{ title: "Audit trail", columns: ["Time", "User", "Role / username", "Action", "Resource", "Resource ID", "Details", "IP address"], rows: logs.map(log => [formatDateTime(log.timestamp), log.user?.name || log.userName || "System", log.user?.username || log.userRole || "Automated event", readableAction(log.action), log.resource.replaceAll("_", " "), log.resourceId, log.details, log.ipAddress]) }],
  });

  return <div className="audit-log-page space-y-5">
    <div className="page-heading"><div><h1>Audit Log</h1></div><button type="button" className="btn" disabled={loading || !logs.length} onClick={() => void downloadAudit()}><Printer size={15} />Download current page PDF</button></div>

    <section className="card audit-filter-card">
      <div className="audit-log-filters">
        <label>User<CimsSelect value={draft.userId} onChange={value => setDraft(current => ({ ...current, userId: value }))} options={userOptions} ariaLabel="Filter by user" /></label>
        <label>Action<CimsSelect value={draft.action} onChange={value => setDraft(current => ({ ...current, action: value }))} options={actionOptions} ariaLabel="Filter by action" /></label>
        <label>From<input className="input" type="date" value={draft.from} onChange={event => setDraft(current => ({ ...current, from: event.target.value }))} /></label>
        <label>To<input className="input" type="date" value={draft.to} onChange={event => setDraft(current => ({ ...current, to: event.target.value }))} /></label>
        <div className="audit-filter-actions">
          <button className="btn btn-primary" type="button" disabled={loading} onClick={() => applyFilters()}>Search</button>
          <button className="btn btn-secondary" type="button" disabled={loading} onClick={clearFilters}>Clear</button>
        </div>
      </div>
    </section>

    {error && <div className="audit-error" role="alert">{error}</div>}

    <section className="card audit-results">
      <div className="card-header"><h2>Audit Trail</h2><span className="users-role-badge">{loading ? "Loading…" : `${total.toLocaleString("en-PK")} records`}</span></div>
      <div className="table-scroll audit-table-scroll">
        <table className="audit-table">
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Resource</th><th>Details</th><th>IP address</th></tr></thead>
          <tbody>
            {!loading && logs.map(log => <tr key={log.id}>
              <td className="audit-time">{formatDateTime(log.timestamp)}</td>
              <td><strong>{log.user?.name || log.userName || "System"}</strong><small>{log.user?.username || log.userRole || "Automated event"}</small></td>
              <td><span className={`audit-action ${actionTone(log.action)}`}>{readableAction(log.action)}</span></td>
              <td><strong>{log.resource.replaceAll("_", " ")}</strong>{log.resourceId && <small>{log.resourceId}</small>}</td>
              <td className="audit-details">{log.details || "—"}</td>
              <td className="audit-ip">{log.ipAddress || "—"}</td>
            </tr>)}
            {loading && <tr><td className="audit-empty" colSpan={6}>Loading audit logs…</td></tr>}
            {!loading && !logs.length && !error && <tr><td className="audit-empty" colSpan={6}>No logs found for the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {!loading && !error && totalPages > 1 && <div className="audit-pagination">
        <button className="btn btn-secondary" type="button" disabled={applied.page <= 1} onClick={() => setApplied(current => ({ ...current, page: current.page - 1 }))}>Previous</button>
        <span>Page <strong>{applied.page}</strong> of <strong>{totalPages}</strong></span>
        <button className="btn btn-secondary" type="button" disabled={applied.page >= totalPages} onClick={() => setApplied(current => ({ ...current, page: current.page + 1 }))}>Next</button>
      </div>}
    </section>
  </div>;
}
