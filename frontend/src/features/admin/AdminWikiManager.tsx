import React, { useState, useEffect } from "react"
import {
  getEffectiveAniimos,
  getEffectiveGiftcodes,
  saveGiftcode,
  deleteGiftcode,
  saveAniimo,
  formatImageUrl,
} from "@/features/wiki/wikiData"
import type { AniimoMonster, GiftcodeItem } from "@/features/wiki/types"
import { Icon } from "@/components/ui"
import { refreshWiki } from "@/features/wiki/wikiStore"

export function AdminWikiManager() {
  const [subTab, setSubTab] = useState<"giftcodes" | "aniimos">("giftcodes")
  const [giftcodes, setGiftcodes] = useState<GiftcodeItem[]>([])
  const [aniimos, setAniimos] = useState<AniimoMonster[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Giftcode Form
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null)
  const [codeVal, setCodeVal] = useState("")
  const [rewardVal, setRewardVal] = useState("")
  const [dateVal, setDateVal] = useState("")

  // Aniimo Edit Form
  const [editingMonster, setEditingMonster] = useState<AniimoMonster | null>(
    null,
  )
  const [searchMonster, setSearchMonster] = useState("")
  const [notice, setNotice] = useState("")

  const loadData = () => {
    setGiftcodes(getEffectiveGiftcodes())
    setAniimos(getEffectiveAniimos())
  }

  useEffect(() => {
    loadData()
    const handler = () => loadData()
    window.addEventListener("wiki-data-changed", handler)
    void refreshWiki().catch(() => setNotice("Không thể tải dữ liệu Wiki từ máy chủ."))
    return () => window.removeEventListener("wiki-data-changed", handler)
  }, [])

  // --- GIFTCODE ACTIONS ---
  const handleSaveGiftcode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codeVal.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const isNew = !editingCodeId
      const item: GiftcodeItem = {
        id: editingCodeId || `gc_admin_${Date.now()}`,
        code: codeVal.trim(),
        reward: rewardVal.trim() || "Chi tiết xem trong game",
        created_at: dateVal || new Date().toLocaleString("vi-VN"),
      }
      await saveGiftcode(item, isNew)
      setEditingCodeId(null)
      setCodeVal("")
      setRewardVal("")
      setDateVal("")
      loadData()
      setNotice("Đã lưu Giftcode thành công!")
      setTimeout(() => setNotice(""), 3000)
    } catch (err: any) {
      setNotice(err?.message || "Lỗi khi lưu giftcode")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditGiftcode = (item: GiftcodeItem) => {
    setEditingCodeId(item.id)
    setCodeVal(item.code)
    setRewardVal(item.reward)
    setDateVal(item.created_at)
  }

  const handleDeleteGiftcode = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa Giftcode này?")) return
    try {
      await deleteGiftcode(id)
      loadData()
      setNotice("Đã xóa Giftcode thành công!")
      setTimeout(() => setNotice(""), 3000)
    } catch (err: any) {
      setNotice(err?.message || "Lỗi khi xóa giftcode")
    }
  }

  // --- ANIIMO EDIT ACTIONS ---
  const handleSaveMonster = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMonster || isSubmitting) return

    setIsSubmitting(true)
    try {
      await saveAniimo(editingMonster)
      setNotice(`Đã cập nhật thông tin thú cưng "${editingMonster.title}"!`)
      setEditingMonster(null)
      loadData()
      setTimeout(() => setNotice(""), 3000)
    } catch (err: any) {
      console.error(err)
      setNotice(err?.message || "Lỗi khi cập nhật thú cưng")
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredMonsters = aniimos.filter(
    (m) =>
      m.title.toLowerCase().includes(searchMonster.toLowerCase()) ||
      m.no.toLowerCase().includes(searchMonster.toLowerCase()),
  )

  return (
    <div className="admin-wiki-manager">
      <div className="product-list-toolbar">
        <div>
          <h2>Quản Lý Aniimo Wiki</h2>
          <p>
            Chỉnh sửa trực tiếp danh sách Giftcode, thông số chỉ số Stats, tên
            và vị trí xuất hiện của 98 thú cưng Aniimo.
          </p>
        </div>
        {notice && <span className="admin-status-badge active">{notice}</span>}
      </div>

      <div className="admin-wiki-tabs">
        <button
          type="button"
          className={`wiki-subtab-btn ${
            subTab === "giftcodes" ? "active" : ""
          }`}
          onClick={() => setSubTab("giftcodes")}
        >
          🎁 Quản Lý Giftcode ({giftcodes.length})
        </button>
        <button
          type="button"
          className={`wiki-subtab-btn ${subTab === "aniimos" ? "active" : ""}`}
          onClick={() => setSubTab("aniimos")}
        >
          🐾 Chỉnh Sửa Thông Tin Aniimo (98 Thú Cưng)
        </button>
      </div>

      {subTab === "giftcodes" ? (
        <div className="admin-wiki-content">
          <form onSubmit={handleSaveGiftcode} className="admin-wiki-form">
            <h3>
              {editingCodeId ? "Chỉnh sửa mã Giftcode" : "Thêm Giftcode Mới"}
            </h3>
            <div className="admin-wiki-form-grid">
              <label>
                <span>Mã Code</span>
                <input
                  type="text"
                  placeholder="Ví dụ: aniimofree2026"
                  value={codeVal}
                  onChange={(e) => setCodeVal(e.target.value)}
                  required
                />
              </label>
              <label>
                <span>Phần Thưởng</span>
                <input
                  type="text"
                  placeholder="Ví dụ: 500 Tinh Thể, 1 Trứng Cổ Đại"
                  value={rewardVal}
                  onChange={(e) => setRewardVal(e.target.value)}
                />
              </label>
              <label>
                <span>Ngày tạo / Giờ</span>
                <input
                  type="text"
                  placeholder="Ví dụ: 12:00 - 10/10/2026"
                  value={dateVal}
                  onChange={(e) => setDateVal(e.target.value)}
                />
              </label>
            </div>
            <div className="admin-form-actions">
              {editingCodeId && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setEditingCodeId(null)
                    setCodeVal("")
                    setRewardVal("")
                    setDateVal("")
                  }}
                >
                  Hủy bỏ
                </button>
              )}
              <button type="submit" className="primary-button">
                {editingCodeId ? "Cập Nhật Giftcode" : "+ Thêm Giftcode"}
              </button>
            </div>
          </form>

          <div className="admin-table-wrapper" style={{ marginTop: "24px" }}>
            <table className="admin-wiki-table">
              <thead>
                <tr>
                  <th>Mã Code</th>
                  <th>Phần Thưởng</th>
                  <th>Thời Gian</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {giftcodes.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code className="admin-code-pill">{item.code}</code>
                    </td>
                    <td>{item.reward}</td>
                    <td>{item.created_at}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="table-btn edit"
                          onClick={() => handleEditGiftcode(item)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="table-btn delete"
                          onClick={() => handleDeleteGiftcode(item.id)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="admin-wiki-content">
          <div className="admin-wiki-filter-row">
            <div className="search-box">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Tìm thú cưng theo tên hoặc số hiệu..."
                value={searchMonster}
                onChange={(e) => setSearchMonster(e.target.value)}
              />
            </div>
            <span>
              Tìm thấy <strong>{filteredMonsters.length}</strong> kết quả
            </span>
          </div>

          <div className="admin-monsters-list">
            {filteredMonsters.map((m) => (
              <div key={m.id} className="admin-monster-row">
                <img
                  src={formatImageUrl(m.thumbnail)}
                  alt={m.title}
                  className="admin-monster-thumb"
                />
                <div className="admin-monster-main">
                  <strong>{m.title}</strong>
                  <small>
                    #{m.no} • {m.taxonomies.elements?.[0]?.name} •{" "}
                    {m.taxonomies.roles?.[0]?.name}
                  </small>
                </div>
                <div className="admin-monster-stats-peek">
                  <span>
                    HP: <strong>{m.stats.hp}</strong>
                  </span>
                  <span>
                    ATK: <strong>{m.stats.atk}</strong>
                  </span>
                  <span>
                    DEF: <strong>{m.stats.pdef}</strong>
                  </span>
                  <span>
                    BREAK: <strong>{m.stats.break}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  className="table-btn edit"
                  onClick={() =>
                    setEditingMonster({ ...m, stats: { ...m.stats } })
                  }
                >
                  Chỉnh Sửa ✏️
                </button>
              </div>
            ))}
          </div>

          {editingMonster && (
            <div
              className="modal-backdrop"
              onClick={() => setEditingMonster(null)}
            >
              <div
                className="admin-edit-modal-box"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="item-modal-header">
                  <div className="item-modal-title-row">
                    <img
                      src={formatImageUrl(editingMonster.thumbnail)}
                      alt=""
                      className="item-modal-icon"
                    />
                    <div>
                      <h3>Chỉnh Sửa Aniimo #{editingMonster.no}</h3>
                      <span style={{ color: "#38dbf8", fontSize: "12px" }}>
                        Điều chỉnh chỉ số Base Stats và Tên
                      </span>
                    </div>
                  </div>
                  <button
                    className="aniimo-modal-close"
                    onClick={() => setEditingMonster(null)}
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={handleSaveMonster}
                  className="admin-monster-edit-form"
                >
                  <label>
                    <span>Tên Aniimo</span>
                    <input
                      type="text"
                      value={editingMonster.title}
                      onChange={(e) =>
                        setEditingMonster({
                          ...editingMonster,
                          title: e.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <div className="stats-edit-grid">
                    <label>
                      <span>HP (Máu)</span>
                      <input
                        type="number"
                        value={editingMonster.stats.hp}
                        onChange={(e) =>
                          setEditingMonster({
                            ...editingMonster,
                            stats: {
                              ...editingMonster.stats,
                              hp: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>ATK (Tấn công)</span>
                      <input
                        type="number"
                        value={editingMonster.stats.atk}
                        onChange={(e) =>
                          setEditingMonster({
                            ...editingMonster,
                            stats: {
                              ...editingMonster.stats,
                              atk: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>BREAK (Phá giáp)</span>
                      <input
                        type="number"
                        value={editingMonster.stats.break}
                        onChange={(e) =>
                          setEditingMonster({
                            ...editingMonster,
                            stats: {
                              ...editingMonster.stats,
                              break: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>P.DEF (Giáp vật lý)</span>
                      <input
                        type="number"
                        value={editingMonster.stats.pdef}
                        onChange={(e) =>
                          setEditingMonster({
                            ...editingMonster,
                            stats: {
                              ...editingMonster.stats,
                              pdef: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>M.DEF (Kháng phép)</span>
                      <input
                        type="number"
                        value={editingMonster.stats.mdef}
                        onChange={(e) =>
                          setEditingMonster({
                            ...editingMonster,
                            stats: {
                              ...editingMonster.stats,
                              mdef: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>REGEN (Hồi phục)</span>
                      <input
                        type="number"
                        value={editingMonster.stats.regen}
                        onChange={(e) =>
                          setEditingMonster({
                            ...editingMonster,
                            stats: {
                              ...editingMonster.stats,
                              regen: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  </div>

                  <label>
                    <span>Mô Tả / Vị Trí Bản Đồ Xuất Hiện</span>
                    <textarea
                      value={editingMonster.forms_and_maps?.basic?.map || ""}
                      onChange={(e) =>
                        setEditingMonster({
                          ...editingMonster,
                          forms_and_maps: {
                            ...editingMonster.forms_and_maps,
                            basic: {
                              form:
                                editingMonster.forms_and_maps?.basic?.form ||
                                "0",
                              map: e.target.value,
                            },
                          },
                        })
                      }
                      rows={3}
                    />
                  </label>

                  <div className="admin-form-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setEditingMonster(null)}
                    >
                      Hủy
                    </button>
                    <button type="submit" className="primary-button">
                      Lưu Thay Đổi
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
