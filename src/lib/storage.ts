import type { WindowSpace } from "../types";

const KEY = 'spaces'

export async function loadSpaces():Promise<WindowSpace[]> {
    const res = await chrome.storage.local.get(KEY)
    return (res[KEY] as WindowSpace[] |undefined) ?? []
}

export async function saveSpaces(list: WindowSpace[]): Promise<void> {
    await chrome.storage.local.set({[KEY]:list})
}

export async function updateSpace(space: WindowSpace): Promise<void> {
  const all = await loadSpaces()
  await saveSpaces(all.map((s) => (s.key === space.key ? space : s)))
}

//our window id is the key for our space 
export async function getWindowMap(): Promise<Record<string,string>>{
    const res = await chrome.storage.session.get('windowMap')
    return (res.windowMap as Record<string,string> | undefined) ?? {}
}

export async function setWindowMap(map: Record<string,string>): Promise<void>{
    await chrome.storage.session.set({windowMap:map})
}

export async function getLiveMap(): Promise<Record<string,number>>{
    const res = await chrome.storage.session.get('liveMap')
    return (res.liveMap as Record<string,number> | undefined) ?? {}
}

export async function setLiveMap(map:Record<string,number>) {
    await chrome.storage.session.set({liveMap: map})
}