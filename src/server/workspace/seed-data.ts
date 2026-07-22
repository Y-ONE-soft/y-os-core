// 워크스페이스 시드 — prisma/seed.ts와 reset(데이터 초기화)이 공유한다.
//
// 그룹 골격만 시드하고 프로젝트·단계·작업은 만들지 않는다. 실제 사용하며
// 화면에서 직접 만들어 검증하기 위해서다.
//
// 그룹을 남기는 이유: User.groupId가 ProjectGroup을 참조하는 FK이고, 소속 그룹이
// 없는 스탭은 프로젝트를 만들 수 없다(API가 400). 사용자 소속을 지정하는 UI가
// 아직 없으므로, 그룹까지 비우면 DB를 직접 고치지 않는 한 복구할 수 없다.

const GROUPS = [
  { id: "g-lab", name: "Lab" },
  { id: "g-soft", name: "Soft" },
  { id: "g-printing", name: "Printing" },
];

/** DB 행 형태 — createdAt 정렬이 시드 순서를 보존하도록 인덱스 기반 타임스탬프 부여 */
export function workspaceSeedRows() {
  const base = Date.parse("2026-07-22T00:00:00.000Z");
  const at = (index: number) => new Date(base + index * 1000);

  const groups = GROUPS.map((group, i) => ({
    id: group.id,
    name: group.name,
    createdAt: at(i),
  }));

  return { groups };
}
