import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // 워크트리(.claude/worktrees/*)에서 락파일이 2개 감지되면 Next.js가 워크스페이스
    // 루트를 메인 폴더로 잘못 추론한다 — 각 체크아웃이 자기 자신을 루트로 갖도록 고정.
    root: __dirname,
  },
};

export default nextConfig;
