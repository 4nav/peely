export interface ClusterInput{
    id: number
    url: string
    title: string
}

export interface Cluster {
    name: string
    tabIds: number[]
    confidence: number
}

export interface ClusterRes{
    clusters: Cluster[]
    unsorted: number[]
}

const W = {domain: 0.5, category: 0.45, text: 0.8}
const THRESHOLD = 0.4

const CATEGORIES: Record<string, string[]> = {
  Dev: [
    'github.com', 'gitlab.com', 'stackoverflow.com', 'stackexchange.com', 'localhost',
    'npmjs.com', 'developer.mozilla.org', 'vercel.com', 'netlify.com', 'codepen.io',
    'replit.com', 'leetcode.com', 'codeforces.com', 'geeksforgeeks.org', 'w3schools.com',
    'react.dev', 'vite.dev', 'docs.python.org', 'developer.chrome.com',
  ],
  Entertainment: [
    'youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com', 'primevideo.com',
    'hotstar.com', 'disneyplus.com', 'crunchyroll.com', 'soundcloud.com', 'imdb.com',
  ],
  Social: [
    'reddit.com', 'twitter.com', 'x.com', 'instagram.com', 'facebook.com',
    'linkedin.com', 'discord.com', 'web.whatsapp.com', 'web.telegram.org',
  ],
  Shopping: [
    'amazon.com', 'amazon.in', 'flipkart.com', 'ebay.com', 'etsy.com',
    'aliexpress.com', 'walmart.com',
  ],
  Research: [
    'arxiv.org', 'wikipedia.org', 'scholar.google.com', 'semanticscholar.org', 'nature.com',
    'sciencedirect.com', 'researchgate.net', 'openreview.net', 'acm.org', 'ieee.org', 'jstor.org',
  ],
  Work: [
    'docs.google.com', 'drive.google.com', 'sheets.google.com', 'notion.so', 'figma.com',
    'slack.com', 'trello.com', 'atlassian.net', 'calendar.google.com',
  ],
  Mail: ['mail.google.com', 'outlook.live.com', 'outlook.office.com'],
  AI: ['chatgpt.com', 'claude.ai', 'gemini.google.com'],
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'you', 'are', 'how', 'what',
  'why', 'not', 'new', 'all', 'can', 'has', 'was', 'but', 'about', 'into', 'out', 'more',
  'www', 'com', 'org', 'net', 'http', 'https', 'html', 'index', 'page', 'home',
])

const hostOf = (url: string): string => {
    try {return new URL(url).hostname.replace(/^www\./, '')} catch {return ''}
}

export function categoryOf(host:string):string | null {
    for(const [name, domain] of Object.entries(CATEGORIES)){
        if(domain.some((d) => host === d || host.endsWith('.' + d)))return name
    }
    return null
}

const tokenize = (s:String):string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOP.has(t))

const pathOf = (url: string): string => {
    try {
        return new URL(url).pathname
    } catch{
        return ''
    }
}

const cap = (s:string) => s.charAt(0).toUpperCase() + s.slice(1)

function domainLabel(host:string): string{
    const parts = host.split('.')
    if(parts.length < 2)return cap(host)
    const second = parts[parts.length - 2]
    const pick = ['co', 'com', 'org', 'gov', 'ac'].includes(second) && parts.length >= 3 ? parts[parts.length - 3] : second
    return cap(pick)
}

type Vec = Map<string, number>

function cosine(a: Vec, b: Vec): number{
    let dot = 0
    for(const [k,v] of a){
        const w = b.get(k);;
        if(w)dot += w*v
    }
    const norm = (m:Vec) => Math.sqrt([...m.values()].reduce((s,x) => s + x * x, 0))
    const d = norm(a) * norm(b)
    return d === 0 ? 0: dot/d
}

export function clusterTabs(tabs: ClusterInput[]): ClusterRes{
    const n = tabs.length
    if(n === 0){
        return{
            clusters:[],
            unsorted: []
        }
    }
    const hosts = tabs.map((t) => hostOf(t.url))
    const cats = hosts.map(categoryOf)
    const docs = tabs.map((t) => tokenize(`${t.title} ${pathOf(t.url)}`))

    const df = new Map<string,number>()
    for(const d of docs){
        for(const t of new Set(d)){
            df.set(t, (df.get(t) ?? 0) + 1)
        }
    }
    const vecs: Vec[] = docs.map((d) => {
        const tf = new Map<string,number>()
        for(const t of d){
            tf.set(t, (tf.get(t) ?? 0) + 1)
        }
        const v: Vec = new Map()
        for(const [t,c] of tf){
            v.set(t, c * Math.log((n + 1) / ((df.get(t) ?? 0) + 1) + 1))
        }
        return v        
    })

    const sim: number[][] = Array.from({length: n}, () => new Array<number>(n).fill(0))
    for(let i = 0; i < n; ++i){
        for(let j = i; j < n; ++j){
            const s = (hosts[i] !== '' && hosts[i] === hosts[j] ? W.domain : 0) + (cats[i] !== null && cats[i] === cats[j] ? W.category : 0) + W.text * cosine(vecs[i], vecs[j])
            sim[i][j] = sim[j][i] = Math.min(1,s)
        }
    }

    let groups: number[][] = tabs.map((_,i) => [i])
    const link = (a: number[], b:number[]) => {
        let sum = 0
        for(const x of a){
            for(const y of b){
                sum += sim[x][y]
            }
        }
        return sum / (a.length * b.length)
    }
    while(groups.length > 1){
        let best = -1
        let bi = 0
        let bj = 1
        for(let i = 0; i < groups.length; ++i){
            for(let j = i + 1; j < n; ++j){
                const s = link(groups[i], groups[j])
                if(s > best){
                    best = s
                    bi = i
                    bj = j
                }
            }
        }
        if(best > THRESHOLD)break
        groups[bi] = groups[bi].concat(groups[bj])
        groups = groups.filter((_, idx) => idx !== bj)
    }

    const clusters: Cluster[] = []
    const unsorted: number[] = []
    const usedNames = new Map<string, number>()

    for(const g of groups){
        if(g.length < 2){
            unsorted.push(tabs[g[0]].id);
            continue
        }
        const cnt = <T,>(xs:T[]) => {
            const m = new Map<T,number>()
            for(const x of xs){
                m.set(x,(m.get(x) ?? 0) + 1)
            }
            return [...m.entries()].sort((a,b) => b[1] - a[1])
        }

        const topCat = cnt(g.map((i) => cats[i]).filter((c): c is string => c!== null))[0]
        const topHost = cnt(g.map((i) => hosts[i]).filter((h) => h!== ''))[0] 
        let name: string
        if(topCat && topCat[1] / g.length >= 0.5)name = topCat[0]
        else if(topHost && topHost[1] / g.length >= 0.5)name = domainLabel(topHost[0])
        else{
            const weights = new Map<string, number>()
            for(const i of g){
                for(const [t,w] of vecs[i]){
                    weights.set(t, (weights.get(t) ?? 0) + w)
                }
            }
            const top = [...weights.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
            name = top ? cap(top[0]) : 'Group'
        }
        const seen = usedNames.get(name) ?? 0
        usedNames.set(name, seen + 1)
        if(seen > 0)name = `${name} ${seen + 1}`

        let sum = 0
        let pairs = 0
        for(let a = 0; a < g.length; ++a){
            for(let b = a + 1; b < g.length; ++b){
                sum += sim[g[a]][g[b]];
                pairs++;
            }
        }
        clusters.push({
            name,
            tabIds: g.map((i) => tabs[i].id),
            confidence: Math.round((sum / pairs) * 100)/100,
        })
    }
    clusters.sort((a,b) => b.tabIds.length - a.tabIds.length || a.name.localeCompare(b.name))
    return {clusters, unsorted}
}
