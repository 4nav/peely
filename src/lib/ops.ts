import { getCurrentSpace } from "./spaces";
import { clearCold, deleteWorkspace, restoreWorkspace, syncSpace } from "./workspace";
import { getLiveMap, getWindowMap, setWindowMap, updateSpace, withLock } from "./storage";

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
        const w = space.workspaces.find((w) => w.id === id);
        if(!w)return;

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
        const nxt = await deleteWorkspace(windowId, space, id, await getLiveMap());
        await syncSpace(windowId, nxt)
    });
}

export async function clearColdIn(windowId: number){
    return withLock(async() => {
        if(!(await isTrackable(windowId)))return;

        const space = await getCurrentSpace(windowId);
        const synced = await syncSpace(windowId, space);
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