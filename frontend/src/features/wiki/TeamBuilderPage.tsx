import { libraryFullData } from "./libraryData"

import React, { useState, useEffect, useMemo } from "react"

import {
  getEffectiveAniimos,
  addCommunityTeam,
  updateCommunityTeam,
  deleteCommunityTeam,
  getEffectiveCommunityTeams,
  canManageTeam,
  getMonsterById,
  formatImageUrl,
  sanitizeBrandName,
} from "./wikiData"

import type {
  AniimoMonster,
  LibraryItem,
  CombatSkill,
  CommunityTeam,
} from "./types"

import { useAppStore } from "@/app/AppStore"

import { Link, useSearchParams } from "react-router"

import { Icon } from "@/components/ui"

// 9 Elements definition with icons & colors

export interface ElementDef {
  id: string

  slug: string

  name: string

  viName: string

  icon: string

  color: string

  bgLight: string
}

export const ELEMENTS: ElementDef[] = [
  {
    id: "elem-ice",

    slug: "elem-ice",

    name: "Ice",

    viName: "Băng",

    icon: "/wiki/icons/element-ice.png",

    color: "#38C6E2",

    bgLight: "rgba(56, 198, 226, 0.2)",
  },

  {
    id: "elem-water",

    slug: "elem-water",

    name: "Water",

    viName: "Nước",

    icon: "/wiki/icons/element-water.png",

    color: "#4A90E2",

    bgLight: "rgba(74, 144, 226, 0.2)",
  },

  {
    id: "elem-electric",

    slug: "elem-electric",

    name: "Lightning",

    viName: "Sét",

    icon: "/wiki/icons/element-electric.png",

    color: "#E6C622",

    bgLight: "rgba(230, 198, 34, 0.2)",
  },

  {
    id: "elem-fire",

    slug: "elem-fire",

    name: "Fire",

    viName: "Lửa",

    icon: "/wiki/icons/element-fire.png",

    color: "#E7534A",

    bgLight: "rgba(231, 83, 74, 0.2)",
  },

  {
    id: "elem-grass",

    slug: "elem-grass",

    name: "Grass",

    viName: "Cây",

    icon: "/wiki/icons/element-grass.png",

    color: "#4CAF6A",

    bgLight: "rgba(76, 175, 106, 0.2)",
  },

  {
    id: "elem-rock",

    slug: "elem-rock",

    name: "Earth",

    viName: "Đất",

    icon: "/wiki/icons/element-rock.png",

    color: "#BD9E73",

    bgLight: "rgba(189, 158, 115, 0.2)",
  },

  {
    id: "elem-wind",

    slug: "elem-wind",

    name: "Wind",

    viName: "Gió",

    icon: "/wiki/icons/element-wind.png",

    color: "#58C9B1",

    bgLight: "rgba(88, 201, 177, 0.2)",
  },

  {
    id: "elem-dark",

    slug: "elem-dark",

    name: "Dark",

    viName: "Bóng Tối",

    icon: "/wiki/icons/element-dark.png",

    color: "#7B4CAC",

    bgLight: "rgba(123, 76, 172, 0.2)",
  },

  {
    id: "elem-holy",

    slug: "elem-holy",

    name: "Light",

    viName: "Ánh Sáng",

    icon: "/wiki/icons/element-holy.png",

    color: "#F5A623",

    bgLight: "rgba(245, 166, 35, 0.2)",
  },
]

// The exact relationship mapping extracted from DUKE1305

export const ELEMENT_RELATIONS: Record<string, {
  atk_high: string[]
  atk_low: string[]
}> = {
  "elem-ice": {
    atk_high: ["elem-water", "elem-electric"],

    atk_low: ["elem-ice", "elem-fire", "elem-rock"],
  },

  "elem-water": {
    atk_high: ["elem-fire", "elem-rock"],

    atk_low: ["elem-ice", "elem-water", "elem-grass", "elem-holy"],
  },

  "elem-electric": {
    atk_high: ["elem-water", "elem-wind"],

    atk_low: ["elem-ice", "elem-electric", "elem-rock"],
  },

  "elem-fire": {
    atk_high: ["elem-ice", "elem-grass"],

    atk_low: ["elem-water", "elem-fire", "elem-rock", "elem-holy"],
  },

  "elem-grass": {
    atk_high: ["elem-water", "elem-rock"],

    atk_low: ["elem-fire", "elem-grass", "elem-holy"],
  },

  "elem-rock": {
    atk_high: ["elem-ice", "elem-fire"],

    atk_low: ["elem-water", "elem-grass", "elem-rock", "elem-dark"],
  },

  "elem-wind": {
    atk_high: ["elem-grass", "elem-dark"],

    atk_low: ["elem-electric", "elem-wind"],
  },

  "elem-dark": {
    atk_high: ["elem-electric", "elem-grass", "elem-holy"],

    atk_low: ["elem-water", "elem-wind"],
  },

  "elem-holy": {
    atk_high: ["elem-wind", "elem-dark"],

    atk_low: ["elem-electric", "elem-holy"],
  },
}

// 4 slots data

interface SlotData {
  monster: AniimoMonster | null

  skills: (CombatSkill | null)[]

  item: LibraryItem | null
}

const DEFAULT_SLOTS: SlotData[] = [
  { monster: null, skills: [null, null, null], item: null },

  { monster: null, skills: [null, null, null], item: null },

  { monster: null, skills: [null, null, null], item: null },

  { monster: null, skills: [null, null, null], item: null },
]

export default function TeamBuilderPage() {
  const { user } = useAppStore()

  const [monsters, setMonsters] = useState<AniimoMonster[]>(
    getEffectiveAniimos(),
  )

  // Accordion collapsed states (all open by default like DUKE1305)

  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(
    {
      matrix: true,

      boss: true,

      calcResult: true,

      topAttack: true,

      topSupport: true,

      teamBuilder: true,
    },
  )

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Element Matrix Tab (elem vs range)

  const [matrixTab, setMatrixTab] = useState<"elem" | "range">("elem")

  const [hoveredCell, setHoveredCell] = useState<{
    atk: string
    def: string
  } | null>(null)

  // Boss Element selection: atk_1, atk_2, def_1, def_2

  const [bossElements, setBossElements] = useState<{
    atk_1: string

    atk_2: string

    def_1: string

    def_2: string
  }>({
    atk_1: "",

    atk_2: "",

    def_1: "",

    def_2: "",
  })

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  // 4 Slots Team Builder State

  const [slots, setSlots] = useState<SlotData[]>(DEFAULT_SLOTS)

  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0)

  const [pickerTab, setPickerTab] = useState<"monster" | "skill" | "item">(
    "monster",
  )

  const [skillSlotEditing, setSkillSlotEditing] = useState<number>(0)

  // Meta & Publishing state

  const [searchParams, setSearchParams] = useSearchParams()

  const isAdmin = user?.role === "admin"

  const [communityTeams, setCommunityTeams] = useState<CommunityTeam[]>(
    getEffectiveCommunityTeams(),
  )

  const [editingTeam, setEditingTeam] = useState<CommunityTeam | null>(null)

  const [isEditSaved, setIsEditSaved] = useState(false)

  const [manageModalOpen, setManageModalOpen] = useState(false)

  const [manageSearchQuery, setManageSearchQuery] = useState("")

  const [teamTitle, setTeamTitle] = useState("")

  const [teamDesc, setTeamDesc] = useState("")

  const [searchQuery, setSearchQuery] = useState("")

  const [publishSuccess, setPublishSuccess] = useState(false)

  const [shareCodeCopied, setShareCodeCopied] = useState(false)

  const [importCodeModal, setImportCodeModal] = useState(false)

  const [importInput, setImportInput] = useState("")

  useEffect(() => {
    const handleUpdate = () => {
      setMonsters(getEffectiveAniimos())

      setCommunityTeams(getEffectiveCommunityTeams())
    }

    window.addEventListener("wiki-data-changed", handleUpdate)

    return () => window.removeEventListener("wiki-data-changed", handleUpdate)
  }, [])

  // Auto-close boss element dropdown when clicking outside

  useEffect(() => {
    if (!activeDropdown) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      if (!target.closest(".boss-slot-wrapper")) {
        setActiveDropdown(null)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [activeDropdown])

  // Carried Items list from library

  const carriedItems = useMemo(() => {
    return libraryFullData.filter(
      (i) =>
        i.categoryGroup === "Trang Bị & Khí Cụ" ||
        (i.category || "").toLowerCase().includes("mang theo") ||
        (i.rawCategory || "").toLowerCase().includes("carried"),
    )
  }, [])

  // Helper to load a team into the builder (edit mode or clone mode)

  const loadTeamIntoBuilder = (team: CommunityTeam, isEditing: boolean) => {
    const newSlots: SlotData[] = [0, 1, 2, 3].map((idx) => {
      const aniimoId = team.aniimo_ids?.[idx]

      const monster =
        monsters.find((m) => m.id === aniimoId) ||
        (aniimoId ? getMonsterById(aniimoId) : null) ||
        null

      const bData = team.build_data?.[idx]

      if (!bData) return { monster, skills: [null, null, null], item: null }

      const skills: (CombatSkill | null)[] = [0, 1, 2].map((sIdx) => {
        const sName =
          sIdx === 0
            ? bData.s1_name
            : sIdx === 1
              ? bData.s2_name
              : bData.s3_name

        const sIcon =
          sIdx === 0
            ? bData.s1_icon
            : sIdx === 1
              ? bData.s2_icon
              : bData.s3_icon

        if (!sName && !sIcon) return null

        const matched = monster?.combat_skills?.find(
          (s) => (sName && s.name === sName) || (sIcon && s.icon === sIcon),
        )

        if (matched) return matched

        return {
          slot: sIdx + 1,

          name: sName || `Kỹ năng ${sIdx + 1}`,

          icon: sIcon || "",

          desc: "",
        } as CombatSkill
      })

      let item: LibraryItem | null = null

      if (bData.item_name || bData.item_id) {
        const matched = carriedItems.find(
          (it) => it.id === bData.item_id || it.name === bData.item_name,
        )

        if (matched) {
          item = matched
        } else {
          item = ({
            id: bData.item_id || `item-${Date.now()}-${idx}`,

            name: bData.item_name || "Vật phẩm",

            desc: "",

            category: "Vật phẩm mang theo",

            quality: bData.item_quality || "legendary",

            icon: bData.item_icon || "",
          } as LibraryItem)
        }
      }

      return { monster, skills, item }
    })

    setSlots(newSlots)

    setTeamTitle(isEditing ? team.title : `${team.title} (Bản sao)`)

    setTeamDesc(team.description || "")

    if (isEditing) {
      setEditingTeam(team)
    } else {
      setEditingTeam(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingTeam(null)

    setTeamTitle("")

    setTeamDesc("")

    setSlots(DEFAULT_SLOTS)

    setSearchParams({})
  }

  // Handle URL query parameters for editTeamId or loadTeamId

  useEffect(() => {
    const editId = searchParams.get("editTeamId")

    const loadId = searchParams.get("loadTeamId")

    if (!editId && !loadId) return

    const allTeams = getEffectiveCommunityTeams()

    if (editId) {
      if (editingTeam && String(editingTeam.id) === String(editId)) return

      const target = allTeams.find((t) => String(t.id) === String(editId))

      if (target) {
        if (canManageTeam(target, user)) {
          loadTeamIntoBuilder(target, true)
        } else {
          alert("Bạn không có quyền chỉnh sửa đội hình này!")

          setSearchParams({})
        }
      }
    } else if (loadId) {
      const target = allTeams.find((t) => String(t.id) === String(loadId))

      if (target) {
        loadTeamIntoBuilder(target, false)
      }
    }
  }, [searchParams, user, monsters])

  // Manageable teams list for the modal

  const manageableTeams = useMemo(() => {
    return communityTeams.filter((t) => {
      const permitted = canManageTeam(t, user)

      if (!permitted) return false

      if (!manageSearchQuery.trim()) return true

      const q = manageSearchQuery.toLowerCase()

      return (
        t.title.toLowerCase().includes(q) ||
        t.nickname.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
      )
    })
  }, [communityTeams, user, manageSearchQuery])

  // Boss elements list (unique filtered)

  const selectedBossList = useMemo(() => {
    return [
      bossElements.atk_1,

      bossElements.atk_2,

      bossElements.def_1,

      bossElements.def_2,
    ].filter(Boolean)
  }, [bossElements])

  const hasBossSelected = selectedBossList.length > 0

  // Calculate advantageous and disadvantageous elements

  const { recommendedAttackElems, avoidAttackElems } = useMemo(() => {
    if (!hasBossSelected)
      return { recommendedAttackElems: [], avoidAttackElems: [] }

    const scores: Record<string, number> = {}

    ELEMENTS.forEach((el) => {
      let score = 0

      const rel = ELEMENT_RELATIONS[el.slug]

      selectedBossList.forEach((bossSlug) => {
        if (rel.atk_high.includes(bossSlug)) score += 2

        if (rel.atk_low.includes(bossSlug)) score -= 2
      })

      scores[el.slug] = score
    })

    const rec = Object.keys(scores)

      .filter((k) => scores[k] >= 2)

      .sort((a, b) => scores[b] - scores[a])

      .slice(0, 4)

    const avoid = Object.keys(scores)

      .filter((k) => scores[k] <= -2)

      .sort((a, b) => scores[a] - scores[b])

      .slice(0, 4)

    return { recommendedAttackElems: rec, avoidAttackElems: avoid }
  }, [hasBossSelected, selectedBossList])

  // Top Aniimo Tấn Công (DPS & BREAK)

  const topAttackAniimos = useMemo(() => {
    if (!hasBossSelected || recommendedAttackElems.length === 0)
      return { dps: [], break: [] }

    const isMatchElem = (m: AniimoMonster) => {
      const slugs = (m.taxonomies.elements || []).map((e) => e.slug)

      return slugs.some((s) => recommendedAttackElems.includes(s))
    }

    const dpsList = monsters

      .filter((m) => {
        const roles = (m.taxonomies.roles || []).map((r) => r.slug)

        return roles.some((r) => r.includes("dps")) && isMatchElem(m)
      })

      .sort((a, b) => (b.stats?.atk || 0) - (a.stats?.atk || 0))

      .slice(0, 8)

    const breakList = monsters

      .filter((m) => {
        const roles = (m.taxonomies.roles || []).map((r) => r.slug)

        return roles.some((r) => r.includes("break")) && isMatchElem(m)
      })

      .sort((a, b) => (b.stats?.break || 0) - (a.stats?.break || 0))

      .slice(0, 8)

    return { dps: dpsList, break: breakList }
  }, [hasBossSelected, recommendedAttackElems, monsters])

  // Top Aniimo Hỗ Trợ (HEAL, SUPPORT, REGEN)

  const topSupportAniimos = useMemo(() => {
    const healList = monsters

      .filter((m) =>
        (m.taxonomies.roles || []).some(
          (r) =>
            r.slug.includes("heal") || r.name.toLowerCase().includes("hồi"),
        ),
      )

      .sort((a, b) => (b.stats?.hp || 0) - (a.stats?.hp || 0))

      .slice(0, 8)

    const supportList = monsters

      .filter((m) =>
        (m.taxonomies.roles || []).some(
          (r) =>
            r.slug.includes("support") ||
            r.name.toLowerCase().includes("hỗ trợ"),
        ),
      )

      .sort((a, b) => (b.stats?.pdef || 0) - (a.stats?.pdef || 0))

      .slice(0, 8)

    const regenList = monsters

      .filter((m) =>
        (m.taxonomies.roles || []).some(
          (r) =>
            r.slug.includes("regen") ||
            r.name.toLowerCase().includes("năng lượng"),
        ),
      )

      .sort((a, b) => (b.stats?.regen || 0) - (a.stats?.regen || 0))

      .slice(0, 8)

    return { heal: healList, support: supportList, regen: regenList }
  }, [monsters])

  // Handle Pick Monster

  const handlePickMonster = (monster: AniimoMonster) => {
    const next = [...slots]

    const initialSkills: (CombatSkill | null)[] = [null, null, null]

    if (monster.combat_skills && monster.combat_skills.length > 0) {
      initialSkills[0] = monster.combat_skills[0] || null

      initialSkills[1] = monster.combat_skills[1] || null

      initialSkills[2] = monster.combat_skills[2] || null
    }

    next[activeSlotIdx] = {
      ...next[activeSlotIdx],

      monster,

      skills: initialSkills,
    }

    setSlots(next)

    setPickerTab("skill")

    setSkillSlotEditing(0)
  }

  // Handle Pick Skill

  const handlePickSkill = (skill: CombatSkill) => {
    const next = [...slots]

    const currentSkills = [...next[activeSlotIdx].skills]

    currentSkills[skillSlotEditing] = skill

    next[activeSlotIdx] = {
      ...next[activeSlotIdx],

      skills: currentSkills,
    }

    setSlots(next)
  }

  // Handle Pick Item

  const handlePickItem = (item: LibraryItem) => {
    const next = [...slots]

    next[activeSlotIdx] = {
      ...next[activeSlotIdx],

      item,
    }

    setSlots(next)
  }

  // Quick Put Monster into Next Empty Slot

  const handleQuickAddMonster = (monster: AniimoMonster) => {
    const emptyIdx = slots.findIndex((s) => s.monster === null)

    const targetIdx = emptyIdx !== -1 ? emptyIdx : activeSlotIdx

    const next = [...slots]

    const initialSkills: (CombatSkill | null)[] = [null, null, null]

    if (monster.combat_skills && monster.combat_skills.length > 0) {
      initialSkills[0] = monster.combat_skills[0] || null

      initialSkills[1] = monster.combat_skills[1] || null

      initialSkills[2] = monster.combat_skills[2] || null
    }

    next[targetIdx] = {
      ...next[targetIdx],

      monster,

      skills: initialSkills,
    }

    setSlots(next)

    setActiveSlotIdx(targetIdx)

    // Scroll smoothly to team builder

    document
      .getElementById("team-slots-builder-anchor")
      ?.scrollIntoView({ behavior: "smooth" })
  }

  // Calculate team synergy & totals

  const totalStats = useMemo(() => {
    return slots.reduce(
      (acc, s) => {
        if (!s.monster) return acc

        return {
          hp: acc.hp + s.monster.stats.hp,

          atk: acc.atk + s.monster.stats.atk,

          break: acc.break + s.monster.stats.break,

          pdef: acc.pdef + s.monster.stats.pdef,

          mdef: acc.mdef + s.monster.stats.mdef,
        }
      },

      { hp: 0, atk: 0, break: 0, pdef: 0, mdef: 0 },
    )
  }, [slots])

  const elementCounts = useMemo(() => {
    const counts: Record<string, number> = {}

    slots.forEach((s) => {
      if (s.monster?.taxonomies.elements?.[0]?.name) {
        const el = s.monster.taxonomies.elements[0].name

        counts[el] = (counts[el] || 0) + 1
      }
    })

    return counts
  }, [slots])

  // Publish or Update team

  const handlePublishToCommunity = () => {
    if (!user) {
      alert("Vui lòng đăng nhập tài khoản để lưu hoặc đóng góp đội hình!")

      return
    }

    const filledSlots = slots.filter((s) => s.monster !== null)

    if (filledSlots.length < 4) {
      alert(
        "Vui lòng chọn đầy đủ 4 Aniimo cho 4 vị trí trong đội hình trước khi đăng!",
      )

      return
    }

    const cleanTitle = teamTitle.trim()

    if (!cleanTitle) {
      alert("Vui lòng nhập tên cho đội hình của bạn!")

      return
    }

    // --- 1. Cơ Chế Chống Spam (Rate Limit Cooldown: 20 giây giữa các lần đăng mới) ---

    const SPAM_COOLDOWN_MS = 20000

    const lastPublishTime = Number(
      localStorage.getItem("duke1305_team_publish_last_time") || "0",
    )

    const now = Date.now()

    if (!editingTeam && now - lastPublishTime < SPAM_COOLDOWN_MS) {
      const waitSeconds = Math.ceil(
        (SPAM_COOLDOWN_MS - (now - lastPublishTime)) / 1000,
      )

      alert(
        `[Chống Spam]\nBạn vừa đăng đội hình gần đây. Vui lòng chờ ${waitSeconds} giây nữa trước khi đăng đội hình mới tiếp theo!`,
      )

      return
    }

    // --- 2. Kiểm Tra Không Cho Đăng Đội Hình Đã Tồn Tại ---

    const allTeams = getEffectiveCommunityTeams()

    const currentAniimoIds = slots
      .map((s) => s.monster?.id || 0)
      .filter(Boolean)

    const sortedCurrentAniimos = [...currentAniimoIds]
      .sort((a, b) => a - b)
      .join(",")

    // Kiểm tra xem tổ hợp 4 Aniimo này đã tồn tại trong hệ thống chưa

    const duplicateAniimoTeam = allTeams.find((t) => {
      // Nếu đang chỉnh sửa chính đội hình này thì bỏ qua

      if (editingTeam && t.id === editingTeam.id) return false

      const tIds = (t.aniimo_ids || []).filter((id) => id > 0)

      if (tIds.length !== currentAniimoIds.length) return false

      const sortedT = [...tIds].sort((a, b) => a - b).join(",")

      return sortedT === sortedCurrentAniimos
    })

    if (duplicateAniimoTeam) {
      alert(
        `[Đội Hình Đã Tồn Tại]\n\n` +
          `Tổ hợp 4 Aniimo này đã tồn tại trên hệ thống trong đội hình "${duplicateAniimoTeam.title}" (Tác giả: ${duplicateAniimoTeam.nickname})!\n\n` +
          `Vui lòng thay đổi ít nhất 1 Aniimo để tạo sự kết hợp chiến thuật mới mẻ cho cộng đồng.`,
      )

      return
    }

    // Kiểm tra trùng tên đội hình

    const duplicateTitleTeam = allTeams.find((t) => {
      if (editingTeam && t.id === editingTeam.id) return false

      return t.title.trim().toLowerCase() === cleanTitle.toLowerCase()
    })

    if (duplicateTitleTeam) {
      alert(
        `[Tên Đội Hình Đã Được Sử Dụng]\n\n` +
          `Tên đội hình "${cleanTitle}" đã được đặt bởi tác giả "${duplicateTitleTeam.nickname}".\n\n` +
          `Vui lòng chọn một tên khác biệt và sáng tạo hơn!`,
      )

      return
    }

    const aniimo_ids = slots.map((s) => s.monster?.id || 0)

    const build_data = slots.map((s) => ({
      aniimo_id: s.monster?.id || 0,

      s1_name: s.skills[0]?.name || "",

      s1_icon: s.skills[0]?.icon || "",

      s2_name: s.skills[1]?.name || "",

      s2_icon: s.skills[1]?.icon || "",

      s3_name: s.skills[2]?.name || "",

      s3_icon: s.skills[2]?.icon || "",

      item_name: s.item?.name || "",

      item_icon: s.item?.icon || "",

      item_id: s.item?.id || "",

      item_quality: s.item?.quality || "",
    }))

    if (editingTeam) {
      // Cập nhật đội hình hiện tại

      const updatedTeam: CommunityTeam = {
        ...editingTeam,

        title: cleanTitle,

        description:
          teamDesc.trim() || "Chiến thuật phối hợp khắc hệ & kỹ năng Aniimo.",

        aniimo_ids,

        build_data,

        time_ago: "Vừa cập nhật",
      }

      updateCommunityTeam(updatedTeam)

      setEditingTeam(updatedTeam)

      setIsEditSaved(true)

      setPublishSuccess(true)
    } else {
      // Tạo đội hình mới

      const cleanNickname = sanitizeBrandName(
        user.name || user.email.split("@")[0],
      )

      const newTeam: CommunityTeam = {
        id: Date.now(),

        user_id: user.id || user.email,

        authorEmail: user.email,

        nickname: cleanNickname,

        title: cleanTitle,

        description:
          teamDesc.trim() || "Chiến thuật phối hợp khắc hệ & kỹ năng Aniimo.",

        aniimo_ids,

        build_data,

        avg_stars: 5,

        total_ratings: 1,

        time_ago: "Vừa xong",

        isCommunity: true,
      }

      addCommunityTeam(newTeam)

      localStorage.setItem(
        "duke1305_team_publish_last_time",
        String(Date.now()),
      )

      setIsEditSaved(false)

      setPublishSuccess(true)
    }
  }

  // Active monster in slot

  const currentSlot = slots[activeSlotIdx]

  const currentMonster = currentSlot?.monster

  return (
    <div className="inner-page page-width wiki-page-container">
      {/* 1. Header Banner */}
      <div className="wiki-hero-banner">
        <div className="wiki-badge-pill">
          <span className="wiki-dot-live"></span> TEAM BUILDER &amp; META GUIDE
        </div>
        <h1 className="wiki-hero-title">🛠️ Hướng Dẫn Xây Dựng Đội Hình</h1>
        <p className="wiki-hero-desc">
          Công cụ trợ giúp phân tích và gợi ý build Aniimo theo meta hiện tại,
          bao gồm ma trận khắc hệ, khắc tầm đánh, máy tính tương khắc đối thủ và
          bộ xếp team 4 vị trí toàn diện.
        </p>
        <div className="build-youtube-action-row">
          <a
            href="https://youtu.be/2q5W465z8S0"
            target="_blank"
            rel="noopener noreferrer"
            className="build-youtube-btn"
          >
            <span className="btn-yt-icon">▶</span>
            <span className="btn-yt-text">Xem Clip Hướng Dẫn Build Team ↗</span>
          </a>
        </div>
      </div>

      {publishSuccess && (
        <div className="builder-publish-alert">
          <div className="alert-left">
            <span className="alert-icon">{isEditSaved ? "💾" : "🎉"}</span>
            <div>
              <strong>
                {isEditSaved
                  ? "Cập Nhật Đội Hình Thành Công!"
                  : "Đăng Đội Hình Thành Công!"}
              </strong>
              <p>
                {isEditSaved
                  ? `Đội hình "${editingTeam?.title}" (ID: #${editingTeam?.id}) đã được lưu lại và áp dụng trên hệ thống.`
                  : "Đội hình đã được xuất bản lên mục Đội Hình Đề Nghị của cộng đồng."}
              </p>
            </div>
          </div>
          <div className="alert-actions">
            <Link to="/wiki/team" className="wiki-pill-btn active">
              Xem Trên Đội Hình Đề Nghị ➔
            </Link>
            <button
              type="button"
              className="wiki-pill-btn"
              onClick={() => setPublishSuccess(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          ACCORDION 1: CƠ CHẾ TƯƠNG KHẮC TRONG GAME (BẢNG KHẮC HỆ)
          ======================================================== */}
      <div className="tool-accordion-section">
        <button
          type="button"
          className="tool-accordion-header"
          onClick={() => toggleAccordion("matrix")}
        >
          <div className="acc-header-left">
            <span className="acc-title-icon">❖</span>
            <h3>Cơ Chế Tương Khắc Trong Game</h3>
          </div>
          <span className="acc-chevron">
            {openAccordions.matrix ? "▲" : "▼"}
          </span>
        </button>

        {openAccordions.matrix && (
          <div className="tool-accordion-body">
            {/* Toggle Bar */}
            <div className="elem-table-toggle-bar">
              <button
                type="button"
                className={`elem-table-toggle-btn ${
                  matrixTab === "elem" ? "is-active" : ""
                }`}
                onClick={() => setMatrixTab("elem")}
              >
                <span className="toggle-icon-circle">❖</span>
                <span>Bảng Khắc Hệ</span>
                <span className="toggle-chevron-icon">
                  {matrixTab === "elem" ? "▲" : "▼"}
                </span>
              </button>
              <button
                type="button"
                className={`elem-table-toggle-btn ${
                  matrixTab === "range" ? "is-active" : ""
                }`}
                onClick={() => setMatrixTab("range")}
              >
                <span className="toggle-icon-circle">▲</span>
                <span>Bảng Khắc Tầm Đánh</span>
                <span className="toggle-chevron-icon">
                  {matrixTab === "range" ? "▲" : "▼"}
                </span>
              </button>
            </div>

            {matrixTab === "elem" ? (
              <div className="matrix-wrapper-container">
                {/* Legend */}
                <div className="element-matrix-legend-bar">
                  <div className="legend-item advantage">
                    <span className="legend-symbol adv">▲</span>
                    <strong>Khắc chế (+ Sát thương)</strong>
                  </div>
                  <div className="legend-item disadvantage">
                    <span className="legend-symbol dis">▼</span>
                    <strong>Bị kháng (- Sát thương)</strong>
                  </div>
                  <div className="legend-item neutral">
                    <span className="legend-symbol neu">—</span>
                    <strong>Không ảnh hưởng</strong>
                  </div>
                </div>

                {/* 9x9 Matrix Table */}
                <div className="element-matrix-scroll-box">
                  <table className="element-matrix-table">
                    <thead>
                      <tr>
                        <th
                          className="corner-logo-cell"
                          colSpan={2}
                          rowSpan={2}
                        >
                          <div className="matrix-corner-brand">
                            <img
                              src="/duke1305.jpg"
                              alt="DUKE1305"
                              className="corner-brand-img"
                            />
                            <span className="corner-brand-text">DUKE1305</span>
                          </div>
                        </th>
                        <th
                          className="defender-header-banner"
                          colSpan={ELEMENTS.length}
                        >
                          🛡️ Bên Phòng Thủ (Defender)
                        </th>
                      </tr>
                      <tr className="defender-elements-row">
                        {ELEMENTS.map((defEl) => (
                          <th
                            key={defEl.slug}
                            className={`def-col-header ${
                              hoveredCell?.def === defEl.slug
                                ? "col-highlighted"
                                : ""
                            }`}
                            style={{ backgroundColor: defEl.color }}
                            title={`Phòng thủ: ${defEl.name}`}
                          >
                            <img
                              src={defEl.icon}
                              alt={defEl.name}
                              className="element-sym-img"
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ELEMENTS.map((atkEl, atkIdx) => (
                        <tr key={atkEl.slug}>
                          {atkIdx === 0 && (
                            <th
                              className="attacker-header-banner"
                              rowSpan={ELEMENTS.length}
                            >
                              <div className="attacker-vertical-text">
                                <span>⚔️ Bên Tấn Công (Attacker)</span>
                              </div>
                            </th>
                          )}
                          <th
                            className={`atk-row-header ${
                              hoveredCell?.atk === atkEl.slug
                                ? "row-highlighted"
                                : ""
                            }`}
                            style={{ backgroundColor: atkEl.color }}
                            title={`Tấn công: ${atkEl.name}`}
                          >
                            <img
                              src={atkEl.icon}
                              alt={atkEl.name}
                              className="element-sym-img"
                            />
                          </th>
                          {ELEMENTS.map((defEl) => {
                            const rel = ELEMENT_RELATIONS[atkEl.slug]

                            let status = "neu"

                            if (rel.atk_high.includes(defEl.slug))
                              status = "adv"
                            else if (rel.atk_low.includes(defEl.slug))
                              status = "dis"

                            const isHovered =
                              hoveredCell?.atk === atkEl.slug &&
                              hoveredCell?.def === defEl.slug

                            const isAxisHovered =
                              hoveredCell?.atk === atkEl.slug ||
                              hoveredCell?.def === defEl.slug

                            return (
                              <td
                                key={defEl.slug}
                                className={`matrix-data-cell ${status} ${
                                  isHovered ? "cell-hovered" : ""
                                } ${isAxisHovered ? "axis-hovered" : ""}`}
                                onMouseEnter={() =>
                                  setHoveredCell({
                                    atk: atkEl.slug,
                                    def: defEl.slug,
                                  })
                                }
                                onMouseLeave={() => setHoveredCell(null)}
                                title={`${atkEl.name} ➔ ${defEl.name}`}
                              >
                                {status === "adv" && (
                                  <span className="cell-adv">▲</span>
                                )}
                                {status === "dis" && (
                                  <span className="cell-dis">▼</span>
                                )}
                                {status === "neu" && (
                                  <span className="cell-neu">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* TAB 2: RANGE COUNTER */

              <div className="range-counters-wrapper">
                <div className="range-cards-grid">
                  <div className="range-card">
                    <div className="range-card-head">
                      <div className="range-pair-icons">
                        <img
                          src="/wiki/icons/range_icon.png"
                          alt="Tầm Xa"
                          className="range-game-icon"
                        />
                        <span className="range-pair-arrow">➔</span>
                        <img
                          src="/wiki/icons/fly_icon.png"
                          alt="Bay Lượn"
                          className="range-game-icon"
                        />
                      </div>
                      <div>
                        <h3>Khắc chế (Tầm Xa ➔ Bay Lượn)</h3>
                        <p>
                          Kỹ năng đánh xa (Ranged) dễ dàng bắn trúng và khắc chế
                          các đối thủ bay lượn (Fly).
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="range-card">
                    <div className="range-card-head">
                      <div className="range-pair-icons">
                        <img
                          src="/wiki/icons/pound_icon.png"
                          alt="Nện Đất"
                          className="range-game-icon"
                        />
                        <span className="range-pair-arrow">➔</span>
                        <img
                          src="/wiki/icons/tunnel_icon.png"
                          alt="Độn Thổ"
                          className="range-game-icon"
                        />
                      </div>
                      <div>
                        <h3>Khắc chế (Nện Đất ➔ Độn Thổ)</h3>
                        <p>
                          Kỹ năng nện đất (Pound) tạo chấn động cực mạnh, hất
                          văng mục tiêu đang độn thổ (Tunnel).
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="range-card">
                    <div className="range-card-head">
                      <div className="range-pair-icons">
                        <img
                          src="/wiki/icons/range_icon.png"
                          alt="Tầm Xa"
                          className="range-game-icon"
                        />
                        <span className="range-pair-arrow dis">✕</span>
                        <img
                          src="/wiki/icons/tunnel_icon.png"
                          alt="Độn Thổ"
                          className="range-game-icon"
                        />
                      </div>
                      <div>
                        <h3>Bị kháng (Tầm Xa ➔ Độn Thổ)</h3>
                        <p>
                          Mục tiêu chui dưới lòng đất né hầu hết các đòn bắn tầm
                          xa thông thường.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="range-card">
                    <div className="range-card-head">
                      <div className="range-pair-icons">
                        <img
                          src="/wiki/icons/pound_icon.png"
                          alt="Nện Đất"
                          className="range-game-icon"
                        />
                        <span className="range-pair-arrow dis">✕</span>
                        <img
                          src="/wiki/icons/fly_icon.png"
                          alt="Bay Lượn"
                          className="range-game-icon"
                        />
                      </div>
                      <div>
                        <h3>Bị kháng (Nện Đất ➔ Bay Lượn)</h3>
                        <p>
                          Mục tiêu lơ lửng trên không trung miễn nhiễm với chấn
                          động mặt đất.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================
          ACCORDION 2: CHỌN NGUYÊN TỐ CỦA ĐỐI THỦ
          ======================================================== */}
      <div
        className={`tool-accordion-section ${
          activeDropdown ? "has-dropdown-open" : ""
        }`}
      >
        <button
          type="button"
          className="tool-accordion-header"
          onClick={() => toggleAccordion("boss")}
        >
          <div className="acc-header-left">
            <span className="acc-title-icon">⚔️</span>
            <div>
              <h3>Chọn Nguyên Tố của Đối Thủ:</h3>
              <small>Boss / Alpha / Omega / NPC / Người Chơi</small>
            </div>
          </div>
          <span className="acc-chevron">{openAccordions.boss ? "▲" : "▼"}</span>
        </button>

        {openAccordions.boss && (
          <div className="tool-accordion-body boss-select-container">
            <div className="boss-select-grid">
              {/* Column 1: Boss Attack Elements */}
              <div className="boss-select-col">
                <div className="boss-col-header">
                  <span className="boss-header-icon">⚔️</span>
                  <span className="boss-header-title">
                    Tấn Công (BOSS/DPS/BREAK)
                  </span>
                </div>
                <div className="boss-slots-row">
                  {(["atk_1", "atk_2"] as const).map((slotKey) => {
                    const currentSlug = bossElements[slotKey]

                    const currentDef = ELEMENTS.find(
                      (e) => e.slug === currentSlug,
                    )

                    const isOpen = activeDropdown === slotKey

                    return (
                      <div
                        key={slotKey}
                        className={`boss-slot-wrapper ${
                          isOpen ? "is-dropdown-open" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className={`boss-slot-btn ${
                            currentDef ? "has-element" : "is-empty"
                          }`}
                          onClick={() =>
                            setActiveDropdown(isOpen ? null : slotKey)
                          }
                        >
                          {currentDef ? (
                            <div className="boss-slot-active-inner">
                              <img
                                src={currentDef.icon}
                                alt={currentDef.name}
                                className="slot-icon-img"
                              />
                              <span className="slot-label">
                                {currentDef.name}
                              </span>
                            </div>
                          ) : (
                            <span className="empty-prompt">
                              chọn nguyên tố...
                            </span>
                          )}
                        </button>

                        {isOpen && (
                          <div className="boss-elem-dropdown">
                            <button
                              type="button"
                              className="boss-dropdown-item is-clear"
                              onClick={() => {
                                setBossElements((prev) => ({
                                  ...prev,
                                  [slotKey]: "",
                                }))

                                setActiveDropdown(null)
                              }}
                            >
                              <span className="clear-icon">✕</span> Bỏ chọn
                            </button>
                            {ELEMENTS.map((el) => (
                              <button
                                key={el.slug}
                                type="button"
                                className="boss-dropdown-item"
                                onClick={() => {
                                  setBossElements((prev) => ({
                                    ...prev,

                                    [slotKey]: el.slug,
                                  }))

                                  setActiveDropdown(null)
                                }}
                              >
                                <img
                                  src={el.icon}
                                  alt={el.name}
                                  className="dropdown-item-img"
                                />
                                <span>{el.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Column 2: Boss Defense Elements */}
              <div className="boss-select-col">
                <div className="boss-col-header">
                  <span className="boss-header-icon">🛡️</span>
                  <span className="boss-header-title">
                    Hỗ Trợ (HEAL/SUPPORT/REGEN)
                  </span>
                </div>
                <div className="boss-slots-row">
                  {(["def_1", "def_2"] as const).map((slotKey) => {
                    const currentSlug = bossElements[slotKey]

                    const currentDef = ELEMENTS.find(
                      (e) => e.slug === currentSlug,
                    )

                    const isOpen = activeDropdown === slotKey

                    return (
                      <div
                        key={slotKey}
                        className={`boss-slot-wrapper ${
                          isOpen ? "is-dropdown-open" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className={`boss-slot-btn ${
                            currentDef ? "has-element" : "is-empty"
                          }`}
                          onClick={() =>
                            setActiveDropdown(isOpen ? null : slotKey)
                          }
                        >
                          {currentDef ? (
                            <div className="boss-slot-active-inner">
                              <img
                                src={currentDef.icon}
                                alt={currentDef.name}
                                className="slot-icon-img"
                              />
                              <span className="slot-label">
                                {currentDef.name}
                              </span>
                            </div>
                          ) : (
                            <span className="empty-prompt">
                              chọn nguyên tố...
                            </span>
                          )}
                        </button>

                        {isOpen && (
                          <div className="boss-elem-dropdown">
                            <button
                              type="button"
                              className="boss-dropdown-item is-clear"
                              onClick={() => {
                                setBossElements((prev) => ({
                                  ...prev,
                                  [slotKey]: "",
                                }))

                                setActiveDropdown(null)
                              }}
                            >
                              <span className="clear-icon">✕</span> Bỏ chọn
                            </button>
                            {ELEMENTS.map((el) => (
                              <button
                                key={el.slug}
                                type="button"
                                className="boss-dropdown-item"
                                onClick={() => {
                                  setBossElements((prev) => ({
                                    ...prev,

                                    [slotKey]: el.slug,
                                  }))

                                  setActiveDropdown(null)
                                }}
                              >
                                <img
                                  src={el.icon}
                                  alt={el.name}
                                  className="dropdown-item-img"
                                />
                                <span>{el.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Reset Button */}
            <div className="boss-reset-row">
              <button
                type="button"
                className="boss-reset-btn"
                onClick={() =>
                  setBossElements({
                    atk_1: "",
                    atk_2: "",
                    def_1: "",
                    def_2: "",
                  })
                }
              >
                🔄 Reset Dữ Liệu
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          ACCORDION 3: KẾT QUẢ SAU KHI TÍNH TOÁN KHẮC HỆ
          ======================================================== */}
      <div className="tool-accordion-section">
        <button
          type="button"
          className="tool-accordion-header"
          onClick={() => toggleAccordion("calcResult")}
        >
          <div className="acc-header-left">
            <span className="acc-title-icon">📊</span>
            <h3>Kết quả sau khi tính toán khắc hệ</h3>
          </div>
          <span className="acc-chevron">
            {openAccordions.calcResult ? "▲" : "▼"}
          </span>
        </button>

        {openAccordions.calcResult && (
          <div className="tool-accordion-body">
            <table className="tool-calc-table">
              <thead>
                <tr>
                  <th className="col-type-title">Loại Aniimo</th>
                  <th className="col-adv-title">
                    <span className="badge-tag-good">✓</span> Nên Dùng
                  </th>
                  <th className="col-dis-title">
                    <span className="badge-tag-bad">✕</span> Cần Tránh
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="cell-type-label">
                    <div className="type-badge-box">
                      <span className="type-icon">⚔️</span>
                      <span className="type-name">Tấn Công</span>
                    </div>
                  </td>
                  <td className="cell-adv-content">
                    {hasBossSelected ? (
                      recommendedAttackElems.length === 0 ? (
                        <span className="no-elem-text">
                          Không có hệ đặc thù
                        </span>
                      ) : (
                        <div className="aniimo-build-pills-row">
                          {recommendedAttackElems.map((slug) => {
                            const el = ELEMENTS.find((e) => e.slug === slug)!

                            return (
                              <div key={slug} className="aniimo-build-pill">
                                <img
                                  src={el.icon}
                                  alt={el.name}
                                  className="build-pill-icon-img"
                                />
                                <span className="build-pill-name">
                                  {el.name}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    ) : (
                      <span className="require-prompt">
                        -cần chọn Nguyên Tố ở trên-
                      </span>
                    )}
                  </td>
                  <td className="cell-dis-content">
                    {hasBossSelected ? (
                      avoidAttackElems.length === 0 ? (
                        <span className="no-elem-text">
                          Không có hệ đặc thù
                        </span>
                      ) : (
                        <div className="aniimo-build-pills-row">
                          {avoidAttackElems.map((slug) => {
                            const el = ELEMENTS.find((e) => e.slug === slug)!

                            return (
                              <div
                                key={slug}
                                className="aniimo-build-pill is-avoid"
                              >
                                <img
                                  src={el.icon}
                                  alt={el.name}
                                  className="build-pill-icon-img"
                                />
                                <span className="build-pill-name">
                                  {el.name}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    ) : (
                      <span className="require-prompt">
                        -cần chọn Nguyên Tố ở trên-
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================
          ACCORDION 4: TOP ANIIMO TẤN CÔNG DỰA THEO KẾT QUẢ TRÊN
          ======================================================== */}
      <div className="tool-accordion-section">
        <button
          type="button"
          className="tool-accordion-header"
          onClick={() => toggleAccordion("topAttack")}
        >
          <div className="acc-header-left">
            <span className="acc-title-icon">💥</span>
            <h3>Top Aniimo Tấn Công dựa theo kết quả trên</h3>
          </div>
          <span className="acc-chevron">
            {openAccordions.topAttack ? "▲" : "▼"}
          </span>
        </button>

        {openAccordions.topAttack && (
          <div className="tool-accordion-body">
            <table className="tool-calc-table">
              <thead>
                <tr>
                  <th className="col-final-dps">
                    <div className="final-th-badge">
                      <img
                        src="/wiki/icons/class-dps.png"
                        alt="DPS"
                        className="final-role-badge-img"
                      />
                      <span className="final-th-text">DPS</span>
                    </div>
                  </th>
                  <th className="col-final-break">
                    <div className="final-th-badge">
                      <img
                        src="/wiki/icons/class-break.png"
                        alt="BREAK"
                        className="final-role-badge-img"
                      />
                      <span className="final-th-text">BREAK</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    {hasBossSelected ? (
                      topAttackAniimos.dps.length === 0 ? (
                        <span className="no-elem-text">
                          Không có Aniimo phù hợp
                        </span>
                      ) : (
                        <div className="final-aniimo-grid">
                          {topAttackAniimos.dps.map((m) => (
                            <div
                              key={m.id}
                              className="final-aniimo-card"
                              onClick={() => handleQuickAddMonster(m)}
                              title="Nhấp để thêm vào đội hình"
                            >
                              <img
                                src={formatImageUrl(m.thumbnail)}
                                alt={m.title}
                                className="final-avatar"
                              />
                              <div className="final-card-info">
                                <strong>{m.title}</strong>
                                <span className="final-elem-tag">
                                  {m.taxonomies.elements?.[0]?.icon && (
                                    <img
                                      src={formatImageUrl(
                                        m.taxonomies.elements[0].icon,
                                      )}
                                      alt=""
                                      className="card-mini-elem-icon"
                                    />
                                  )}
                                  {m.taxonomies.elements?.[0]?.name}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="quick-add-btn"
                                title="Thêm vào slot"
                              >
                                +
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <span className="require-prompt">
                        -cần chọn Nguyên Tố ở trên-
                      </span>
                    )}
                  </td>
                  <td>
                    {hasBossSelected ? (
                      topAttackAniimos.break.length === 0 ? (
                        <span className="no-elem-text">
                          Không có Aniimo phù hợp
                        </span>
                      ) : (
                        <div className="final-aniimo-grid">
                          {topAttackAniimos.break.map((m) => (
                            <div
                              key={m.id}
                              className="final-aniimo-card"
                              onClick={() => handleQuickAddMonster(m)}
                              title="Nhấp để thêm vào đội hình"
                            >
                              <img
                                src={formatImageUrl(m.thumbnail)}
                                alt={m.title}
                                className="final-avatar"
                              />
                              <div className="final-card-info">
                                <strong>{m.title}</strong>
                                <span className="final-elem-tag">
                                  {m.taxonomies.elements?.[0]?.icon && (
                                    <img
                                      src={formatImageUrl(
                                        m.taxonomies.elements[0].icon,
                                      )}
                                      alt=""
                                      className="card-mini-elem-icon"
                                    />
                                  )}
                                  {m.taxonomies.elements?.[0]?.name}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="quick-add-btn"
                                title="Thêm vào slot"
                              >
                                +
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <span className="require-prompt">
                        -cần chọn Nguyên Tố ở trên-
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================
          ACCORDION 5: TOP ANIIMO HỖ TRỢ DỰA THEO CHỦ LỰC TRÊN
          ======================================================== */}
      <div className="tool-accordion-section">
        <button
          type="button"
          className="tool-accordion-header"
          onClick={() => toggleAccordion("topSupport")}
        >
          <div className="acc-header-left">
            <span className="acc-title-icon">💚</span>
            <h3>Top Aniimo Hỗ Trợ dựa theo Chủ Lực trên</h3>
          </div>
          <span className="acc-chevron">
            {openAccordions.topSupport ? "▲" : "▼"}
          </span>
        </button>

        {openAccordions.topSupport && (
          <div className="tool-accordion-body">
            <table className="tool-calc-table">
              <thead>
                <tr>
                  <th className="col-hs-heal">
                    <div className="final-th-badge">
                      <img
                        src="/wiki/icons/class-healer.png"
                        alt="HEAL"
                        className="final-role-badge-img"
                      />
                      <span className="final-th-text">HEAL (Hồi Máu)</span>
                    </div>
                  </th>
                  <th className="col-hs-support">
                    <div className="final-th-badge">
                      <img
                        src="/wiki/icons/class-support.png"
                        alt="SUPPORT"
                        className="final-role-badge-img"
                      />
                      <span className="final-th-text">SUPPORT (Hỗ Trợ)</span>
                    </div>
                  </th>
                  <th className="col-hs-regen">
                    <div className="final-th-badge">
                      <img
                        src="/wiki/icons/class-regen.png"
                        alt="REGEN"
                        className="final-role-badge-img"
                      />
                      <span className="final-th-text">REGEN (Hồi Khí)</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="final-aniimo-grid">
                      {topSupportAniimos.heal.map((m) => (
                        <div
                          key={m.id}
                          className="final-aniimo-card"
                          onClick={() => handleQuickAddMonster(m)}
                        >
                          <img
                            src={formatImageUrl(m.thumbnail)}
                            alt={m.title}
                            className="final-avatar"
                          />
                          <div className="final-card-info">
                            <strong>{m.title}</strong>
                            <span className="final-elem-tag">
                              {m.taxonomies.elements?.[0]?.icon && (
                                <img
                                  src={formatImageUrl(
                                    m.taxonomies.elements[0].icon,
                                  )}
                                  alt=""
                                  className="card-mini-elem-icon"
                                />
                              )}
                              {m.taxonomies.elements?.[0]?.name}
                            </span>
                          </div>
                          <button type="button" className="quick-add-btn">
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="final-aniimo-grid">
                      {topSupportAniimos.support.map((m) => (
                        <div
                          key={m.id}
                          className="final-aniimo-card"
                          onClick={() => handleQuickAddMonster(m)}
                        >
                          <img
                            src={formatImageUrl(m.thumbnail)}
                            alt={m.title}
                            className="final-avatar"
                          />
                          <div className="final-card-info">
                            <strong>{m.title}</strong>
                            <span className="final-elem-tag">
                              {m.taxonomies.elements?.[0]?.icon && (
                                <img
                                  src={formatImageUrl(
                                    m.taxonomies.elements[0].icon,
                                  )}
                                  alt=""
                                  className="card-mini-elem-icon"
                                />
                              )}
                              {m.taxonomies.elements?.[0]?.name}
                            </span>
                          </div>
                          <button type="button" className="quick-add-btn">
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="final-aniimo-grid">
                      {topSupportAniimos.regen.map((m) => (
                        <div
                          key={m.id}
                          className="final-aniimo-card"
                          onClick={() => handleQuickAddMonster(m)}
                        >
                          <img
                            src={formatImageUrl(m.thumbnail)}
                            alt={m.title}
                            className="final-avatar"
                          />
                          <div className="final-card-info">
                            <strong>{m.title}</strong>
                            <span className="final-elem-tag">
                              {m.taxonomies.elements?.[0]?.icon && (
                                <img
                                  src={formatImageUrl(
                                    m.taxonomies.elements[0].icon,
                                  )}
                                  alt=""
                                  className="card-mini-elem-icon"
                                />
                              )}
                              {m.taxonomies.elements?.[0]?.name}
                            </span>
                          </div>
                          <button type="button" className="quick-add-btn">
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Anchor for auto scroll */}
      <div id="team-slots-builder-anchor" style={{ scrollMarginTop: "90px" }} />

      {/* ========================================================
          ACCORDION 6: TOOL BUILD ĐỘI HÌNH 4 SLOTS & XUẤT BẢN CỘNG ĐỒNG
          ======================================================== */}
      <div className="tool-accordion-section">
        <button
          type="button"
          className="tool-accordion-header"
          onClick={() => toggleAccordion("teamBuilder")}
        >
          <div className="acc-header-left">
            <span className="acc-title-icon">👥</span>
            <h3>Xây Dựng Đội Hình 4 Slots &amp; Đóng Góp Cộng Đồng</h3>
          </div>
          <span className="acc-chevron">
            {openAccordions.teamBuilder ? "▲" : "▼"}
          </span>
        </button>

        {openAccordions.teamBuilder && (
          <div className="tool-accordion-body">
            <div className="builder-layout">
              {/* Left Side: 4 Team Slots & Synergies */}
              <div className="builder-main-panel">
                <div className="builder-panel-head">
                  <div className="builder-head-title-row">
                    <h3>Đội hình của bạn (4 slots)</h3>
                    {editingTeam && (
                      <span className="builder-editing-pill-indicator">
                        ✏️ Đang Sửa: #{editingTeam.id}
                      </span>
                    )}
                  </div>
                  <div className="builder-code-actions">
                    <button
                      type="button"
                      className="builder-action-btn manage-teams-btn"
                      onClick={() => setManageModalOpen(true)}
                      title="Quản lý danh sách đội hình"
                    >
                      📂 Quản Lý Đội Hình ({manageableTeams.length})
                    </button>
                    <button
                      type="button"
                      className="builder-action-btn"
                      onClick={() => {
                        const exportData = {
                          title: teamTitle || "Đội hình chia sẻ",

                          desc: teamDesc,

                          slots: slots.map((s) => ({
                            id: s.monster?.id || null,

                            skills: s.skills.map((sk) => sk?.name || null),

                            item: s.item?.id || null,
                          })),
                        }

                        const code = btoa(
                          encodeURIComponent(JSON.stringify(exportData)),
                        )

                        navigator.clipboard.writeText(code)

                        setShareCodeCopied(true)

                        setTimeout(() => setShareCodeCopied(false), 2500)
                      }}
                      title="Sao chép mã chia sẻ"
                    >
                      {shareCodeCopied ? "✓ Đã Chép Mã" : "📋 Xuất Mã Đội Hình"}
                    </button>
                    <button
                      type="button"
                      className="builder-action-btn"
                      onClick={() => setImportCodeModal(true)}
                      title="Nhập mã đội hình"
                    >
                      📥 Nhập Mã
                    </button>
                  </div>
                </div>

                {editingTeam && (
                  <div className="builder-edit-banner">
                    <div className="builder-edit-banner-info">
                      <div className="edit-banner-title-line">
                        <span className="builder-edit-badge">
                          ✏️ ĐANG CHỈNH SỬA
                        </span>
                        <h4>
                          <strong>{editingTeam.title}</strong>{" "}
                          <small>(ID: #{editingTeam.id})</small>
                        </h4>
                      </div>
                      <p className="builder-edit-subtext">
                        Tác giả: <strong>{editingTeam.nickname}</strong> • Sau
                        khi hoàn tất điều chỉnh Aniimo, kỹ năng, trang bị hoặc
                        tên, hãy bấm{" "}
                        <strong>&quot;Lưu Cập Nhật Đội Hình&quot;</strong> bên
                        dưới.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="builder-cancel-edit-btn"
                      onClick={handleCancelEdit}
                      title="Hủy bỏ chỉnh sửa và tạo đội hình mới"
                    >
                      ✕ Hủy Sửa (Tạo Mới)
                    </button>
                  </div>
                )}

                {/* 4 slots */}
                <div className="builder-slots-grid">
                  {slots.map((slot, idx) => {
                    const isActive = activeSlotIdx === idx

                    const m = slot.monster

                    return (
                      <div
                        key={idx}
                        className={`builder-slot ${isActive ? "active" : ""} ${
                          m ? "has-monster" : ""
                        }`}
                        onClick={() => {
                          setActiveSlotIdx(idx)

                          if (!m) setPickerTab("monster")
                        }}
                      >
                        <span className="slot-badge">Vị Trí {idx + 1}</span>
                        {m ? (
                          <>
                            <button
                              type="button"
                              className="slot-remove-btn"
                              onClick={(e) => {
                                e.stopPropagation()

                                const next = [...slots]

                                next[idx] = {
                                  monster: null,

                                  skills: [null, null, null],

                                  item: null,
                                }

                                setSlots(next)

                                setActiveSlotIdx(idx)

                                setPickerTab("monster")
                              }}
                              title="Xóa Aniimo này"
                            >
                              ✕
                            </button>
                            <img
                              src={formatImageUrl(m.thumbnail)}
                              alt={m.title}
                              className="slot-img"
                            />
                            <strong className="slot-title">{m.title}</strong>
                            <div className="slot-taxonomies-row">
                              {m.taxonomies.elements?.[0] && (
                                <span className="slot-elem-badge">
                                  {m.taxonomies.elements[0].icon && (
                                    <img
                                      src={formatImageUrl(
                                        m.taxonomies.elements[0].icon,
                                      )}
                                      alt=""
                                      className="slot-mini-elem-icon"
                                    />
                                  )}
                                  {m.taxonomies.elements[0].name}
                                </span>
                              )}
                              <span className="slot-role">
                                {m.taxonomies.roles?.[0]?.icon && (
                                  <img
                                    src={formatImageUrl(
                                      m.taxonomies.roles[0].icon,
                                    )}
                                    alt=""
                                    className="slot-mini-role-icon"
                                  />
                                )}
                                {m.taxonomies.roles?.[0]?.name || "DPS"}
                              </span>
                            </div>

                            {/* Mini loadout summary */}
                            <div className="slot-loadout-preview">
                              <div className="slot-mini-skills">
                                {slot.skills.map((sk, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className={`mini-skill-dot ${
                                      sk ? "filled" : ""
                                    }`}
                                    title={sk?.name || `Kỹ năng ${sIdx + 1}`}
                                    onClick={(e) => {
                                      e.stopPropagation()

                                      setActiveSlotIdx(idx)

                                      setPickerTab("skill")

                                      setSkillSlotEditing(sIdx)
                                    }}
                                  >
                                    {sk?.icon ? (
                                      <img
                                        src={formatImageUrl(sk.icon)}
                                        alt=""
                                      />
                                    ) : (
                                      <span>{sIdx + 1}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div
                                className={`slot-mini-item ${
                                  slot.item ? "filled" : ""
                                }`}
                                title={
                                  slot.item?.name || "Chọn trang bị mang theo"
                                }
                                onClick={(e) => {
                                  e.stopPropagation()

                                  setActiveSlotIdx(idx)

                                  setPickerTab("item")
                                }}
                              >
                                {slot.item?.icon ? (
                                  <img
                                    src={formatImageUrl(slot.item.icon)}
                                    alt=""
                                  />
                                ) : (
                                  <span>🎒</span>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="slot-empty">
                            <span>+</span>
                            <small>Chọn Aniimo</small>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Slot Detail Customizer (Skills & Items for Active Slot) */}
                {currentMonster && (
                  <div className="builder-slot-customizer">
                    <div className="customizer-head">
                      <div className="customizer-title-wrap">
                        <img
                          src={formatImageUrl(currentMonster.thumbnail)}
                          alt=""
                          className="customizer-avatar"
                        />
                        <div>
                          <h4>
                            Tùy Biến Vị Trí {activeSlotIdx + 1}:{" "}
                            {currentMonster.title}
                          </h4>
                          <span className="customizer-sub">
                            #{currentMonster.no} •{" "}
                            {currentMonster.taxonomies.elements?.[0]?.name}
                          </span>
                        </div>
                      </div>
                      <div className="customizer-tab-btns">
                        <button
                          type="button"
                          className={`customizer-tab-btn ${
                            pickerTab === "skill" ? "active" : ""
                          }`}
                          onClick={() => setPickerTab("skill")}
                        >
                          ⚡ Kỹ Năng (3 Slots)
                        </button>
                        <button
                          type="button"
                          className={`customizer-tab-btn ${
                            pickerTab === "item" ? "active" : ""
                          }`}
                          onClick={() => setPickerTab("item")}
                        >
                          🎒 Trang Bị Mang Theo
                        </button>
                        <button
                          type="button"
                          className={`customizer-tab-btn ${
                            pickerTab === "monster" ? "active" : ""
                          }`}
                          onClick={() => setPickerTab("monster")}
                        >
                          🔄 Đổi Aniimo
                        </button>
                      </div>
                    </div>

                    {/* Skills selection row */}
                    <div className="customizer-skills-section">
                      <span className="section-label">
                        Bộ Chiêu Thức Được Trang Bị:
                      </span>
                      <div className="customizer-skills-grid">
                        {[0, 1, 2].map((skIdx) => {
                          const sk = currentSlot.skills[skIdx]

                          const isSelected =
                            pickerTab === "skill" && skillSlotEditing === skIdx

                          return (
                            <div
                              key={skIdx}
                              className={`customizer-skill-card ${
                                isSelected ? "is-editing" : ""
                              }`}
                              onClick={() => {
                                setPickerTab("skill")

                                setSkillSlotEditing(skIdx)
                              }}
                            >
                              <span className="skill-slot-tag">
                                {skIdx === 1
                                  ? "Kỹ Năng 2 (Ult)"
                                  : `Kỹ Năng ${skIdx + 1}`}
                              </span>
                              {sk ? (
                                <div className="customizer-skill-inner">
                                  <img
                                    src={formatImageUrl(sk.icon)}
                                    alt={sk.name}
                                    className="skill-thumb"
                                  />
                                  <div className="skill-text">
                                    <strong>{sk.name}</strong>
                                    <small>
                                      {sk.cd ? `CD: ${sk.cd}` : ""}
                                      {sk.break ? ` • Break: ${sk.break}` : ""}
                                    </small>
                                  </div>
                                </div>
                              ) : (
                                <div className="skill-slot-empty">
                                  <span>+</span>
                                  <small>Chọn kỹ năng</small>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Carried item selection row */}
                    <div className="customizer-item-section">
                      <span className="section-label">Vật Phẩm Mang Theo:</span>
                      <div
                        className={`customizer-item-box ${
                          pickerTab === "item" ? "is-editing" : ""
                        }`}
                        onClick={() => setPickerTab("item")}
                      >
                        {currentSlot.item ? (
                          <div className="customizer-item-inner">
                            <img
                              src={formatImageUrl(currentSlot.item.icon)}
                              alt={currentSlot.item.name}
                              className="item-thumb"
                            />
                            <div className="item-text">
                              <strong>{currentSlot.item.name}</strong>
                              <span
                                className={`quality-badge ${currentSlot.item.quality.toLowerCase()}`}
                              >
                                {currentSlot.item.qualityVi ||
                                  currentSlot.item.quality}
                              </span>
                              <p>{currentSlot.item.desc}</p>
                            </div>
                            <button
                              type="button"
                              className="remove-item-btn"
                              onClick={(e) => {
                                e.stopPropagation()

                                const next = [...slots]

                                next[activeSlotIdx] = {
                                  ...next[activeSlotIdx],

                                  item: null,
                                }

                                setSlots(next)
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="item-empty-prompt">
                            <span>🎒</span>
                            <div>
                              <strong>Chưa trang bị vật phẩm mang theo</strong>
                              <small>
                                Nhấp để mở kho vật phẩm và chọn trang bị phù hợp
                              </small>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Team Stats Summary */}
                <div className="builder-stats-summary">
                  <h4>📊 Tổng Chỉ Số Toàn Đội</h4>
                  <div className="summary-stats-cards">
                    <div className="summary-stat-box">
                      <small>TỔNG HP</small>
                      <strong>{totalStats.hp}</strong>
                    </div>
                    <div className="summary-stat-box">
                      <small>TỔNG ATK</small>
                      <strong>{totalStats.atk}</strong>
                    </div>
                    <div className="summary-stat-box">
                      <small>TỔNG BREAK</small>
                      <strong>{totalStats.break}</strong>
                    </div>
                    <div className="summary-stat-box">
                      <small>TỔNG P.DEF</small>
                      <strong>{totalStats.pdef}</strong>
                    </div>
                    <div className="summary-stat-box">
                      <small>TỔNG M.DEF</small>
                      <strong>{totalStats.mdef}</strong>
                    </div>
                  </div>

                  <div className="builder-synergy-box">
                    <h4>🔥 Cộng Hưởng Nguyên Tố:</h4>
                    <div className="synergy-tags">
                      {Object.keys(elementCounts).length > 0 ? (
                        Object.entries(elementCounts).map(([el, cnt]) => (
                          <span key={el} className="synergy-tag">
                            {el}: <strong>{cnt} Aniimo</strong>
                          </span>
                        ))
                      ) : (
                        <span className="synergy-empty">
                          Chưa có thú cưng trong đội hình
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Publishing Form (User Contributions) */}
                <div className="builder-publish-form-card">
                  <div className="publish-head">
                    <h3>🚀 Xuất Bản &amp; Đóng Góp Lên Cộng Đồng</h3>
                    {user ? (
                      <div className="user-author-tag">
                        <span className="user-dot"></span> Đăng bởi:{" "}
                        <strong>{user.name || user.email}</strong>
                      </div>
                    ) : (
                      <span className="login-req-hint">
                        🔒 Cần đăng nhập để chia sẻ đội hình
                      </span>
                    )}
                  </div>

                  <div className="publish-fields">
                    <div className="publish-field">
                      <label>Tên Đội Hình:</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Đội hình Siêu Đóng Băng Khống Chế, Team Sốc Dame Điện..."
                        value={teamTitle}
                        onChange={(e) => setTeamTitle(e.target.value)}
                      />
                    </div>

                    <div className="publish-field">
                      <label>Mô Tả Chiến Thuật &amp; Hướng Dẫn Combo:</label>
                      <textarea
                        rows={3}
                        placeholder="Chia sẻ cách xoay tua chiêu thức, combo đánh thường, thời điểm kích hoạt Ultimate..."
                        value={teamDesc}
                        onChange={(e) => setTeamDesc(e.target.value)}
                      />
                    </div>

                    <div className="publish-submit-row">
                      {user ? (
                        editingTeam ? (
                          <div className="publish-edit-actions-row">
                            <button
                              type="button"
                              className="publish-btn edit-mode-save-btn"
                              onClick={handlePublishToCommunity}
                            >
                              💾 Lưu Cập Nhật Đội Hình (ID: #{editingTeam.id})
                            </button>
                            <button
                              type="button"
                              className="cancel-edit-btn"
                              onClick={handleCancelEdit}
                            >
                              ✕ Hủy Sửa (Tạo Mới)
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="publish-btn"
                            onClick={handlePublishToCommunity}
                          >
                            🚀 Đăng Lên Cộng Đồng (Đóng Góp)
                          </button>
                        )
                      ) : (
                        <div className="login-prompt-box">
                          <p>
                            Đăng nhập tài khoản để lưu trữ và chia sẻ chiến
                            thuật của bạn tới toàn thể người chơi!
                          </p>
                          <Link to="/login" className="login-now-btn">
                            🔑 Đăng Nhập Ngay
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Dynamic Picker Panel */}
              <div className="builder-selector-panel">
                <div className="selector-tabs-header">
                  <button
                    type="button"
                    className={`selector-tab-btn ${
                      pickerTab === "monster" ? "active" : ""
                    }`}
                    onClick={() => setPickerTab("monster")}
                  >
                    🐾 Aniimo
                  </button>
                  <button
                    type="button"
                    className={`selector-tab-btn ${
                      pickerTab === "skill" ? "active" : ""
                    }`}
                    onClick={() => setPickerTab("skill")}
                    disabled={!currentMonster}
                  >
                    ⚡ Kỹ Năng
                  </button>
                  <button
                    type="button"
                    className={`selector-tab-btn ${
                      pickerTab === "item" ? "active" : ""
                    }`}
                    onClick={() => setPickerTab("item")}
                  >
                    🎒 Trang Bị ({carriedItems.length})
                  </button>
                </div>

                {pickerTab === "monster" && (
                  <div className="picker-tab-body">
                    <div className="selector-head">
                      <h4>Chọn thú cưng cho Vị Trí {activeSlotIdx + 1}</h4>
                      <div className="search-box">
                        <input
                          type="text"
                          placeholder="Tìm theo tên, #No..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="selector-search-input"
                        />
                      </div>
                    </div>
                    <div className="selector-list">
                      {monsters

                        .filter((m) => {
                          const q = searchQuery.toLowerCase().trim()

                          return (
                            !q ||
                            m.title.toLowerCase().includes(q) ||
                            m.no.toLowerCase().includes(q)
                          )
                        })

                        .map((m) => (
                          <div
                            key={m.id}
                            className="selector-item"
                            onClick={() => handlePickMonster(m)}
                          >
                            <img
                              src={formatImageUrl(m.thumbnail)}
                              alt={m.title}
                              className="selector-item-thumb"
                              loading="lazy"
                            />
                            <div>
                              <strong>{m.title}</strong>
                              <div className="picker-item-badges">
                                <span className="picker-no-tag">#{m.no}</span>
                                {m.taxonomies.elements?.[0] && (
                                  <span className="picker-elem-tag">
                                    {m.taxonomies.elements[0].icon && (
                                      <img
                                        src={formatImageUrl(
                                          m.taxonomies.elements[0].icon,
                                        )}
                                        alt=""
                                        className="picker-mini-icon"
                                      />
                                    )}
                                    {m.taxonomies.elements[0].name}
                                  </span>
                                )}
                                {m.taxonomies.roles?.[0] && (
                                  <span className="picker-role-tag">
                                    {m.taxonomies.roles[0].icon && (
                                      <img
                                        src={formatImageUrl(
                                          m.taxonomies.roles[0].icon,
                                        )}
                                        alt=""
                                        className="picker-mini-icon"
                                      />
                                    )}
                                    {m.taxonomies.roles[0].name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {pickerTab === "skill" && (
                  <div className="picker-tab-body">
                    <div className="selector-head">
                      <h4>
                        Chọn Kỹ Năng {skillSlotEditing + 1} cho{" "}
                        {currentMonster?.title}
                      </h4>
                    </div>
                    <div className="selector-list skills-selector-list">
                      {currentMonster?.combat_skills &&
                      currentMonster.combat_skills.length > 0 ? (
                        currentMonster.combat_skills.map((skill, sIdx) => {
                          const isEquipped = currentSlot.skills.some(
                            (sk) => sk?.name === skill.name,
                          )

                          return (
                            <div
                              key={sIdx}
                              className={`selector-skill-item ${
                                isEquipped ? "is-already-equipped" : ""
                              }`}
                              onClick={() => handlePickSkill(skill)}
                            >
                              <img
                                src={formatImageUrl(skill.icon)}
                                alt={skill.name}
                                className="skill-icon-big"
                              />
                              <div className="skill-info-block">
                                <div className="skill-title-row">
                                  <strong>{skill.name}</strong>
                                  {isEquipped && (
                                    <span className="equipped-badge">
                                      Đang dùng
                                    </span>
                                  )}
                                </div>
                                <div className="skill-meta-tags">
                                  {skill.cd && <span>CD: {skill.cd}</span>}
                                  {skill.break && (
                                    <span>Break: {skill.break}</span>
                                  )}
                                </div>
                                <p className="skill-desc-text">{skill.desc}</p>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="selector-empty">
                          Không có kỹ năng chiến đấu riêng.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {pickerTab === "item" && (
                  <div className="picker-tab-body">
                    <div className="selector-head">
                      <h4>
                        Chọn Trang Bị Mang Theo (Vị Trí {activeSlotIdx + 1})
                      </h4>
                      <div className="search-box">
                        <input
                          type="text"
                          placeholder="Tìm tên trang bị..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="selector-search-input"
                        />
                      </div>
                    </div>
                    <div className="selector-list items-selector-list">
                      {carriedItems

                        .filter((it) => {
                          const q = searchQuery.toLowerCase().trim()

                          return !q || it.name.toLowerCase().includes(q)
                        })

                        .map((item) => (
                          <div
                            key={item.id}
                            className={`selector-item item-selector-card quality-${item.quality.toLowerCase()}`}
                            onClick={() => handlePickItem(item)}
                          >
                            <img
                              src={formatImageUrl(item.icon)}
                              alt={item.name}
                              className="selector-item-thumb"
                              loading="lazy"
                            />
                            <div>
                              <strong>{item.name}</strong>
                              <span className="item-quality-pill">
                                {item.qualityVi || item.quality}
                              </span>
                              {item.desc && (
                                <p className="item-desc-clip">{item.desc}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          7. BANNER ỦNG HỘ / DONATE
          ======================================================== */}
      <div className="builder-support-banner-card">
        <div className="support-banner-inner">
          <span className="spark-icon">✨</span>
          <p>
            Nếu cảm thấy nội dung hay và hữu ích thì bạn có thể ủng hộ DUKE1305
            bằng cách sử dụng dịch vụ <strong>Nạp Game Giá Rẻ</strong>,{" "}
            <strong>Trung Gian Đổi Mail An Toàn</strong> hoặc liên hệ hỗ trợ khi
            có nhu cầu nha. Cảm ơn mọi người rất nhiều!
          </p>
          <div className="support-action-links">
            <Link to="/nap-game" className="support-btn nap">
              Nạp Game Ngay
            </Link>
            <Link to="/trung-gian" className="support-btn tg">
              Dịch Vụ Trung Gian
            </Link>
          </div>
        </div>
      </div>

      {/* Import Code Modal */}
      {importCodeModal && (
        <div
          className="modal-backdrop"
          onClick={() => setImportCodeModal(false)}
        >
          <div className="item-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="item-modal-header">
              <h3>📥 Nhập Mã Đội Hình</h3>
              <button
                className="aniimo-modal-close"
                onClick={() => setImportCodeModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="item-modal-body">
              <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>
                Dán chuỗi mã đội hình bạn nhận được từ bạn bè để nạp cấu hình:
              </p>
              <textarea
                rows={4}
                placeholder="Dán mã đội hình vào đây..."
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                style={{
                  width: "100%",

                  background: "#141f33",

                  border: "1px solid #1e283a",

                  color: "#f1f5f9",

                  padding: "10px",

                  borderRadius: "8px",

                  fontSize: "12px",
                }}
              />
              <button
                type="button"
                className="publish-btn"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(
                      decodeURIComponent(atob(importInput.trim())),
                    )

                    if (parsed.slots && Array.isArray(parsed.slots)) {
                      const newSlots: SlotData[] = [
                        {
                          monster: null,
                          skills: [null, null, null],
                          item: null,
                        },

                        {
                          monster: null,
                          skills: [null, null, null],
                          item: null,
                        },

                        {
                          monster: null,
                          skills: [null, null, null],
                          item: null,
                        },

                        {
                          monster: null,
                          skills: [null, null, null],
                          item: null,
                        },
                      ]

                      parsed.slots.forEach((slotData: any, idx: number) => {
                        if (idx < 4 && slotData.id) {
                          const m = monsters.find(
                            (mon) => mon.id === slotData.id,
                          )

                          if (m) {
                            const matchedSkills: (CombatSkill | null)[] = [
                              null,
                              null,
                              null,
                            ]

                            if (
                              slotData.skills &&
                              Array.isArray(slotData.skills)
                            ) {
                              slotData.skills.forEach(
                                (skName: string, skIdx: number) => {
                                  if (skIdx < 3 && skName && m.combat_skills) {
                                    matchedSkills[skIdx] =
                                      m.combat_skills.find(
                                        (cs) => cs.name === skName,
                                      ) || null
                                  }
                                },
                              )
                            }

                            const matchedItem = slotData.item
                              ? carriedItems.find(
                                  (it) => it.id === slotData.item,
                                ) || null
                              : null

                            newSlots[idx] = {
                              monster: m,
                              skills: matchedSkills,
                              item: matchedItem,
                            }
                          }
                        }
                      })

                      setSlots(newSlots)

                      if (parsed.title) setTeamTitle(parsed.title)

                      if (parsed.desc) setTeamDesc(parsed.desc)

                      setImportCodeModal(false)

                      setImportInput("")
                    }
                  } catch {
                    alert("Mã đội hình không hợp lệ!")
                  }
                }}
                style={{ marginTop: "10px" }}
              >
                Tải Đội Hình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Quản Lý & Chỉnh Sửa Đội Hình (Dành cho Admin và Tác Giả) */}
      {manageModalOpen && (
        <div
          className="wiki-modal-backdrop"
          onClick={() => setManageModalOpen(false)}
        >
          <div
            className="wiki-modal-box manage-teams-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="modal-header-icon">📂</span>
                <div>
                  <h3>Quản Lý Đội Hình</h3>
                  <p className="modal-header-desc">
                    Danh sách các đội hình bạn có thể chỉnh sửa hoặc xóa.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setManageModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="manage-modal-toolbar">
              <div className="search-box wiki-search">
                <Icon name="search" size={16} />
                <input
                  type="text"
                  placeholder="Tìm đội hình theo tên hoặc tác giả..."
                  value={manageSearchQuery}
                  onChange={(e) => setManageSearchQuery(e.target.value)}
                />
              </div>
              <span className="manage-count-badge">
                Hiển thị <strong>{manageableTeams.length}</strong> đội hình
              </span>
            </div>

            <div className="manage-teams-scroll-list">
              {manageableTeams.length === 0 ? (
                <div className="manage-empty-state">
                  <p>
                    {isAdmin
                      ? "Không tìm thấy đội hình nào phù hợp với bộ lọc."
                      : "Bạn chưa đăng đội hình nào lên cộng đồng. Hãy xếp 4 Aniimo và bấm Đăng để chia sẻ!"}
                  </p>
                </div>
              ) : (
                manageableTeams.map((team) => {
                  const isCurrentEditing = editingTeam?.id === team.id

                  return (
                    <div
                      key={team.id}
                      className={`manage-team-row ${
                        isCurrentEditing ? "is-currently-editing" : ""
                      }`}
                    >
                      <div className="manage-row-left">
                        <div className="manage-team-aniimo-thumbs">
                          {team.aniimo_ids.map((id, aIdx) => {
                            const m = getMonsterById(id)

                            return (
                              <div
                                key={aIdx}
                                className="manage-mini-avatar"
                                title={m ? m.title : `Aniimo #${id}`}
                              >
                                {m ? (
                                  <img
                                    src={formatImageUrl(m.thumbnail)}
                                    alt={m.title}
                                  />
                                ) : (
                                  <span>?</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <div className="manage-team-details">
                          <div className="manage-team-title-line">
                            <strong>{team.title}</strong>
                            {isCurrentEditing && (
                              <span className="editing-badge-now">
                                Đang sửa
                              </span>
                            )}
                          </div>
                          <div className="manage-team-meta-line">
                            <span>
                              Tác giả: <strong>{team.nickname}</strong>
                            </span>
                            <span>• {team.time_ago || "Gần đây"}</span>
                            <span>• ID: #{team.id}</span>
                          </div>
                        </div>
                      </div>

                      <div className="manage-row-actions">
                        <button
                          type="button"
                          className="manage-action-btn edit-load-btn"
                          onClick={() => {
                            loadTeamIntoBuilder(team, true)

                            setManageModalOpen(false)

                            const el = document.getElementById(
                              "team-slots-builder-anchor",
                            )

                            if (el) el.scrollIntoView({ behavior: "smooth" })
                          }}
                          title="Nạp vào builder để chỉnh sửa trực tiếp"
                        >
                          ✏️ Nạp Để Sửa
                        </button>
                        <button
                          type="button"
                          className="manage-action-btn delete-team-btn"
                          onClick={() => {
                            if (
                              confirm(
                                `Bạn có chắc chắn muốn xóa đội hình "${team.title}"?`,
                              )
                            ) {
                              deleteCommunityTeam(team.id)

                              if (editingTeam?.id === team.id) {
                                handleCancelEdit()
                              }
                            }
                          }}
                          title="Xóa đội hình này"
                        >
                          🗑️ Xóa
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
