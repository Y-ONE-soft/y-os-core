// 프론트의 모든 HTTP 호출이 거치는 공통 래퍼 — 컴포넌트에서 fetch 직접 사용 금지 (CLAUDE.md 아키텍처 규칙).
// 백엔드 분리 시 이 파일의 기준 URL만 바꾸면 되도록 호출부는 경로만 넘긴다.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let message = `요청에 실패했습니다. (${response.status})`;
    try {
      const data = (await response.json()) as { error?: unknown };
      if (typeof data.error === "string") message = data.error;
    } catch {
      // 에러 본문이 JSON이 아니면 기본 메시지 유지
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: Record<string, unknown>) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body: Record<string, unknown>) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  // 부분 수정이 아니라 통째 교체일 때 (예: 프리셋 덮어쓰기)
  put: <T>(path: string, body: Record<string, unknown>) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
