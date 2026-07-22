import { LoginForm } from "@/components/features/auth/login-form";
import { YOneLogo } from "@/components/layout/y-one-logo";

export function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="flex flex-col items-center gap-2.5">
        <YOneLogo size={40} />
        <h1 className="text-xl font-semibold">Y.OS Core</h1>
        <p className="text-[13px] text-muted-foreground">통합 업무 관리</p>
      </div>
      <LoginForm />
    </div>
  );
}
