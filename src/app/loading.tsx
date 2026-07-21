import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <LoaderCircle
        aria-label="로딩 중"
        className="size-5 animate-spin text-muted-foreground"
      />
    </div>
  );
}
