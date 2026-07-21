"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          문제가 발생했습니다
        </h1>
        <p className="text-sm text-muted-foreground">
          일시적인 오류일 수 있습니다. 다시 시도해 주세요.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">오류 코드: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset}>다시 시도</Button>
    </div>
  );
}
