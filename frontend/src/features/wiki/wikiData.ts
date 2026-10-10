import rawAniimos from "@/data/wiki/aniimos.json"

import rawGiftcodes from "@/data/wiki/giftcodes.json"

import rawTierStats from "@/data/wiki/tier_stats.json"

import rawTeams from "@/data/wiki/teams.json"

import rawAniipediaTierList from "@/data/wiki/aniipedia_tier_list.json"

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

export interface GuideArticle {
  id: string
  title: string
  category: string
  readTime: string
  summary: string
  content: string[]
}

export const DEFAULT_GUIDES: GuideArticle[] = [
  {
    id: "tan-thu-khoi-dau",
    title: "Cẩm Nang Tân Thủ: 7 Ngày Khởi Đầu Thu Phục Aniimo Hiệu Quả Nhất",
    category: "Tân Thủ",
    readTime: "5 phút",
    summary:
      "Tối ưu lộ trình những ngày đầu trải nghiệm game: cách chọn Aniimo khởi đầu, nhận đủ các mốc quà tân thủ và mở khóa bản đồ thế giới nhanh chóng.",
    content: [
      "1. Chọn Aniimo khởi đầu phù hợp: Khi bắt đầu cuộc phiêu lưu, hãy ưu tiên các thú cưng có khả năng cân bằng giữa sát thương (DPS) và hồi phục. Emberpup hoặc Glacy là 2 lựa chọn cực tốt cho tân thủ.",
      "2. Nhập toàn bộ Giftcode tân thủ: Mở mục Giftcode trên Wiki để nhận hàng ngàn tinh thể và các vật phẩm ấp trứng miễn phí.",
      "3. Chú ý chỉ số Phá Giáp (BREAK): Trong Aniimo, việc phá giáp quái vật nhanh sẽ giúp team gây sát thương gấp 2-3 lần. Luôn kẹp ít nhất 1 thú cưng hệ Phá Giáp trong đội hình.",
      "4. Khám phá bản đồ thế giới: Đừng bỏ qua các rương kho báu và trứng ấp nằm rải rác ở Bình Nguyên Gió Hôn.",
    ],
  },
  {
    id: "toi-uu-tai-nguyen",
    title: "Mẹo Tối Ưu Tinh Thể & Xu Voxel Cho Người Chơi Free-To-Play (F2P)",
    category: "Tài Nguyên",
    readTime: "4 phút",
    summary:
      "Cách tích lũy và sử dụng Tinh Thể Ánh Sáng (Lumin Crystals), Xu Bạn Đồng Hành để không bị thâm hụt tài nguyên khi nâng cấp đội hình.",
    content: [
      "1. Đừng nâng đều tất cả Aniimo: Hãy tập trung 100% tài nguyên nâng max cấp cho 1 chủ lực DPS và 1 Hỗ Trợ chính trước.",
      "2. Tiêu phí Tinh Thể vào đâu: Ưu tiên mở rộng túi đồ và mua các gói vật phẩm tăng tốc ấp trứng thay vì quay gacha vô tội vạ.",
      "3. Hoàn thành nhiệm vụ ngày (Daily Quests): Đây là nguồn thu nhập đá quý và exp ổn định nhất mỗi ngày.",
    ],
  },
  {
    id: "bi-quyet-ap-trung",
    title: "Bí Quyết Ấp Trứng & Săn Biến Thể Hiếm (Shiny / Rare Variant)",
    category: "Ấp Trứng & Bắt Thú",
    readTime: "6 phút",
    summary:
      "Toàn tập về hệ thống ấp trứng Máy Ấp Trứng (Hatchinator), tỉ lệ nở ra biến thể đặc biệt và các điều kiện thời tiết để bắt thú hiếm.",
    content: [
      "1. Kiểm tra thời tiết môi trường: Một số thú cưng chỉ xuất hiện ngoài tự nhiên khi trời mưa sấm sét hoặc ban đêm.",
      "2. Sử dụng đúng loại thức ăn: Mỗi chủng loài Aniimo thích một loại quả/mồi khác nhau, dùng đúng mồi sẽ tăng 40% tỉ lệ bắt thành công.",
      "3. Máy Ấp Trứng cổ đại: Trứng Cổ Đại thu thập từ chiến dịch Egg Heist luôn có tỉ lệ cao nở ra các Aniimo tư chất bậc S.",
    ],
  },
  {
    id: "xay-dung-doi-hinh-meta",
    title: "Hướng Dẫn Build Đội Hình Chuẩn Meta Cho Mọi Phó Bản & Đấu Trường",
    category: "Chiến Thuật",
    readTime: "7 phút",
    summary:
      "Phân tích công thức chuẩn: 1 Tanker/Break + 2 DPS Nguyên Tố + 1 Healer/Buffer giúp bạn vượt qua mọi tầng tháp và Boss thế giới.",
    content: [
      "1. Công thức 4 vị trí vàng: 1 Thú cưng Phá Giáp đứng đầu + 1 DPS chủ lực đơn mục tiêu + 1 DPS diện rộng (AOE) + 1 Healer hồi máu.",
      "2. Kết hợp nguyên tố khắc chế: Lửa > Cây > Đất > Sét > Nước > Lửa. Nắm rõ vòng tuần hoàn này để gây thêm 50% sát thương lên Boss.",
      "3. Sử dụng công cụ Tool Build trên Wiki DUKE1305 để thử nghiệm cộng hưởng chỉ số trước khi dồn đá nâng cấp.",
    ],
  },
]

export function getEffectiveGuides(): GuideArticle[] {
  const map = new Map<string, GuideArticle>(
    DEFAULT_GUIDES.map((g) => [g.id, g]),
  )

  for (const entry of getWikiEntries("guide")) {
    const id = entry.key.slice("guide:".length)
    if (entry.deleted) {
      map.delete(id)
    } else if (entry.data) {
      map.set(id, { ...map.get(id), ...entry.data, id } as GuideArticle)
    }
  }

  return [...map.values()]
}

export async function saveGuide(guide: GuideArticle, isNew: boolean) {
  await writeWiki(
    isNew ? "/guides" : `/guides/${encodeURIComponent(guide.id)}`,
    isNew ? "POST" : "PUT",
    guide,
  )
}

export async function deleteGuide(id: string) {
  await writeWiki(`/guides/${encodeURIComponent(id)}`, "DELETE")
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

export interface TierDefinition {
  rank: string
  label: string
  color: string
  names: string[]
}

const TIER_STORAGE_KEY = "custom_wiki_tier_list"

export function getEffectiveTierList(): TierDefinition[] {
  const custom = getWikiEntries("tierlist").find(
    (e) => !e.deleted && (e.data as any)?.tiers,
  )
  if (custom && Array.isArray((custom.data as any).tiers)) {
    return (custom.data as any).tiers as TierDefinition[]
  }
  const local = localStorage.getItem(TIER_STORAGE_KEY)
  if (local) {
    try {
      const parsed = JSON.parse(local)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {}
  }
  return rawAniipediaTierList as TierDefinition[]
}

export function getEffectiveTierMap(): Record<string, { rank: string; label: string; color: string }> {
  const tiers = getEffectiveTierList()
  const map: Record<string, { rank: string; label: string; color: string }> = {}
  tiers.forEach((tier) => {
    tier.names.forEach((name: string) => {
      map[name.toLowerCase().trim()] = {
        rank: tier.rank,
        label: tier.label,
        color: tier.color,
      }
    })
  })
  return map
}

export async function saveTierList(tiers: TierDefinition[]): Promise<void> {
  await writeWiki("/tier-list", "PUT", tiers)
  localStorage.setItem(TIER_STORAGE_KEY, JSON.stringify(tiers))
  window.dispatchEvent(new CustomEvent("wiki-data-changed"))
}

export async function resetTierListToDefault(): Promise<void> {
  await writeWiki("/tier-list", "DELETE")
  localStorage.removeItem(TIER_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent("wiki-data-changed"))
}

export async function syncAniipediaTierList(): Promise<{
  tiers: TierDefinition[]
  syncedAt: string
  total: number
}> {
  const res = await writeWiki("/sync-aniipedia", "POST", {})
  const resultData = (res as any)?.tiers ? (res as any) : (res as any)?.data
  if (resultData && Array.isArray(resultData.tiers)) {
    localStorage.setItem(TIER_STORAGE_KEY, JSON.stringify(resultData.tiers))
    window.dispatchEvent(new CustomEvent("wiki-data-changed"))
    return {
      tiers: resultData.tiers,
      syncedAt: resultData.syncedAt || new Date().toISOString(),
      total: resultData.total || resultData.tiers.reduce((s: number, t: any) => s + (t.names?.length || 0), 0),
    }
  }
  throw new Error("Không thể đồng bộ dữ liệu từ Aniipedia")
}
