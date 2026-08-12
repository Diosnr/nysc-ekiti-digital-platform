"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

type Log = {
  id: string;
  actorEmail: string | null;
  actorRoleAtTime: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  ip: string | null;
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    staffFetch("/api/admin/audit?limit=100").then(async (res) => {
      if (res.status === 403) {
        setError("You need audit:read permission.");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      }
    });
  }, []);

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>
      <p className="mt-1 text-sm text-slate-600">
        Recent sensitive actions (login, role changes, user creates, and more as modules grow).
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No audit entries yet.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {new Date(l.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{l.actorEmail ?? "—"}</div>
                  <div className="text-xs text-slate-500">{l.actorRoleAtTime}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{l.action}</td>
                <td className="px-4 py-3 text-slate-600">
                  {l.entityType ? `${l.entityType} ${l.entityId?.slice(0, 8) ?? ""}` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{l.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
