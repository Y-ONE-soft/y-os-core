"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  return (
    <Card className="w-90 gap-0 rounded-md py-6 [--card-spacing:--spacing(6)]">
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-2xl font-medium">로그인</h2>
        <p className="text-sm text-muted-foreground">
          Y.OS Core 계정으로 로그인하세요.
        </p>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            // 화면 전용 단계 — 인증 연동 태스크에서 실제 제출 로직을 연결한다.
            event.preventDefault();
          }}
        >
          <div className="flex flex-col gap-1.5 pt-1">
            <Label htmlFor="login-email">이메일</Label>
            <Input
              id="login-email"
              name="email"
              type="email"
              placeholder="name@y-one.co.kr"
              autoComplete="email"
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
              className="h-9 rounded-md px-3"
            />
          </div>
          <Button type="submit" size="lg" className="w-full rounded-md">
            로그인
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
