import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../lib/i18n.jsx";
import { PartyTag } from "./PartyTag.jsx";
import { billLabel, ordinal } from "../lib/format.js";
import { POLICY_AREAS, areaName, topicSlug } from "../lib/policyAreas.js";
import { matchMembers, matchByWords, pickRows, highlightParts, parseBillQuery } from "../lib/suggest.js";
import { loadDirectory, loadCommittees, fetchBills, fetchStatePeople } from "../lib/suggestData.js";
import { StatePartyTag, statePersonPath } from "./StateOfficialCard.jsx";
import { stateOfficeLabel } from "../lib/stateOffices.js";

// The header search box with suggestions underneath, like Wikipedia's: members, bills, committees,
// topics and site pages that match what's typed, from our own data. Enter with no row chosen still
// goes to the search page, and the last row always does. ARIA combobox with a listbox popup.

const MAX_ROWS = 8;
const DEBOUNCE_MS = 170;

function Marked({ text, q }) {
  return highlightParts(text, q).map((p, i) => (p.match ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>));
}

// "H.R. 152" with the typed "H.R. 15" in bold.
function BillNumber({ bill, typed }) {
  const label = billLabel(bill);
  if (!typed || typed.bill_type !== bill.bill_type) return label;
  const cut = label.length - String(bill.number).length + (String(bill.number).startsWith(typed.digits) ? typed.digits.length : 0);
  return <><b>{label.slice(0, cut)}</b>{label.slice(cut)}</>;
}

export default function SearchSuggest({ id, value, onValueChange, pages, ariaLabel, placeholder }) {
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const wrap = useRef(null);
  const list = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [dir, setDir] = useState(null);
  const [comms, setComms] = useState(null);
  const [bills, setBills] = useState({ q: "", byNumber: false, bills: [] });
  const q = value.trim();
  const showing = open && q.length >= 2;

  // Small lists load once per visit, the first time the box gets focus.
  function prefetch() {
    if (!dir) loadDirectory().then(setDir, () => {});
    if (!comms) loadCommittees().then(setComms, () => {});
  }

  // Bills: debounced, and an older request is cancelled when the text changes.
  useEffect(() => {
    if (!showing) return undefined;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      fetchBills(q, ctl.signal).then((r) => setBills({ q, ...r }), () => { if (!ctl.signal.aborted) setBills({ q, byNumber: false, bills: [] }); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [q, showing]);

  // State officials: same pacing, words only.
  const [statePeople, setStatePeople] = useState({ q: "", people: [] });
  useEffect(() => {
    if (!showing || parseBillQuery(q)) return undefined;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      fetchStatePeople(q, ctl.signal).then((people) => setStatePeople({ q, people }), () => { if (!ctl.signal.aborted) setStatePeople({ q, people: [] }); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [q, showing]);

  const groups = useMemo(() => {
    if (!showing) return [];
    const isNumber = !!parseBillQuery(q);
    // Until the new bills arrive, the last ones stay, unless they answer a different kind of query.
    const fresh = bills.q === q || !!parseBillQuery(bills.q) === isNumber;
    const billRows = (fresh ? bills.bills : []).map((b) => ({ key: `b-${b.congress}-${b.bill_type}-${b.number}`, href: `/bill/${b.congress}/${b.bill_type}/${b.number}`, kind: "bill", b }));
    const memberRows = isNumber ? [] : matchMembers(dir, q, MAX_ROWS).map((m) => ({ key: `m-${m.bioguide_id}`, href: `/member/${m.bioguide_id}`, kind: "member", m }));
    const stateRows = isNumber || statePeople.q !== q ? [] : statePeople.people.map((p) => ({ key: `s-${p.id}`, href: statePersonPath(p.id), kind: "state", p }));
    const committeeRows = isNumber ? [] : matchByWords(comms, q, (c) => c.name, 3).map((c) => ({ key: `c-${c.committee_id}`, href: `/committee/${c.committee_id}`, kind: "committee", c }));
    const topicRows = isNumber ? [] : matchByWords(POLICY_AREAS, q, areaName, 2).map((a) => ({ key: `t-${a}`, href: `/topic/${topicSlug(a)}`, kind: "topic", label: areaName(a) }));
    const pageRows = isNumber ? [] : matchByWords(pages, q, (p) => t(...p.title), 2).map((p) => ({ key: `p-${p.to}`, href: p.to, kind: "page", label: t(...p.title) }));
    const billGroup = { key: "bills", title: t("Bills", "Proyectos de ley"), items: billRows };
    return pickRows([
      ...(isNumber ? [billGroup] : []),
      { key: "members", title: t("Members of Congress", "Miembros del Congreso"), items: memberRows },
      ...(isNumber ? [] : [billGroup]),
      { key: "state", title: t("State officials", "Funcionarios estatales"), items: stateRows },
      { key: "committees", title: t("Committees", "Comités"), items: committeeRows },
      { key: "topics", title: t("Topics", "Temas"), items: topicRows },
      { key: "pages", title: t("Pages", "Páginas"), items: pageRows },
    ], MAX_ROWS);
  }, [showing, q, dir, comms, bills, statePeople, pages, lang]);

  const options = useMemo(() => [
    ...groups.flatMap((g) => g.items),
    { key: "search", href: `/search?q=${encodeURIComponent(q)}`, kind: "search" },
  ], [groups, q]);
  const optionId = (i) => `${id}-opt-${i}`;

  // A new list starts with nothing chosen.
  useEffect(() => setActive(-1), [q]);
  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  // Close on a tap or click anywhere else.
  useEffect(() => {
    if (!showing) return undefined;
    const close = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [showing]);

  function go(opt) {
    setOpen(false);
    setActive(-1);
    if (opt.kind !== "search") onValueChange("");
    navigate(opt.href);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!showing) { setOpen(true); return; }
      const n = options.length;
      // Past either end, back to the box itself (nothing chosen), as on Wikipedia.
      setActive((i) => (e.key === "ArrowDown" ? (i + 1 >= n ? -1 : i + 1) : (i <= -1 ? n - 1 : i - 1)));
    } else if (e.key === "Enter") {
      if (showing && active >= 0) { e.preventDefault(); go(options[active]); } else setOpen(false);
    } else if (e.key === "Escape") {
      // Close the list only; the menu around a phone's search box stays open.
      if (showing) { e.preventDefault(); e.stopPropagation(); setOpen(false); setActive(-1); }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const listId = `${id}-list`;
  const count = options.length - 1;
  let n = -1;
  const row = (opt) => {
    n += 1;
    const i = n;
    return (
      <div key={opt.key} id={optionId(i)} role="option" aria-selected={i === active} className={`suggest-option${opt.kind === "search" ? " suggest-search" : ""}${i === active ? " active" : ""}`}
        onMouseDown={(e) => e.preventDefault()} onClick={() => go(opt)} onMouseMove={() => active !== i && setActive(i)}>
        {opt.kind === "member" && <>
          <span className="suggest-main"><Marked text={opt.m.name} q={q} /></span> <PartyTag p={opt.m} />{" "}
          <span className="suggest-meta">{opt.m.chamber === "senate" ? t("Senate", "Senado") : t("House", "Cámara")}{opt.m.serving ? "" : t(", former", ", exmiembro")}</span>
        </>}
        {opt.kind === "bill" && <>
          <span className="suggest-num"><BillNumber bill={opt.b} typed={bills.ref} /></span>
          <span className="suggest-title"> · {bills.byNumber ? (opt.b.short_title ?? opt.b.title) : <Marked text={opt.b.short_title ?? opt.b.title} q={q} />}</span>
          <span className="suggest-meta"> ({ordinal(opt.b.congress)})</span>
        </>}
        {opt.kind === "state" && <>
          <span className="suggest-main"><Marked text={opt.p.name} q={q} /></span> <StatePartyTag party={opt.p.party} />{" "}
          <span className="suggest-meta">{opt.p.role ? stateOfficeLabel(opt.p.role, opt.p.state) : opt.p.state}</span>
        </>}
        {opt.kind === "committee" && <>
          <span className="suggest-main"><Marked text={opt.c.name} q={q} /></span>{" "}
          {/* The chamber, unless the name already starts with it ("House Committee on ...") */}
          {!/^(House|Senate|Joint)\b/.test(opt.c.name) && <span className="suggest-meta">{{ house: t("House", "Cámara"), senate: t("Senate", "Senado"), joint: t("Joint", "Conjunto") }[opt.c.chamber] ?? ""}</span>}
        </>}
        {(opt.kind === "topic" || opt.kind === "page") && <span className="suggest-main"><Marked text={opt.label} q={q} /></span>}
        {opt.kind === "search" && <span className="suggest-main">{t(`Search for “${q}”`, `Buscar “${q}”`)}</span>}
      </div>
    );
  };

  return (
    <div className="suggest" ref={wrap}>
      <input type="search" role="combobox" aria-label={ariaLabel} placeholder={placeholder} autoComplete="off" spellCheck={false}
        aria-autocomplete="list" aria-expanded={showing} aria-controls={showing ? listId : undefined}
        aria-activedescendant={showing && active >= 0 ? optionId(active) : undefined}
        value={value} onFocus={() => { prefetch(); setOpen(true); }}
        onChange={(e) => { onValueChange(e.target.value); setOpen(true); }} onKeyDown={onKeyDown} />
      <div className="visually-hidden" aria-live="polite">
        {showing ? (count === 1 ? t("1 suggestion", "1 sugerencia") : t(`${count} suggestions`, `${count} sugerencias`)) : ""}
      </div>
      {showing && (
        <div className="suggest-list" role="listbox" id={listId} ref={list} aria-label={t("Suggestions", "Sugerencias")}>
          {groups.map((g) => (
            <div key={g.key} role="group" aria-label={g.title}>
              <div className="suggest-head" aria-hidden="true">{g.title}</div>
              {g.items.map(row)}
            </div>
          ))}
          {row(options[options.length - 1])}
        </div>
      )}
    </div>
  );
}
