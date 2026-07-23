"use client";

import { useEffect, type RefObject } from "react";

/**
 * 화면 어디서든(입력·오버레이 밖에서) 키보드를 치면 지정한 입력창으로 포커스를 옮겨
 * 그 글자가 바로 입력되게 한다. 백로그 빠른 추가용 — "아무 데서나 타이핑 → 입력창 캡처".
 *
 * - 이미 입력/텍스트영역/선택/편집 요소에 포커스가 있으면 가로채지 않는다.
 * - 모달 오버레이(`[role="dialog"]`)가 열려 있으면 가로채지 않는다(상세 위에서 타이핑을 뺏지 않도록).
 * - Ctrl/Cmd/Alt 조합키·기능키(화살표·Backspace 등)는 무시한다.
 * - 한글 등 IME 입력은 포커스만 옮기고 조합은 입력창에서 이어지게 둔다(직접 삽입하면 조합이 깨진다).
 */
export function useTypeToFocus(ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key;
      const isIME = event.isComposing || key === "Process";
      // 출력 가능한 단일 문자(글자·숫자·기호·공백)만 — 기능키는 length가 1이 아니다
      const isPrintable = key.length === 1;
      if (!isIME && !isPrintable) return;

      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        active?.isContentEditable
      ) {
        return;
      }
      // 오버레이가 열려 있으면(상세 등) 그쪽 타이핑을 뺏지 않는다
      if (document.querySelector('[role="dialog"]')) return;

      const input = ref.current;
      if (!input || input === active) return;

      input.focus();

      // IME(한글)는 포커스만 — 조합은 입력창에서 이어진다.
      // 일반 문자는 기본 동작을 막고 직접 붙여, 포커스 이동으로 첫 글자가 유실되지 않게 한다.
      if (isPrintable && !isIME) {
        event.preventDefault();
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(input, input.value + key);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [ref]);
}
