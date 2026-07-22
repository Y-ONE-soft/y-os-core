import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/constants";
import { login } from "@/server/auth/service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { username, password } = (body ?? {}) as {
    username?: unknown;
    password?: unknown;
  };
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username.trim() ||
    !password
  ) {
    return NextResponse.json(
      { error: "아이디와 비밀번호를 입력하세요." },
      { status: 400 },
    );
  }

  const result = await login(username.trim(), password);
  if (!result) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: result.expiresAt,
  });

  return NextResponse.json({ user: result.user });
}
