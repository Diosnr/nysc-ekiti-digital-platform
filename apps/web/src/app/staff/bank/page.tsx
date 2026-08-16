"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { staffFetch } from "@/lib/staff-api";

type PcmBrief = {
  id: string;
  fullName: string;
  callUpNumber: string;
  stateCode?: string | null;
  gender?: string | null;
  photographUrl?: string | null;
  status?: string;
  phone?: string | null;
};

type BankRec = {
  id: string;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  bvn?: string | null;
  note?: string | null;
  registeredByName?: string | null;
  registeredAt?: string;
  updatedAt?: string;
};

type NinRec = {
  id: string;
  nin?: string | null;
  frontUrl?: string | null;
  backUrl?: string | null;
  createdAt?: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export default function BankDeskPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [q, setQ] = useState("");
  const [pcm, setPcm] = useState<PcmBrief | null>(null);
  const [bank, setBank] = useState<BankRec | null>(null);
  const [nin, setNin] = useState<NinRec | null>(null);
  const [summary, setSummary] = useState<{
    registered: number;
    recent: {
      id: string;
      bankName?: string | null;
      accountNumber?: string | null;
      registeredByName?: string | null;
      updatedAt: string;
      pcm: PcmBrief;
    }[];
  } | null>(null);

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bvn, setBvn] = useState("");
  const [note, setNote] = useState("");
  const [ninDigits, setNinDigits] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    staffFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) {
        setAllowed(false);
        return;
      }
      const me = await res.json();
      const r: string[] = me.roles ?? [];
      const p: string[] = me.permissions ?? [];
      const ok =
        p.includes("*") ||
        p.includes("bank:register") ||
        p.includes("bank:update") ||
        r.some(
          (x) =>
            x.toLowerCase().includes("bank") ||
            x.toLowerCase().includes("account officer") ||
            x.toLowerCase() === "super admin"
        );
      setAllowed(ok);
    });
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const res = await staffFetch("/api/bank/summary");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSummary(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (allowed) void loadSummary();
  }, [allowed, loadSummary]);

  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setPcm(null);
    setBank(null);
    setNin(null);
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await staffFetch(
        `/api/bank/lookup?q=${encodeURIComponent(q.trim())}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Not found");
        return;
      }
      setPcm(data.pcm);
      setBank(data.bank);
      setNin(data.nin);
      setBankName(data.bank?.bankName || "");
      setAccountNumber(data.bank?.accountNumber || "");
      setAccountName(data.bank?.accountName || data.pcm?.fullName || "");
      setBvn(data.bank?.bvn || "");
      setNote(data.bank?.note || "");
      setNinDigits(data.nin?.nin || "");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!pcm) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      let ninFrontDataUrl: string | undefined;
      let ninBackDataUrl: string | undefined;
      if (frontFile) ninFrontDataUrl = await fileToDataUrl(frontFile);
      if (backFile) ninBackDataUrl = await fileToDataUrl(backFile);

      const res = await staffFetch("/api/bank/register", {
        method: "POST",
        body: JSON.stringify({
          pcmId: pcm.id,
          bankName: bankName || undefined,
          accountNumber: accountNumber || undefined,
          accountName: accountName || undefined,
          bvn: bvn || undefined,
          note: note || undefined,
          nin: ninDigits || undefined,
          ninFrontDataUrl,
          ninBackDataUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setBank(data.bank);
      setMsg("Bank registration saved");
      setFrontFile(null);
      setBackFile(null);
      await loadSummary();
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
            Bank / NIN records are sensitive. Only Bank Account Officers or Super
            Admin may use this desk.
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
          <h1 className="text-2xl font-bold text-slate-900">Bank / Account desk</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Record bank details and NIN for corps members. Account numbers are
            entered by staff — never generated by the system.
          </p>
        </div>
        <p className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200">
          Sensitive · audited
        </p>
      </div>

      {summary && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase text-slate-400">
              Bank registered
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {summary.registered}
            </p>
          </div>
        </div>
      )}

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

      <form
        onSubmit={search}
        className="mt-6 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"
      >
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2.5 text-sm"
          placeholder="State code, call-up or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-nysc-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Find member
        </button>
      </form>

      {pcm && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <PcmPhoto
              url={pcm.photographUrl}
              alt={pcm.fullName}
              sizeClass="h-20 w-20"
            />
            <div>
              <h2 className="text-lg font-bold text-slate-900">{pcm.fullName}</h2>
              <p className="font-mono text-sm text-slate-600">
                {pcm.callUpNumber}
                {pcm.stateCode ? ` · ${pcm.stateCode}` : " · PCM"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {pcm.gender || "—"} · {pcm.status}
                {pcm.phone ? ` · ${pcm.phone}` : ""}
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Bank details
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Enter account number from the bank / corps member — do not invent or
              auto-generate numbers.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400">
                  Bank name
                </label>
                <input
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. First Bank"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400">
                  Account number
                </label>
                <input
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="As on account"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400">
                  Account name
                </label>
                <input
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400">
                  BVN (optional)
                </label>
                <input
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                  value={bvn}
                  onChange={(e) => setBvn(e.target.value)}
                  maxLength={11}
                  inputMode="numeric"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold uppercase text-slate-400">
                  Note
                </label>
                <input
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
            {bank?.registeredByName && (
              <p className="mt-3 text-xs text-slate-500">
                Last saved by {bank.registeredByName}
                {bank.updatedAt
                  ? ` · ${new Date(bank.updatedAt).toLocaleString()}`
                  : ""}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              NIN card
            </h3>
            {nin && (
              <div className="mt-3 flex flex-wrap gap-3">
                {nin.frontUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={nin.frontUrl} target="_blank" rel="noreferrer">
                    <img
                      src={nin.frontUrl}
                      alt="NIN front"
                      className="h-24 rounded-lg border border-slate-200 object-cover"
                    />
                  </a>
                )}
                {nin.backUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={nin.backUrl} target="_blank" rel="noreferrer">
                    <img
                      src={nin.backUrl}
                      alt="NIN back"
                      className="h-24 rounded-lg border border-slate-200 object-cover"
                    />
                  </a>
                )}
                {nin.nin && (
                  <p className="self-center font-mono text-sm text-slate-700">
                    NIN {nin.nin}
                  </p>
                )}
              </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400">
                  NIN digits
                </label>
                <input
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                  value={ninDigits}
                  onChange={(e) => setNinDigits(e.target.value)}
                  maxLength={11}
                  inputMode="numeric"
                />
              </div>
              <div />
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400">
                  Front image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="mt-0.5 block w-full text-sm"
                  onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400">
                  Back image (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="mt-0.5 block w-full text-sm"
                  onChange={(e) => setBackFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </section>

          <button
            type="button"
            disabled={loading}
            onClick={() => void save()}
            className="w-full rounded-md bg-nysc-green py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {bank ? "Update bank registration" : "Save bank registration"}
          </button>
        </div>
      )}

      {summary && summary.recent.length > 0 && !pcm && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Recent registrations
          </h2>
          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {summary.recent.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  onClick={() => {
                    setQ(r.pcm.callUpNumber);
                    void (async () => {
                      setLoading(true);
                      try {
                        const res = await staffFetch(
                          `/api/bank/lookup?q=${encodeURIComponent(r.pcm.callUpNumber)}`
                        );
                        const data = await res.json().catch(() => ({}));
                        if (res.ok) {
                          setPcm(data.pcm);
                          setBank(data.bank);
                          setNin(data.nin);
                          setBankName(data.bank?.bankName || "");
                          setAccountNumber(data.bank?.accountNumber || "");
                          setAccountName(
                            data.bank?.accountName || data.pcm?.fullName || ""
                          );
                          setBvn(data.bank?.bvn || "");
                          setNote(data.bank?.note || "");
                          setNinDigits(data.nin?.nin || "");
                        }
                      } finally {
                        setLoading(false);
                      }
                    })();
                  }}
                >
                  <PcmPhoto
                    url={r.pcm.photographUrl}
                    alt=""
                    sizeClass="h-10 w-10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{r.pcm.fullName}</p>
                    <p className="font-mono text-[11px] text-slate-500">
                      {r.pcm.callUpNumber}
                      {r.accountNumber ? ` · ${r.accountNumber}` : ""}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {r.bankName || "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </StaffShell>
  );
}
