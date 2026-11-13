import type { groupColor, LiveTab } from "../types";

export async function getWindowTabs(): Promise<LiveTab[]>{
    const win = await chrome.windows.getCurrent()
    const tabs = await chrome.tabs.query({windowId: win.id})
    return tabs.flatMap((t) => 
        t.id === undefined ? []: [{
            id: t.id,
            title: t.title ?? '',
            url: t.url || t.pendingUrl || '',
            pinned: t.pinned,
            groupId: t.groupId,
            index: t.index,
        }],
    )
}

export async function createGroup(tabIds:number[], title: string, color: groupColor): Promise<number|null> {
    if (tabIds.length === 0) return null
    const groupId = await chrome.tabs.group({tabIds: tabIds as [number, ...number[]]})
    await chrome.tabGroups.update(groupId, {title,color})
    return groupId
}

export async function ungroup(tabIds: number[]): Promise<void> {
  if (tabIds.length > 0) await chrome.tabs.ungroup(tabIds as [number, ...number[]])
}