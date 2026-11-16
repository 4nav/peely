import { useCallback, useEffect, useState } from "react";
import { createGroup, getWindowTabs, ungroup } from "./lib/tabs";
import { readWindowState } from "./lib/storage";
import { loadSnapshots, type SnapshotMap } from "./lib/snapshots";
import type { groupColor, LiveTab, PeelRequest, PeelResponse, WindowSpace } from "./types";
import { clusterTabs } from "./lib/clustering";
import { parkedWorkspaceIds } from "./lib/park";

const COLORS: groupColor[] = ['blue', 'green', 'yellow', 'pink', 'purple', 'cyan', 'orange', 'red']

const domainof = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

async function groupByDomainTest(tabs: LiveTab[]){
  const byDomain = new Map<string, number[]>()
  for(const t of tabs){
    const d= domainof(t.url)
    if(t.pinned || !d)continue
    byDomain.set(d, [...(byDomain.get(d) ?? []), t.id])
  }
  let i = 0
  for(const [domain, ids] of byDomain){
    if(ids.length < 2)continue
    await createGroup(ids, domain, COLORS[i++ % COLORS.length])
  }
}

async function send(req: PeelRequest){
  const res = await chrome.runtime.sendMessage(req) as PeelResponse | undefined;

  if(!res ?. ok){
    throw new Error(res?.error ?? `Request failed: ${req.type}`);
  }
}

export default function App(){
  const [windowId, setWindowId] = useState<number | null>(null);
  const [tabs, setTabs] = useState<LiveTab[]>([]);
  const [space, setSpace] = useState<WindowSpace | null>(null);
  const [live, setLive] = useState<Record<string,number>>({});
  const [snaps, setSnaps] = useState<SnapshotMap>({});
  const [plan, setPlan] = useState<{ name: string; tabIds: number[]; confidence: number; on: boolean }[] | null>(null);
  const [unsorted, setUnsorted] = useState<number[]>([]);
  const [parked, setParked] = useState<string[]>([]);

  const refreshTabs = useCallback(async() => {
    if(windowId === null)return;
    setTabs(await getWindowTabs(windowId));
  }, [windowId]);

  const refreshState = useCallback(async () => {
    if(windowId === null)return;
    const state = await readWindowState(windowId);
    setSpace(state.space);
    setLive(state.live);
    setSnaps(await loadSnapshots());
    setParked(await parkedWorkspaceIds(state.live));
  }, [windowId]);

  useEffect(() => {
    chrome.windows.getCurrent().then((window) => {
      if(window.id !== undefined)setWindowId(window.id);
    });
  }, []);

  useEffect(() => {
    if(windowId === null)return;

    send({type: "sync", windowId}).then(refreshState);
    refreshTabs();

    const onStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if((areaName === 'local' && (changes.spaces || changes.snapshots)) || areaName==='session'){
        refreshState();
      }
    };
    chrome.storage.onChanged.addListener(onStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, [windowId, refreshState, refreshTabs]);

  useEffect(() => {
    if(windowId === null)return;

    refreshTabs();

    chrome.tabs.onCreated.addListener(refreshTabs);
    chrome.tabs.onRemoved.addListener(refreshTabs);
    chrome.tabs.onUpdated.addListener(refreshTabs);
    chrome.tabs.onMoved.addListener(refreshTabs);

    return () => {
      chrome.tabs.onCreated.removeListener(refreshTabs);
      chrome.tabs.onRemoved.removeListener(refreshTabs);
      chrome.tabs.onUpdated.removeListener(refreshTabs);
      chrome.tabs.onMoved.removeListener(refreshTabs);
    };
  }, [windowId, refreshTabs]);

  return(
    <main style={{padding: 16}}>
      <h1>Peel · {tabs.length} tabs</h1>

      <button onClick={() => groupByDomainTest(tabs).then(refreshTabs)}> Test: Group by Domain</button>{" "}
      <button onClick={() => ungroup(tabs.filter((t) => t.groupId !== -1).map((t) => t.id)).then(refreshTabs)}>Ungrup all</button>
      <button onClick={async() => {
        if(windowId === null)return;
        await send({type: "sync", windowId});
        await refreshState();
      }}> Sync </button>


      <ul>
        {tabs.map((t) => (<li key={t.id}>
          {t.title || t.url}{" "}
          {t.pinned ? "(pinned)": t.groupId !== -1 ? "(grouped)": ""}
        </li>
      ))}
      </ul>
      <h2>Saved</h2>
      <button onClick={async() => {
        if(windowId === null || !space)return;
        if(!confirm("Remove all closed workspaces? You can bring them back from History"))return;

        await send({type: "clearCold", windowId});
        await refreshState();
      }}>Clear Cold</button>
      <button onClick={() => {
        const r = clusterTabs(tabs.filter((t) => !t.pinned && t.groupId === -1 && t.url.startsWith('http')))
        setPlan(r.clusters.map((c) => ({ ...c, on: true })))
        setUnsorted(r.unsorted)
      }}>
        Scan Tabs
      </button>
    {plan && (
      <section>
        <h2>Suggestions</h2>
        {plan.length === 0 && <p>Nothing to group: no loose tabs, or none looked related.</p>}
        {plan.map((c, i) => (
          <div key={i}>
            <input type="checkbox" checked={c.on}
              onChange={() => setPlan(plan.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} />{" "}
            <input value={c.name}
              onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />{" "}
            {c.tabIds.length} tabs · {Math.round(c.confidence * 100)}%
            <ul>
              {c.tabIds.map((id) => <li key={id}>{tabs.find((t) => t.id === id)?.title}</li>)}
            </ul>
          </div>
        ))}
        {unsorted.length > 0 && (
          <div>
            <b>Unsorted · {unsorted.length}</b> (left as they are)
            <ul>
              {unsorted.map((id) => <li key={id}>{tabs.find((t) => t.id === id)?.title}</li>)}
            </ul>
          </div>
        )}
        <button disabled={!plan.some((c) => c.on)} onClick={async () => {
          if (windowId === null) return
          await send({
            type: "applyClusters",
            windowId,
            clusters: plan.filter((c) => c.on).map((c) => ({ name: c.name.trim() || "Untitled", tabIds: c.tabIds })),
          })
          setPlan(null)
          setUnsorted([])
          await refreshTabs()
          await refreshState()
        }}>Apply {plan.filter((c) => c.on).length} groups</button>{" "}
        <button onClick={() => { setPlan(null); setUnsorted([]) }}>Cancel</button>
      </section>
    )}

      <ul>
        {space?.workspaces.map((w) => (
          <li key={w.id}>
            {w.id === space.activeId?"★ " : ""}
            {w.name} · {w.tabs.length} tabs ·{" "}
            {live[w.id] === undefined ? "cold" : parked.includes(w.id) ? "parked" : "live"}{" "}

            <button onClick={async() => {
              if(windowId === null)return;

              await send({
                type: "open",
                windowId,
                id: w.id
              });
              await refreshState();
              await refreshTabs();
            }}>
              Open
            </button>

            <button onClick={async() => {
              if(windowId === null || !space)return;

              const msg = live[w.id] !== undefined ? `Delete "${w.name}"? Its tabs stay open but ungrouped. You can bring it back from History.` : `Delete "${w.name}"? You can bring it back from History.`;
              if(!confirm(msg))return;

              await send({
                type: "delete",
                windowId, 
                id:w.id
              });
              await refreshState();
            }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <h2>History</h2>
      {space && Object.values(snaps).filter((list) => list[0]?.spaceKey === space.key).map((list) => {
        const latest = list[0];
        const gone = !space.workspaces.some((w) => w.id === latest.workspaceId);
        return(
          <details key={latest.workspaceId}>
            <summary>
              {latest.name}{gone ? " · deleted" : ""} · {list.length} snapshots
            </summary>
            <ul>
              {list.map((s) => (
                <li key={s.id}>
                  {new Date(s.takenAt).toLocaleString()} · {s.reason} · {s.tabs.length} tabs{" "}
                  <button onClick={async() => {
                    if(windowId === null)return;

                    await send({
                      type: "restoreSnapshot",
                      windowId,
                      snapshotId: s.id
                    });
                    await refreshState();
                  }}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )
      })}
    </main>
  );
}