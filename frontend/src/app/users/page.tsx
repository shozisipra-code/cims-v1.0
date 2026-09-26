"use client";
import { FormEvent, useEffect, useState } from "react";
import { LayoutGrid, ShieldCheck, UserCheck, UserX, type LucideIcon } from "lucide-react";
import { CimsSelect } from "@/components/ui/CimsSelect";
import { useRole } from "@/components/layout/RoleContext";
import { CurrentUser, PermissionKey } from "@/types";
import { defaultPermissions, permissionOptions, roleLabels } from "@/lib/permissions";

type ManagedUser = CurrentUser & { department?: string; phone?: string };
const roles = ["RECEPTIONIST", "DOCTOR", "SUPER_USER", "PHARMACIST", "ENGINEER"] as const;

export default function UsersPage() {
  const { currentUser } = useRole();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "RECEPTIONIST" as typeof roles[number], permissions: [...defaultPermissions.RECEPTIONIST] });
  const [message, setMessage] = useState("");
  const headers = { "Content-Type": "application/json", "x-cims-user-id": currentUser.id };
  async function load() { const response = await fetch("/api/users", { headers }); if (response.ok) setUsers(await response.json()); }
  useEffect(() => { load(); }, [currentUser.id]);
  function changeRole(role: typeof roles[number]) { setForm(value => ({ ...value, role, permissions: [...defaultPermissions[role]] })); }
  function togglePermission(key: PermissionKey) { if (form.role === "SUPER_USER" || form.role === "ENGINEER" || key === "audit_log") return; setForm(value => ({ ...value, permissions: value.permissions.includes(key) ? value.permissions.filter(item => item !== key) : [...value.permissions, key] })); }
  async function create(event: FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/users", { method: "POST", headers, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error || "Unable to create user.");
    setUsers(value => [result, ...value]); setMessage(`${result.name} can now sign in.`);
    setForm({ name: "", username: "", password: "", role: "RECEPTIONIST", permissions: [...defaultPermissions.RECEPTIONIST] });
  }
  async function update(id: string, data: object) { const response = await fetch("/api/users", { method: "PATCH", headers, body: JSON.stringify({ id, ...data }) }); if (response.ok) { const updated = await response.json(); setUsers(value => value.map(user => user.id === id ? updated : user)); } }
  const activeUsers = users.filter(user => user.isActive !== false).length;
  const adminUsers = users.filter(user => user.role === "SUPER_USER" || user.role === "ENGINEER").length;
  const panelGrants = users.reduce((total, user) => total + user.permissions.length, 0);
  const inactiveUsers = users.length - activeUsers;
  return <div className="users-page space-y-5">
    <div className="page-heading"><div><h1>User Management</h1></div></div>
    <section className="users-stats">
      <Stat icon={UserCheck} label="Active users" value={activeUsers} note="Can sign in now" />
      <Stat icon={ShieldCheck} label="Admins" value={adminUsers} note="Superuser / Engineer" alert />
      <Stat icon={LayoutGrid} label="Panel grants" value={panelGrants} note="Assigned access entries" />
      <Stat icon={UserX} label="Deactivated" value={inactiveUsers} note="Inactive accounts" muted />
    </section>
    <section className="card users-create"><div className="card-header"><h2>Create User</h2><span className="users-role-badge">{roleLabels[form.role]}</span></div><form onSubmit={create} className="users-form">
      <label>Full name<input className="input" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>Username<input className="input" required type="text" minLength={3} maxLength={40} pattern="[A-Za-z0-9._-]+" title="Use letters, numbers, dots, dashes, or underscores" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /></label>
      <label>Password<input className="input" required minLength={6} type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>
      <label>Role<CimsSelect value={form.role} onChange={value => changeRole(value as typeof form.role)} options={roles.map(value => ({ value, label: roleLabels[value] }))} /></label>
      <div className="users-submit">{message && <p>{message}</p>}<button className="btn btn-primary" type="submit">Create User</button></div>
      <fieldset className="permission-fieldset"><legend>Module permissions</legend><div className="permission-grid">{permissionOptions.map(option => { const fullAccess = form.role === "SUPER_USER" || form.role === "ENGINEER"; const selected = fullAccess || form.permissions.includes(option.key); return <label key={option.key} className={selected ? "permission-chip selected" : "permission-chip"}><input type="checkbox" checked={selected} disabled={fullAccess || option.key === "audit_log"} onChange={() => togglePermission(option.key)} />{option.label}</label>; })}</div></fieldset>
    </form></section>
    <section className="card users-list"><div className="card-header"><h2>Active Users</h2><span className="users-role-badge">{users.length} users</span></div><div className="table-scroll"><table><thead><tr><th>User</th><th>Role</th><th>Workspace</th><th>Panel access</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map(user => { const protectedEngineer = user.role === "ENGINEER" && currentUser.role !== "ENGINEER"; return <tr key={user.id}><td><div className="users-identity"><span className="users-avatar">{user.name.charAt(0).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.username || user.email.split("@")[0]}</small></span></div></td><td><CimsSelect value={user.role} ariaLabel={`Role for ${user.name}`} disabled={user.id === currentUser.id || protectedEngineer} onChange={role => update(user.id, { role, permissions: defaultPermissions[role as keyof typeof defaultPermissions] })} options={roles.map(value => ({ value, label: roleLabels[value] }))} /></td><td>{user.department || "Main clinic"}</td><td><div className="access-list editable">{permissionOptions.map(option => { const fullAccess = user.role === "SUPER_USER" || user.role === "ENGINEER"; const selected = fullAccess || user.permissions.includes(option.key); return <button type="button" key={option.key} className={selected ? "selected" : ""} disabled={fullAccess || protectedEngineer || option.key === "audit_log"} onClick={() => update(user.id, { permissions: selected ? user.permissions.filter(key => key !== option.key) : [...user.permissions, option.key] })}>{option.label}</button>; })}</div></td><td><span className={user.isActive === false ? "status-pill inactive" : "status-pill active"}>{user.isActive === false ? "Inactive" : "Active"}</span></td><td><button className="btn btn-secondary" disabled={user.id === currentUser.id || protectedEngineer} onClick={() => update(user.id, { isActive: user.isActive === false })}>{user.isActive === false ? "Reactivate" : "Deactivate"}</button></td></tr>; })}</tbody></table></div></section>
  </div>;
}

function Stat({ icon: Icon, label, value, note, alert, muted }: { icon: LucideIcon; label: string; value: number; note: string; alert?: boolean; muted?: boolean }) {
  return <div className={`stat-card ${alert ? "danger" : ""} ${muted ? "muted" : ""}`}><div className="stat-label">{label}<Icon size={17} /></div><div className="stat-value">{value}</div><div className="stat-sub">{note}</div></div>;
}
