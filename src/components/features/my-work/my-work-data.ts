// 내 작업 화면 자리표시 데이터 — Figma My Work Layout(147:495)의 예시 값 재현.
// 캘린더는 실데이터로 전환됐다. 남은 요청 카드만 아직 자리표시다.

export type WorkRequest = {
  id: string;
  typeLabel: string;
  typeTone: "primary" | "warning";
  direction: string;
  date: string;
  code: string;
  title: string;
  from: string;
  message: string;
  actions: ("수락" | "거절" | "요청 취소")[];
};

export const REQUESTS: WorkRequest[] = [
  {
    id: "req-1",
    typeLabel: "할일 할당 요청",
    typeTone: "primary",
    direction: "받은 요청",
    date: "07-20",
    code: "YOC-909",
    title: "회의1",
    from: "노윤기",
    message: '노윤기 → 김주웅  ·  "회의1" 할일을 할당했어요. 확인 부탁드려요.',
    actions: ["수락", "거절", "요청 취소"],
  },
  {
    id: "req-2",
    typeLabel: "도움 요청",
    typeTone: "warning",
    direction: "보낸 요청",
    date: "07-20",
    code: "YOC-909",
    title: "회의1",
    from: "노윤기",
    message: '노윤기 → 김주웅  ·  "회의 안건 정리가 막혀요. 봐주실 수 있나요?"',
    actions: ["요청 취소"],
  },
];
