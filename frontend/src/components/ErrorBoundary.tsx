import React, { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleGoHome = (): void => {
    window.location.href = "/nap-game"
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          role="alert"
          style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "inherit",
          }}
        >
          <div
            style={{
              maxWidth: "480px",
              width: "100%",
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: "16px",
              padding: "32px 24px",
              textAlign: "center",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
              color: "#f8fafc",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                color: "#ef4444",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                marginBottom: "16px",
              }}
            >
              ⚠️
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "#fff" }}>
              Đã xảy ra sự cố không mong muốn
            </h2>
            <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.6, marginBottom: "24px" }}>
              Hệ thống đã ghi nhận lỗi giao diện. Bạn vui lòng tải lại trang hoặc quay về trang chủ để tiếp tục giao dịch.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #0284c7, #0369a1)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Tải lại trang
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "#cbd5e1",
                  fontWeight: 600,
                  fontSize: "14px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  cursor: "pointer",
                }}
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

