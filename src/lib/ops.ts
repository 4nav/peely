import { getCurrentSpace } from "./spaces";
import { clearCold, deleteWorkspace, restoreWorkspace, syncSpace } from "./workspace";
import { getLiveMap, getWindowMap, loadSpaces, setWindowMap, updateSpace, withLock } from "./storage";
import { findSnapshot, takeSnapshots } from "./snapshots";
import type { Workspace } from "../types";

async function isTrackable(windowId:number): Promise<boolean> {
    try{
        const window = await chrome.windows.get(windowId)
        return window.type === 'normal'
    } catch{
        return false
    }
}

export async function syncWindow(windowId: number){
    return withLock(async() => {
        if(! await isTrackable(windowId))return;

        const space = await getCurrentSpace(windowId);
        await syncSpace(windowId, space);
    });
}

export async function syncAll(){
    const windows = await chrome.windows.getAll({windowTypes: ['normal']})

    for(const w of windows){
        if(w.id !== undefined){
            await(syncWindow(w.id))
        }
    }
}

export async function openWorkspace(windowId:number, id: string) {
    return withLock(async() => {
        if(!(await isTrackable(windowId)))return;

        const space = await getCurrentSpace(windowId);
        const w = space.workspaces.find((x) => x.id === id);
        if(!w)return;
        
        const cur = space.workspaces.find((w) => w.id === space.activeId)
        if(cur && cur.id !== id){
            const synced = await syncSpace(windowId, space);
            const fresh = synced.space.workspaces.find((x) => x.id === cur.id);

            if(fresh){
                await takeSnapshots([{
                    w:fresh,
                    spaceKey: synced.space.key,
                    reason: 'pre-switch'
                }]);
            }

            const target = synced.space.workspaces.find((x) => x.id === id);
            if (!target) return;
            await restoreWorkspace(windowId, target, synced.live);
            const nxt = {...synced.space, activeId: id};
            await updateSpace(nxt);
            await syncSpace(windowId, nxt);
            return;
        }

        await restoreWorkspace(windowId,w, await getLiveMap());
        const nxt = {...space, activeId: id};
        await updateSpace(nxt)
        await syncSpace(windowId, nxt)
    });
}

export async function deleteWorkspaceIn(windowId: number, id:string){
    return withLock(async() => {
        if(!(await isTrackable(windowId)))return;
        const space = await getCurrentSpace(windowId);
        const synced = await syncSpace(windowId, space);

        const w = synced.space.workspaces.find((x) => x.id === id);
        if(!w)return;

        await takeSnapshots([{
            w,
            spaceKey: synced.space.key,
            reason: 'pre-delete'
        }]);
        const nxt = await deleteWorkspace(windowId, synced.space, id, synced.live);
        await syncSpace(windowId, nxt);
    });
}

export async function clearColdIn(windowId: number){
    return withLock(async() => {
        if(!(await isTrackable(windowId)))return;

        const space = await getCurrentSpace(windowId);
        const synced = await syncSpace(windowId, space);

        const cold = synced.space.workspaces.filter((w) => synced.live[w.id] === undefined);
        if(cold.length ===0)return;

        await takeSnapshots(cold.map((w) => ({
            w,
            spaceKey: synced.space.key,
            reason: 'pre-clear' as const
        })));
        await clearCold(synced.space, synced.live)
    });
}

export async function forgetWindow(windowId:number) {
    return withLock(async () => {
        const map = await getWindowMap();
        delete map[String(windowId)];
        await setWindowMap(map);
    });
}

export async function restoreSnapshotIn(windowId:number, snapshotId: string) {
    return withLock(async () => {
        if(!(await isTrackable(windowId)))return;

        const snap = await findSnapshot(snapshotId);
        if(!snap)return;

        const space = await getCurrentSpace(windowId);
        const taken = (await loadSpaces()).some((s) => s.workspaces.some((w) => w.id === snap.workspaceId));

        const now = Date.now();

        const w: Workspace = {
            id: taken ? crypto.randomUUID() : snap.workspaceId,
            name: taken ? `${snap.name} (restored)` : snap.name,
            color: snap.color,
            tabs:snap.tabs,
            createdAt: now,
            updatedAt: now
        };
        await updateSpace({
            ...space,
            workspaces: [...space.workspaces, w]
        });
    });
}

export async function autosaveSnapshots(now: number = Date.now()){
    return withLock(async() => {
        const spaces = await loadSpaces();

        const items = spaces.flatMap((s) => s.workspaces.map((w) => ({
            w,
            spaceKey: s.key,
            reason: 'autosave' as const
        })));
        await takeSnapshots(items,now, new Set(items.map((i) => i.w.id)));
    });
}