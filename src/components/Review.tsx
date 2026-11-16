import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { COLORS } from "../lib/ops";
import { COLOR_HEX, plural, type PlanItem } from "../lib/ui";
import Banana from "./Banana";

interface Props {
  plan: PlanItem[];
  unsorted: number;
  titleOf: (id: number) => string;
  busy: boolean;
  onChange: (plan: PlanItem[]) => void;
  onApply: () => void;
  onRescan: () => void;
  onBack: () => void;
}

function Suggestion({ c, color, titleOf, onChange }: { c: PlanItem; color: string; titleOf: (id: number) => string; onChange: (c: PlanItem) => void }) {
  const [open, setOpen] = useState(false);
  const rest = c.tabIds.length - 2;
  const ids = open ? c.tabIds : c.tabIds.slice(0, 2);
  return (
    <article className={`card${c.on ? "" : " off"}`}>
      <div className="card-top">
        <button className="check" role="switch" aria-checked={c.on} aria-label={`Include ${c.name}`} onClick={() => onChange({ ...c, on: !c.on })} />
        <span className="dot" style={{ background: color }} />
        <input className="name-input" value={c.name} aria-label="Workspace name" onChange={(e) => onChange({ ...c, name: e.target.value })} />
        <span className="count">{plural(c.tabIds.length, "tab")}</span>
      </div>
      <ul className="tablist">
        {ids.map((id) => <li key={id}>{titleOf(id)}</li>)}
      </ul>
      <div className="card-bottom">
        {rest > 0 ? <button className="link" onClick={() => setOpen(!open)}>{open ? "Show less" : `+${rest} more`}</button> : <span />}
        <span className="pill">{Math.round(c.confidence * 100)}% match</span>
      </div>
    </article>
  );
}

export default function Review({ plan, unsorted, titleOf, busy, onChange, onApply, onRescan, onBack }: Props) {
  const on = plan.filter((c) => c.on).length;
  const total = plan.reduce((n, c) => n + c.tabIds.length, 0);
  // mirrors applyClustersIn: colours go to enabled clusters, in order
  const colors = plan.map((c, i) => c.on ? COLOR_HEX[COLORS[plan.slice(0, i).filter((x) => x.on).length % COLORS.length]] : COLOR_HEX.grey);

  return (
    <>
      <div className="scroll">
        <header className="head">
          <h1><button className="icon" onClick={onBack} aria-label="Back"><ChevronLeft size={18} /></button><Banana /> Peel</h1>
          <button className="btn soft" onClick={onRescan}>Rescan</button>
        </header>

        {plan.length === 0 ? (
          <p className="empty">Nothing to group: no loose tabs, or none looked related.</p>
        ) : (
          <p className="banner">
            {plural(total, "tab")} became {plural(plan.length, "suggested workspace")}. Rename them or switch any off. Nothing changes until you approve.
            {unsorted > 0 && ` ${plural(unsorted, "tab")} didn't fit anywhere and stay as they are.`}
          </p>
        )}

        {plan.map((c, i) => (
          <Suggestion
            key={i}
            c={c}
            color={colors[i]}
            titleOf={titleOf}
            onChange={(x) => onChange(plan.map((p, j) => (j === i ? x : p)))}
          />
        ))}
      </div>
      <footer className="footer">
        <button className="btn primary wide" disabled={on === 0 || busy} onClick={onApply}>Apply {plural(on, "workspace")}</button>
        <p className="note">Your tabs stay open. This only groups them.</p>
      </footer>
    </>
  );
}
