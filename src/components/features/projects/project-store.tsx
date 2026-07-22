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
  resetWorkspaceApi,
} from "@/lib/api/workspace";
import * as cache from "@/components/features/projects/workspace-cache";
import { useSession } from "@/components/features/auth/session-context";
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
    addProject: (groupId, name) => {
      const id = `p-${crypto.randomUUID()}`;
      const totalProjects = workspace.groups.reduce(
        (sum, group) => sum + group.projects.length,
        0,
      );
      const color = PROJECT_COLORS[totalProjects % PROJECT_COLORS.length];
      cache.apply((prev) => ({
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
        boards: { ...prev.boards, [id]: { stages: [], backlog: [] } },
      }));
      cache.persist(createProjectApi({ id, groupId, name, color }));
    },
    deleteGroup: (groupId) => {
      cache.apply((prev) => {
        const target = prev.groups.find((group) => group.id === groupId);
        const boards = { ...prev.boards };
        target?.projects.forEach((project) => delete boards[project.id]);
        return {
          groups: prev.groups.filter((group) => group.id !== groupId),
          boards,
        };
      });
      cache.persist(deleteGroupApi(groupId));
    },
    deleteProject: (groupId, projectId) => {
      cache.apply((prev) => {
        const boards = { ...prev.boards };
        delete boards[projectId];
        return {
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
