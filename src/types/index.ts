export type groupColor = "grey" | "blue" | "red" | "pink" | "purple" | "yellow" | "green" | "cyan" | "orange"

export interface LiveTab {
    id: number
    title: string
    url: string
    pinned: boolean
    groupId: number
    index: number
}

export interface SavedTab {
    url: string
    title: string
}

export interface Workspace {
    id: string
    name: string
    color: groupColor
    tabs: SavedTab[]
    createdAt: number
    updatedAt: number
}

export interface WindowSpace {
    key: string
    workspaces: Workspace[]
    activeId: string | null
}

export type PeelRequest = {
    type: 'sync';
    windowId: number
} | {
    type: 'open';
    windowId: number;
    id: string;
} | {
    type: 'delete';
    windowId: number;
    id: string;
} | {
    type: 'clearCold';
    windowId: number
} | {
    type: 'restoreSnapshot';
    windowId: number;
    snapshotId: string
} | {
    type: 'applyClusters';
    windowId: number;
    clusters: {name:string, tabIds: number[]}[]
}

export type PeelResponse = {ok: true} | {ok: false; error: string}

export type SnapshotReason = 'autosave' | 'pre-delete' | 'pre-clear' | 'pre-switch'

export interface Snapshot{
    id: string
    v: 1
    workspaceId: string
    spaceKey: string
    takenAt: number
    reason: SnapshotReason
    name: string
    color: groupColor
    tabs: SavedTab[]
}

