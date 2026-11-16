import { ChevronLeft } from "lucide-react";
import type { SnapshotReason, WindowSpace } from "../types";
import type { SnapshotMap } from "../lib/snapshots";
import { COLOR_HEX, plural, timeAgo } from "../lib/ui";

const REASON: Record<SnapshotReason, string> = {
  autosave: "Autosave",
  "pre-delete": "Before delete",
  "pre-clear": "Before clear",
  "pre-switch": "Before switch",
};

interface Props {
  space: WindowSpace;
  snaps: SnapshotMap;
  busy: boolean;
  onRestore: (snapshotId: string) => void;
  onBack: () => void;
}

export default function History({ space, snaps, busy, onRestore, onBack }: Props) {
  const lists = Object.values(snaps).filter((l) => l[0]?.spaceKey === space.key);
  return (
    <div className="scroll">
      <header className="head">
        <h1><button className="icon" onClick={onBack} aria-label="Back"><ChevronLeft size={18} /></button> History</h1>
      </header>
      <p className="banner">Peel snapshots your workspaces every few minutes, and right before anything destructive. Restore brings a workspace back as a closed one.</p>
      {lists.length === 0 && <p className="empty">No snapshots yet.</p>}
      {lists.map((list) => {
        const latest = list[0];
        const gone = !space.workspaces.some((w) => w.id === latest.workspaceId);
        return (
          <details key={latest.workspaceId} className="card">
            <summary className="card-top">
              <span className="dot" style={{ background: COLOR_HEX[latest.color] }} />
              <span className="name">{latest.name}</span>
              {gone && <span className="pill">deleted</span>}
              <span className="count">{plural(list.length, "snapshot")}</span>
            </summary>
            <ul className="snaps">
              {list.map((s) => (
                <li key={s.id}>
                  <span>
                    {REASON[s.reason]} · {timeAgo(s.takenAt)}
                    <small>{plural(s.tabs.length, "tab")}</small>
                  </span>
                  <button className="link" disabled={busy} onClick={() => onRestore(s.id)}>Restore</button>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
