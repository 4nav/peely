import type { Snapshot, SnapshotReason, Workspace } from '../types'

const KEY = 'snapshots'

export const AUTOSAVE_TIMER = 5
export const MAXW = 20
export const STAY = 30 * 24 * 60 * 60 * 1000

export type SnapshotMap = Record<string, Snapshot[]>

export async function loadSnapshots(): Promise<SnapshotMap> {
    const res = await chrome.storage.local.get(KEY)
    return(res[KEY] as SnapshotMap | undefined) ?? {}
}

async function  saveSnapshots(map:SnapshotMap): Promise<void> {
    await chrome.storage.local.set({[KEY]: map})
}

export async function findSnapshot(id:string): Promise<Snapshot | undefined> {
    const map = await loadSnapshots()
    for(const list of Object.values(map)){
        const x = list.find((s) => s.id === id)
        if(x) return x
    }
}

const sameContent = (a: Snapshot, w: Workspace) => 
    a.name === w.name && a.color === w.color && a.tabs.length === w.tabs.length && a.tabs.every((t,i) => t.url === w.tabs[i].url)

function cap(list: Snapshot[]): Snapshot[] {
    let out = list
    while(out.length > MAXW){
        const i = out.findLastIndex((s) => s.reason === 'autosave')
        const drop = i>=0 ? i: out.length - 1
        out = out.filter((_, idx) => idx !== drop)
    }
    return out
}

export interface SnapshotRequest{
    w: Workspace
    spaceKey: string
    reason: SnapshotReason
}

// Caller must hold the storage lock (see ops.ts). One read + one write however many
// snapshots are taken. Autosaves are skipped when nothing changed since the last
// snapshot; pre-* snapshots are always taken. If existingIds is given, history of
// workspaces that no longer exist is dropped once it's older than the TTL.
export async function takeSnapshots(
    items: SnapshotRequest[],
    now: number = Date.now(),
    existingIds?: Set<string>,
): Promise<void> {
    const map = await loadSnapshots()

    for (const { w, spaceKey, reason } of items) {
        if (w.tabs.length === 0) continue // nothing to restore

        const list = map[w.id] ?? []
        if (reason === 'autosave' && list[0] && sameContent(list[0], w)) continue

        const snap: Snapshot = {
            id: crypto.randomUUID(),
            v: 1,
            workspaceId: w.id,
            spaceKey,
            takenAt: now,
            reason,
            name: w.name,
            color: w.color,
            tabs: w.tabs.map((t) => ({
                url: t.url,
                title: t.title.slice(0, 120)
            })),
        }

        map[w.id] = cap([snap, ...list].sort((a, b) => b.takenAt - a.takenAt))
    }

    if (existingIds) {
        for (const [id, list] of Object.entries(map)) {
            if (!existingIds.has(id) && (list[0]?.takenAt ?? 0) < now - STAY) {
                delete map[id]
            }
        }
    }

    await saveSnapshots(map)
}