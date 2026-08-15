"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { staffFetch } from "@/lib/staff-api";

type RoleFlags = {
  nurse: boolean;
  doctor: boolean;
  pharmacist: boolean;
  super: boolean;
};

type PcmBrief = {
  id: string;
  fullName: string;
  callUpNumber: string;
  stateCode?: string | null;
  gender?: string | null;
  photographUrl?: string | null;
  status?: string;
};

type Vital = {
  id: string;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  pulse?: number | null;
  temperatureC?: number | null;
  respiratoryRate?: number | null;
  weightKg?: number | null;
  spo2?: number | null;
  note?: string | null;
  recordedByName?: string | null;
  recordedAt: string;
};

type Drug = {
  id: string;
  drugName: string;
  dose?: string | null;
  quantity?: string | null;
  instructions?: string | null;
  dispensedByName?: string | null;
  dispensedAt: string;
};

type Encounter = {
  id: string;
  status: "OPEN" | "CLOSED";
  chiefComplaint?: string | null;
  diagnosis?: string | null;
  doctorNote?: string | null;
  openedByName?: string | null;
  openedAt: string;
  attendedByDoctorName?: string | null;
  attendedAt?: string | null;
  closedAt?: string | null;
  pcm: PcmBrief;
  vitals?: Vital[];
  drugs?: Drug[];
  latestVital?: Vital | null;
  recentDrugs?: Drug[];
};

export default function ClinicPage() {
  const [roles, setRoles] = useState<RoleFlags>({
    nurse: false,
    doctor: false,
    pharmacist: false,
    super: false,
  });
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"open" | "closed" | "new">("open");
  const [list, setList] = useState<Encounter[]>([]);
  const [selected, setSelected] = useState<Encounter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Find member
  const [q, setQ] = useState("");
  const [pcmHit, setPcmHit] = useState<PcmBrief | null>(null);
  const [complaint, setComplaint] = useState("");

  // Forms
  const [vitals, setVitals] = useState({
    bpSystolic: "",
    bpDiastolic: "",
    pulse: "",
    temperatureC: "",
    respiratoryRate: "",
    weightKg: "",
    spo2: "",
    note: "",
  });
  const [diagnosis, setDiagnosis] = useState("");
  const [doctorNote, setDoctorNote] = useState("");
  const [drug, setDrug] = useState({
    drugName: "",
    dose: "",
    quantity: "",
    instructions: "",
  });

  useEffect(() => {
    staffFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) {
        setAllowed(false);
        return;
      }
      const me = await res.json();
      const r: string[] = me.roles ?? [];
      const p: string[] = me.permissions ?? [];
      const superA =
        p.includes("*") || r.some((x) => x.toLowerCase() === "super admin");
      const clinic =
        superA ||
        p.includes("camp:clinic") ||
        r.some((x) =>
          ["clinic", "doctor", "nurse", "pharmacist"].some((k) =>
            x.toLowerCase().includes(k)
          )
        );
      setAllowed(clinic);
      setRoles({
        super: superA,
        nurse: superA || r.some((x) => x.toLowerCase().includes("nurse")),
        doctor:
          superA ||
          r.some(
            (x) =>
              x.toLowerCase().includes("doctor") ||
              x.toLowerCase().includes("head of clinic")
          ),
        pharmacist:
          superA || r.some((x) => x.toLowerCase().includes("pharmacist")),
      });
    });
  }, []);

  const loadList = useCallback(async () => {
    if (tab === "new") return;
    setLoading(true);
    setError(null);
    try {
      const res = await staffFetch(
        `/api/clinic/encounters?status=${tab === "open" ? "OPEN" : "CLOSED"}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load encounters");
        return;
      }
      setList(data.encounters ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (allowed) void loadList();
  }, [allowed, loadList]);

  async function searchMember(e: FormEvent) {
    e.preventDefault();
    setPcmHit(null);
    setError(null);
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
      const list = (data.pcms ?? []) as PcmBrief[];
      if (!list.length) {
        setError("No corps member found");
        return;
      }
      const exact = list.find(
        (p) =>
          p.callUpNumber.toLowerCase() === q.trim().toLowerCase() ||
          (p.stateCode || "").toLowerCase() === q.trim().toLowerCase()
      );
      setPcmHit(exact ?? list[0]);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function openEncounter() {
    if (!pcmHit) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch("/api/clinic/encounters", {
        method: "POST",
        body: JSON.stringify({
          pcmId: pcmHit.id,
          chiefComplaint: complaint || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not open encounter");
        return;
      }
      setMsg("Encounter opened");
      setPcmHit(null);
      setQ("");
      setComplaint("");
      setTab("open");
      setSelected(data.encounter);
      await openDetail(data.encounter.id);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await staffFetch(`/api/clinic/encounters/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load chart");
        return;
      }
      setSelected(data.encounter);
      setDiagnosis(data.encounter.diagnosis || "");
      setDoctorNote(data.encounter.doctorNote || "");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function saveVitals() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/clinic/encounters/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "vitals",
          bpSystolic: vitals.bpSystolic || undefined,
          bpDiastolic: vitals.bpDiastolic || undefined,
          pulse: vitals.pulse || undefined,
          temperatureC: vitals.temperatureC || undefined,
          respiratoryRate: vitals.respiratoryRate || undefined,
          weightKg: vitals.weightKg || undefined,
          spo2: vitals.spo2 || undefined,
          note: vitals.note || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save vitals");
        return;
      }
      setMsg("Vitals recorded");
      setVitals({
        bpSystolic: "",
        bpDiastolic: "",
        pulse: "",
        temperatureC: "",
        respiratoryRate: "",
        weightKg: "",
        spo2: "",
        note: "",
      });
      await openDetail(selected.id);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function saveAttend() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/clinic/encounters/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "attend",
          diagnosis: diagnosis || undefined,
          doctorNote: doctorNote || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      setMsg("Doctor notes saved");
      await openDetail(selected.id);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function saveDrug() {
    if (!selected || !drug.drugName.trim()) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/clinic/encounters/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "dispense",
          ...drug,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not dispense");
        return;
      }
      setMsg("Drug recorded");
      setDrug({ drugName: "", dose: "", quantity: "", instructions: "" });
      await openDetail(selected.id);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function closeEncounter() {
    if (!selected || !confirm("Close this clinical encounter?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await staffFetch(`/api/clinic/encounters/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "close" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not close");
        return;
      }
      setMsg("Encounter closed");
      setSelected(null);
      await loadList();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (allowed === false) {
    return (
      <StaffShell>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-bold text-red-900">Access denied</h1>
          <p className="mt-2 text-sm text-red-800">
            Patient / clinical records are classified. Only clinic staff (nurse, doctor,
            pharmacist, head of clinic) or Super Admin may open this desk.
          </p>
        </div>
      </StaffShell>
    );
  }

  if (allowed === null) {
    return (
      <StaffShell>
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      </StaffShell>
    );
  }

  return (
    <StaffShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Camp Clinic</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Classified patient data · Nurses (vitals) · Doctors (attend) · Pharmacists
            (drugs). Applies to all corps members on the roll.
          </p>
        </div>
        <p className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200">
          Restricted · audited
        </p>
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

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["open", "Open cases"],
            ["closed", "Closed"],
            ["new", "New encounter"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setSelected(null);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === id
                ? "bg-nysc-green text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "new" && (
        <div className="mt-6 max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Open encounter</h2>
          <p className="text-xs text-slate-500">
            Search any CM / PCM on the roll (state code, call-up or name).
          </p>
          <form onSubmit={searchMember} className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="State code, call-up or name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
            >
              Find
            </button>
          </form>
          {pcmHit && (
            <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <PcmPhoto
                url={pcmHit.photographUrl}
                alt={pcmHit.fullName}
                sizeClass="h-14 w-14"
              />
              <div className="text-sm">
                <p className="font-semibold">{pcmHit.fullName}</p>
                <p className="font-mono text-xs text-slate-600">
                  {pcmHit.callUpNumber}
                  {pcmHit.stateCode ? ` · ${pcmHit.stateCode}` : " · PCM"}
                </p>
                <p className="text-xs text-slate-500">
                  {pcmHit.gender || "—"} · {pcmHit.status}
                </p>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Chief complaint
            </label>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Reason for visit"
            />
          </div>
          <button
            type="button"
            disabled={loading || !pcmHit}
            onClick={() => void openEncounter()}
            className="w-full rounded-md bg-nysc-green py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Open clinical encounter
          </button>
        </div>
      )}

      {(tab === "open" || tab === "closed") && !selected && (
        <div className="mt-6">
          {loading && !list.length ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-200" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-slate-500">No encounters in this list.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {list.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => void openDetail(e.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <PcmPhoto
                      url={e.pcm.photographUrl}
                      alt=""
                      sizeClass="h-11 w-11"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{e.pcm.fullName}</p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {e.pcm.callUpNumber}
                        {e.pcm.stateCode ? ` · ${e.pcm.stateCode}` : ""}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-600">
                        {e.chiefComplaint || "No complaint noted"}
                        {" · "}
                        {new Date(e.openedAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        e.status === "OPEN"
                          ? "bg-amber-50 text-amber-900"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {e.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected && (
        <div className="mt-6 space-y-4">
          <button
            type="button"
            className="text-sm text-slate-500"
            onClick={() => {
              setSelected(null);
              void loadList();
            }}
          >
            ← Back to list
          </button>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-4">
              <PcmPhoto
                url={selected.pcm.photographUrl}
                alt={selected.pcm.fullName}
                sizeClass="h-20 w-20"
              />
              <div>
                <h2 className="text-lg font-bold">{selected.pcm.fullName}</h2>
                <p className="font-mono text-sm text-slate-600">
                  {selected.pcm.callUpNumber}
                  {selected.pcm.stateCode ? ` · ${selected.pcm.stateCode}` : " · PCM"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selected.pcm.gender || "—"} · {selected.status} · Opened by{" "}
                  {selected.openedByName}
                </p>
                {selected.chiefComplaint && (
                  <p className="mt-2 text-sm text-slate-800">
                    <span className="font-medium">Complaint:</span>{" "}
                    {selected.chiefComplaint}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Vitals */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Vitals · Nursing
            </h3>
            {(selected.vitals ?? []).length > 0 && (
              <ul className="mt-3 space-y-2">
                {(selected.vitals ?? []).map((v) => (
                  <li
                    key={v.id}
                    className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700"
                  >
                    <span className="font-medium">
                      {new Date(v.recordedAt).toLocaleString()} · {v.recordedByName}
                    </span>
                    <span className="mt-1 block">
                      BP {v.bpSystolic ?? "—"}/{v.bpDiastolic ?? "—"} · Pulse{" "}
                      {v.pulse ?? "—"} · Temp {v.temperatureC ?? "—"}°C · RR{" "}
                      {v.respiratoryRate ?? "—"} · Wt {v.weightKg ?? "—"}kg · SpO₂{" "}
                      {v.spo2 ?? "—"}%
                    </span>
                    {v.note && <span className="mt-0.5 block text-slate-500">{v.note}</span>}
                  </li>
                ))}
              </ul>
            )}
            {selected.status === "OPEN" && (roles.nurse || roles.doctor) && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ["bpSystolic", "BP sys"],
                    ["bpDiastolic", "BP dia"],
                    ["pulse", "Pulse"],
                    ["temperatureC", "Temp °C"],
                    ["respiratoryRate", "RR"],
                    ["weightKg", "Weight kg"],
                    ["spo2", "SpO₂ %"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-[10px] font-semibold uppercase text-slate-400">
                      {label}
                    </label>
                    <input
                      className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={vitals[key]}
                      onChange={(e) =>
                        setVitals((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
                <div className="col-span-2 sm:col-span-4">
                  <input
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    placeholder="Vital note"
                    value={vitals.note}
                    onChange={(e) =>
                      setVitals((prev) => ({ ...prev, note: e.target.value }))
                    }
                  />
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void saveVitals()}
                  className="col-span-2 rounded-md bg-nysc-green py-2 text-sm font-semibold text-white sm:col-span-4"
                >
                  Save vitals
                </button>
              </div>
            )}
          </section>

          {/* Doctor */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Doctor · Attend
            </h3>
            {selected.attendedByDoctorName && (
              <p className="mt-2 text-xs text-slate-500">
                Last attended by {selected.attendedByDoctorName}
                {selected.attendedAt
                  ? ` · ${new Date(selected.attendedAt).toLocaleString()}`
                  : ""}
              </p>
            )}
            {selected.status === "OPEN" && roles.doctor ? (
              <div className="mt-3 space-y-2">
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Diagnosis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Clinical notes"
                  value={doctorNote}
                  onChange={(e) => setDoctorNote(e.target.value)}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void saveAttend()}
                  className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white"
                >
                  Save attendance
                </button>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-700">
                {selected.diagnosis && (
                  <p>
                    <span className="font-medium">Diagnosis:</span> {selected.diagnosis}
                  </p>
                )}
                {selected.doctorNote && (
                  <p className="mt-1 whitespace-pre-wrap">{selected.doctorNote}</p>
                )}
                {!selected.diagnosis && !selected.doctorNote && (
                  <p className="text-slate-400">No doctor notes yet.</p>
                )}
              </div>
            )}
          </section>

          {/* Pharmacy */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Pharmacy · Drugs given
            </h3>
            {(selected.drugs ?? []).length > 0 && (
              <ul className="mt-3 space-y-2">
                {(selected.drugs ?? []).map((d) => (
                  <li
                    key={d.id}
                    className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700"
                  >
                    <span className="font-semibold text-slate-900">{d.drugName}</span>
                    {d.dose ? ` · ${d.dose}` : ""}
                    {d.quantity ? ` · qty ${d.quantity}` : ""}
                    <span className="mt-0.5 block text-slate-500">
                      {d.dispensedByName} · {new Date(d.dispensedAt).toLocaleString()}
                    </span>
                    {d.instructions && (
                      <span className="block text-slate-500">{d.instructions}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {selected.status === "OPEN" && (roles.pharmacist || roles.doctor) && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                  placeholder="Drug name *"
                  value={drug.drugName}
                  onChange={(e) => setDrug((p) => ({ ...p, drugName: e.target.value }))}
                />
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Dose"
                  value={drug.dose}
                  onChange={(e) => setDrug((p) => ({ ...p, dose: e.target.value }))}
                />
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Quantity"
                  value={drug.quantity}
                  onChange={(e) => setDrug((p) => ({ ...p, quantity: e.target.value }))}
                />
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                  placeholder="Instructions"
                  value={drug.instructions}
                  onChange={(e) =>
                    setDrug((p) => ({ ...p, instructions: e.target.value }))
                  }
                />
                <button
                  type="button"
                  disabled={loading || !drug.drugName.trim()}
                  onClick={() => void saveDrug()}
                  className="rounded-md bg-nysc-green py-2 text-sm font-semibold text-white disabled:opacity-40 sm:col-span-2"
                >
                  Record drug given
                </button>
              </div>
            )}
          </section>

          {selected.status === "OPEN" && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void closeEncounter()}
              className="w-full rounded-md border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-800"
            >
              Close encounter
            </button>
          )}
        </div>
      )}
    </StaffShell>
  );
}
