// 단계 프리셋 — 프로젝트의 단계·할일 구성을 담는 개인용 템플릿.
// 날짜는 기준일 기준 상대 오프셋으로만 담는다 (적용 시 지정한 시작일부터 재현).

export type PresetTask = {
  name: string;
  /** 예정일 오프셋(일). undefined = 일정 미정이던 할일 */
  offsetDays?: number;
};

export type PresetStage = {
  name: string;
  color: string;
  /** 기준일로부터 며칠 뒤 시작. undefined = 날짜가 없던 단계 */
  offsetDays?: number;
  /** 기간(일). undefined = 종료일이 없던 진행형 막대 */
  durationDays?: number;
  tasks: PresetTask[];
};

/** 목록용 — 구성 요약만 */
export type PresetSummary = {
  id: string;
  name: string;
  stageCount: number;
  taskCount: number;
  updatedAt: string;
};

/** 상세 — 적용에 필요한 구성 전체 */
export type PresetDetail = PresetSummary & {
  stages: PresetStage[];
};
