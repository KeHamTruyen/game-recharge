export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getAccessToken: () => string | null = () => null,
  ) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getAccessToken()
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })

    const body =
      response.status === 204
        ? undefined
        : await response.json().catch(() => undefined)
    if (!response.ok) {
      const details = (body as { details?: Array<{ message?: string }> } | undefined)?.details
      throw new ApiError(
        details?.map((detail) => detail.message).filter(Boolean).join(" ") ||
          (body as { error?: string; message?: string } | undefined)?.error ||
          (body as { message?: string } | undefined)?.message ||
          "Yêu cầu không thành công.",
        response.status,
        body,
      )
    }
    return body as T
  }
}
