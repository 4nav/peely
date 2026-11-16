import { useCallback, useEffect, useState } from "react";
import { getWindowTabs } from "./lib/tabs";
import { readWindowState } from "./lib/storage";
import { loadSnapshots, type SnapshotMap } from "./lib/snapshots";
import type { LiveTab, PeelRequest, PeelResponse, WindowSpace } from "./types";
import { clusterTabs } from "./lib/clustering";
import { parkedWorkspaceIds } from "./lib/park";
import type { PlanItem } from "./lib/ui";
import Workspaces from "./components/Workspaces";
import Review from "./components/Review";
import History from "./components/History";

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
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [unsorted, setUnsorted] = useState<number[]>([]);
  const [view, setView] = useState<'workspaces' | 'review' | 'history'>('workspaces');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  const scan = () => {
    const loose = tabs.filter((t) => !t.pinned && t.groupId === -1 && t.url.startsWith('http'));
    const r = clusterTabs(loose);
    setPlan(r.clusters.map((c) => ({ ...c, on: true })));
    setUnsorted(r.unsorted);
    setView('review');
  };

  const titleOf = (id: number) => {
    const t = tabs.find((x) => x.id === id);
    return t?.title || t?.url || 'Untitled tab';
  };

  return(
    <main className="app">
      {error && <p className="error" role="alert">{error} <button className="link" onClick={() => setError(null)}>Dismiss</button></p>}

      {view === 'workspaces' && (
        <Workspaces
          space={space} live={live} parked={parked} snaps={snaps} busy={busy}
          onScan={scan}
          onHistory={() => setView('history')}
          onOpen={(id) => act(async () => {
            if(windowId === null)return;
            await send({type: "open", windowId, id});
            await refreshState();
            await refreshTabs();
          })}
          onDelete={(id) => act(async () => {
            const w = space?.workspaces.find((x) => x.id === id);
            if(windowId === null || !w)return;
            const msg = live[id] !== undefined ? `Delete "${w.name}"? Its tabs stay open but ungrouped. You can bring it back from History.` : `Delete "${w.name}"? You can bring it back from History.`;
            if(!confirm(msg))return;
            await send({type: "delete", windowId, id});
            await refreshState();
          })}
          onClearCold={() => act(async () => {
            if(windowId === null)return;
            if(!confirm("Remove all closed workspaces? You can bring them back from History"))return;
            await send({type: "clearCold", windowId});
            await refreshState();
          })}
        />
      )}

      {view === 'review' && plan && (
        <Review
          plan={plan} unsorted={unsorted.length} titleOf={titleOf} busy={busy}
          onChange={setPlan}
          onRescan={scan}
          onBack={() => { setPlan(null); setUnsorted([]); setView('workspaces'); }}
          onApply={() => act(async () => {
            if(windowId === null)return;
            await send({
              type: "applyClusters",
              windowId,
              clusters: plan.filter((c) => c.on).map((c) => ({ name: c.name.trim() || "Untitled", tabIds: c.tabIds })),
            });
            setPlan(null);
            setUnsorted([]);
            setView('workspaces');
            await refreshTabs();
            await refreshState();
          })}
        />
      )}

      {view === 'history' && space && (
        <History
          space={space} snaps={snaps} busy={busy}
          onBack={() => setView('workspaces')}
          onRestore={(snapshotId) => act(async () => {
            if(windowId === null)return;
            await send({type: "restoreSnapshot", windowId, snapshotId});
            await refreshState();
            setView('workspaces');
          })}
        />
      )}
    </main>
  );
}
