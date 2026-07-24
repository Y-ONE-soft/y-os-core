import type { Dispatch, DragEvent, SetStateAction } from "react";

import {
  getTaskDragData,
  isTaskDrag,
} from "@/components/features/projects/task-drag";

// 할일 카드 "위에" 드롭하면 같은 컨테이너 안에서 그 카드 앞으로 재정렬한다.
// 다른 컨테이너에서 온 드래그는 여기서 손대지 않고 흘려보내(버블) 컬럼·백로그의
// 기존 이동 핸들러(assignTask)가 처리하게 둔다. 그래서 "카드 위로 옮겨 이동"하던
// 기존 동작이 그대로 유지되면서, 같은 컨테이너 재정렬만 새로 얹힌다.

/**
 * 할일 카드에 붙일 재정렬 드롭 핸들러를 만든다.
 * @param siblingIds 이 카드가 속한 컨테이너에서 지금 보이는 할일 id들(현재 순서).
 *   단계·프로젝트 백로그는 전체, 내 할일은 그 컨테이너의 내 담당분(부분집합)만.
 */
export function buildTaskReorderProps(opts: {
  projectId: string | null;
  stageId: string | null;
  targetTaskId: string;
  siblingIds: string[];
  setDropTargetId: Dispatch<SetStateAction<string | null>>;
  reorder: (
    projectId: string | null,
    stageId: string | null,
    taskIds: string[],
  ) => void;
}) {
  const { projectId, stageId, targetTaskId, siblingIds, setDropTargetId } = opts;
  return {
    onDragOver: (event: DragEvent) => {
      if (!isTaskDrag(event)) return;
      event.preventDefault();
      // 카드 위에선 컬럼이 아니라 카드를 강조한다 (컬럼 dragover로 안 번지게)
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setDropTargetId(targetTaskId);
    },
    onDragLeave: (event: DragEvent) => {
      if (event.currentTarget.contains(event.relatedTarget as Node)) return;
      setDropTargetId((prev) => (prev === targetTaskId ? null : prev));
    },
    onDrop: (event: DragEvent) => {
      const draggedId = getTaskDragData(event);
      // 다른 컨테이너(또는 데이터 없음)는 여기서 처리하지 않고 컬럼 이동 핸들러로 버블
      if (!draggedId || !siblingIds.includes(draggedId)) return;
      event.preventDefault();
      event.stopPropagation();
      setDropTargetId(null);
      if (draggedId === targetTaskId) return; // 제자리
      const without = siblingIds.filter((id) => id !== draggedId);
      const at = without.indexOf(targetTaskId);
      if (at === -1) return;
      opts.reorder(projectId, stageId, [
        ...without.slice(0, at),
        draggedId,
        ...without.slice(at),
      ]);
    },
  };
}
