// 할일 카드 드래그 앤 드롭 규약 — 백로그·보드가 함께 쓴다.
// 전용 MIME 타입을 써서 외부에서 끌어온 텍스트·파일이 드롭되지 않게 한다.

const TASK_MIME = "application/x-yos-task";

export function setTaskDragData(event: React.DragEvent, taskId: string) {
  event.dataTransfer.setData(TASK_MIME, taskId);
  // 일부 브라우저는 text/plain이 없으면 드래그를 시작하지 않는다
  event.dataTransfer.setData("text/plain", taskId);
  event.dataTransfer.effectAllowed = "move";
}

/**
 * 드롭 대상이 받아도 되는 드래그인지. `dragover` 단계에서는 보안상 값을 읽을 수
 * 없고 타입 목록만 볼 수 있어, 하이라이트 판정은 이 함수로 한다.
 */
export function isTaskDrag(event: React.DragEvent) {
  return event.dataTransfer.types.includes(TASK_MIME);
}

/** 드롭 시점에만 실제 할일 id를 읽을 수 있다 */
export function getTaskDragData(event: React.DragEvent) {
  return event.dataTransfer.getData(TASK_MIME) || null;
}
