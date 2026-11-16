import { getLiveMap, setLiveMap } from "./storage";

const KEY = 'parkWindowId'

export async function getParkWindowId(): Promise<number | null> {
    const id = (await chrome.storage.local.get(KEY))[KEY] as number | undefined
    if(id === undefined)return null
    try{
        await chrome.windows.get(id)
        return id
    } catch{
        return null
    }
}

export async function clearParkWindowId(): Promise<void>{
    await chrome.storage.local.remove(KEY)
}

async function ensureParkWindow(): Promise<number>{
    const existing = await getParkWindowId()
    if(existing !== null)return existing
    const w = await chrome.windows.create({state: "minimized", url: "about: blank"})
    if(w?.id === undefined)throw new Error('Could not create the second window')
    await chrome.storage.local.set({[KEY]: w.id})
    return w.id
}

export async function parkGroup(wsId: string, gid: number): Promise<void> {
    const parkId = await ensureParkWindow()
    for(const t of await chrome.tabs.query({groupId: gid})){
        if(t.id !== undefined)await chrome.tabs.update(t.id, {muted: true})
    }
    const moved = await chrome.tabGroups.move(gid, {windowId: parkId, index: -1})
    if(!moved)throw new Error('could not park the group')
    await setLiveMap({...(await getLiveMap()), [wsId]: moved.id})
}

export async function unparkGroup(windowId:number, wsId: string, gid: number): Promise<void> {
    const moved = await chrome.tabGroups.move(gid, {windowId, index: -1})
    if(!moved)throw new Error('could not bring the group back')
    const tabs = (await chrome.tabs.query({groupId: moved.id})).sort((a,b) => a.index - b.index)
    for(const t of tabs){
        if(t.id !== undefined){
            await chrome.tabs.update(t.id, {muted:false})
        }
    }
    if(tabs[0].id !== undefined)await chrome.tabs.update(tabs[0].id, {active: true})
    await setLiveMap({...(await getLiveMap()), [wsId]: moved.id})
}

export async function parkedWorkspaceIds(live: Record<string, number>): Promise<string[]>{
    const parkId = await getParkWindowId()
    if(parkId === null)return[]
    const gids = new Set((await chrome.tabGroups.query({windowId: parkId})).map((g) => g.id))
    return Object.entries(live).filter(([,gid]) => gids.has(gid)).map(([id]) => id)
}