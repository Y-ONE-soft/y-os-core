// 워크스페이스 시드 트리 — prisma/seed.ts와 reset(데이터 초기화)이 공유한다.
// 기존 localStorage 시드(사이드바 docs/5, 보드 docs/8·11, 이후 작업자들이 확장한 값)와 동일.

type SeedTask = { id: string; name: string };
type SeedStage = {
  id: string;
  name: string;
  color: string;
  startDate?: string;
  endDate?: string;
  showDeadline: boolean;
  tasks: SeedTask[];
};
type SeedBoard = { stages: SeedStage[]; backlog: SeedTask[] };

const GROUPS = [
  { id: "g-lab", name: "Lab", projects: [] as { id: string; name: string; color: string }[] },
  {
    id: "g-soft",
    name: "Soft",
    projects: [
      { id: "p-cms", name: "화학강사 김한울 CMS 프로젝트", color: "#3b82f6" },
      { id: "p-yos", name: "YOS", color: "#8b5cf6" },
      { id: "p-contents", name: "Y.OS CONTENTS", color: "#10b981" },
    ],
  },
  {
    id: "g-printing",
    name: "Printing",
    projects: [{ id: "p-wise", name: "와이즈", color: "#f59e0b" }],
  },
];

const BOARDS: Record<string, SeedBoard> = {
  "p-yos": {
    stages: [
      {
        id: "st-define",
        name: "프로젝트 정의",
        color: "#3b82f6",
        startDate: "2026-07-20",
        endDate: "2026-07-24",
        showDeadline: true,
        tasks: [
          { id: "tk-prd", name: "PRD" },
          { id: "tk-req", name: "요구사항 정의서" },
        ],
      },
      {
        id: "st-design",
        name: "서비스·기술 설계",
        color: "#8b5cf6",
        showDeadline: false,
        tasks: [{ id: "tk-proto", name: "화면설계·프로토타입" }],
      },
      {
        id: "st-build",
        name: "개발·구현",
        color: "#10b981",
        showDeadline: false,
        tasks: [
          { id: "tk-cms-core", name: "CMS 모듈 핵심기능 개발" },
          { id: "tk-cms-data", name: "CMS 모듈 실사용 데이터 반영" },
          { id: "tk-core", name: "CORE 모듈 핵심 기능 개발" },
        ],
      },
    ],
    backlog: [
      { id: "bk-overview", name: "프로젝트 개요서" },
      { id: "bk-service", name: "서비스 설계서" },
    ],
  },
  "p-cms": {
    stages: [
      { id: "st-cms-kickoff", name: "착수", color: "#3b82f6", startDate: "2026-07-20", showDeadline: true, tasks: [] },
      { id: "st-cms-define", name: "프로젝트정의", color: "#8b5cf6", showDeadline: false, tasks: [] },
      { id: "st-cms-build", name: "개발·구현", color: "#10b981", startDate: "2026-07-22", endDate: "2026-07-23", showDeadline: true, tasks: [] },
      { id: "st-cms-test", name: "통합테스트", color: "#06b6d4", startDate: "2026-07-16", endDate: "2026-07-17", showDeadline: true, tasks: [] },
      { id: "st-cms-accept", name: "고객검수", color: "#f59e0b", showDeadline: false, tasks: [] },
      { id: "st-cms-deliver", name: "납품·인수인계", color: "#ef4444", showDeadline: false, tasks: [] },
      { id: "st-cms-ops", name: "운영·유지보수", color: "#ec4899", startDate: "2026-07-17", endDate: "2026-07-23", showDeadline: true, tasks: [] },
    ],
    backlog: [],
  },
  "p-contents": {
    stages: [
      {
        id: "st-ct-req",
        name: "요구사항 분석",
        color: "#3b82f6",
        startDate: "2026-07-30",
        endDate: "2026-08-07",
        showDeadline: true,
        tasks: [
          { id: "tk-ct-interview", name: "요구사항 인터뷰" },
          { id: "tk-ct-define", name: "요구사항 정의" },
        ],
      },
      { id: "st-ct-design", name: "서비스, 시스템 설계", color: "#8b5cf6", startDate: "2026-08-05", endDate: "2026-08-11", showDeadline: true, tasks: [] },
      { id: "st-ct-build", name: "개발", color: "#10b981", startDate: "2026-08-10", showDeadline: true, tasks: [] },
    ],
    backlog: [],
  },
  "p-wise": {
    stages: [
      { id: "st-ws-ops", name: "운영·유지보수", color: "#f59e0b", startDate: "2026-07-17", endDate: "2026-07-23", showDeadline: true, tasks: [] },
    ],
    backlog: [],
  },
};

/** DB 행 형태로 평탄화 — createdAt 정렬이 시드 순서를 보존하도록 인덱스 기반 타임스탬프 부여 */
export function workspaceSeedRows() {
  const base = Date.parse("2026-07-22T00:00:00.000Z");
  const at = (index: number) => new Date(base + index * 1000);

  const groups = GROUPS.map((group, i) => ({
    id: group.id,
    name: group.name,
    createdAt: at(i),
  }));

  const projects = GROUPS.flatMap((group) =>
    group.projects.map((project, i) => ({
      id: project.id,
      groupId: group.id,
      name: project.name,
      color: project.color,
      createdAt: at(i),
    })),
  );

  const stages: {
    id: string;
    projectId: string;
    name: string;
    color: string;
    startDate?: string;
    endDate?: string;
    showDeadline: boolean;
    createdAt: Date;
  }[] = [];
  const tasks: {
    id: string;
    projectId: string;
    stageId: string | null;
    name: string;
    createdAt: Date;
  }[] = [];

  for (const [projectId, board] of Object.entries(BOARDS)) {
    board.stages.forEach((stage, stageIndex) => {
      stages.push({
        id: stage.id,
        projectId,
        name: stage.name,
        color: stage.color,
        startDate: stage.startDate,
        endDate: stage.endDate,
        showDeadline: stage.showDeadline,
        createdAt: at(stageIndex),
      });
      stage.tasks.forEach((task, taskIndex) =>
        tasks.push({
          id: task.id,
          projectId,
          stageId: stage.id,
          name: task.name,
          createdAt: at(taskIndex),
        }),
      );
    });
    board.backlog.forEach((task, taskIndex) =>
      tasks.push({
        id: task.id,
        projectId,
        stageId: null,
        name: task.name,
        createdAt: at(taskIndex),
      }),
    );
  }

  return { groups, projects, stages, tasks };
}
