import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { scenarios } from '../../../../core/scenarios';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const SYSTEM_PROMPT = `당신은 "환자경험카드® MOT 코치"입니다.

병원 상담사의 환자 응대를 EOSEO 프레임워크와 4종 카드 기준으로 분석합니다.

## EOSEO 프레임워크
E - Emotion (감정 인식): 환자의 감정을 먼저 읽었는가?
S - Situation (상황 파악): 구체적인 상황을 파악했는가?
O - Options (선택지 제시): 환자에게 선택권을 주었는가?
E - Expectation (기대 관리): 시간, 절차를 명확히 안내했는가?
O - Outcome (결과 안내): 다음 단계를 안내했는가?

## 4종 카드 시스템
💎 VALUES: 공감, 신뢰, 책임, 존중, 공정, 원칙
💭 EMOTION: 불안, 분노, 두려움, 부담, 억울함, 안도
📍 MOT: 결정적 순간 (대기, 예약, 비용, 클레임 등)
🎯 ACTION: 감정 읽기, 공감 표현, 사과, 시간 안내, 설명 등

## 분석 기준
1. 감정 인식 (30점): 환자의 불안, 분노, 혼란 등을 얼마나 잘 읽었는가?
2. 공감 표현 (20점): 환자 입장에서 먼저 공감했는가?
3. 구체적 정보 (30점): 추상적이 아니라 구체적으로 안내했는가? (시간, 절차 등)
4. 신뢰 구축 (20점): 사과, 시간 알림, 절차 안내가 있었는가?

## 출력 형식 (반드시 JSON)
{
  "score": 85,
  "grade": "B",
  "eoseo": {
    "E_emotion": "✅ 불안을 인식함" 또는 "❌ 감정 인식 없음",
    "S_situation": "...",
    "O_options": "...",
    "E_expectation": "...",
    "O_outcome": "..."
  },
  "feedback": {
    "good": ["✅ 구체적인 잘한 점"],
    "warning": "⚠️ 위험 패턴 (있으면)",
    "missing": ["❌ 구체적인 놓친 점"]
  },
  "cards_used": ["💭 불안(Anxiety)", "🎯 ACT-037: 시간을 알려준다"],
  "next_tip": "다음엔 이렇게 해보세요: [구체적 대사 예시]"
}

## 중요 원칙
- 추상적 피드백 금지 ("공감이 부족합니다" ❌)
- 실전 대사 제공 ("이렇게 말해보세요: ..." ✅)
- 위험 패턴 즉시 경고 (밀어붙이기, 책임회피 등)
- 긍정적 톤 유지하되 명확한 개선점 제시`;

type KakaoRequest = {
  userRequest: {
    user: { id: string };
    utterance: string;
  };
};

type Session = {
  scenarioId: string;
  currentTurn: number;
  answers: string[];
  scores: number[];
};

export async function POST(req: NextRequest) {
  try {
    const body: KakaoRequest = await req.json();
    const userId = body.userRequest.user.id;
    const userInput = body.userRequest.utterance.trim();

    // 세션 가져오기
    let session = await kv.get<Session>(`session:${userId}`);

    // 1. 시작 명령어
    if (userInput === '시작') {
      await kv.del(`session:${userId}`);
      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [
            {
              simpleText: {
                text: '🏥 환자경험카드® 상담 시뮬레이터\n\n실제 상황처럼 AI 환자와 대화하며\nEOSEO + 4종 카드를 마스터하세요!\n\n━━━━━━━━━━━━━━━━━━\n\n💎 VALUES: 공감·신뢰·책임\n💭 EMOTION: 불안·분노·두려움\n📍 MOT: 결정적 순간\n🎯 ACTION: 구체적 행동\n\n━━━━━━━━━━━━━━━━━━\n\n연습할 시나리오를 선택하세요:',
              },
            },
          ],
          quickReplies: [
            { label: '😰 불안한 첫 내원', action: 'message', messageText: 'S1' },
            { label: '🤔 임플란트 망설임', action: 'message', messageText: 'S2' },
            { label: '😤 불만 전화', action: 'message', messageText: 'S3' },
            { label: '💰 비용 저항', action: 'message', messageText: 'S4' },
          ],
        },
      });
    }

    // 힌트 요청
    if (userInput === '힌트' && session) {
      const scenario = scenarios[session.scenarioId];
      const currentTurn = scenario.turns[session.currentTurn];
      
      if (currentTurn.role === 'staff') {
        return NextResponse.json({
          version: '2.0',
          template: {
            outputs: [
              {
                simpleText: {
                  text: `💡 모범 답변 힌트\n\n━━━━━━━━━━━━━━━━━━\n\n${currentTurn.ideal}\n\n━━━━━━━━━━━━━━━━━━\n\n✅ 핵심 키워드:\n${currentTurn.keywords?.join(', ')}\n\n다시 답변을 입력해주세요!`,
                },
              },
            ],
          },
        });
      }
    }

    // 2. 시나리오 선택
    if (userInput === 'S1' || userInput === 'S2' || userInput === 'S3' || userInput === 'S4') {
      const scenario = scenarios[userInput];
      const firstTurn = scenario.turns[0];

      await kv.set(
        `session:${userId}`,
        {
          scenarioId: userInput,
          currentTurn: 0,
          answers: [],
          scores: [],
        },
        { ex: 3600 }
      );

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [
            {
              simpleText: {
                text: `📋 ${scenario.title}\n${scenario.subtitle}\n\n━━━━━━━━━━━━━━━━━━\n\n🏥 상황:\n${scenario.context}\n\n━━━━━━━━━━━━━━━━━━\n\n💭 환자 감정: ${firstTurn.emotion}\n\n👨 환자:\n"${firstTurn.text}"\n\n━━━━━━━━━━━━━━━━━━\n\n👨‍⚕️ 어떻게 응대하시겠습니까?\n\n💬 답변을 입력하세요!\n(막히면 "힌트" 입력)`,
              },
            },
          ],
        },
      });
    }

    // 3. 세션 없으면 시작 유도
    if (!session) {
      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [{ simpleText: { text: '"시작"을 입력해서 시뮬레이션을 시작하세요!' } }],
        },
      });
    }

    // 4. 사용자 답변 분석
    const scenario = scenarios[session.scenarioId];
    const currentTurn = scenario.turns[session.currentTurn];
    
    // 환자 턴이면 다음으로
    if (currentTurn.role === 'patient') {
      session.currentTurn += 1;
      await kv.set(`session:${userId}`, session, { ex: 3600 });

      const nextTurn = scenario.turns[session.currentTurn];
      if (!nextTurn) {
        return NextResponse.json({
          version: '2.0',
          template: {
            outputs: [{ simpleText: { text: '시나리오가 완료되었습니다!\n"시작"을 입력해주세요.' } }],
          },
        });
      }

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [
            {
              simpleText: {
                text: `━━━━━━━━━━━━━━━━━━\n\n💭 환자 감정: ${nextTurn.emotion || '복합 감정'}\n\n👨 환자:\n"${nextTurn.text}"\n\n━━━━━━━━━━━━━━━━━━\n\n👨‍⚕️ 어떻게 응대하시겠습니까?\n\n💬 답변을 입력하세요!\n(막히면 "힌트" 입력)`,
              },
            },
          ],
        },
      });
    }

    // 상담사 턴 - Claude API로 실제 분석
    const prevTurn = scenario.turns[session.currentTurn - 1];
    
    const analysisPrompt = `
시나리오: ${scenario.title}
상황: ${scenario.context}

환자 말: "${prevTurn.text}"
환자 감정: ${prevTurn.emotion}

상담사 답변: "${userInput}"

모범 답변: "${currentTurn.ideal}"
핵심 키워드: ${currentTurn.keywords?.join(', ')}

위 상담사 답변을 EOSEO 프레임워크와 4종 카드 기준으로 분석하고 JSON 형식으로 피드백하세요.
`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      analysis = null;
    }

    if (!analysis) {
      analysis = {
        score: 50,
        grade: 'C',
        eoseo: {
          E_emotion: '❌ 분석 실패',
          S_situation: '',
          O_options: '',
          E_expectation: '',
          O_outcome: ''
        },
        feedback: {
          good: ['답변을 제출했습니다.'],
          missing: ['AI 분석 중 오류가 발생했습니다.']
        },
        cards_used: [],
        next_tip: '다시 시도해보세요.'
      };
    }

    session.answers.push(userInput);
    session.scores.push(analysis.score);
    session.currentTurn += 1;

    // 다음 턴 확인
    const nextTurnIndex = session.currentTurn;
    if (nextTurnIndex >= scenario.turns.length) {
      // 시나리오 완료
      const totalScore = session.scores.length > 0
        ? Math.round(session.scores.reduce((sum: number, s: number) => sum + s, 0) / session.scores.length)
        : 0;
      
      let grade = 'D', gradeText = '추가 학습 필요';
      if (totalScore >= 80) { grade = 'A'; gradeText = '전문가 수준'; }
      else if (totalScore >= 60) { grade = 'B'; gradeText = '숙련 단계'; }
      else if (totalScore >= 40) { grade = 'C'; gradeText = '초보 단계'; }

      await kv.del(`session:${userId}`);

      let eoseoText = '';
      if (analysis.eoseo) {
        eoseoText = `\n🔍 EOSEO 분석:\n${analysis.eoseo.E_emotion}\n${analysis.eoseo.S_situation || ''}\n${analysis.eoseo.O_options || ''}\n${analysis.eoseo.E_expectation || ''}\n${analysis.eoseo.O_outcome || ''}\n`;
      }

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [
            {
              simpleText: {
                text: `━━━━━━━━━━━━━━━━━━\n📊 마지막 분석\n━━━━━━━━━━━━━━━━━━\n\n점수: ${analysis.score}점 (${analysis.grade})\n${eoseoText}\n${analysis.feedback.good?.length > 0 ? '\n✅ 잘한 점:\n' + analysis.feedback.good.map((g: string) => `• ${g}`).join('\n') : ''}${analysis.feedback.warning ? '\n\n⚠️ ' + analysis.feedback.warning : ''}${analysis.feedback.missing?.length > 0 ? '\n\n💡 개선할 점:\n' + analysis.feedback.missing.map((m: string) => `• ${m}`).join('\n') : ''}${analysis.cards_used?.length > 0 ? '\n\n🎴 사용한 카드:\n' + analysis.cards_used.join(', ') : ''}${analysis.next_tip ? '\n\n🎯 ' + analysis.next_tip : ''}\n\n━━━━━━━━━━━━━━━━━━\n🎉 시나리오 완료!\n━━━━━━━━━━━━━━━━━━\n\n최종 점수: ${totalScore}점\n등급: ${grade} (${gradeText})`,
              },
            },
          ],
          quickReplies: [
            { label: '🔄 처음으로', action: 'message', messageText: '시작' },
          ],
        },
      });
    }

    // 다음 턴으로
    await kv.set(`session:${userId}`, session, { ex: 3600 });
    const nextTurn = scenario.turns[nextTurnIndex];

    let eoseoText = '';
    if (analysis.eoseo) {
      eoseoText = `\n🔍 EOSEO 분석:\n${analysis.eoseo.E_emotion}\n${analysis.eoseo.S_situation || ''}\n${analysis.eoseo.O_options || ''}\n${analysis.eoseo.E_expectation || ''}\n${analysis.eoseo.O_outcome || ''}\n`;
    }

    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [
          {
            simpleText: {
              text: `━━━━━━━━━━━━━━━━━━\n📊 분석 결과 (${session.answers.length}/${scenario.turns.filter((t: any) => t.role === 'staff').length})\n━━━━━━━━━━━━━━━━━━\n\n점수: ${analysis.score}점 (${analysis.grade})\n${eoseoText}\n${analysis.feedback.good?.length > 0 ? '\n✅ 잘한 점:\n' + analysis.feedback.good.map((g: string) => `• ${g}`).join('\n') : ''}${analysis.feedback.warning ? '\n\n⚠️ ' + analysis.feedback.warning : ''}${analysis.feedback.missing?.length > 0 ? '\n\n💡 개선할 점:\n' + analysis.feedback.missing.map((m: string) => `• ${m}`).join('\n') : ''}${analysis.cards_used?.length > 0 ? '\n\n🎴 사용한 카드:\n' + analysis.cards_used.join(', ') : ''}${analysis.next_tip ? '\n\n🎯 ' + analysis.next_tip : ''}\n\n━━━━━━━━━━━━━━━━━━\n🔄 다음 상황\n━━━━━━━━━━━━━━━━━━\n\n💭 환자 감정: ${nextTurn.emotion || '복합 감정'}\n\n👨 환자:\n"${nextTurn.text}"\n\n━━━━━━━━━━━━━━━━━━\n\n👨‍⚕️ 어떻게 응대하시겠습니까?\n\n(막히면 "힌트" 입력)`,
            },
          },
        ],
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [
          {
            simpleText: {
              text: '오류가 발생했습니다.\n\n"시작"을 입력해서 다시 시도해주세요.',
            },
          },
        ],
        quickReplies: [
          { label: '🔄 처음으로', action: 'message', messageText: '시작' },
        ],
      },
    });
  }
}