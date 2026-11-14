import { getWindowTabs } from "./tabs";
import { getWindowMap, loadSpaces, saveSpaces, setWindowMap } from "./storage";
import type { WindowSpace } from "../types";

export async function getCurrentSpace(windowId: number): Promise<WindowSpace> {
    const winkey = String(windowId)
    const mp = await getWindowMap()
    const spaces = await loadSpaces()

    const bound = spaces.find((s) => s.key === mp[winkey])
    if(bound)return bound

    //this is so stupid bbrah. UPD: Doesn't work
    const live = new Set((await getWindowTabs(windowId)).filter((t) => !t.pinned && t.url.startsWith('http')).map((t) => t.url),)
    const taken = new Set(Object.values(mp))
    let best: WindowSpace | undefined
    let bestScore = 0
    for(const s of spaces){
        if(taken.has(s.key))continue
        const urls = new Set(s.workspaces.flatMap((w) => w.tabs.map((t) => t.url)))
        if(urls.size === 0 || live.size === 0)continue
        const shared = [...urls].filter((u) => live.has(u)).length
        const score = shared / Math.min(live.size, urls.size)
        if(score > bestScore){
            best  = s;
            bestScore = score;
        }
    }
    const matched = best && bestScore > 0.5 ? best: undefined
    const space: WindowSpace = matched ?? {
        key: crypto.randomUUID(),
        workspaces: [],
        activeId: null
    }

    if(!matched)await saveSpaces([...spaces,space])
    await setWindowMap({...mp, [winkey]: space.key})
    return space
}   