"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export function UserManagementClient({
  users,
  canManageUsers,
}: {
  users: UserRow[];
  canManageUsers: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.CARE_MANAGER);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json?.error?.message ?? "Failed to create user");
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      setMessage(`Created user ${json.user.email} (${json.user.role}).`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleUserActive(userId: string, active: boolean) {
    setBusy(true);
    try {
      await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, active: !active }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      {canManageUsers && (
        <form
          onSubmit={handleCreateUser}
          className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
        >
          <div className="text-xs font-semibold text-slate-800">
            Provision New Tenant User (Requires <code>users.manage</code>)
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Work Email"
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
            <input
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Initial Password (10+ chars)"
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              {Object.values(UserRole).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
            >
              Create User
            </button>
            {message && <span className="text-xs text-slate-700">{message}</span>}
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              {canManageUsers && <th className="px-3 py-2 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2 font-medium text-slate-900">{u.name}</td>
                <td className="px-3 py-2 font-mono text-slate-600">{u.email}</td>
                <td className="px-3 py-2 font-semibold text-teal-800">{u.role}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      u.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {u.active ? "Active" : "Disabled"}
                  </span>
                </td>
                {canManageUsers && (
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleUserActive(u.id, u.active)}
                      className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
