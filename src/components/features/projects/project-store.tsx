"use client";

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";

export type Project = {
  id: string;
  name: string;
  color: string;
};

export type ProjectGroup = {
  id: string;
  name: string;
  projects: Project[];
};

export const PROJECT_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
];

const SEED_GROUPS: ProjectGroup[] = [
  { id: "g-lab", name: "Lab", projects: [] },
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

const STORAGE_KEY = "yos.projects.v1";

// localStorage 기반 외부 스토어 — DB/API 도입 전까지의 임시 영속 계층.
// useSyncExternalStore로 구독해 SSR(시드)과 클라이언트(저장본)를 안전하게 분리한다.
let groupsState: ProjectGroup[] | null = null;
const listeners = new Set<() => void>();

function loadGroups(): ProjectGroup[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ProjectGroup[];
  } catch {
    // 저장 데이터가 깨진 경우 시드로 대체
  }
  return SEED_GROUPS;
}

function getSnapshot(): ProjectGroup[] {
  if (groupsState === null) groupsState = loadGroups();
  return groupsState;
}

function getServerSnapshot(): ProjectGroup[] {
  return SEED_GROUPS;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function updateGroups(
  updater: (prev: ProjectGroup[]) => ProjectGroup[] | null,
) {
  const next = updater(getSnapshot());
  if (next === null) {
    groupsState = SEED_GROUPS;
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    groupsState = next;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((listener) => listener());
}

type ProjectStoreValue = {
  groups: ProjectGroup[];
  selectedProjectId: string | null;
  selectProject: (id: string | null) => void;
  addGroup: (name: string) => void;
  addProject: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  deleteProject: (groupId: string, projectId: string) => void;
  resetData: () => void;
};

const ProjectStoreContext = createContext<ProjectStoreValue | null>(null);

export function ProjectStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const groups = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );

  const value: ProjectStoreValue = {
    groups,
    selectedProjectId,
    selectProject: setSelectedProjectId,
    addGroup: (name) =>
      updateGroups((prev) => [
        ...prev,
        { id: `g-${crypto.randomUUID()}`, name, projects: [] },
      ]),
    addProject: (groupId, name) =>
      updateGroups((prev) => {
        const totalProjects = prev.reduce(
          (sum, g) => sum + g.projects.length,
          0,
        );
        return prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                projects: [
                  ...g.projects,
                  {
                    id: `p-${crypto.randomUUID()}`,
                    name,
                    color:
                      PROJECT_COLORS[totalProjects % PROJECT_COLORS.length],
                  },
                ],
              }
            : g,
        );
      }),
    deleteGroup: (groupId) =>
      updateGroups((prev) => prev.filter((g) => g.id !== groupId)),
    deleteProject: (groupId, projectId) =>
      updateGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, projects: g.projects.filter((p) => p.id !== projectId) }
            : g,
        ),
      ),
    resetData: () => {
      updateGroups(() => null);
      setSelectedProjectId(null);
    },
  };

  return <ProjectStoreContext value={value}>{children}</ProjectStoreContext>;
}

export function useProjectStore() {
  const context = useContext(ProjectStoreContext);
  if (!context) {
    throw new Error(
      "useProjectStore는 ProjectStoreProvider 내부에서만 사용할 수 있습니다.",
    );
  }
  return context;
}
