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
  const [lastScanned, setLastScanned] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [camps, setCamps] = useState<CampOpt[]>([]);
  /** Security desk should return to security hub, never Registry */
  const [fromSecurity, setFromSecurity] = useState(false);

  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const handlingScan = useRef(false);
  const wedgeRef = useRef<HTMLInputElement | null>(null);
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
    // Hardware scanners often append CR/LF; strip control chars
    const trimmed = input.replace(/[\u0000-\u001F]+/g, " ").trim();
    if (!trimmed) return;

    handlingScan.current = true;
    setLastScanned(trimmed);
    setQrRaw(trimmed);
    setLoading(true);
    setError(null);
    setMsg("QR captured — fetching NYSC call-up details…");

    // Stop camera immediately so it cannot re-fire / blink the page
    await stopScanner();

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
        setError(
          (json.error as string) ||
            "Could not read QR / NYSC verify page. Check the scanned text below, or use manual intake."
        );
        setMsg(null);
        return;
      }
      if (json.alreadyRegistered) {
        setMsg(
          `Already registered: ${json.fields?.fullName} (${json.fields?.callUpNumber}). Use Security gate search to check in.`
        );
      } else {
        setMsg(null);
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
    } catch {
      setError(
        "Network error while contacting the server. Scanned text is kept below — try Load again."
      );
      setMsg(null);
    } finally {
      setLoading(false);
      handlingScan.current = false;
    }
  }

  function submitWedgeValue(raw: string) {
    const v = raw.replace(/[\u0000-\u001F]+/g, " ").trim();
    if (!v || loading || handlingScan.current) return;
    void runQrPreview(v);
    if (wedgeRef.current) wedgeRef.current.value = "";
  }

  async function startCamera() {
    setError(null);
    setMsg(null);
    handlingScan.current = false;
    await stopScanner();
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const el = document.getElementById(readerId);
      if (el) el.innerHTML = "";

      const scanner = new Html5Qrcode(readerId, { verbose: false });
      scannerRef.current = scanner;

      let cameraConfig: string | MediaTrackConstraints = {
        facingMode: "environment",
      };
      try {
        const cams = await Html5Qrcode.getCameras();
        const rear = cams.find((c) =>
          /back|rear|environment/i.test(c.label || "")
        );
        if (rear?.id) cameraConfig = rear.id;
        else if (cams.length > 1) cameraConfig = cams[cams.length - 1].id;
        else if (cams[0]?.id) cameraConfig = cams[0].id;
      } catch {
        /* facingMode fallback */
      }

      await scanner.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: (viewW: number, viewH: number) => {
            const edge = Math.floor(Math.min(viewW, viewH) * 0.72);
            return { width: edge, height: edge };
          },
        },
        (decoded) => {
          if (handlingScan.current) return;
          const text = String(decoded || "").trim();
          if (!text) return;
          handlingScan.current = true;
          void runQrPreview(text);
        },
        () => {}
      );
      setMsg("Camera on — point at the call-up letter QR.");
    } catch (e) {
      setScanning(false);
      setError(
        e instanceof Error
          ? `${e.message} — use the USB/BT scanner box or paste URL below`
          : "Camera failed — use the USB/BT scanner box or paste URL below"
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
          href={fromSecurity ? "/staff/security" : "/staff/pcm"}
          className="text-sm font-medium text-nysc-green hover:underline"
        >
          {fromSecurity ? "← Security dashboard" : "← Registry"}
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
            {loading
              ? "Loading NYSC data…"
              : scanning
                ? "Camera on — hold steady on the QR…"
                : "Start camera, or use the USB/BT scanner box below"}
          </p>

          {lastScanned ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase text-slate-500">
                Last scanned / pasted
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-800">
                {lastScanned}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void startCamera()}
              className="rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {scanning ? "Restart camera" : "Start QR camera"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={startManual}
              className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-40"
            >
              Manual intake instead
            </button>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <label className="text-xs font-semibold uppercase text-emerald-900">
              External QR scanner (USB or Bluetooth wedge)
            </label>
            <p className="mt-1 text-xs text-emerald-900/80">
              Tap the box so it is focused, then scan. The scanner types like a
              keyboard and submits on Enter (or Tab).
            </p>
            <input
              ref={wedgeRef}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={loading}
              className="mt-2 w-full rounded-md border border-emerald-300 bg-white px-3 py-3 font-mono text-sm outline-none ring-emerald-500 focus:ring-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  submitWedgeValue((e.target as HTMLInputElement).value);
                }
              }}
              placeholder="Tap here, then scan…"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  wedgeRef.current?.focus();
                  wedgeRef.current?.select();
                }}
                className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900"
              >
                Focus scanner box
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  const v = wedgeRef.current?.value?.trim() || "";
                  if (v) submitWedgeValue(v);
                }}
                className="rounded-md border border-emerald-700 bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                Load from scanner box
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Or paste verify URL
            </label>
            <textarea
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              rows={3}
              value={qrRaw}
              disabled={loading}
              onChange={(e) => setQrRaw(e.target.value)}
              placeholder="https://mgt.nysc.org.ng/verify/CorpMemberVerify.aspx?…"
            />
            <button
              type="button"
              disabled={loading || !qrRaw.trim()}
              onClick={() => void runQrPreview(qrRaw)}
              className="mt-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              {loading ? "Loading…" : "Load from paste"}
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
          <p className="font-semibold text-green-900">PCM registered & checked in</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{form.fullName}</p>
          <p className="font-mono text-sm text-slate-600">{form.callUpNumber}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {fromSecurity ? (
              <Link
                href="/staff/security"
                className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white"
              >
                Back to Security dashboard
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
