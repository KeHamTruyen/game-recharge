export interface SkillElement {
  name: string
  slug: string
  icon?: string
}

export interface SkillDamageType {
  name: string
  slug: string
}

export interface CombatSkill {
  slot: number
  name: string
  core_icon?: string
  icon: string
  elements?: SkillElement[]
  damage_type?: SkillDamageType[]
  tags?: string[]
  might?: string
  ep_cost?: string
  break?: string
  cd?: string
  desc: string
  note?: string
}

export interface MonsterStats {
  hp: number
  atk: number
  break: number
  pdef: number
  mdef: number
  regen: number
}

export interface TaxonomyItem {
  id?: number
  name: string
  slug: string
  icon?: string
}

export interface AniimoMonster {
  id: number
  title: string
  slug: string
  url?: string
  thumbnail: string
  no: string
  stats: MonsterStats
  taxonomies: {
    elements?: TaxonomyItem[]
    roles?: TaxonomyItem[]
    stages?: TaxonomyItem[]
    damages?: TaxonomyItem[]
    home_skills?: TaxonomyItem[]
  }
  combat_skills?: CombatSkill[]
  build_guide?: {
    combo_desc?: string
    next_stages?: Array<{
      id: number
      name: string
      slug: string
      url: string
      thumbnail: string
    }>
    rec_team?: Array<{
      id: number
      name: string
      slug: string
      url: string
      thumbnail: string
    }>
  }
  forms_and_maps?: Record<string, { form: string; map: string }>
}

export interface GiftcodeItem {
  id: string
  code: string
  reward: string
  created_at: string
  author?: string
  expires_at?: string
  isCommunity?: boolean
  upvotes?: number
  reports?: number
}

export interface TeamMemberBuild {
  aniimo_id: number
  s1_name?: string
  s1_icon?: string
  s2_name?: string
  s2_icon?: string
  s3_name?: string
  s3_icon?: string
  item_name?: string
  item_icon?: string
  item_id?: string
  item_quality?: string
}

export interface CommunityTeam {
  id: number
  user_id?: number | string
  nickname: string
  title: string
  aniimo_ids: number[]
  build_data: TeamMemberBuild[]
  description: string
  avg_stars: number
  total_ratings: number
  time_ago?: string
  isCommunity?: boolean
  authorEmail?: string
}

export interface AniimoReview {
  id: string
  monsterId: number
  author: string
  rating: number
  comment: string
  createdAt: string
}

export interface LibraryItem {
  id: string
  item_id?: string
  name: string
  desc: string
  categoryGroup?: string
  category: string
  rawCategory?: string
  quality: string
  qualityVi?: string
  icon: string
  sub?: string
  detail_facts?: Array<{ label: string; value: string }>
  obtain_methods?: string[]
}
