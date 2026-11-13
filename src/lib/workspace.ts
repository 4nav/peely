import { getWindowTabs, createGroup } from "./tabs";
import type { groupColor, Workspace, SavedTab, WindowSpace } from "../types";
import { getLiveMap, setLiveMap, updateSpace } from "./storage";

const overlap = (a: string[], b: string[]) => {
    const sb = new Set(b)
    return a.filter((t) => sb.has(t)).length / Math.max(1, Math.min(a.length, b.length))
}


export async function syncSpace(space: WindowSpace){
    const window = await chrome.windows.getCurrent()
    const grps = await chrome.tabGroups.query({windowId: window.id})
    const tabs = await getWindowTabs()
    const now = Date.now()
    const prev = await getLiveMap()

    const tabsOf = (gid: number): SavedTab[] => tabs.filter((t) => t.groupId === gid).sort((a,b) => a.index - b.index).map((t) => ({url: t.url, title: t.title}))
    const live: Record<string, number> = {}
    const open = new Set(grps.map((t) => t.id))

    for(const w of space.workspaces){
        const gid = prev[w.id]
        if(gid !== undefined && open.has(gid)){
            live[w.id] = gid;
            open.delete(gid)
        }
    }

    for(const g of grps.filter((g) => open.has(g.id))){
        const urls = tabsOf(g.id).map((t) => t.url)
        const match = space.workspaces.find((w) => !(w.id in live) && w.name === (g.title || 'Untitled') && overlap(w.tabs.map((t) => t.url), urls) >= 0.5,)
        if(match){
            live[match.id] = g.id;
            open.delete(g.id)
        }
    }

    const byId = new Map(grps.map((t) => [t.id,t]))
    const wrkspcs: Workspace[] = space.workspaces.map((w) => {
        const gid = live[w.id]
        const g = gid !== undefined ? byId.get(gid) : undefined
        return g? {...w, name: g.title || w.name, color: g.color as groupColor, tabs: tabsOf(g.id), updatedAt: now}:w
    })

    for(const gid of open){
        const g = byId.get(gid)!
        const w: Workspace = {
            id: crypto.randomUUID(),
            name: g.title || 'untitled',
            color: g.color as groupColor,
            tabs: tabsOf(gid),
            createdAt: now,
            updatedAt: now,
        }
        wrkspcs.push(w)
        live[w.id] = gid
    }
    const next: WindowSpace = {
        ...space,
        workspaces: wrkspcs,
        activeId: wrkspcs.some((w) => w.id === space.activeId) ? space.activeId : null,
    }
    const mine = new Set(wrkspcs.map((w) => w.id))
    const others = Object.fromEntries(Object.entries(prev).filter(([id]) => !mine.has(id)))
    await updateSpace(next)
    await setLiveMap({...others, ...live})
    return {space: next, live}
}

export async function restoreWorkspace(w: Workspace, live: Record<string,number>){
    const liveGid = live[w.id]
    if(liveGid !== undefined){
        const first = (await getWindowTabs()).find((t) => t.groupId === liveGid)
        if(first)await chrome.tabs.update(first.id, {active: true})
        await chrome.tabGroups.update(liveGid, {collapsed: false})
        return liveGid
    }

    const window = await chrome.windows.getCurrent()
    const existing = (await getWindowTabs()).filter((t) => !t.pinned)
    const ids: number[] = []

    for(const saved of w.tabs){
        if(!saved.url.startsWith('http'))continue
        const open = existing.find((t) => t.url === saved.url && t.groupId === -1 && !ids.includes(t.id),)
        if(open){
            ids.push(open.id);
            continue
        }
        const tab = await chrome.tabs.create({
            windowId: window.id,
            url: saved.url,
            active: false
        })
        if(tab.id !== undefined)ids.push(tab.id)
    }
    const gid = await createGroup(ids, w.name, w.color)
    if (gid !== null) await setLiveMap({ ...(await getLiveMap()), [w.id]: gid })
    return gid
}