// 단계 드래그 앤 드롭 규약 — 보드 컬럼·단계 로드맵 행이 함께 쓴다.
// 할일 드래그(task-drag.ts)와 다른 MIME을 써서 서로의 드롭 대상에 걸리지 않게 한다.
// 보드 컬럼은 두 드래그를 다 받는 자리라 이 구분이 특히 중요하다 — 컬럼에
// 할일을 놓으면 편입, 단계를 놓으면 순서 변경이다.

const STAGE_MIME = "application/x-yos-stage";

export function setStageDragData(event: React.DragEvent, stageId: string) {
  event.dataTransfer.setData(STAGE_MIME, stageId);
  // 일부 브라우저는 text/plain이 없으면 드래그를 시작하지 않는다
  event.dataTransfer.setData("text/plain", stageId);
  event.dataTransfer.effectAllowed = "move";
}

/**
 * 드롭 대상이 받아도 되는 드래그인지. `dragover` 단계에서는 보안상 값을 읽을 수
 * 없고 타입 목록만 볼 수 있어, 하이라이트 판정은 이 함수로 한다.
 */
export function isStageDrag(event: React.DragEvent) {
  return event.dataTransfer.types.includes(STAGE_MIME);
}

/** 드롭 시점에만 실제 단계 id를 읽을 수 있다 */
export function getStageDragData(event: React.DragEvent) {
  return event.dataTransfer.getData(STAGE_MIME) || null;
}
