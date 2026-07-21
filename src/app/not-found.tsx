import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-sm text-muted-foreground">
          주소가 잘못되었거나 아직 준비되지 않은 페이지입니다.
        </p>
      </div>
      <Button asChild>
        <Link href="/">대시보드로 돌아가기</Link>
      </Button>
    </div>
  );
}
