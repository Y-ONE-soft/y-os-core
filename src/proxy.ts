import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/constants";

// 비로그인 상태로 접근 가능한 경로
const PUBLIC_PATHS = new Set(["/login", "/reset-password"]);

// 쿠키 존재 여부만 보는 가벼운 관문 — 실제 세션 검증은 서버 레이어(/api/auth/me 등)에서 한다.
// 위조 쿠키는 여길 통과해도 데이터 접근(API) 단계에서 401로 걸러진다.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // API(자체 401 처리)·Next 내부 리소스·정적 파일(확장자 포함 경로) 제외
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
