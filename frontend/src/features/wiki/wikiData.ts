import rawAniimos from "@/data/wiki/aniimos.json"

import rawGiftcodes from "@/data/wiki/giftcodes.json"

import rawTierStats from "@/data/wiki/tier_stats.json"

import rawTeams from "@/data/wiki/teams.json"

import { getWikiEntries, writeWiki } from "./wikiStore"

import type {
  AniimoMonster,
  GiftcodeItem,
  CommunityTeam,
  AniimoReview,
} from "./types"

export function getEffectiveGiftcodes(): GiftcodeItem[] {
  const base = new Map<string, GiftcodeItem>(
    (rawGiftcodes.data as GiftcodeItem[]).map((code) => [code.id, code]),
  )

  for (const entry of getWikiEntries("giftcode")) {
    const id = entry.key.slice("giftcode:".length)

    if (entry.deleted) base.delete(id)
    else if (base.has(id) || entry.data.code)
      base.set(id, { ...base.get(id), ...entry.data, id } as GiftcodeItem)
  }

  return [...base.values()]
}

export function getEffectiveAniimos(): AniimoMonster[] {
  const patches = new Map(
    getWikiEntries("aniimo").map((entry) => [
      Number(entry.key.split(":")[1]),
      entry.data as Partial<AniimoMonster>,
    ]),
  )

  return (rawAniimos as AniimoMonster[]).map((monster) => {
    const patch = patches.get(monster.id)

    return patch
      ? { ...monster, ...patch, stats: { ...monster.stats, ...patch.stats } }
      : monster
  })
}

export const tierStatsMap: Record<string, { total: number; score: number }> =
  (rawTierStats as any)?.data as Record<string, {
    total: number
    score: number
  }> || {}

export function sanitizeBrandName(text?: string): string {
  if (!text) return ""

  return text

    .replace(/nexa\s*admin/gi, "DUKE1305 Admin")

    .replace(/nexa/gi, "DUKE1305")
}

export function getEffectiveCommunityTeams(): CommunityTeam[] {
  const teams = new Map<number, CommunityTeam>(
    (rawTeams as CommunityTeam[]).map((team) => [team.id, team]),
  )

  for (const entry of getWikiEntries("team")) {
    const id = Number(entry.key.split(":")[1])

    if (entry.deleted) teams.delete(id)
    else
      teams.set(id, {
        ...teams.get(id),
        ...entry.data,
        id,
        user_id: entry.authorId || undefined,
      } as CommunityTeam)
  }

  return [...teams.values()].map((team) => ({
    ...team,
    nickname: sanitizeBrandName(team.nickname),
  }))
}

export async function addCommunityTeam(team: CommunityTeam) {
  return (await writeWiki("/teams", "POST", team))
    ?.data as unknown as CommunityTeam
}

export async function updateCommunityTeam(team: CommunityTeam) {
  return (await writeWiki(`/teams/${team.id}`, "PUT", team))
    ?.data as unknown as CommunityTeam
}

export async function deleteCommunityTeam(teamId: number) {
  await writeWiki(`/teams/${teamId}`, "DELETE")
}

export function canManageTeam(
  team: CommunityTeam,
  user: { id?: string | number; role?: string } | null,
): boolean {
  return Boolean(
    user &&
      (user.role === "admin" ||
        (user.id &&
          team.isCommunity &&
          team.user_id &&
          String(team.user_id) === String(user.id))),
  )
}

export async function addGiftcodeContribution(item: GiftcodeItem) {
  await writeWiki("/giftcodes", "POST", item)
}

export async function saveGiftcode(item: GiftcodeItem, isNew: boolean) {
  await writeWiki(
    isNew ? "/giftcodes" : `/giftcodes/${encodeURIComponent(item.id)}`,
    isNew ? "POST" : "PUT",
    item,
  )
}

export async function deleteGiftcode(id: string) {
  await writeWiki(`/giftcodes/${encodeURIComponent(id)}`, "DELETE")
}

export async function saveAniimo(monster: AniimoMonster) {
  await writeWiki(`/aniimos/${monster.id}`, "PUT", monster)
}

export async function voteGiftcode(codeId: string, type: "up" | "report") {
  await writeWiki(`/giftcodes/${encodeURIComponent(codeId)}/vote`, "POST", {
    type,
  })
}

export function getAniimoReviews(monsterId: number): AniimoReview[] {
  return getWikiEntries("review")
    .filter((entry) => !entry.deleted && entry.data.monsterId === monsterId)

    .map((entry) => entry.data as unknown as AniimoReview)

    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function addAniimoReview(
  monsterId: number,
  review: Omit<AniimoReview, "id" | "monsterId">,
) {
  await writeWiki(`/aniimos/${monsterId}/reviews`, "POST", review)
}

export function getMonsterById(id: number): AniimoMonster | undefined {
  return getEffectiveAniimos().find((m) => m.id === id)
}

export function getMonsterScore(id: number): number {
  return tierStatsMap[String(id)]?.score ?? 0
}

export function formatImageUrl(url: string | undefined): string {
  if (!url) return ""

  if (url.startsWith("http://") || url.startsWith("https://")) return url

  if (url.startsWith("/wiki/") || url.startsWith("wiki/")) {
    return url.startsWith("/") ? url : "/" + url
  }

  return "https://koiseki.com/" + url.replace(/^\//, "")
}

export const GAME_ELEMENT_ICONS: Record<string, string> = {
  "elem-ice": "/wiki/icons/element-ice.png",

  "elem-water": "/wiki/icons/element-water.png",

  "elem-electric": "/wiki/icons/element-electric.png",

  "elem-fire": "/wiki/icons/element-fire.png",

  "elem-grass": "/wiki/icons/element-grass.png",

  "elem-rock": "/wiki/icons/element-rock.png",

  "elem-wind": "/wiki/icons/element-wind.png",

  "elem-dark": "/wiki/icons/element-dark.png",

  "elem-holy": "/wiki/icons/element-holy.png",
}

export const GAME_ROLE_ICONS: Record<string, string> = {
  "role-dps": "/wiki/icons/class-dps.png",

  "role-break": "/wiki/icons/class-break.png",

  "role-heal": "/wiki/icons/class-healer.png",

  "role-support": "/wiki/icons/class-support.png",

  "role-regen": "/wiki/icons/class-regen.png",
}

export const GAME_RANGE_ICONS: Record<string, string> = {
  range: "/wiki/icons/range_icon.png",

  fly: "/wiki/icons/fly_icon.png",

  pound: "/wiki/icons/pound_icon.png",

  tunnel: "/wiki/icons/tunnel_icon.png",
}

export function getElementIcon(key: string | undefined): string {
  if (!key) return ""

  const lower = key.toLowerCase().trim()

  if (GAME_ELEMENT_ICONS[lower]) return GAME_ELEMENT_ICONS[lower]

  if (lower.includes("băng") || lower.includes("ice"))
    return GAME_ELEMENT_ICONS["elem-ice"]

  if (
    lower.includes("nước") ||
    lower.includes("thủy") ||
    lower.includes("water")
  )
    return GAME_ELEMENT_ICONS["elem-water"]

  if (
    lower.includes("sét") ||
    lower.includes("lôi") ||
    lower.includes("lightning") ||
    lower.includes("electric")
  )
    return GAME_ELEMENT_ICONS["elem-electric"]

  if (lower.includes("lửa") || lower.includes("hỏa") || lower.includes("fire"))
    return GAME_ELEMENT_ICONS["elem-fire"]

  if (lower.includes("cây") || lower.includes("mộc") || lower.includes("grass"))
    return GAME_ELEMENT_ICONS["elem-grass"]

  if (
    lower.includes("đất") ||
    lower.includes("thổ") ||
    lower.includes("rock") ||
    lower.includes("earth")
  )
    return GAME_ELEMENT_ICONS["elem-rock"]

  if (
    lower.includes("gió") ||
    lower.includes("phong") ||
    lower.includes("wind")
  )
    return GAME_ELEMENT_ICONS["elem-wind"]

  if (lower.includes("tối") || lower.includes("ám") || lower.includes("dark"))
    return GAME_ELEMENT_ICONS["elem-dark"]

  if (
    lower.includes("sáng") ||
    lower.includes("quang") ||
    lower.includes("holy") ||
    lower.includes("light")
  )
    return GAME_ELEMENT_ICONS["elem-holy"]

  return ""
}

export function getRoleIcon(key: string | undefined): string {
  if (!key) return ""

  const lower = key.toLowerCase().trim()

  if (GAME_ROLE_ICONS[lower]) return GAME_ROLE_ICONS[lower]

  if (lower.includes("dps")) return GAME_ROLE_ICONS["role-dps"]

  if (lower.includes("break")) return GAME_ROLE_ICONS["role-break"]

  if (lower.includes("heal")) return GAME_ROLE_ICONS["role-heal"]

  if (lower.includes("support")) return GAME_ROLE_ICONS["role-support"]

  if (lower.includes("regen")) return GAME_ROLE_ICONS["role-regen"]

  return ""
}
