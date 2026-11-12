import { getWindowTabs } from "./tabs";
import type { groupColor, Workspace } from "../types";

export async function snapshotLiveGroups(): Promise<Workspace[]> {
    const window = await chrome.windows.getCurrent()
    const grps = await chrome.tabGroups.query({windowId: window.id})
    const tabs = await getWindowTabs()
    const now = Date.now()

    return grps.map((g) => ({
        id: crypto.randomUUID(),
        name: g.title || 'Untitled',
        color: g.color as groupColor,
        tabs: tabs.filter((t) => t.groupId === g.id).sort(
            (a,b) => a.index - b.index
        ).map((t) => ({
            url: t.url,
            title: t.title
        })),
        createdAt: now,
        updatedAt: now,
    }))
}