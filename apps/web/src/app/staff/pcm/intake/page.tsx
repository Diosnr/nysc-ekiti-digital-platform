"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";
import { formatReportingDate, toDateInputValue } from "@/lib/dates";
import { GENDERS, NIGERIA_STATES } from "@/lib/nigeria";

type Fields = {
  callUpNumber: string;
  fullName: string;
  gender: string;
  institution: string;
  deploymentState: string;
  campAddress: string;
  dateReporting: string;
  batchYear: string;
  photographUrl: string;
  verificationUrl?: string;
};

type CampOpt = { id: string; name: string; address: string };

const empty: Fields = {
  callUpNumber: "",
  fullName: "",
  gender: "",
  institution: "",
  deploymentState: "",
  campAddress: "",
  dateReporting: "",
  batchYear: "",
  photographUrl: "",
};

type Step = "scan" | "form" | "done";

function normalizeGender(v: string): string {
  const s = v.trim().toLowerCase();
  if (s === "m" || s === "male") return "Male";
  if (s === "f" || s === "female") return "Female";
  return "";
}

function normalizeState(v: string): string {
  const t = v.trim().toLowerCase();
  if (!t) return "";
  const hit = NIGERIA_STATES.find(
    (s) =>
      s.toLowerCase() === t ||
      s.toLowerCase().replace(/\s+/g, "") === t.replace(/\s+/g, "") ||
      (t.includes("abuja") && s === "FCT")
  );
  return hit ?? v.trim();
}

export default function StaffPcmIntakePage() {
  const [step, setStep] = useState<Step>("scan");
  const [form, setForm] = useState<Fields>(empty);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [qrRaw, setQrRaw] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [camps, setCamps] = useState<CampOpt[]>([]);
  /** Security desk should return to gate, never Registry */
  const [fromSecurity, setFromSecurity] = useState(false);

  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const handlingScan = useRef(false);
  const readerId = "staff-pcm-qr-reader";

  useEffect(() => {
    staffFetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) return;
        const me = await res.json();
        const roles: string[] = me.roles ?? [];
        const perms: string[] = me.permissions ?? [];
        const isSuper =
          perms.includes("*") ||
          roles.some((r) => r.toLowerCase() === "super admin");
        const isSec = roles.some((r) => r.toLowerCase().includes("security"));
        setFromSecurity(isSec && !isSuper);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    staffFetch("/api/camp-addresses")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setCamps(data.campAddresses ?? []);
      })
      .catch(() => {});
  }, []);

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
    } catch {
      /* ignore */
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  async function runQrPreview(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch("/api/pcm/intake", {
        method: "POST",
        body: JSON.stringify({
          mode: "qr",
          previewOnly: true,
          input: trimmed,
          qrPayload: trimmed,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not read QR / verify page");
        return;
      }
      if (json.alreadyRegistered) {
        setMsg(
          `Already registered: ${json.fields?.fullName} (${json.fields?.callUpNumber}). Use Security gate search to check in.`
        );
      }
      const f = json.fields ?? {};
      setForm({
        callUpNumber: f.callUpNumber ?? "",
        fullName: f.fullName ?? "",
        gender: normalizeGender(f.gender ?? ""),
        institution: f.institution ?? "",
        deploymentState: normalizeState(f.deploymentState ?? ""),
        campAddress: f.campAddress ?? "",
        dateReporting: f.dateReporting ?? "",
        batchYear: f.batchYear ?? "",
        photographUrl: f.photographUrl ?? "",
        verificationUrl: f.verificationUrl ?? trimmed,
      });
      setStep("form");
      await stopScanner();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
      handlingScan.current = false;
    }
  }

  async function startCamera() {
    setError(null);
    await stopScanner();
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          if (handlingScan.current) return;
          handlingScan.current = true;
          void runQrPreview(decoded);
        },
        () => {}
      );
    } catch (e) {
      setScanning(false);
      setError(
        e instanceof Error
          ? e.message
          : "Camera failed — use paste URL or manual intake"
      );
    }
  }

  function startManual() {
    void stopScanner();
    setForm(empty);
    setStep("form");
    setError(null);
    setMsg(null);
  }

  async function onPhotoFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (dataUrl.startsWith("data:image")) {
        setForm((f) => ({ ...f, photographUrl: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await staffFetch("/api/pcm/intake", {
        method: "POST",
        body: JSON.stringify({
          mode: form.verificationUrl ? "qr" : "manual",
          confirm: true,
          verificationUrl: form.verificationUrl,
          data: {
            callUpNumber: form.callUpNumber.trim(),
            fullName: form.fullName.trim(),
            gender: form.gender,
            institution: form.institution,
            deploymentState: form.deploymentState,
            campAddress: form.campAddress,
            dateReporting: form.dateReporting,
            batchYear: form.batchYear,
            photographUrl: form.photographUrl,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
      setCreatedId(json.pcm?.id ?? null);
      if (json.pcm?.photographUrl) {
        setForm((f) => ({ ...f, photographUrl: json.pcm.photographUrl }));
      }
      setStep("done");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const campSelectValue =
    camps.find((c) => c.address === form.campAddress)?.address ||
    (form.campAddress ? "__custom__" : "");

  return (
    <StaffShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PCM Intake</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gender, state, and camp address use controlled lists. Photo is required.
          </p>
        </div>
        <Link
          href={fromSecurity ? "/staff/security/checkin" : "/staff/pcm"}
          className="text-sm font-medium text-nysc-green hover:underline"
        >
          {fromSecurity ? "← Security gate" : "← Registry"}
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {msg && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {msg}
        </p>
      )}

      {step === "scan" && (
        <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
            <div id={readerId} className="min-h-[260px] w-full" />
          </div>
          <p className="text-center text-sm text-slate-600">
            {scanning
              ? "Scanning…"
              : loading
                ? "Loading NYSC data…"
                : "Start camera to scan"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void startCamera()}
              className="rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white"
            >
              {scanning ? "Restart camera" : "Start QR camera"}
            </button>
            <button
              type="button"
              onClick={startManual}
              className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800"
            >
              Manual intake instead
            </button>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Or paste verify URL / USB scanner input
            </label>
            <textarea
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              rows={3}
              value={qrRaw}
              onChange={(e) => setQrRaw(e.target.value)}
              placeholder="https://… or scanner paste"
            />
            <button
              type="button"
              disabled={loading || !qrRaw.trim()}
              onClick={() => void runQrPreview(qrRaw)}
              className="mt-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Load from paste
            </button>
          </div>
        </div>
      )}

      {step === "form" && (
        <form
          onSubmit={submitForm}
          className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            {form.photographUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.photographUrl}
                alt="PCM"
                className="mb-3 h-28 w-28 rounded-xl object-cover ring-1 ring-slate-200"
              />
            ) : (
              <p className="mb-2 text-sm text-amber-800">Photo required</p>
            )}
            <input
              type="file"
              accept="image/*"
              capture="user"
              onChange={(e) => void onPhotoFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Call-up number
            </label>
            <input
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
              value={form.callUpNumber}
              onChange={(e) => setForm({ ...form, callUpNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Full name
            </label>
            <input
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Gender</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">Select</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Institution
            </label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.institution}
              onChange={(e) => setForm({ ...form, institution: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Deployment state
            </label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.deploymentState}
              onChange={(e) =>
                setForm({ ...form, deploymentState: e.target.value })
              }
            >
              <option value="">Select</option>
              {NIGERIA_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Batch / stream
            </label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.batchYear}
              onChange={(e) => setForm({ ...form, batchYear: e.target.value })}
              placeholder="e.g. 2026 Batch B"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-slate-500">
              Camp address
            </label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={campSelectValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__custom__") return;
                setForm({ ...form, campAddress: v });
              }}
            >
              <option value="">Select camp</option>
              {camps.map((c) => (
                <option key={c.id} value={c.address}>
                  {c.name}
                </option>
              ))}
              {form.campAddress &&
                !camps.some((c) => c.address === form.campAddress) && (
                  <option value="__custom__">Custom (current)</option>
                )}
            </select>
            {(!camps.length || campSelectValue === "__custom__") && (
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.campAddress}
                onChange={(e) =>
                  setForm({ ...form, campAddress: e.target.value })
                }
                placeholder="Camp address text"
              />
            )}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Date reporting
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={toDateInputValue(form.dateReporting)}
              onChange={(e) =>
                setForm({
                  ...form,
                  dateReporting: e.target.value
                    ? formatReportingDate(e.target.value)
                    : "",
                })
              }
            />
            {form.dateReporting && (
              <p className="mt-1 text-xs text-slate-500">
                Saved as: {form.dateReporting}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-nysc-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save PCM record"}
            </button>
            <button
              type="button"
              onClick={() => {
                void stopScanner();
                setStep("scan");
                setError(null);
              }}
              className="rounded-md border border-slate-300 px-4 py-2.5 text-sm"
            >
              Back to scan
            </button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
          <p className="font-semibold text-green-900">PCM registered</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{form.fullName}</p>
          <p className="font-mono text-sm text-slate-600">{form.callUpNumber}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {fromSecurity ? (
              <Link
                href="/staff/security/checkin"
                className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white"
              >
                Back to Security gate
              </Link>
            ) : (
              createdId && (
                <Link
                  href={`/staff/pcm/${createdId}`}
                  className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white"
                >
                  View record
                </Link>
              )
            )}
            <button
              type="button"
              onClick={() => {
                setForm(empty);
                setCreatedId(null);
                setQrRaw("");
                setStep("scan");
              }}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Intake another
            </button>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
