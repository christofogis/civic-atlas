import { useState } from "react";
import { Link } from "react-router-dom";
import { tr } from "../lib/lang.js";
import { useAccount, saveOfficials, removeOfficial, saveBill, removeBill } from "../lib/auth.js";
import { officialRow, officialKey, billRow, billKey } from "../lib/account.js";

// "Save" on an official's or a bill's page, for people with an account. Signed out it's a quiet
// link to the account page; with accounts turned off it's nothing. Same wording for everyone.
// Give either official (a bioguide or ocd-person ID) or bill ({ congress, type, number }).
export default function SaveToggle({ official, bill }) {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const row = official ? officialRow(official) : bill ? billRow(bill.congress, bill.type, bill.number) : null;
  if (account.status === "off" || !row) return null;
  if (account.status !== "signedIn") {
    return <p className="save-toggle fine"><Link to="/account">{official ? tr("Sign in to save this official", "Inicie sesión para guardar este funcionario") : tr("Sign in to save this bill", "Inicie sesión para guardar este proyecto")}</Link></p>;
  }
  const saved = official
    ? account.officials.some((o) => officialKey(o) === officialKey(row))
    : account.bills.some((b) => billKey(b) === billKey(row));
  async function toggle() {
    setBusy(true); setFailed(false);
    try {
      if (official) await (saved ? removeOfficial(row) : saveOfficials([row]));
      else await (saved ? removeBill(row) : saveBill(row));
    } catch { setFailed(true); }
    setBusy(false);
  }
  return (
    <p className="save-toggle">
      <button type="button" aria-pressed={saved} disabled={busy} onClick={toggle}>
        {saved ? tr("Saved", "Guardado") : tr("Save", "Guardar")}
      </button>
      {failed && <span className="fine"> {tr("Couldn't save. Please try again.", "No se pudo guardar. Inténtelo de nuevo.")}</span>}
    </p>
  );
}
