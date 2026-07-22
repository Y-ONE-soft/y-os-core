"use client";

import { useEffect, useState } from "react";

import { fetchUsers } from "@/lib/api/users";
import type { DirectoryUser } from "@/types/users";

// 사용자 목록은 세션 동안 거의 바뀌지 않으므로 모듈 수준에서 한 번만 받아 공유한다.
// 요청 다이얼로그가 여러 곳(단계 추가·단계 상세·할일 상세)에서 열리는데
// 열 때마다 재요청하면 낭비다.
let cache: DirectoryUser[] | null = null;
let inflight: Promise<DirectoryUser[]> | null = null;

function load() {
  if (cache) return Promise.resolve(cache);
  inflight ??= fetchUsers()
    .then((users) => {
      cache = users;
      return users;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** 작업자 선택 목록. 실패해도 화면이 죽지 않도록 빈 배열로 떨어뜨린다. */
export function useUsers() {
  const [users, setUsers] = useState<DirectoryUser[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    let active = true;
    load()
      .then((list) => {
        if (active) setUsers(list);
      })
      .catch(() => {
        if (active) setUsers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { users, loading };
}
