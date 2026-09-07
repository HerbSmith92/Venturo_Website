"use client";

import { useState } from "react";
import {
  SA_BANK_OTHER,
  SA_BANKS,
  bankSelectValue,
  defaultBranchCode,
  digitsOnly,
  resolveBankName,
} from "@/lib/sa-banks";

type ExistingPayout = {
  accountHolder: string;
  bankName: string;
  accountNumberLast4: string;
  branchCode: string | null;
} | null;

export function HostPayoutForm({
  existingPayout,
  fallbackHolder,
}: {
  existingPayout: ExistingPayout;
  fallbackHolder: string;
}) {
  const initialSelect = bankSelectValue(existingPayout?.bankName ?? "");
  const [accountHolder, setAccountHolder] = useState(
    existingPayout?.accountHolder || fallbackHolder,
  );
  const [bankSelect, setBankSelect] = useState(initialSelect);
  const [otherBank, setOtherBank] = useState(
    initialSelect === SA_BANK_OTHER ? (existingPayout?.bankName ?? "") : "",
  );
  const [accountNumber, setAccountNumber] = useState("");
  const [accountNumberConfirm, setAccountNumberConfirm] = useState("");
  const [branchCode, setBranchCode] = useState(existingPayout?.branchCode ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onBankChange(next: string) {
    setBankSelect(next);
    if (next === SA_BANK_OTHER) return;
    const suggested = defaultBranchCode(next);
    if (suggested && !branchCode.trim()) setBranchCode(suggested);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const bankName = resolveBankName(bankSelect, otherBank);
    const account = digitsOnly(accountNumber);
    const confirm = digitsOnly(accountNumberConfirm);
    if (!bankSelect) {
      setError("Pick a bank.");
      return;
    }
    if (!bankName) {
      setError("Add the bank name.");
      return;
    }
    if (!accountHolder.trim()) {
      setError("Add the account holder.");
      return;
    }
    if (account !== confirm) {
      setError("Account numbers do not match.");
      return;
    }
    if (!confirmed) {
      setError("Tick the box to confirm these details are correct.");
      return;
    }
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const response = await fetch("/api/host/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolder,
          bankName,
          accountNumber: account,
          accountNumberConfirm: confirm,
          branchCode,
          confirmed,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save.");
      setAccountNumber("");
      setAccountNumberConfirm("");
      setConfirmed(false);
      setNotice("Payout bank saved. Paid tickets on any event use this account.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      {existingPayout ? (
        <p className="notice">
          On file: {existingPayout.bankName} · ****{existingPayout.accountNumberLast4}. Enter the
          full account number again to replace it.
        </p>
      ) : (
        <p className="notice">Add a bank before you go live with paid tickets.</p>
      )}
      <div className="field-row">
        <label className="field">
          <span>Account Holder</span>
          <input
            value={accountHolder}
            onChange={(event) => setAccountHolder(event.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="field">
          <span>Bank</span>
          <select value={bankSelect} onChange={(event) => onBankChange(event.target.value)}>
            <option value="">Pick a bank</option>
            {SA_BANKS.map((bank) => (
              <option key={bank.name} value={bank.name}>
                {bank.name}
              </option>
            ))}
            <option value={SA_BANK_OTHER}>{SA_BANK_OTHER}</option>
          </select>
        </label>
      </div>
      {bankSelect === SA_BANK_OTHER ? (
        <label className="field">
          <span>Bank Name</span>
          <input
            value={otherBank}
            onChange={(event) => setOtherBank(event.target.value)}
            placeholder="Name as it appears at the bank"
          />
        </label>
      ) : null}
      <div className="field-row">
        <label className="field">
          <span>Account Number</span>
          <input
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Confirm Account Number</span>
          <input
            value={accountNumberConfirm}
            onChange={(event) => setAccountNumberConfirm(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </label>
      </div>
      <label className="field">
        <span>Branch Code</span>
        <input
          value={branchCode}
          onChange={(event) => setBranchCode(event.target.value)}
          inputMode="numeric"
          autoComplete="off"
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        I confirm all of this info is correct.
      </label>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving" : "Save Bank"}
      </button>
    </form>
  );
}
