// core/scenarios.ts

export type ConversationTurn = {
  role: 'patient' | 'staff';
  text: string;
  emotion?: string;
  ideal?: string;
  keywords?: string[];
};

export type Scenario = {
  id: string;
  title: string;
  subtitle: string;
  context: string;
  turns: ConversationTurn[];
};

export const scenarios: Record<string, Scenario> = {
  S1: {
    id: 'S1',
    title: '불안한 첫 내원 환자',
    subtitle: '처음 방문하는 병원에서 긴장하는 40대 남성',
    context: '40대 남성, 첫 내원. 대기실에서 초조해하며 시계를 자주 봄',
    turns: [
      {
        role: 'patient',
        text: '제가... 얼마나 더 기다려야 하나요? 처음이라 뭐가 뭔지...',
        emotion: '불안 + 혼란',
        keywords: ['공감', '시간', '안내', '사과'],
      },
      {
        role: 'patient',
        text: '아... 네. 그런데 검사는 어디서 받는 건가요? 복잡하네요...',
        emotion: '혼란 유지',
        keywords: ['위치', '절차', '안내', '재확인'],
      },
      {
        role: 'patient',
        text: '알겠습니다. 그럼 여기서 기다리면 되는 거죠?',
        emotion: '불안 감소 → 안정',
        keywords: ['확인', '안심'],
      },
    ],
  },
  S2: {
    id: 'S2',
    title: '임플란트 상담 망설임',
    subtitle: '비용 때문에 치료를 주저하는 50대 여성',
    context: '50대 여성, 임플란트 고민 중. 비용 때문에 주저함',
    turns: [
      {
        role: 'patient',
        text: '임플란트가 생각보다 비싸네요... 꼭 해야 하나요?',
        emotion: '저항 + 의심',
        keywords: ['공감', '가치', '대안', '선택'],
      },
      {
        role: 'patient',
        text: '다른 치과는 더 싸던데... 여기는 왜 이렇게 비싼가요?',
        emotion: '의심 증가 → 비교',
        keywords: ['차별화', '투명성', '품질', '비교'],
      },
    ],
  },
};