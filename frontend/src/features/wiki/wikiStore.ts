import { client } from "@/services/api"

export type WikiEntry = {
  key: string
  kind: string
  authorId: string | null
  data: Record<string, unknown>
  deleted: boolean
}

declare global {
  interface Window {
    __duke_wiki_entries__?: WikiEntry[]
  }
}

let fallbackEntries: WikiEntry[] = []

function getEntries(): WikiEntry[] {
  if (typeof window !== "undefined") {
    if (!window.__duke_wiki_entries__) window.__duke_wiki_entries__ = []
    return window.__duke_wiki_entries__
  }
  return fallbackEntries
}

function setEntries(items: WikiEntry[]) {
  if (typeof window !== "undefined") {
    window.__duke_wiki_entries__ = items
  } else {
    fallbackEntries = items
  }
}

let pending: Promise<void> | null = null

export function getWikiEntries(kind: string, includeDeleted = false) {
  return getEntries().filter((entry) => entry.kind === kind && (includeDeleted || !entry.deleted))
}

let currentFetchId = 0

export function refreshWiki(force = false): Promise<void> {
  if (typeof document !== "undefined" && document.visibilityState === "hidden" && !force) {
    return Promise.resolve()
  }
  if (!force && pending) {
    return pending
  }
  const fetchId = ++currentFetchId
  pending = (async () => {
    const next: WikiEntry[] = []
    let cursor: string | null = null
    do {
      const result: { data: { entries: WikiEntry[]; next: string | null } } =
        await client.request(
          `/wiki${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`,
        )
      if (fetchId !== currentFetchId) return
      next.push(...result.data.entries)
      cursor = result.data.next
    } while (cursor)
    if (fetchId !== currentFetchId) return
    setEntries(next)
    window.dispatchEvent(new Event("wiki-data-changed"))
  })().finally(() => {
    if (fetchId === currentFetchId) {
      pending = null
    }
  })
  return pending
}


export async function writeWiki(path: string, method: string, body?: unknown) {
  const response = await client.request<{ success?: boolean; data?: any }>(`/wiki${path}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  // Read after an in-flight poll finishes so a stale poll cannot replace the write.
  if (pending) await pending.catch(() => {})
  try {
    await refreshWiki()
  } catch (refreshErr) {
    console.warn("Wiki write succeeded but background refresh failed:", refreshErr)
  }
  return response.data !== undefined ? response.data : response
}
