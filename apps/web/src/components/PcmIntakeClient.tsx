"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Step = "choose" | "qr" | "manual" | "done";

export function PcmIntakeClient() {
  const [step, setStep] = useState<Step>("choose");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrRaw, setQrRaw] = useState("");
  const [created, setCreated] = useState<{ callUpNumber: string; fullName: string } | null>(null);
  const [form, setForm] = useState({
    callUpNumber: "",
    fullName: "",
    gender: "",
    institution: "",
    course: "",
    stateCode: "",
    phone: "",
    email: "",
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  async function startCamera() {
    setCameraError(null);
    setStep("qr");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError(
        "Camera not available. Paste the QR content or verification link below, or use manual entry."
      );
    }
  }

  async function submitQrPayload(input: string, data?: typeof form) {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/pcm/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "qr",
          input,
          data: data
            ? {
                callUpNumber: data.callUpNumber,
                fullName: data.fullName,
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
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Intake failed");
        return;
      }
      if (json.status === "needs_completion") {
        setMsg(json.message);
        setForm((f) => ({
          ...f,
          callUpNumber: json.partial?.callUpNumber || f.callUpNumber,
        }));
        setQrRaw(input);
        setStep("manual");
        stopCamera();
        return;
      }
      setCreated({
        callUpNumber: json.pcm.callUpNumber,
        fullName: json.pcm.fullName,
      });
      setStep("done");
      stopCamera();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function onManual(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // If we came from QR, re-submit with completion fields
      if (qrRaw) {
        await submitQrPayload(qrRaw, form);
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
            Register with your NYSC call-up letter. Prefer scanning the QR code on the letter.
            You stay on this NYSC Ekiti site — you are not sent away to another page.
          </p>
          <button
            type="button"
            onClick={startCamera}
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
            <video ref={videoRef} className="aspect-square w-full object-cover" playsInline muted />
          </div>
          {cameraError && (
            <p className="text-sm text-amber-800">{cameraError}</p>
          )}
          <p className="text-xs text-slate-500">
            Point your camera at the QR on your call-up letter. You can also paste the QR link or
            text below if the camera cannot read it yet.
          </p>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={3}
            placeholder="Paste verification URL or QR text here"
            value={qrRaw}
            onChange={(e) => setQrRaw(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || !qrRaw.trim()}
              onClick={() => submitQrPayload(qrRaw.trim())}
              className="flex-1 rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Use this QR / link"}
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
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
          <p className="text-sm text-slate-600">
            Enter the details exactly as on your call-up letter.
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
              setForm({
                callUpNumber: "",
                fullName: "",
                gender: "",
                institution: "",
                course: "",
                stateCode: "",
                phone: "",
                email: "",
              });
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
