// 사이드바 프로젝트 순서 변경 드래그 규약.
// 값에 "groupId:projectId"를 담아, 드롭 시 같은 그룹 안에서만 재정렬한다.
// (order는 그룹별이라 다른 그룹으로의 이동은 다루지 않는다)

const PROJECT_MIME = "application/x-yos-project";

export function setProjectDragData(
  event: React.DragEvent,
  groupId: string,
  projectId: string,
) {
  event.dataTransfer.setData(PROJECT_MIME, `${groupId}:${projectId}`);
  // 일부 브라우저는 text/plain이 없으면 드래그를 시작하지 않는다
  event.dataTransfer.setData("text/plain", projectId);
  event.dataTransfer.effectAllowed = "move";
}

/** dragover 단계에서는 값을 못 읽고 타입만 볼 수 있어 하이라이트 판정에 쓴다 */
export function isProjectDrag(event: React.DragEvent) {
  return event.dataTransfer.types.includes(PROJECT_MIME);
}

/** 드롭 시점에만 실제 값을 읽을 수 있다 */
export function getProjectDragData(
  event: React.DragEvent,
): { groupId: string; projectId: string } | null {
  const raw = event.dataTransfer.getData(PROJECT_MIME);
  const sep = raw.indexOf(":");
  if (sep === -1) return null;
  return { groupId: raw.slice(0, sep), projectId: raw.slice(sep + 1) };
}
