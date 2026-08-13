"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Step = "choose" | "qr" | "manual" | "done";

type FormState = {
  callUpNumber: string;
  fullName: string;
  gender: string;
  institution: string;
  course: string;
  stateCode: string;
  phone: string;
  email: string;
};

const emptyForm: FormState = {
  callUpNumber: "",
  fullName: "",
  gender: "",
  institution: "",
  course: "",
  stateCode: "",
  phone: "",
  email: "",
};

export function PcmIntakeClient() {
  const [step, setStep] = useState<Step>("choose");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [qrRaw, setQrRaw] = useState("");
  const [created, setCreated] = useState<{
    callUpNumber: string;
    fullName: string;
  } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const handlingScan = useRef(false);
  const lastDecodedRef = useRef("");
  const readerId = "pcm-qr-reader";

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
    } catch {
      /* already stopped */
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  async function submitQrPayload(input: string, data?: FormState) {
    const payload = input.trim();
    if (!payload) {
      setError("No QR content to submit. Scan again or paste the verification link.");
      return;
    }

    // Always keep what we are sending visible in the UI
    lastDecodedRef.current = payload;
    setQrRaw(payload);

    setLoading(true);
    setError(null);
    setMsg("Submitting to NYSC Ekiti…");

    try {
      const res = await fetch("/api/pcm/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "qr",
          input: payload,
          data: data
            ? {
                callUpNumber: data.callUpNumber || undefined,
                fullName: data.fullName || undefined,
                gender: data.gender || undefined,
                institution: data.institution || undefined,
                course: data.course || undefined,
                stateCode: data.stateCode || undefined,
                phone: data.phone || undefined,
                email: data.email || undefined,
              }
            : undefined,
        }),
      });

      let json: {
        error?: string;
        status?: string;
        message?: string;
        partial?: { callUpNumber?: string };
        pcm?: { callUpNumber: string; fullName: string };
      } = {};
      try {
        json = await res.json();
      } catch {
        setError(
          "Server returned an invalid response. If this is a new deploy, run database setup (db push + seed) against Neon first."
        );
        return;
      }

      if (!res.ok) {
        const err = json.error ?? `Intake failed (${res.status})`;
        // Common when Neon tables were never created
        if (res.status >= 500) {
          setError(
            `${err} — Database may not be set up yet. Run prisma db push + seed against your Neon DATABASE_URL.`
          );
        } else {
          setError(err);
        }
        return;
      }

      if (json.status === "needs_completion") {
        setMsg(
          json.message ??
            "QR scanned. Confirm your call-up number and full name from the letter."
        );
        setForm((f) => ({
          ...f,
          callUpNumber: json.partial?.callUpNumber || f.callUpNumber,
        }));
        setStep("manual");
        await stopScanner();
        return;
      }

      if (json.pcm) {
        setCreated({
          callUpNumber: json.pcm.callUpNumber,
          fullName: json.pcm.fullName,
        });
        setStep("done");
        await stopScanner();
        return;
      }

      setError("Unexpected response from server.");
    } catch {
      setError(
        "Network error while submitting scan. Check that the site API is running and DATABASE_URL is configured."
      );
    } finally {
      setLoading(false);
      handlingScan.current = false;
    }
  }

  async function startLiveScan() {
    setError(null);
    setMsg(null);
    setStep("qr");
    handlingScan.current = false;

    // Let React mount #pcm-qr-reader before html5-qrcode touches it
    await new Promise((r) => setTimeout(r, 150));

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      // Clear any leftover DOM from a previous attempt
      const el = document.getElementById(readerId);
      if (el) el.innerHTML = "";

      const scanner = new Html5Qrcode(readerId, { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 8,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
            return { width: edge, height: edge };
          },
        },
        (decodedText) => {
          if (handlingScan.current) return;
          if (!decodedText || !String(decodedText).trim()) return;

          handlingScan.current = true;
          const text = String(decodedText).trim();
          lastDecodedRef.current = text;
          setQrRaw(text);
          setMsg("QR detected — camera stopping, then verifying…");

          // Stop camera, then submit (use ref so we never lose the string)
          void (async () => {
            await stopScanner();
            await submitQrPayload(lastDecodedRef.current || text);
          })();
        },
        () => {
          /* frame miss — ignore */
        }
      );
      setScanning(true);
      setMsg("Camera on — point at the call-up letter QR.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not start camera";
      setError(
        `${message}. Allow camera access, or paste the verification link in the box below.`
      );
      setScanning(false);
    }
  }

  async function onManual(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fromQr = (lastDecodedRef.current || qrRaw).trim();
      if (fromQr) {
        await submitQrPayload(fromQr, form);
        return;
      }
      const res = await fetch("/api/pcm/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          data: {
            callUpNumber: form.callUpNumber.trim(),
            fullName: form.fullName.trim(),
            gender: form.gender || undefined,
            institution: form.institution || undefined,
            course: form.course || undefined,
            stateCode: form.stateCode || undefined,
            phone: form.phone || undefined,
            email: form.email || undefined,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Registration failed");
        return;
      }
      setCreated({
        callUpNumber: json.pcm.callUpNumber,
        fullName: json.pcm.fullName,
      });
      setStep("done");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const scannedDisplay = qrRaw || lastDecodedRef.current;

  return (
    <div className="mx-auto max-w-lg">
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {msg && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {msg}
        </div>
      )}

      {step === "choose" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Register with your NYSC call-up letter. Scan the QR code on the letter — you stay on this
            NYSC Ekiti site; you are not sent away to another page.
          </p>
          <button
            type="button"
            onClick={() => void startLiveScan()}
            className="w-full rounded-md bg-nysc-green px-4 py-3 text-sm font-semibold text-white"
          >
            Scan call-up QR code
          </button>
          <button
            type="button"
            onClick={() => setStep("manual")}
            className="w-full rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800"
          >
            Enter details manually
          </button>
        </div>
      )}

      {step === "qr" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
            <div id={readerId} className="w-full min-h-[240px]" />
          </div>
          <p className="text-center text-sm text-slate-600">
            {scanning
              ? "Point your camera at the QR on your call-up letter…"
              : loading
                ? "Processing scan…"
                : "Starting camera…"}
          </p>

          {scannedDisplay ? (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase text-green-800">Scanned content</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-800">{scannedDisplay}</p>
            </div>
          ) : null}

          <p className="text-xs text-slate-500">
            Camera not reading it? Paste the verification URL (from the QR) below and tap Use link.
          </p>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={3}
            placeholder="https://mgt.nysc.org.ng/verify/CorpMemberVerify.aspx?svc=callup&callup=..."
            value={qrRaw}
            onChange={(e) => {
              setQrRaw(e.target.value);
              lastDecodedRef.current = e.target.value;
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || !qrRaw.trim()}
              onClick={() => void submitQrPayload(qrRaw.trim())}
              className="flex-1 rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Use scanned / pasted link"}
            </button>
            <button
              type="button"
              onClick={() => {
                void stopScanner();
                setStep("choose");
              }}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === "manual" && (
        <form onSubmit={onManual} className="space-y-3">
          {scannedDisplay ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold text-slate-500">QR / link used</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">{scannedDisplay}</p>
            </div>
          ) : null}
          <p className="text-sm text-slate-600">
            Enter the details exactly as on your call-up letter
            {scannedDisplay ? " (complete any fields the scan could not fill)." : "."}
          </p>
          <input
            required
            placeholder="Call-up number"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.callUpNumber}
            onChange={(e) => setForm({ ...form, callUpNumber: e.target.value })}
          />
          <input
            required
            placeholder="Full name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <input
            placeholder="Gender"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          />
          <input
            placeholder="Institution"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.institution}
            onChange={(e) => setForm({ ...form, institution: e.target.value })}
          />
          <input
            placeholder="Course"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.course}
            onChange={(e) => setForm({ ...form, course: e.target.value })}
          />
          <input
            placeholder="Phone"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            placeholder="Email"
            type="email"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Submitting…" : "Complete registration"}
            </button>
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {step === "done" && created && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-sm font-semibold text-green-900">You are registered on the Ekiti platform</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{created.fullName}</p>
          <p className="font-mono text-sm text-slate-600">{created.callUpNumber}</p>
          <p className="mt-4 text-xs text-slate-600">
            Keep your call-up letter. Present it at camp for security check-in.
          </p>
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setQrRaw("");
              lastDecodedRef.current = "";
              setForm(emptyForm);
              setMsg(null);
              setError(null);
              setStep("choose");
            }}
            className="mt-6 text-sm text-nysc-green hover:underline"
          >
            Register another
          </button>
        </div>
      )}
    </div>
  );
}
