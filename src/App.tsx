import { useCallback, useEffect, useState } from "react";
import { createGroup, getWindowTabs, ungroup } from "./lib/tabs";
import { readWindowState } from "./lib/storage";
import type { groupColor, LiveTab, PeelRequest, PeelResponse, WindowSpace } from "./types";
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

  const refreshTabs = useCallback(async() => {
    if(windowId === null)return;
    setTabs(await getWindowTabs(windowId));
  }, [windowId]);

  const refreshState = useCallback(async () => {
    if(windowId === null)return;
    const state = await readWindowState(windowId);
    setSpace(state.space);
    setLive(state.live);
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
      if((areaName === 'local' && changes.spaces) || (areaName === 'session')){
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
        if(!confirm("Remove all closed workspaces? This can't be undone yet."))return;

        await send({type: "clearCold", windowId});
        await refreshState();
      }}>Clear Cold</button>

      <ul>
        {space?.workspaces.map((w) => (
          <li key={w.id}>
            {w.id === space.activeId?"★ " : ""}
            {w.name} · {w.tabs.length} tabs ·{" "}
            {live[w.id] !== undefined? "live": "cold"}{" "}

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

              const msg = live[w.id] !== undefined ? `Delete "${w.name}"? Its tabs stay open but ungrouped.` : `Delete "${w.name}"? This can't be undone yet.`;
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
    </main>
  );
}