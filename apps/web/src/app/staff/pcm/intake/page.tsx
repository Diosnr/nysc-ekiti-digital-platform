"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

type Fields = {
  callUpNumber: string;
  fullName: string;
  gender: string;
  institution: string;
  course: string;
  deploymentState: string;
  campAddress: string;
  dateReporting: string;
  batchYear: string;
  photographUrl: string;
  phone: string;
  email: string;
  verificationUrl?: string;
};

const empty: Fields = {
  callUpNumber: "",
  fullName: "",
  gender: "",
  institution: "",
  course: "",
  deploymentState: "",
  campAddress: "",
  dateReporting: "",
  batchYear: "",
  photographUrl: "",
  phone: "",
  email: "",
};

type Step = "scan" | "form" | "done";

export default function StaffPcmIntakePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("scan");
  const [form, setForm] = useState<Fields>(empty);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [qrRaw, setQrRaw] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);

  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const handlingScan = useRef(false);
  const readerId = "staff-pcm-qr-reader";

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

  async function previewFromQr(input: string) {
    const payload = input.trim();
    if (!payload) {
      setError("Scan or paste a verification URL first.");
      return;
    }
    setLoading(true);
    setError(null);
    setMsg("Fetching details from NYSC verification page…");
    try {
      const res = await staffFetch("/api/pcm/intake", {
        method: "POST",
        body: JSON.stringify({
          mode: "qr",
          input: payload,
          previewOnly: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not read call-up letter");
        return;
      }
      if (json.alreadyRegistered) {
        setError(
          `Already registered: ${json.fields?.fullName} (${json.fields?.callUpNumber}). Open registry to view.`
        );
        if (json.fields) {
          setForm({ ...empty, ...json.fields });
        }
        return;
      }
      const f = json.fields as Fields;
      setForm({
        callUpNumber: f.callUpNumber || "",
        fullName: f.fullName || "",
        gender: f.gender || "",
        institution: f.institution || "",
        course: f.course || "",
        deploymentState: f.deploymentState || "",
        campAddress: f.campAddress || "",
        dateReporting: f.dateReporting || "",
        batchYear: f.batchYear || "",
        photographUrl: f.photographUrl || "",
        phone: f.phone || "",
        email: f.email || "",
        verificationUrl: payload,
      });
      setQrRaw(payload);
      setMsg("Details loaded from NYSC. Review, ensure photo is present, then save.");
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
    setMsg(null);
    handlingScan.current = false;
    setStep("scan");
    await new Promise((r) => setTimeout(r, 150));
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const el = document.getElementById(readerId);
      if (el) el.innerHTML = "";
      const scanner = new Html5Qrcode(readerId, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 8,
          qrbox: (w, h) => {
            const edge = Math.floor(Math.min(w, h) * 0.7);
            return { width: edge, height: edge };
          },
        },
        (decodedText) => {
          if (handlingScan.current) return;
          const text = String(decodedText || "").trim();
          if (!text) return;
          handlingScan.current = true;
          setQrRaw(text);
          setMsg("QR detected…");
          void (async () => {
            await stopScanner();
            await previewFromQr(text);
          })();
        },
        () => {}
      );
      setScanning(true);
      setMsg("Point camera at call-up letter QR.");
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Camera failed") +
          ". Paste the verify URL below, or use a USB scanner into the box."
      );
      setScanning(false);
    }
  }

  function onPhotoFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setForm((f) => ({ ...f, photographUrl: result }));
    };
    reader.readAsDataURL(file);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.photographUrl) {
      setError("Photo is required. Upload one or re-scan so NYSC photo is loaded.");
      return;
    }
    if (!form.callUpNumber.trim() || !form.fullName.trim()) {
      setError("Call-up number and full name are required.");
      return;
    }
    setLoading(true);
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
            gender: form.gender.trim() || undefined,
            institution: form.institution.trim() || undefined,
            course: form.course.trim() || undefined,
            deploymentState: form.deploymentState.trim() || undefined,
            campAddress: form.campAddress.trim() || undefined,
            dateReporting: form.dateReporting.trim() || undefined,
            batchYear: form.batchYear.trim() || undefined,
            phone: form.phone.trim() || undefined,
            email: form.email.trim() || undefined,
            photographUrl: form.photographUrl,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
      setCreatedId(json.pcm.id);
      setStep("done");
      setMsg(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function startManual() {
    void stopScanner();
    setForm(empty);
    setQrRaw("");
    setError(null);
    setMsg("Enter details from the call-up letter. Photo upload is required.");
    setStep("form");
  }

  return (
    <StaffShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PCM Intake</h1>
          <p className="mt-1 text-sm text-slate-600">
            Scan call-up QR first. Manual entry is secondary. Photo is required.
          </p>
        </div>
        <Link
          href="/staff/pcm"
          className="text-sm font-medium text-nysc-green hover:underline"
        >
          ← Registry
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
              placeholder="https://mgt.nysc.org.ng/verify/CorpMemberVerify.aspx?svc=callup&callup=..."
            />
            <button
              type="button"
              disabled={loading || !qrRaw.trim()}
              onClick={() => void previewFromQr(qrRaw)}
              className="mt-2 rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Fetching…" : "Load from URL"}
            </button>
          </div>
        </div>
      )}

      {step === "form" && (
        <form
          onSubmit={onSave}
          className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
        >
          <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row">
            <div className="shrink-0">
              {form.photographUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.photographUrl}
                  alt="PCM"
                  className="h-36 w-36 rounded-xl border object-cover"
                />
              ) : (
                <div className="flex h-36 w-36 items-center justify-center rounded-xl border border-dashed border-red-300 bg-red-50 text-xs text-red-600">
                  Photo required
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="text-sm font-semibold text-slate-800">
                Photograph <span className="text-red-600">*</span>
              </label>
              <p className="mt-1 text-xs text-slate-500">
                From NYSC page when available, or upload a clear passport photo.
              </p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="mt-2 block w-full text-sm"
                onChange={(e) => onPhotoFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {(
            [
              ["callUpNumber", "Call-up number *", true],
              ["fullName", "Full name *", true],
              ["gender", "Gender", false],
              ["institution", "Institution", false],
              ["course", "Course", false],
              ["deploymentState", "State of deployment", false],
              ["campAddress", "Camp address", false],
              ["dateReporting", "Date reporting", false],
              ["batchYear", "Batch / Year", false],
              ["phone", "Phone", false],
              ["email", "Email", false],
            ] as [keyof Fields, string, boolean][]
          ).map(([key, label, required]) => (
            <div key={key}>
              <label className="text-xs font-semibold uppercase text-slate-500">
                {label}
              </label>
              <input
                required={required}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form[key] || ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}

          <div className="sm:col-span-2 flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-nysc-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save PCM record"}
            </button>
            <button
              type="button"
n              onClick={() => {
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
          <div className="mt-6 flex justify-center gap-3">
            {createdId && (
              <Link
                href={`/staff/pcm/${createdId}`}
                className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white"
              >
                View record
              </Link>
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
