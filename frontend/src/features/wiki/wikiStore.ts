import { client } from "@/services/api"

export type WikiEntry = {
  key: string
  kind: string
  authorId: string | null
  data: Record<string, unknown>
  deleted: boolean
}

let entries: WikiEntry[] = []
let pending: Promise<void> | null = null

export function getWikiEntries(kind: string) {
  return entries.filter((entry) => entry.kind === kind)
}

export function refreshWiki(): Promise<void> {
  if (pending) return pending
  pending = (async () => {
    const next: WikiEntry[] = []
    let cursor: string | null = null
    do {
      const result: { data: { entries: WikiEntry[]; next: string | null } } =
        await client.request(
          `/wiki${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`,
        )
      next.push(...result.data.entries)
      cursor = result.data.next
    } while (cursor)
    entries = next
    window.dispatchEvent(new Event("wiki-data-changed"))
  })().finally(() => {
    pending = null
  })
  return pending
}

export async function writeWiki(path: string, method: string, body?: unknown) {
  const response = await client.request<{ data?: WikiEntry }>(`/wiki${path}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  // Read after an in-flight poll finishes so a stale poll cannot replace the write.
  if (pending) await pending.catch(() => {})
  await refreshWiki()
  return response.data
}
