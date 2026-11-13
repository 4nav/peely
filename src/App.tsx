import { useCallback, useEffect, useState, useRef } from "react";
import { createGroup, getWindowTabs, ungroup } from './lib/tabs'
import type { groupColor, LiveTab } from './types'
import { updateSpace } from "./lib/storage"
import { syncSpace, restoreWorkspace, deleteWorkspace, clearCold } from './lib/workspace'
import type { WindowSpace } from "./types";
import { getCurrentSpace } from "./lib/spaces";

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

export default function App() {
  const [tabs, setTabs] = useState<LiveTab[]>([])
  const refresh = useCallback(() => {getWindowTabs().then(setTabs)}, [])
  const [space, setSpace] = useState<WindowSpace | null>(null)
  const [live, setLive] = useState<Record<string,number>>({})
  const spaceRef = useRef<WindowSpace | null>(null)
  spaceRef.current = space
  const busy = useRef(false)
  const apply = (x: {space: WindowSpace; live: Record<string,number>}) => {
    setSpace(x.space); 
    setLive(x.live)
  }

  useEffect(() => {
    getCurrentSpace().then(syncSpace).then(apply)
  },[])

  useEffect(() => {
    refresh()
    chrome.tabs.onCreated.addListener(refresh)
    chrome.tabs.onRemoved.addListener(refresh)
    chrome.tabs.onUpdated.addListener(refresh)
    return () => {
    chrome.tabs.onCreated.removeListener(refresh)
    chrome.tabs.onRemoved.removeListener(refresh)
    chrome.tabs.onUpdated.removeListener(refresh)

    }
  }, [refresh])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if(busy.current || !spaceRef.current)return
        syncSpace(spaceRef.current).then(apply)
      }, 600)
    }
    const onTabUpdated = (_id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if('groupId' in info || info.url || info.title)schedule()
    }
    chrome.tabs.onRemoved.addListener(schedule)
    chrome.tabs.onUpdated.addListener(onTabUpdated)
    chrome.tabGroups.onCreated.addListener(schedule)
    chrome.tabGroups.onUpdated.addListener(schedule)
    chrome.tabGroups.onRemoved.addListener(schedule)

    return() => {
      clearTimeout(timer)
      chrome.tabs.onRemoved.removeListener(schedule)
      chrome.tabs.onUpdated.removeListener(onTabUpdated)
      chrome.tabGroups.onCreated.removeListener(schedule)
      chrome.tabGroups.onUpdated.removeListener(schedule)
      chrome.tabGroups.onRemoved.removeListener(schedule)
    }
  }, [])
  return(
    <main style={{padding:16}}>
      <h1>Peel · {tabs.length} tabs </h1>
      <button onClick={() => groupByDomainTest(tabs).then(refresh)}>Test: group by domain</button>{' '}
      <button onClick={() => ungroup(tabs.filter((t) => t.groupId !== -1).map((t) => t.id)).then(refresh)}>Ungroup All</button>
      <button onClick={() => space && syncSpace(space).then(apply)}>
        Sync
      </button>
      <ul>
        {tabs.map((t) => (
          <li key={t.id}>{t.title || t.url} {t.pinned ? '(pinned)':t.groupId !== -1 ? '(grouped)': ''}</li>
        ))}
      </ul>
      <h2>Saved</h2>
      <button onClick={async() => {
        if(!space || !confirm("Remove all closed workspaces? This can't be undone yet.")) return
          await clearCold(space,live).then(syncSpace).then(apply)
      }}>
        Clear Cold
      </button>
      <ul>
        {space?.workspaces.map((t) => (
          <li key = {t.id}>
            {t.id === space.activeId ? '★ ' : ''}{t.name} · {t.tabs.length} tabs ·{' '}
            {live[t.id] !== undefined ? 'live' : 'cold'} {' '}
            <button
              onClick={async () => {
                busy.current = true
                try{
                  await restoreWorkspace(t,live)
                  const active = {...space, activeId: t.id}
                  await updateSpace(active)
                  await syncSpace(active).then(apply)
                } finally{
                  busy.current = false
                }
              }}
            >Open</button>
            <button
              onClick={async() => {
                if(!confirm(
                  live[t.id] !== undefined ? `Delete "${t.name}"? Its tabs stay open but ungrouped.` : `Delete "${t.name}"? This can't be undone yet.`,
                )) return
                try{
                  await deleteWorkspace(space, t.id, live).then(syncSpace).then(apply)
                } finally{
                  busy.current = false
                }
              }}
            >Delete</button>
          </li>
        ))}
      </ul>
    </main>
  )
}