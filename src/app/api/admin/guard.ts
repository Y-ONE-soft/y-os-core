import { NextResponse } from "next/server";

// 관리 API 공통 가드/응답 헬퍼 — route.ts가 아니므로 라우트로 노출되지 않는다.
export { currentUser } from "@/server/auth/session";

export const unauthorized = () =>
  NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

export const forbidden = () =>
  NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

export const badRequest = (message = "잘못된 요청입니다.") =>
  NextResponse.json({ error: message }, { status: 400 });

/** 필수 문자열 필드 검증 */
export const isName = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
