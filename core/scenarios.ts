export type Scenario = {
  id: number;
  title: string;
  subtitle: string;
  context: string;
  values: string[];
  emotions: string[];
  mot: string[];
  actions: string[];
  turns: {
    role: 'patient' | 'staff';
    text: string;
    emotion?: string;
    ideal?: string;
    keywords?: string[];
  }[];
};

export const scenarios: Record<string, Scenario> = {
  S1: {
    id: 1,
    title: "불안한 첫 내원 환자",
    subtitle: "진료 전 / 대기실",
    context: "처음 내원한 환자는 '혹시 아픈 건 아닐까?'라는 불안 속에서 좁은 대기실, 낯선 기계, 익숙하지 않은 용어들 사이에 앉아 있습니다.",
    values: ["공감(Empathy)", "신뢰(Trust)"],
    emotions: ["불안(Anxiety)"],
    mot: ["MOT-B06: '지금 뭐하나요?'라고 묻고 싶을 때"],
    actions: ["ACT-003: 감정을 읽는다", "ACT-030: 불안을 감소시킨다", "ACT-037: 시간을 알려준다"],
    turns: [
      {
        role: 'patient',
        text: "저기... 여기서 뭘 하는 건가요? 얼마나 기다려야 하죠?",
        emotion: "불안(Anxiety)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "○○님, 혹시 지금 조금 불안하시죠?",
        keywords: ["불안", "긴장", "걱정"]
      },
      {
        role: 'patient',
        text: "네... 뭘 하는 건지 잘 몰라서요.",
        emotion: "불안(Anxiety)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "당연해요. 처음 오시면 누구나 불안하십니다. 지금은 X-ray 촬영 전 대기 시간이고요, 앞으로 5분 안에 촬영실로 모실 예정이에요.",
        keywords: ["당연", "5분", "촬영실"]
      },
      {
        role: 'patient',
        text: "촬영하면 아픈가요?",
        emotion: "두려움(Fear)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "촬영은 10초 정도, 통증 없이 끝나는 검사라 너무 걱정하지 않으셔도 됩니다.",
        keywords: ["10초", "통증 없이", "걱정하지"]
      },
      {
        role: 'patient',
        text: "아, 5분 후에요? 그럼 괜찮네요.",
        emotion: "안도(Relief)"
      }
    ]
  },
  S2: {
    id: 2,
    title: "임플란트 상담 후 예약 망설임",
    subtitle: "수납 / 예약",
    context: "치료 필요성은 이해했지만, 환자는 '비용은?', '아프진 않을까?'를 속으로만 고민합니다.",
    values: ["책임(Responsibility)", "설명력(Expertise)"],
    emotions: ["두려움(Fear)", "부담(Burden)"],
    mot: ["MOT-D02: 예약 제안을 받을 때"],
    actions: ["ACT-052: 일정을 안내한다", "ACT-043: 예상시간을 말한다", "ACT-004: 감정을 케어한다"],
    turns: [
      {
        role: 'patient',
        text: "음... 설명은 들었는데, 조금 더 생각해볼게요.",
        emotion: "부담(Burden)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "○○님, 설명 들으시면서 혹시 걱정되셨던 부분 있으셨어요?",
        keywords: ["걱정", "부분", "있으셨"]
      },
      {
        role: 'patient',
        text: "아무래도 수술이라... 그리고 비용도 부담되고요.",
        emotion: "두려움(Fear), 부담(Burden)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "네, 임플란트는 대부분 그런 두려움과 부담에서 시작합니다. 그래서 저희는 '한 번에 결정'이 아니라 '충분히 이해하고 결정'하는 걸 더 중요하게 생각해요.",
        keywords: ["두려움", "부담", "이해하고 결정"]
      },
      {
        role: 'patient',
        text: "그럼 언제까지 결정해야 하나요?",
        emotion: "불안(Anxiety)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "지금 바로 예약을 안 하셔도 괜찮습니다. 다만, 치료 적기를 놓치지 않도록 가장 편하신 날짜 두 개만 먼저 잡아 둘까요?",
        keywords: ["바로", "괜찮", "두 개", "먼저"]
      },
      {
        role: 'patient',
        text: "그렇게 해주시면 좋겠어요.",
        emotion: "안도(Relief)"
      }
    ]
  },
  S3: {
    id: 3,
    title: "불만 전화 클레임",
    subtitle: "전화응대 & 디지털 접점",
    context: "대부분의 클레임은 초기 감정 케어에 실패했을 때 발생합니다.",
    values: ["존중(Respect)", "책임(Responsibility)"],
    emotions: ["분노(Anger)", "억울함(Injustice)"],
    mot: ["MOT-D06: 바쁜 상황 속에서 배려를 기대할 때"],
    actions: ["ACT-032: 사과한다", "ACT-011: 공감의 말을 전한다"],
    turns: [
      {
        role: 'patient',
        text: "지난번에 예약했는데 한참을 기다리게 해서 뭐 하는 병원입니까?",
        emotion: "분노(Anger)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "○○님, 많이 불편하셨죠. 먼저 그날 오래 기다리시게 한 점 진심으로 사과드립니다.",
        keywords: ["불편", "사과"]
      },
      {
        role: 'patient',
        text: "사과만 하면 뭐하나요? 30분이나 기다렸어요!",
        emotion: "분노(Anger), 억울함(Injustice)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "말씀하신 부분은 '기다림에 대한 억울함과 분노'로 들립니다. 저희가 상황을 정확히 파악해서 다시는 반복되지 않도록 하겠습니다.",
        keywords: ["억울함", "분노", "반복되지 않도록"]
      },
      {
        role: 'patient',
        text: "왜 그렇게 기다려야 했는지 설명이라도 해주세요.",
        emotion: "억울함(Injustice)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "당시 기록을 확인해 보니, 응급 환자가 겹쳐 진료가 20분 정도 지연된 것으로 나옵니다. 그 과정에서 미리 충분히 안내를 못 드린 것이 저희의 가장 큰 잘못입니다.",
        keywords: ["응급", "안내", "잘못"]
      },
      {
        role: 'patient',
        text: "그래도 미리 말은 해주셔야죠...",
        emotion: "억울함(Injustice)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "다음 내원 시에는 ○○님 예약 시간을 가장 앞 시간으로 조정해 두고, 대기시간이 10분 이상 길어질 경우 문자/카톡으로 즉시 안내드리겠습니다. 괜찮으실까요?",
        keywords: ["앞 시간", "문자", "즉시"]
      },
      {
        role: 'patient',
        text: "알겠습니다. 다음엔 조금만 신경 써주세요.",
        emotion: "안도(Relief)"
      }
    ]
  },
  S4: {
    id: 4,
    title: "진료비 저항 환자 💰",
    subtitle: "비용 상담",
    context: "많은 환자들은 비용이 아닌 '불확실성' 때문에 망설입니다.",
    values: ["공정(Fairness)", "신뢰(Trust)", "원칙(Principle)"],
    emotions: ["불안(Anxiety)", "부담(Burden)", "억울함(Injustice)"],
    mot: ["MOT-D03: 비용 관련 질문을 던질 때"],
    actions: ["ACT-011: 공감의 말을 전한다", "ACT-034: 설명한다", "ACT-046: 요약한다"],
    turns: [
      {
        role: 'patient',
        text: "여기는 너무 비싼 거 아닌가요? 다른 병원은 더 싸던데요.",
        emotion: "부담(Burden), 의심(Doubt)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "○○님, 비용이 가장 중요한 부분이죠. 충분히 그렇게 느끼실 수 있어요.",
        keywords: ["비용", "중요", "느끼실"]
      },
      {
        role: 'patient',
        text: "다른 곳은 150만 원인데 여기는 왜 200만 원이에요?",
        emotion: "억울함(Injustice)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "다른 병원과 비교하시는 건 당연한 과정입니다. 저희가 안내드린 금액은 전체 치료 과정을 기준으로 한 확정 비용이고, 추가 비용이 발생하지 않도록 원칙을 지키고 있습니다.",
        keywords: ["당연", "전체", "확정", "원칙"]
      },
      {
        role: 'patient',
        text: "그래도 비싸네요. 할인은 안 되나요?",
        emotion: "부담(Burden)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "저희는 모든 환자분께 같은 기준과 동일한 비용 원칙을 적용합니다. 그래서 비용을 깎는 대신, 품질·책임·결과에 대한 기준을 지키고 있습니다.",
        keywords: ["같은 기준", "원칙", "품질", "책임"]
      },
      {
        role: 'patient',
        text: "한 번에 내기엔 부담되는데...",
        emotion: "부담(Burden)"
      },
      {
        role: 'staff',
        text: "",
        ideal: "지금 바로 결정하지 않으셔도 괜찮습니다. 두 가지 날짜만 미리 잡아 두고 편하실 때 선택하시는 건 어떠세요?",
        keywords: ["바로", "괜찮", "선택"]
      },
      {
        role: 'patient',
        text: "그렇게 해주시면 좋겠어요.",
        emotion: "안도(Relief)"
      }
    ]
  }
};