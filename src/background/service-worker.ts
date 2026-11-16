import { applyClustersIn, autosave,clearColdIn, deleteWorkspaceIn,  forgetWindow, openWorkspace, restoreSnapshotIn, syncAll, syncWindow} from "../lib/ops";
import { AUTOSAVE_TIMER } from "../lib/snapshots";
import { clearParkWindowId } from "../lib/park";
import type { PeelRequest, PeelResponse } from "../types";

const AUTOSAVE_ALARM = 'peel-autosave';

async function ensureAutosaveAlarm() {
  if(await chrome.alarms.get(AUTOSAVE_ALARM))return;

  await chrome.alarms.create(AUTOSAVE_ALARM, {
    delayInMinutes: AUTOSAVE_TIMER,
    periodInMinutes: AUTOSAVE_TIMER
  });
}

void ensureAutosaveAlarm().catch((error: unknown) => {
  console.error("[peel] failed to initialize autosave alarm", error);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if(alarm.name !== AUTOSAVE_ALARM)return;

  void syncAll().then(() => autosave()).catch((error: unknown) => {
    console.error("[peel] autosave failed", error);
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true});
  void syncAll();
});

chrome.runtime.onStartup.addListener(() => {
  void clearParkWindowId().then(() => syncAll());
});

const timers = new Map<number, ReturnType<typeof setTimeout>>();

function scheduleSync(windowId: number){
  if(windowId === chrome.windows.WINDOW_ID_NONE)return;

  const old = timers.get(windowId);
  if(old !== undefined)clearTimeout(old)

  timers.set(windowId, setTimeout(() => {
    timers.delete(windowId);
    void syncWindow(windowId);
  }, 600));
}

chrome.tabs.onCreated.addListener((tab) => {
  if(tab.windowId !== undefined)scheduleSync(tab.windowId);
});

chrome.tabs.onRemoved.addListener((_tabId, info) =>{ 
  if(!info.isWindowClosing)scheduleSync(info.windowId);
});

chrome.tabs.onUpdated.addListener((_tabId, _changeInfo, tab) => {
  if(tab.windowId !== undefined)scheduleSync(tab.windowId);
});

chrome.tabs.onMoved.addListener((_tabId, info) =>{
  scheduleSync(info.windowId);
});

chrome.tabGroups.onCreated.addListener((group) => {
  scheduleSync(group.windowId);
});

chrome.tabGroups.onUpdated.addListener((group) => {
    scheduleSync(group.windowId);
});

chrome.tabGroups.onRemoved.addListener((group) => {
  scheduleSync(group.windowId);
});

chrome.windows.onRemoved.addListener((windowId) => {
  const timer = timers.get(windowId);

  if(timer !== undefined){
    clearTimeout(timer);
    timers.delete(windowId);
  }

  void forgetWindow(windowId);
});

async function run(req: PeelRequest): Promise<void>{
  switch(req.type){
    case "sync":
      await syncWindow(req.windowId);
      break;
    case "open":
      await openWorkspace(req.windowId, req.id);
      break;
    case "delete":
      await deleteWorkspaceIn(req.windowId, req.id);
      break;
    case "clearCold":
      await clearColdIn(req.windowId);
      break;
    case "restoreSnapshot": 
      await restoreSnapshotIn(req.windowId, req.snapshotId);
      break;
    case "applyClusters":
      await applyClustersIn(req.windowId, req.clusters);
      break;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void run(message as PeelRequest).then(() => sendResponse({ok: true} satisfies PeelResponse)).catch((error: unknown)=>{
    sendResponse({
      ok:false,
      error:String(error),
    } satisfies PeelResponse);
  });
  return true;
});