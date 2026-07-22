"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { login } from "@/lib/api/auth";
import { AFTER_LOGIN_PATH } from "@/lib/constants";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!username || !password) {
      setError("아이디와 비밀번호를 입력하세요.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await login(username, password);
      router.replace(AFTER_LOGIN_PATH);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
      setPending(false);
    }
  }

  return (
    <Card className="w-90 gap-0 rounded-md py-6 [--card-spacing:--spacing(6)]">
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-2xl font-medium">로그인</h2>
        <p className="text-sm text-muted-foreground">
          Y.OS Core 계정으로 로그인하세요.
        </p>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5 pt-1">
            <Label htmlFor="login-username">아이디 또는 이메일</Label>
            <Input
              id="login-username"
              name="username"
              type="text"
              placeholder="name@y-one.co.kr"
              autoComplete="username"
              disabled={pending}
              className="h-9 rounded-md px-3"
            />
          </div>
          <div className="flex flex-col gap-1.5 pt-1">
            <Label htmlFor="login-password">비밀번호</Label>
            <Input
              id="login-password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={pending}
              className="h-9 rounded-md px-3"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="w-full rounded-md"
          >
            {pending ? "로그인 중..." : "로그인"}
          </Button>
        </form>
        <div className="flex justify-center">
          <Link
            href="/reset-password"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
