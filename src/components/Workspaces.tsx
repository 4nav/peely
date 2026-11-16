import { useState } from "react";
import type { WindowSpace } from "../types";
import type { SnapshotMap } from "../lib/snapshots";
import { COLOR_HEX, plural, timeAgo } from "../lib/ui";
import Banana from "./Banana";

interface Props {
  space: WindowSpace | null;
  live: Record<string, number>;
  parked: string[];
  snaps: SnapshotMap;
  busy: boolean;
  onScan: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClearCold: () => void;
  onHistory: () => void;
}

export default function Workspaces({ space, live, parked, snaps, busy, onScan, onOpen, onDelete, onClearCold, onHistory }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const all = space?.workspaces ?? [];
  const shown = q
    ? all.filter((w) => w.name.toLowerCase().includes(q) || w.tabs.some((t) => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q)))
    : all;
  const coldCount = all.filter((w) => live[w.id] === undefined).length;

  return (
    <>
      <div className="scroll">
        <header className="head">
          <h1><Banana /> Workspaces</h1>
          <button className="btn soft" onClick={onScan}>Scan tabs</button>
        </header>

        <input className="search" placeholder="Search workspaces and tabs" value={query} onChange={(e) => setQuery(e.target.value)} />

        {all.length === 0 && (
          <p className="empty">No workspaces yet. Hit <b>Scan tabs</b> and Peel will suggest some from your loose tabs.</p>
        )}
        {all.length > 0 && shown.length === 0 && <p className="empty">Nothing matches “{query}”.</p>}

        {shown.map((w) => {
          const active = w.id === space?.activeId;
          const isLive = live[w.id] !== undefined;
          const isParked = parked.includes(w.id);
          const status = active ? `${plural(w.tabs.length, "tab")} open` : isParked ? "Parked in the background" : isLive ? "Open in this window" : "Closed, ready to restore";
          return (
            <article key={w.id} className={`card${active ? " active" : ""}`}>
              <div className="card-top">
                <span className="dot" style={{ background: COLOR_HEX[w.color] }} />
                <span className="name">{w.name}</span>
                {active ? <span className="pill strong">Active</span> : <span className="count">{plural(w.tabs.length, "tab")}</span>}
              </div>
              <p className="meta">{status}</p>
              <p className="meta">Saved {timeAgo(w.updatedAt)}</p>
              <div className="card-bottom">
                {active ? <span /> : <button className="link" disabled={busy} onClick={() => onOpen(w.id)}>Switch to this</button>}
                <span className="row">
                  <button className="link danger" disabled={busy} onClick={() => onDelete(w.id)}>Delete</button>
                  {(snaps[w.id]?.length ?? 0) > 0 && <span className="pill">Snapshot ok</span>}
                </span>
              </div>
            </article>
          );
        })}

        {coldCount > 0 && (
          <button className="link danger center" disabled={busy} onClick={onClearCold}>Clear {plural(coldCount, "closed workspace")}</button>
        )}
      </div>
      <footer className="footer">
        <button className="btn soft wide" onClick={onHistory}>History and undo</button>
      </footer>
    </>
  );
}
