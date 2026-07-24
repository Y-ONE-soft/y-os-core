"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import {
  createGroupApi,
  createProjectApi,
  deleteGroupApi,
  deleteProjectApi,
  patchProjectApi,
  reorderProjectsApi,
  resetWorkspaceApi,
} from "@/lib/api/workspace";
import * as cache from "@/components/features/projects/workspace-cache";
import { useSession } from "@/components/features/auth/session-context";
import { todayISO } from "@/components/features/projects/roadmap-utils";
import { addDaysISO } from "@/lib/stage-plan";
import type { ProjectGroup } from "@/types/workspace";

// DB 전환 후에도 기존 소비자 호환을 위해 타입을 재노출한다
export type { Project, ProjectGroup } from "@/types/workspace";

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

type ProjectStoreValue = {
  groups: ProjectGroup[];
  selectedProjectId: string | null;
  selectProject: (id: string | null) => void;
  addGroup: (name: string) => void;
  /** `color` 미지정 시 팔레트에서 순번대로 자동 배정한다 */
  addProject: (groupId: string, name: string, color?: string) => void;
  /** 프로젝트 색 변경 — 그 프로젝트의 단계·할일 색도 파생이라 함께 바뀐다 */
  setProjectColor: (projectId: string, color: string) => void;
  deleteGroup: (groupId: string) => void;
  deleteProject: (groupId: string, projectId: string) => void;
  /** 그룹 안에서 프로젝트 순서를 projectIds 순서대로 바꾼다 (사이드바 드래그) */
  reorderProjects: (groupId: string, projectIds: string[]) => void;
  resetData: () => void;
};

const ProjectStoreContext = createContext<ProjectStoreValue | null>(null);

export function ProjectStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = useSyncExternalStore(
    cache.subscribe,
    cache.getSnapshot,
    cache.getServerSnapshot,
  );
  const { user } = useSession();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );

  // 세션 확립(proxy 통과) 후 최초 1회 DB에서 부트스트랩
  useEffect(() => {
    void cache.ensureLoaded();
  }, []);

  const value: ProjectStoreValue = {
    groups: workspace.groups,
    selectedProjectId,
    selectProject: setSelectedProjectId,
    addGroup: (name) => {
      const id = `g-${crypto.randomUUID()}`;
      cache.apply((prev) => ({
        ...prev,
        groups: [...prev.groups, { id, name, projects: [] }],
      }));
      cache.persist(createGroupApi({ id, name }));
    },
    addProject: (groupId, name, pickedColor) => {
      const id = `p-${crypto.randomUUID()}`;
      const totalProjects = workspace.groups.reduce(
        (sum, group) => sum + group.projects.length,
        0,
      );
      const color =
        pickedColor ?? PROJECT_COLORS[totalProjects % PROJECT_COLORS.length];
      cache.apply((prev) => ({
        ...prev,
        groups: prev.groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                // 작업자는 서버가 "만든 사람"으로 정한다 — 낙관적 값도 동일하게 맞춘다
                projects: [
                  ...group.projects,
                  { id, name, color, ownerId: user?.id ?? null },
                ],
              }
            : group,
        ),
        // 서버가 함께 만드는 기본 단계("프로젝트 생성", 오늘~모레)를 낙관값에도
        // 넣어 로드맵·캘린더에 바로 보이게 한다. 진짜 id·색은 다음 부트스트랩에서
        // 서버 값으로 교체된다(색은 board-store가 프로젝트 색에서 파생).
        boards: {
          ...prev.boards,
          [id]: {
            stages: [
              {
                id: `st-${crypto.randomUUID()}`,
                name: "프로젝트 생성",
                color,
                startDate: todayISO(),
                endDate: addDaysISO(todayISO(), 2),
                showDeadline: false,
                tasks: [],
              },
            ],
            backlog: [],
          },
        },
      }));
      cache.persist(createProjectApi({ id, groupId, name, color }));
    },
    deleteGroup: (groupId) => {
      cache.apply((prev) => {
        const target = prev.groups.find((group) => group.id === groupId);
        const boards = { ...prev.boards };
        target?.projects.forEach((project) => delete boards[project.id]);
        return {
          ...prev,
          groups: prev.groups.filter((group) => group.id !== groupId),
          boards,
        };
      });
      cache.persist(deleteGroupApi(groupId));
    },
    setProjectColor: (projectId, color) => {
      cache.apply((prev) => ({
        ...prev,
        groups: prev.groups.map((group) => ({
          ...group,
          projects: group.projects.map((project) =>
            project.id === projectId ? { ...project, color } : project,
          ),
        })),
      }));
      cache.persist(patchProjectApi(projectId, { color }));
    },
    deleteProject: (groupId, projectId) => {
      cache.apply((prev) => {
        const boards = { ...prev.boards };
        delete boards[projectId];
        return {
          ...prev,
          groups: prev.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  projects: group.projects.filter(
                    (project) => project.id !== projectId,
                  ),
                }
              : group,
          ),
          boards,
        };
      });
      cache.persist(deleteProjectApi(projectId));
    },
    reorderProjects: (groupId, projectIds) => {
      cache.apply((prev) => ({
        ...prev,
        groups: prev.groups.map((group) => {
          if (group.id !== groupId) return group;
          // 대상들이 차지한 배열 위치(슬롯)를 순서대로 모아 새 순서로 재배정한다 —
          // 서버 reorderProjects와 같은 규칙(스탭이 소유분만 옮겨도 비소유는 제자리).
          const idSet = new Set(projectIds);
          const slots: number[] = [];
          group.projects.forEach((project, index) => {
            if (idSet.has(project.id)) slots.push(index);
          });
          if (slots.length !== projectIds.length) return group;
          const byId = new Map(group.projects.map((p) => [p.id, p]));
          const next = [...group.projects];
          projectIds.forEach((id, k) => {
            const project = byId.get(id);
            if (project) next[slots[k]] = project;
          });
          return { ...group, projects: next };
        }),
      }));
      cache.persist(reorderProjectsApi(groupId, projectIds));
    },
    resetData: () => {
      setSelectedProjectId(null);
      cache.persist(resetWorkspaceApi().then(() => cache.refresh()));
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
