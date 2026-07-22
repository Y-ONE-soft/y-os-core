"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { changePasswordApi, updateMe } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/components/features/auth/session-context";
import { useProjectStore } from "@/components/features/projects/project-store";
import type { SessionUser } from "@/types/auth";

/** 편집 가능한 필드만 폼 상태로 다룬다 — 아이디·역할·소속은 읽기 전용 표시 */
type Form = { name: string; title: string; email: string; phone: string };

/** 이 화면의 패널 — 백로그·로드맵 등 앱 전반과 같은 규격 */
const PANEL =
  "rounded-[8px] border bg-background shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)]";

/** 계정 정보처럼 바꿀 수 없는 값 — 입력처럼 보이면 고칠 수 있다고 오해한다 */
function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="shrink-0 text-[13px] text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 truncate text-[13px] font-medium">{value}</span>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * 비밀번호 변경 — 프로필 폼과 저장 버튼을 나눈다.
 * 이름만 고치려는데 현재 비밀번호까지 요구하면 안 된다.
 */
function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  const filled = current && next && confirm;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!filled) return;
    // 확인 일치는 서버가 알 수 없는 값이라 화면에서 막는다
    if (next !== confirm) {
      setStatus({ kind: "error", text: "새 비밀번호가 서로 다릅니다." });
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      await changePasswordApi({ currentPassword: current, nextPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      setStatus({
        kind: "ok",
        text: "비밀번호를 변경했습니다. 다른 기기는 로그아웃됩니다.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        text:
          error instanceof ApiError
            ? error.message
            : "변경에 실패했습니다. 잠시 후 다시 시도하세요.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby="me-password"
      className={cn("flex w-full flex-col", PANEL)}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 id="me-password" className="text-sm font-semibold">
            비밀번호
          </h2>
          <p className="text-[12px] text-muted-foreground">
            변경하면 이 기기를 제외한 다른 기기에서 로그아웃됩니다.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field id="pw-current" label="현재 비밀번호">
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => {
                setCurrent(event.target.value);
                setStatus(null);
              }}
              className="h-9 rounded-[8px]"
            />
          </Field>
          <Field id="pw-next" label="새 비밀번호">
            <Input
              id="pw-next"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => {
                setNext(event.target.value);
                setStatus(null);
              }}
              className="h-9 rounded-[8px]"
            />
          </Field>
          <Field id="pw-confirm" label="새 비밀번호 확인">
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              // 확인란만 즉시 불일치를 표시한다 — 새 비밀번호 쪽에 띄우면
              // 입력하는 도중 내내 빨갛다
              aria-invalid={
                (confirm.length > 0 && confirm !== next) || undefined
              }
              onChange={(event) => {
                setConfirm(event.target.value);
                setStatus(null);
              }}
              className="h-9 rounded-[8px]"
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 rounded-b-[8px] border-t bg-muted/40 px-5 py-3">
        {status && (
          <p
            role="status"
            className={cn(
              "min-w-0 flex-1 truncate text-[12px]",
              status.kind === "ok"
                ? "text-muted-foreground"
                : "text-destructive",
            )}
          >
            {status.text}
          </p>
        )}
        <Button type="submit" size="sm" disabled={!filled || saving}>
          {saving ? "변경 중…" : "비밀번호 변경"}
        </Button>
      </div>
    </form>
  );
}

export function MyInfoPage() {
  const { user, loading, setUser } = useSession();

  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-6 pb-6 pt-5">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-64" />
        <div className="flex gap-4 pt-1">
          <Skeleton className="h-[236px] w-[280px] rounded-[8px]" />
          <Skeleton className="h-[236px] flex-1 rounded-[8px]" />
        </div>
      </div>
    );
  }
  if (!user) return null;

  // 세션이 도착한 뒤에 폼을 마운트해 초기값을 그 자리에서 넣는다. 이펙트로
  // 나중에 채우면 첫 렌더가 빈 폼이고, 상태 동기화 규칙도 복잡해진다.
  // key로 계정이 바뀌면(재로그인) 폼이 통째로 새로 만들어진다.
  return <MyInfoForm key={user.id} user={user} setUser={setUser} />;
}

function MyInfoForm({
  user,
  setUser,
}: {
  user: SessionUser;
  setUser: (next: SessionUser) => void;
}) {
  const { groups } = useProjectStore();
  const [form, setForm] = useState<Form>(() => ({
    name: user.name,
    title: user.title ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  // 그룹 이름은 세션에 없어 프로젝트 스토어에서 찾는다. 스토어가 늦게 로드되는
  // 동안 groupId("g-soft")를 그대로 보여주면 내부 id가 사용자에게 노출되므로,
  // 로드 전에는 빈 값으로 둔다.
  const groupsLoaded = groups.length > 0;
  const groupName = !user.groupId
    ? "소속 없음"
    : groupsLoaded
      ? (groups.find((group) => group.id === user.groupId)?.name ?? "소속 없음")
      : "";
  const roleLabel = user.role === "MASTER" ? "마스터" : "스탭";

  const set = (key: keyof Form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus(null);
  };

  // 값이 실제로 바뀐 필드만 보낸다 — 안 바뀐 이메일까지 보내면 중복 검사가
  // 불필요하게 돌고, 서버가 받은 필드를 그대로 덮어쓰는 것도 피한다.
  const changed = (): Record<string, string> => {
    const patch: Record<string, string> = {};
    if (form.name.trim() !== user.name) patch.name = form.name.trim();
    if (form.title.trim() !== (user.title ?? "")) patch.title = form.title.trim();
    if (form.email.trim() !== (user.email ?? "")) patch.email = form.email.trim();
    if (form.phone.trim() !== (user.phone ?? "")) patch.phone = form.phone.trim();
    return patch;
  };

  const dirty = Object.keys(changed()).length > 0;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const patch = changed();
    if (!Object.keys(patch).length) return;
    if (!form.name.trim()) {
      setStatus({ kind: "error", text: "이름을 입력하세요." });
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const updated = await updateMe(patch);
      setUser(updated); // 헤더 아바타·이름이 즉시 따라온다
      setStatus({ kind: "ok", text: "저장했습니다." });
    } catch (error) {
      setStatus({
        kind: "error",
        text:
          error instanceof ApiError
            ? error.message
            : "저장에 실패했습니다. 잠시 후 다시 시도하세요.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 pt-5">
      <header className="flex shrink-0 flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold">내 정보</h1>
        <p className="text-[13px] text-muted-foreground">
          프로필과 비밀번호를 수정할 수 있습니다
        </p>
      </header>

      {/* 좌: 계정 요약(고정폭) · 우: 편집 폼. 한 장짜리 카드는 넓은 화면에서
          왼쪽에 몰려 페이지가 비어 보인다 — 백로그가 있는 화면들과 같은 구성.
          비밀번호는 아래 행에 따로 둔다 (저장 버튼이 분리돼야 하므로 폼도 별개). */}
      <div className="flex flex-wrap items-stretch gap-4">
        <section
          aria-labelledby="me-account"
          className={cn("flex w-[280px] shrink-0 flex-col gap-4 p-5", PANEL)}
        >
          {/* 이름 아래에는 아이디를 둔다. 역할·소속은 아래 계정 목록에 있으므로
              여기에 칩으로 또 넣으면 "스탭 / 스탭"처럼 같은 말이 두 번 보인다. */}
          <div className="flex flex-col items-center gap-2.5 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-muted text-[22px] font-medium">
              {user.name.charAt(0)}
            </span>
            <div className="flex min-w-0 flex-col items-center gap-0.5">
              <p className="max-w-full truncate text-[15px] font-semibold">
                {user.name}
              </p>
              <p className="max-w-full truncate text-[12px] text-muted-foreground">
                @{user.username}
              </p>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="flex flex-col">
            <h2 id="me-account" className="pb-1.5 text-sm font-semibold">
              계정
            </h2>
            {/* 아이디는 이름 아래 @{username}으로 이미 보인다 */}
            <ReadOnlyRow label="역할" value={roleLabel} />
            {/* 그룹 이름은 스토어 로드 후에야 안다. 그동안 "—"를 보여주면
                "소속 없음"으로 읽히므로 자리만 잡아둔다. */}
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="shrink-0 text-[13px] text-muted-foreground">
                소속 그룹
              </span>
              {groupName ? (
                <span className="min-w-0 truncate text-[13px] font-medium">
                  {groupName}
                </span>
              ) : (
                <Skeleton className="h-3.5 w-16" />
              )}
            </div>
          </div>

          <p className="text-[11px] leading-[15px] text-muted-foreground">
            아이디·역할·소속은 관리자가 관리합니다.
          </p>
        </section>

        <form
          onSubmit={save}
          aria-labelledby="me-profile"
          className={cn("flex min-w-[320px] flex-1 flex-col", PANEL)}
        >
          <div className="flex flex-col gap-4 p-5">
            <h2 id="me-profile" className="text-sm font-semibold">
              프로필
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field id="me-name" label="이름">
                <Input
                  id="me-name"
                  value={form.name}
                  onChange={(event) => set("name")(event.target.value)}
                  aria-invalid={!form.name.trim() || undefined}
                  className="h-9 rounded-[8px]"
                />
              </Field>
              <Field id="me-title" label="직책">
                <Input
                  id="me-title"
                  value={form.title}
                  placeholder="예: 사원"
                  onChange={(event) => set("title")(event.target.value)}
                  className="h-9 rounded-[8px]"
                />
              </Field>
              <Field id="me-email" label="이메일">
                <Input
                  id="me-email"
                  type="email"
                  value={form.email}
                  placeholder="예: name@y-os.local"
                  onChange={(event) => set("email")(event.target.value)}
                  className="h-9 rounded-[8px]"
                />
              </Field>
              <Field id="me-phone" label="연락처">
                <Input
                  id="me-phone"
                  value={form.phone}
                  placeholder="예: 010-0000-0000"
                  onChange={(event) => set("phone")(event.target.value)}
                  className="h-9 rounded-[8px]"
                />
              </Field>
            </div>
          </div>

          {/* 액션은 muted 밴드로 내려 본문과 분리한다 — 폼 안에 버튼이 그냥
              떠 있으면 저장 지점이 눈에 안 들어온다.
              mt-auto로 바닥에 붙여 좌측 계정 패널과 높이를 맞춘다. */}
          <div className="mt-auto flex items-center justify-end gap-3 rounded-b-[8px] border-t bg-muted/40 px-5 py-3">
            {status && (
              <p
                role="status"
                className={cn(
                  "min-w-0 flex-1 truncate text-[12px]",
                  status.kind === "ok"
                    ? "text-muted-foreground"
                    : "text-destructive",
                )}
              >
                {status.text}
              </p>
            )}
            <Button type="submit" size="sm" disabled={!dirty || saving}>
              {saving ? "저장 중…" : "저장"}
            </Button>
          </div>
        </form>
      </div>

      <PasswordSection />
    </div>
  );
}
