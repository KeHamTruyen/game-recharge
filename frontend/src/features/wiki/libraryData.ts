import type { LibraryItem } from "./types"

let cachedItems: LibraryItem[] | null = null

export async function getLibraryFullData(): Promise<LibraryItem[]> {
  if (cachedItems) return cachedItems
  const mod = await import("@/data/wiki/library_items_full.json")
  cachedItems = (mod.default || mod) as LibraryItem[]
  return cachedItems
}
