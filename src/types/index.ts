export type groupColor = "grey" | "blue" | "red" | "pink" | "purple" | "red" | "yellow" | "green" | "cyan" | "orange"

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

