"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, ClipboardCheck, Clock3, Pill, ReceiptText, RefreshCw, ShieldAlert, TicketCheck, X } from "lucide-react";
import { useRole } from "./RoleContext";

type WorkflowNotification = {
  id: string;
  type: string;
  audience: "QUEUE" | "RECEPTION" | "PHARMACY" | "BILLING";
  title: string;
  message: string;
  href?: string | null;
  createdAt: string;
};

type SecurityAlert = {
  id: string;
  username: string;
  ipAddress: string;
  failedCount: number;
  updatedAt: string;
};

type NotificationData = {
  workflowAlerts: WorkflowNotification[];
  securityAlerts: SecurityAlert[];
  isPrivileged: boolean;
  total: number;
};

const emptyData: NotificationData = { workflowAlerts: [], securityAlerts: [], isPrivileged: false, total: 0 };

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function workflowIcon(item: WorkflowNotification, size = 17) {
  if (item.audience === "PHARMACY") return <Pill size={size} />;
  if (item.audience === "BILLING") return <ReceiptText size={size} />;
  if (item.type === "CONSULTATION_COMPLETED") return <ClipboardCheck size={size} />;
  return <TicketCheck size={size} />;
}

export function NotificationPanel() {
  const { currentUser, ready } = useRole();
  const pathname = usePathname();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const seenAlertIds = useRef<Set<string> | null>(null);
  const previewTimer = useRef<number | null>(null);
  const [data, setData] = useState<NotificationData>(emptyData);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"workflow" | "security">("workflow");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<WorkflowNotification | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (!ready || !currentUser.id) return;
    if (showSpinner) setLoading(true);
    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
        headers: { "x-cims-user-id": currentUser.id },
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load notifications.");
      const rawWorkflowAlerts = Array.isArray(result.workflowAlerts)
        ? result.workflowAlerts
        : Array.isArray(result.tickets) ? result.tickets : [];
      const workflowAlerts: WorkflowNotification[] = rawWorkflowAlerts.map((item: Partial<WorkflowNotification>) => ({
        ...item,
        id: String(item.id || ""),
        type: item.type || "PATIENT_TICKET",
        audience: item.audience || "QUEUE",
        title: item.title || "Workflow update",
        message: item.message || "New clinic activity is available.",
        createdAt: item.createdAt || new Date().toISOString(),
      }));
      const securityAlerts = Array.isArray(result.securityAlerts) ? result.securityAlerts : [];
      const next: NotificationData = {
        workflowAlerts,
        securityAlerts,
        isPrivileged: Boolean(result.isPrivileged),
        total: workflowAlerts.length + securityAlerts.length,
      };
      if (seenAlertIds.current) {
        const latest = next.workflowAlerts.find(item => !seenAlertIds.current?.has(item.id));
        if (latest) {
          setPreview(latest);
          if (previewTimer.current) window.clearTimeout(previewTimer.current);
          previewTimer.current = window.setTimeout(() => setPreview(null), 7000);
        }
      }
      seenAlertIds.current = new Set(next.workflowAlerts.map(item => item.id));
      setData(next);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load notifications.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [currentUser.id, ready]);

  useEffect(() => {
    seenAlertIds.current = null;
    setData(emptyData);
    setTab("workflow");
    if (!ready) return;
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    const refresh = () => void load();
    window.addEventListener("cims:notifications-refresh", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("cims:notifications-refresh", refresh);
      if (previewTimer.current) window.clearTimeout(previewTimer.current);
    };
  }, [load, ready]);

  useEffect(() => { setOpen(false); setPreview(null); }, [pathname]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);

  async function update(action: string, id?: string) {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-cims-user-id": currentUser.id },
      body: JSON.stringify({ action, id }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "Unable to update notification.");
  }

  async function openAlert(item: WorkflowNotification) {
    setPreview(null);
    setData(current => ({ ...current, workflowAlerts: current.workflowAlerts.filter(row => row.id !== item.id), total: Math.max(0, current.total - 1) }));
    try { await update("READ_ALERT", item.id); } catch { void load(); }
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  async function dismissSecurity(id: string) {
    setData(current => ({ ...current, securityAlerts: current.securityAlerts.filter(row => row.id !== id), total: Math.max(0, current.total - 1) }));
    try { await update("READ_SECURITY", id); } catch { void load(); }
  }

  async function readAll() {
    const isSecurity = tab === "security";
    setData(current => isSecurity
      ? { ...current, total: Math.max(0, current.total - current.securityAlerts.length), securityAlerts: [] }
      : { ...current, total: Math.max(0, current.total - current.workflowAlerts.length), workflowAlerts: [] });
    try { await update(isSecurity ? "READ_ALL_SECURITY" : "READ_ALL_ALERTS"); } catch { void load(); }
  }

  const activeCount = tab === "workflow" ? data.workflowAlerts.length : data.securityAlerts.length;

  return <div className="notification-root" ref={rootRef}>
    <button type="button" className="topbar-circle notification-trigger" aria-label={`${data.total} unread notifications`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setOpen(value => !value); setPreview(null); if (!open) void load(true); }}>
      <Bell size={20} />
      {data.total > 0 && <span className="notification-badge">{data.total > 99 ? "99+" : data.total}</span>}
    </button>

    {preview && !open && <button type="button" className="notification-preview" onClick={() => void openAlert(preview)} aria-live="polite">
      <span className="notification-preview-icon">{workflowIcon(preview)}</span>
      <span><strong>{preview.title}</strong><small>{preview.message}</small></span>
      <X size={15} onClick={event => { event.stopPropagation(); setPreview(null); }} aria-label="Close preview" />
    </button>}

    {open && <section className="notification-panel" role="dialog" aria-label="Notifications">
      <div className="notification-header">
        <div className="notification-heading">
          <span className="notification-heading-icon"><Bell size={18} /></span>
          <span><strong>Notifications</strong><small>{data.total} active {data.total === 1 ? "alert" : "alerts"}</small></span>
        </div>
        <button type="button" className="notification-icon-button" onClick={() => void load(true)} aria-label="Refresh notifications"><RefreshCw size={16} className={loading ? "is-spinning" : ""} /></button>
      </div>
      <div className="notification-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "workflow"} className={tab === "workflow" ? "active" : ""} onClick={() => setTab("workflow")}>Workflow {data.workflowAlerts.length > 0 && <span>{data.workflowAlerts.length}</span>}</button>
        {data.isPrivileged && <button type="button" role="tab" aria-selected={tab === "security"} className={tab === "security" ? "active" : ""} onClick={() => setTab("security")}>Security {data.securityAlerts.length > 0 && <span>{data.securityAlerts.length}</span>}</button>}
      </div>
      <div className="notification-list">
        {error && <p className="notification-error" role="alert">{error}</p>}
        {!error && loading && activeCount === 0 && <p className="notification-empty">Refreshing notifications…</p>}
        {!error && !loading && activeCount === 0 && <div className="notification-empty"><Check size={28} strokeWidth={1.8} /><strong>No unread {tab === "workflow" ? "workflow updates" : "security alerts"}</strong><span>New activity will appear here automatically.</span></div>}
        {tab === "workflow" && data.workflowAlerts.map(item => <button type="button" className="notification-item" key={item.id} onClick={() => void openAlert(item)}>
          <span className={`notification-item-icon ticket ${item.audience.toLowerCase()}`}>{workflowIcon(item)}</span>
          <span className="notification-copy"><strong>{item.title}</strong><span>{item.message}</span><time>{timeAgo(item.createdAt)}</time></span>
        </button>)}
        {tab === "security" && data.securityAlerts.map(item => <div className="notification-item" key={item.id}>
          <span className="notification-item-icon security"><ShieldAlert size={17} /></span>
          <span className="notification-copy"><strong>{item.failedCount} failed sign-in attempts</strong><span>Account: {item.username}<br />IP: {item.ipAddress}</span><time>{timeAgo(item.updatedAt)}</time></span>
          <button type="button" className="notification-dismiss" aria-label="Dismiss security alert" onClick={() => void dismissSecurity(item.id)}><X size={15} /></button>
        </div>)}
      </div>
      <footer className="notification-footer">
        <span><Clock3 size={14} /> Refreshes every 8 sec</span>
        {activeCount > 0 ? <button type="button" onClick={() => void readAll()}><CheckCheck size={15} /> Mark all read <span aria-hidden="true">→</span></button> : <strong>Up to date</strong>}
      </footer>
    </section>}
  </div>;
}
