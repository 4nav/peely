import { getCurrentSpace } from "./spaces";
import { clearCold, deleteWorkspace, restoreWorkspace, syncSpace } from "./workspace";
import { getLiveMap, getWindowMap, loadSpaces, setWindowMap, updateSpace, withLock } from "./storage";
import { findSnapshot, takeSnapshots } from "./snapshots";
import { getParkWindowId, parkGroup, parkedWorkspaceIds, unparkGroup } from "./park";
import { createGroup, getWindowTabs } from "./tabs";
import type { groupColor, Workspace } from "../types";

async function isTrackable(windowId:number): Promise<boolean> {
    try{
        if(windowId === await getParkWindowId())return false
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

export async function openWorkspace(windowId: number, id: string){
    return withLock(async() => {
        if(!(await isTrackable(windowId)))return;

        const space = await getCurrentSpace(windowId);
        const synced = await syncSpace(windowId, space);
        const target  = synced.space.workspaces.find((x) => x.id === id)
        if(!target)return;

        const parkedNow = await parkedWorkspaceIds(synced.live);
        const onScreen = synced.space.workspaces.filter((w) => w.id !== id && synced.live[w.id] !== undefined && !parkedNow.includes(w.id));

        if(onScreen.length > 0){
            await takeSnapshots(onScreen.map((w) => ({
                w,
                spaceKey: synced.space.key,
                reason: 'pre-switch' as const
            })));
        }

        if(parkedNow.includes(id))await unparkGroup(windowId, id, synced.live[id]);
        else await restoreWorkspace(windowId, target, synced.live);

        const liveNow = await getLiveMap();
        const toPark = onScreen.filter((w) => liveNow[w.id]);
        const parkGids = new Set(toPark.map((w) => liveNow[w.id]));
        const remaining = (await getWindowTabs(windowId)).filter((t) => !parkGids.has(t.groupId));

        if(toPark.length > 0 && remaining.length == 0){
            await chrome.tabs.create({windowId, active: true});
        }
        for (const w of toPark){
            await parkGroup(w.id, liveNow[w.id]);
        }
        const nxt = {...synced.space, activeId: id};
        await updateSpace(nxt);
        await syncSpace(windowId, nxt);
    });
}

export async function deleteWorkspaceIn(windowId:number, id: string) {
    return withLock(async() => {
        if(!(await isTrackable(windowId)))return;
        const space = await getCurrentSpace(windowId);
        const synced = await syncSpace(windowId, space);

        const w = synced.space.workspaces.find((x) => x.id === id);
        if(!w)return;

        await takeSnapshots(([{
            w,
            spaceKey: synced.space.key,
            reason: 'pre-delete'
        }]));
        const nxt = await deleteWorkspace(windowId, synced.space, id, synced.live);
        await syncSpace(windowId, nxt);
    });
}

export async function clearColdIn(windowId:number) {
    return withLock(async() => {
        if(!(await isTrackable(windowId)))return;

        const space = await getCurrentSpace(windowId);
        const synced = await syncSpace(windowId, space);

        const cold = synced.space.workspaces.filter((w) => synced.live[w.id] === undefined);;
        if(cold.length === 0)return;

        await takeSnapshots(cold.map((w) => ({
            w,
            spaceKey: synced.space.key,
            reason: 'pre-clear' as const
        })));
        await clearCold(synced.space, synced.live)
    });
}

export async function forgetWindow(windowId: number){
    return withLock(async() => {
        const mp = await getWindowMap();
        delete mp[String(windowId)];
        await setWindowMap(mp);
    });
}

export async function restoreSnapshotIn(windowId: number, snapshotId: string){
    return withLock(async () => {
        if(!(await isTrackable(windowId)))return;

        const snap = await findSnapshot(snapshotId);
        if(!snap)return;

        const space = await getCurrentSpace(windowId);
        const taken = (await loadSpaces()).some((s) => s.workspaces.some((w) => w.id === snap.workspaceId));
        const now = Date.now();

        const w: Workspace = {
            id:taken? crypto.randomUUID(): snap.workspaceId,
            name: taken ? `${snap.name} (restored)`: snap.name,
            color: snap.color,
            tabs: snap.tabs,
            createdAt: now,
            updatedAt: now
        };
        await updateSpace({...space, workspaces:[...space.workspaces, w]});
    });
}

export async function autosave(now: number = Date.now()) {
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

const COLORS: groupColor[] = ['blue', 'green', 'yellow', 'pink', 'purple', 'cyan','orange', 'red', 'grey']

export async function applyClustersIn(windowId: number, clusters: { name: string; tabIds: number[] }[]) {
    return withLock(async () => {
        if(!(await isTrackable(windowId)))return;

        const tabs = await getWindowTabs(windowId);
        const valid = new Set(tabs.filter((t) => !t.pinned && t.groupId === -1).map((t) => t.id));

        let i = 0;
        for(const c of clusters){
            const ids = c.tabIds.filter((id) => valid.has(id));
            if(ids.length === 0)continue;
            await createGroup(ids, c.name, COLORS[i++ % COLORS.length]);
        }

        const space = await getCurrentSpace(windowId);
        await syncSpace(windowId, space);
    });
}
