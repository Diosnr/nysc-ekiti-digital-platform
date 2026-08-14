"use client";

import { FormEvent, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch, getAccessToken } from "@/lib/staff-api";
import { parseCsv, REGISTRATION_CSV_TEMPLATE } from "@/lib/csv";

type PcmHit = {
  id: string;
  callUpNumber: string;
  fullName: string;
  stateCode?: string | null;
  ppaName?: string | null;
  ppaAddress?: string | null;
  lgiName?: string | null;
  lgiPhone?: string | null;
  ziName?: string | null;
  ziPhone?: string | null;
};

type Officer = {
  id: string;
  name: string;
  phone: string;
  lgaCode: string | null;
  zoneCode: string | null;
};

const CHUNK = 250;

export default function RegistrationCommitteePage() {
  const [q, setQ] = useState("");
  const [pcm, setPcm] = useState<PcmHit | null>(null);
  const [lgis, setLgis] = useState<Officer[]>([]);
  const [zis, setZis] = useState<Officer[]>([]);
  const [form, setForm] = useState({
    stateCode: "",
    ppaName: "",
    ppaAddress: "",
    lgiName: "",
    lgiPhone: "",
    ziName: "",
    ziPhone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const [lRes, zRes] = await Promise.all([
        staffFetch("/api/registration/officers?type=lgi"),
        staffFetch("/api/registration/officers?type=zi"),
      ]);
      if (lRes.ok) {
        const d = await lRes.json();
        setLgis(d.officers ?? []);
      }
      if (zRes.ok) {
        const d = await zRes.json();
        setZis(d.officers ?? []);
      }
    })();
  }, []);

  async function download(type: "skills" | "special-status") {
    setError(null);
    const token = getAccessToken();
    const res = await fetch(`/api/registration/export?type=${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      type === "skills"
        ? "skilled-corps-members.csv"
        : "special-status-corps-members.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate() {
    const blob = new Blob([REGISTRATION_CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "registration-bulk-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onBulkFile(file: File | null) {
    if (!file) return;
    setError(null);
    setMsg(null);
    setImportBusy(true);
    setImportProgress("Reading file…");
    try {
      const text = await file.text();
      const { rows } = parseCsv(text);
      if (!rows.length) {
        setError("CSV has no data rows");
        return;
      }
      let jobId: string | null = null;
      let created = 0;
      let updated = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const done = i + CHUNK >= rows.length;
        setImportProgress(
          `Uploading ${Math.min(i + CHUNK, rows.length)} / ${rows.length}…`
        );
        const res = await staffFetch("/api/registration/import", {
          method: "POST",
          body: JSON.stringify({
            jobId,
            fileName: file.name,
            totalRows: rows.length,
            rows: chunk,
            done,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Import chunk failed");
          return;
        }
        jobId = data.jobId;
        created = data.job?.createdCount ?? created;
        updated = data.job?.updatedCount ?? updated;
      }
      setMsg(
        `Import complete · created ${created} · updated ${updated} · ${rows.length} rows processed`
      );
      setImportProgress(null);
    } catch {
      setError("Could not read or upload CSV");
    } finally {
      setImportBusy(false);
    }
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setPcm(null);
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await staffFetch(
        `/api/pcm?q=${encodeURIComponent(q.trim())}&callUp=${encodeURIComponent(q.trim())}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        return;
      }
      const list = (data.pcms ?? []) as PcmHit[];
      if (!list.length) {
        setError("No PCM found");
        return;
      }
      const hit =
        list.find((p) => p.callUpNumber.toLowerCase() === q.trim().toLowerCase()) ??
        list[0];
      const det = await staffFetch(`/api/pcm/${hit.id}`);
      const full = await det.json();
      const p = (full.pcm ?? hit) as PcmHit;
      setPcm(p);
      setForm({
        stateCode: p.stateCode || "",
        ppaName: p.ppaName || "",
        ppaAddress: p.ppaAddress || "",
        lgiName: p.lgiName || "",
        lgiPhone: p.lgiPhone || "",
        ziName: p.ziName || "",
        ziPhone: p.ziPhone || "",
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function selectLgi(name: string) {
    const o = lgis.find((x) => x.name === name);
    setForm((f) => ({
      ...f,
      lgiName: name,
      lgiPhone: o?.phone || f.lgiPhone,
    }));
  }

  function selectZi(name: string) {
    const o = zis.find((x) => x.name === name);
    setForm((f) => ({
      ...f,
      ziName: name,
      ziPhone: o?.phone || f.ziPhone,
    }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!pcm) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/pcm/${pcm.id}/registration`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setMsg("Registration details saved");
      setPcm(data.pcm);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">Registration Committee</h1>
      <p className="mt-1 text-sm text-slate-600">
        Exports, single-record PPA/LGI/ZI capture, and bulk CSV upsert for large rolls.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {msg && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {msg}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void download("skills")}
          className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white"
        >
          Download skilled (CSV)
        </button>
        <button
          type="button"
          onClick={() => void download("special-status")}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          Download special status (CSV)
        </button>
        <button
          type="button"
          onClick={downloadTemplate}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          Bulk template
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-nysc-green/40 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Bulk upload</h2>
        <p className="mt-1 text-xs text-slate-500">
          Upsert by call-up number. Existing records: fill empty identity fields; apply
          registration columns when present. New rows need callUpNumber + fullName. Chunked
          for large files (100k+).
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={importBusy}
          className="mt-3 block w-full text-sm"
          onChange={(e) => void onBulkFile(e.target.files?.[0] ?? null)}
        />
        {importProgress && (
          <p className="mt-2 text-sm font-medium text-nysc-green">{importProgress}</p>
        )}
      </div>

      <form onSubmit={search} className="mt-8 flex flex-wrap gap-2">
        <input
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search call-up or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
        >
          {loading ? "…" : "Find PCM"}
        </button>
      </form>

      {pcm && (
        <form
          onSubmit={save}
          className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <p className="text-lg font-bold text-slate-900">{pcm.fullName}</p>
            <p className="font-mono text-sm text-slate-600">{pcm.callUpNumber}</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">State code</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.stateCode}
              onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">PPA name</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.ppaName}
              onChange={(e) => setForm({ ...form, ppaName: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-slate-500">PPA address</label>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.ppaAddress}
              onChange={(e) => setForm({ ...form, ppaAddress: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">LGI name</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.lgiName}
              onChange={(e) => selectLgi(e.target.value)}
            >
              <option value="">Select LGI…</option>
              {lgis.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                  {o.lgaCode ? ` (${o.lgaCode})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">LGI phone</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.lgiPhone}
              onChange={(e) => setForm({ ...form, lgiPhone: e.target.value })}
            >
              <option value="">Select phone…</option>
              {[...new Set(lgis.map((o) => o.phone).filter(Boolean))].map((ph) => (
                <option key={ph} value={ph}>
                  {ph}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">ZI name</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.ziName}
              onChange={(e) => selectZi(e.target.value)}
            >
              <option value="">Select ZI…</option>
              {zis.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                  {o.zoneCode ? ` (${o.zoneCode})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">ZI phone</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.ziPhone}
              onChange={(e) => setForm({ ...form, ziPhone: e.target.value })}
            >
              <option value="">Select phone…</option>
              {[...new Set(zis.map((o) => o.phone).filter(Boolean))].map((ph) => (
                <option key={ph} value={ph}>
                  {ph}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save registration details"}
            </button>
          </div>
        </form>
      )}
    </StaffShell>
  );
}
