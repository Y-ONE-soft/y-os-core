import { LoginForm } from "@/components/features/auth/login-form";

/** Figma: Y.ONE Logo(92:158) — 로그인 화면은 40px 변형을 사용한다. */
function BrandMark() {
  return (
    <div
      aria-hidden
      className="flex size-10 items-center justify-center rounded-[6px] bg-primary"
    >
      <span className="text-[9px] font-medium tracking-[1.26px] text-primary-foreground">
        Y.ONE
      </span>
    </div>
  );
}

export function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="flex flex-col items-center gap-2.5">
        <BrandMark />
        <h1 className="text-xl font-semibold">Y.OS Core</h1>
        <p className="text-[13px] text-muted-foreground">통합 업무 관리</p>
      </div>
      <LoginForm />
    </div>
  );
}
