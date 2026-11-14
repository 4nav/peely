import { clearColdIn, deleteWorkspaceIn, forgetWindow, openWorkspace, syncAll, syncWindow } from "../lib/ops";
import type { PeelRequest, PeelResponse } from "../types";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true});
  void syncAll();
});

chrome.runtime.onStartup.addListener(() => {
  void syncAll();
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