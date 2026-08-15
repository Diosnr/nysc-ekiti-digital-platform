"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { staffFetch } from "@/lib/staff-api";

type PcmBrief = {
  id: string;
  fullName: string;
  callUpNumber: string;
  gender?: string | null;
  photographUrl?: string | null;
  stateCode?: string | null;
  status?: string;
};

type Bed = {
  id: string;
  code: string;
  status: "VACANT" | "OCCUPIED" | "BLOCKED";
  assignedAt?: string | null;
  assignedByName?: string | null;
  note?: string | null;
  pcm?: PcmBrief | null;
};

type Hostel = {
  id: string;
  name: string;
  genderRestriction: "MALE" | "FEMALE" | "MIXED";
  capacity: number;
  isActive: boolean;
  notes?: string | null;
  bedCount: number;
  vacant: number;
  occupied: number;
  blocked: number;
  beds: Bed[];
};

type Summary = {
  hostels: number;
  beds: number;
  vacant: number;
  occupied: number;
  blocked: number;
};

export default function AccommodationPage() {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedHostelId, setSelectedHostelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  // Assign panel
  const [q, setQ] = useState("");
  const [pcmHit, setPcmHit] = useState<PcmBrief | null>(null);
  const [selectedBedId, setSelectedBedId] = useState("");
  const [busy, setBusy] = useState(false);

  // Create hostel
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCapacity, setNewCapacity] = useState("40");
  const [newGender, setNewGender] = useState<"MALE" | "FEMALE" | "MIXED">("MIXED");
  const [newPrefix, setNewPrefix] = useState("B");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await staffFetch("/api/accommodation/hostels");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load hostels");
        return;
      }
      setHostels(data.hostels ?? []);
      setSummary(data.summary ?? null);
      if (!selectedHostelId && data.hostels?.[0]) {
        setSelectedHostelId(data.hostels[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedHostelId]);

  useEffect(() => {
    void load();
    staffFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) return;
      const me = await res.json();
      const roles: string[] = me.roles ?? [];
      const perms: string[] = me.permissions ?? [];
      setCanManage(
        perms.includes("*") ||
          perms.includes("hostel:manage") ||
          roles.some((r) => r.toLowerCase().includes("accommodation"))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = hostels.find((h) => h.id === selectedHostelId) ?? null;

  async function searchPcm(e: FormEvent) {
    e.preventDefault();
    setPcmHit(null);
    setError(null);
    if (!q.trim()) return;
    setBusy(true);
    try {
      const res = await staffFetch(
        `/api/pcm?q=${encodeURIComponent(q.trim())}&callUp=${encodeURIComponent(q.trim())}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        return;
      }
      const list = (data.pcms ?? []) as PcmBrief[];
      if (!list.length) {
        setError("No record found");
        return;
      }
      const exact = list.find(
        (p) => p.callUpNumber.toLowerCase() === q.trim().toLowerCase()
      );
      setPcmHit(exact ?? list[0]);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    if (!pcmHit || !selectedBedId) {
      setError("Select a corps member and a vacant bed");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch("/api/accommodation/assign", {
        method: "POST",
        body: JSON.stringify({ pcmId: pcmHit.id, bedId: selectedBedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Assignment failed");
        return;
      }
      setMsg(
        `Assigned ${data.pcm?.fullName ?? pcmHit.fullName} → ${data.bed?.hostelName} / ${data.bed?.code}`
      );
      setPcmHit(null);
      setQ("");
      setSelectedBedId("");
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function release(bedId: string) {
    if (!confirm("Release this bed?")) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch("/api/accommodation/assign", {
        method: "DELETE",
        body: JSON.stringify({ bedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Release failed");
        return;
      }
      setMsg("Bed released");
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function createHostel(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch("/api/accommodation/hostels", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          capacity: Number(newCapacity),
          genderRestriction: newGender,
          bedPrefix: newPrefix,
          createBeds: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create hostel");
        return;
      }
      setMsg(`Hostel “${newName}” created with ${newCapacity} beds`);
      setShowCreate(false);
      setNewName("");
      setNewCapacity("40");
      await load();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const vacantBeds =
    selected?.beds.filter((b) => b.status === "VACANT") ?? [];

  return (
    <StaffShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accommodation</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Hostel and bed allocation. Assign only after security check-in. Gender rules
            are enforced per hostel.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-full bg-nysc-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            {showCreate ? "Cancel" : "+ New hostel"}
          </button>
        )}
      </div>

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

      {summary && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ["Hostels", summary.hostels, "slate"],
              ["Total beds", summary.beds, "slate"],
              ["Vacant", summary.vacant, "green"],
              ["Occupied", summary.occupied, "amber"],
              ["Blocked", summary.blocked, "rose"],
            ] as const
          ).map(([label, value, tone]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  tone === "green"
                    ? "text-emerald-800"
                    : tone === "amber"
                      ? "text-amber-900"
                      : tone === "rose"
                        ? "text-rose-800"
                        : "text-slate-900"
                }`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {showCreate && canManage && (
        <form
          onSubmit={createHostel}
          className="mt-6 max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-semibold text-slate-900">Create hostel</h2>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Name *</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              placeholder="e.g. Hostel A — Male"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Capacity *
              </label>
              <input
                type="number"
                min={1}
                max={500}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Bed code prefix
              </label>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={newPrefix}
                onChange={(e) => setNewPrefix(e.target.value)}
                placeholder="B"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Gender</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={newGender}
              onChange={(e) => setNewGender(e.target.value as typeof newGender)}
            >
              <option value="MALE">Male only</option>
              <option value="FEMALE">Female only</option>
              <option value="MIXED">Mixed</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-nysc-green py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create hostel & beds"}
          </button>
        </form>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Hostel list */}
        <div className="space-y-2 lg:col-span-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Hostels
          </h2>
          {loading && !hostels.length ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200" />
              ))}
            </div>
          ) : hostels.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              No hostels yet.{canManage ? " Create one to start allocating beds." : ""}
            </p>
          ) : (
            <ul className="space-y-2">
              {hostels.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedHostelId(h.id)}
                    className={`w-full rounded-xl border p-4 text-left shadow-sm transition ${
                      selectedHostelId === h.id
                        ? "border-nysc-green bg-emerald-50/50 ring-1 ring-nysc-green/30"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900">{h.name}</p>
                      {!h.isActive && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {h.genderRestriction} · {h.occupied}/{h.bedCount || h.capacity} occupied
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-nysc-green"
                        style={{
                          width: `${
                            h.bedCount
                              ? Math.min(100, (h.occupied / h.bedCount) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Beds + assign */}
        <div className="space-y-6 lg:col-span-2">
          {selected ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                    <p className="text-sm text-slate-500">
                      {selected.genderRestriction} · {selected.vacant} vacant ·{" "}
                      {selected.occupied} occupied
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {selected.beds.map((b) => {
                    const tone =
                      b.status === "VACANT"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : b.status === "OCCUPIED"
                          ? "border-amber-200 bg-amber-50 text-amber-950"
                          : "border-slate-200 bg-slate-100 text-slate-500";
                    return (
                      <button
                        key={b.id}
                        type="button"
                        title={
                          b.pcm
                            ? `${b.code}: ${b.pcm.fullName}`
                            : `${b.code}: ${b.status}`
                        }
                        onClick={() => {
                          if (b.status === "VACANT") setSelectedBedId(b.id);
                          else if (b.status === "OCCUPIED") void release(b.id);
                        }}
                        className={`rounded-lg border px-1 py-2 text-center text-[11px] font-semibold transition ${
                          selectedBedId === b.id
                            ? "ring-2 ring-nysc-green " + tone
                            : tone
                        }`}
                      >
                        {b.code}
                        {b.pcm && (
                          <span className="mt-0.5 block truncate text-[9px] font-normal opacity-80">
                            {b.pcm.fullName.split(" ")[0]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] text-slate-400">
                  Click a vacant bed to select for assignment · click an occupied bed to
                  release
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Assign bed</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Search by call-up, state code or name. Member must be checked in.
                </p>
                <form onSubmit={searchPcm} className="mt-3 flex flex-wrap gap-2">
                  <input
                    className="min-w-[12rem] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Call-up, state code or name"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
                  >
                    Find
                  </button>
                </form>

                {pcmHit && (
                  <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                    <PcmPhoto
                      url={pcmHit.photographUrl}
                      alt={pcmHit.fullName}
                      sizeClass="h-16 w-16"
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold text-slate-900">{pcmHit.fullName}</p>
                      <p className="font-mono text-xs text-slate-600">
                        {pcmHit.callUpNumber}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {pcmHit.gender || "Gender —"}
                        {pcmHit.stateCode ? ` · ${pcmHit.stateCode}` : " · PCM"}
                        {pcmHit.status ? ` · ${pcmHit.status}` : ""}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    Vacant bed in {selected.name}
                  </label>
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                  >
                    <option value="">Select bed…</option>
                    {vacantBeds.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  disabled={busy || !pcmHit || !selectedBedId}
                  onClick={() => void assign()}
                  className="mt-4 w-full rounded-md bg-nysc-green py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {busy ? "Working…" : "Assign bed"}
                </button>
              </div>

              {/* Occupied list */}
              {selected.beds.some((b) => b.status === "OCCUPIED") && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Occupied beds
                  </h3>
                  <ul className="mt-3 divide-y divide-slate-100">
                    {selected.beds
                      .filter((b) => b.status === "OCCUPIED" && b.pcm)
                      .map((b) => (
                        <li
                          key={b.id}
                          className="flex items-center gap-3 py-3"
                        >
                          <PcmPhoto
                            url={b.pcm!.photographUrl}
                            alt=""
                            sizeClass="h-10 w-10"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {b.pcm!.fullName}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500">
                              {b.code} · {b.pcm!.callUpNumber}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void release(b.id)}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Release
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            !loading && (
              <p className="text-sm text-slate-500">Select a hostel to view beds.</p>
            )
          )}
        </div>
      </div>
    </StaffShell>
  );
}
