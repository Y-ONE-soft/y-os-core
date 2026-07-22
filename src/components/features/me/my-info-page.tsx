"use client";

import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { updateMe } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/components/features/auth/session-context";
import { useProjectStore } from "@/components/features/projects/project-store";
import type { SessionUser } from "@/types/auth";

/** 편집 가능한 필드만 폼 상태로 다룬다 — 아이디·역할·소속은 읽기 전용 표시 */
type Form = { name: string; title: string; email: string; phone: string };

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {/* 입력처럼 보이면 고칠 수 있다고 오해한다 — 배경 없는 텍스트로 둔다 */}
      <p className="flex h-9 items-center text-[13px] text-foreground">
        {value}
      </p>
    </div>
  );
}

export function MyInfoPage() {
  const { user, loading, setUser } = useSession();

  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-6 pb-6 pt-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full max-w-[560px] rounded-[12px]" />
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
    if (!patch.name && !form.name.trim()) {
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
    <div className="flex flex-col gap-5 px-6 pb-6 pt-5">
      <header className="flex shrink-0 flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold">내 정보</h1>
        <p className="text-[13px] text-muted-foreground">
          이름·직책·이메일·연락처를 수정할 수 있습니다
        </p>
      </header>

      <form
        onSubmit={save}
        className="flex w-full max-w-[560px] flex-col gap-5 rounded-[12px] border bg-background p-6"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-[17px] font-medium">
            {user.name.charAt(0)}
          </span>
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-[15px] font-semibold">{user.name}</p>
            <p className="truncate text-[12px] text-muted-foreground">
              {groupName ? `${roleLabel} · ${groupName}` : roleLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ReadOnlyField label="아이디" value={user.username} />
          <ReadOnlyField label="역할" value={roleLabel} />
          <ReadOnlyField label="소속 그룹" value={groupName} />
        </div>

        <div className="h-px bg-border" />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="me-name" className="text-xs">
              이름
            </Label>
            <Input
              id="me-name"
              value={form.name}
              onChange={(event) => set("name")(event.target.value)}
              aria-invalid={!form.name.trim() || undefined}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="me-title" className="text-xs">
              직책
            </Label>
            <Input
              id="me-title"
              value={form.title}
              placeholder="예: 사원"
              onChange={(event) => set("title")(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="me-email" className="text-xs">
              이메일
            </Label>
            <Input
              id="me-email"
              type="email"
              value={form.email}
              placeholder="예: name@y-os.local"
              onChange={(event) => set("email")(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="me-phone" className="text-xs">
              연락처
            </Label>
            <Input
              id="me-phone"
              value={form.phone}
              placeholder="예: 010-0000-0000"
              onChange={(event) => set("phone")(event.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? "저장 중…" : "저장"}
          </Button>
          {status && (
            <p
              role="status"
              className={
                status.kind === "ok"
                  ? "text-[13px] text-muted-foreground"
                  : "text-[13px] text-destructive"
              }
            >
              {status.text}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
