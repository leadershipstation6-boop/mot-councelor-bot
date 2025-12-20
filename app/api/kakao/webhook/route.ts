import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { scenarios } from '../../../../core/scenarios';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const SYSTEM_PROMPT = `당신은 "환자경험카드® MOT 코치"입니다.

병원 상담사의 환자 응대를 실시간으로 분석하고 구체적인 피드백을 제공합니다.

## 분석 기준
1. 감정 인식: 환자의 불안, 분노, 혼란 등을 얼마나 잘 읽었는가?
2. 공감 표현: 환자 입장에서 먼저 공감했는가?
3. 구체적 정보: 추상적이 아니라 구체적으로 안내했는가?
4. 신뢰 구축: 사과, 시간 알림, 절차 안내가 있었는가?

## 출력 형식 (JSON)
{
  "score": 85,
  "grade": "B",
  "feedback": {
    "good": ["✅ 잘한 점 1", "✅ 잘한 점 2"],
    "warning": "⚠️ 위험 패턴 (있으면)",
    "missing": ["❌ 놓친 점 1", "❌ 놓친 점 2"]
  },
  "next_tip": "다음엔 이렇게 해보세요: ..."
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

const sessions = new Map<string, any>();

export async function POST(req: NextRequest) {
  try {
    const body: KakaoRequest = await req.json();
    const userId = body.userRequest.user.id;
    const userInput = body.userRequest.utterance.trim();

    let session = sessions.get(userId) || {
      scenarioId: null,
      turnIndex: 0,
      history: [],
    };

    if (userInput === '시작' || !session.scenarioId) {
      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [
            {
              simpleText: {
                text: '🏥 환자경험카드® 상담 시뮬레이터\n\n연습할 시나리오를 선택하세요:',
              },
            },
          ],
          quickReplies: [
            {
              label: '😰 불안한 첫 내원',
              action: 'message',
              messageText: 'S1',
            },
            {
              label: '🤔 임플란트 망설임',
              action: 'message',
              messageText: 'S2',
            },
          ],
        },
      });
    }

    if (userInput === 'S1' || userInput === 'S2') {
      const scenario = scenarios[userInput];
      session = {
        scenarioId: userInput,
        turnIndex: 0,
        history: [],
      };
      sessions.set(userId, session);

      const firstTurn = scenario.turns[0];

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [
            {
              simpleText: {
                text: `📋 ${scenario.title}\n\n🏥 상황: ${scenario.context}\n\n👨 환자: "${firstTurn.text}"\n\n💭 감정: ${firstTurn.emotion}\n\n━━━━━━━━━━━━━━━━━━\n👨‍⚕️ 어떻게 응대하시겠습니까?`,
              },
            },
          ],
        },
      });
    }

    const scenario = scenarios[session.scenarioId];
    if (!scenario) {
      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [
            { simpleText: { text: '시나리오를 먼저 선택해주세요. "시작"을 입력하세요.' } },
          ],
        },
      });
    }

    const currentTurn = scenario.turns[session.turnIndex];

    const analysisPrompt = `
상황: ${scenario.context}
환자 말: "${currentTurn.text}"
환자 감정: ${currentTurn.emotion}
상담사 답변: "${userInput}"

위 상담사 답변을 분석하고 JSON 형식으로 피드백하세요.
`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        score: 50,
        grade: 'C',
        feedback: {
          good: ['답변을 제출했습니다.'],
          missing: ['구체적인 피드백을 생성하지 못했습니다.']
        },
        next_tip: '다시 시도해보세요.'
      };
    } catch (e) {
      analysis = {
        score: 50,
        grade: 'C',
        feedback: {
          good: ['답변을 제출했습니다.'],
          missing: ['분석 중 오류가 발생했습니다.']
        },
        next_tip: '다시 시도해보세요.'
      };
    }

    let feedbackText = `━━━━━━━━━━━━━━━━━━\n📊 점수: ${analysis.score}점 (${analysis.grade} 등급)\n\n`;
    
    if (analysis.feedback.good && analysis.feedback.good.length > 0) {
      feedbackText += '✅ 잘한 점:\n' + analysis.feedback.good.map((g: string) => `• ${g}`).join('\n') + '\n\n';
    }
    
    if (analysis.feedback.warning) {
      feedbackText += `⚠️ 주의:\n• ${analysis.feedback.warning}\n\n`;
    }
    
    if (analysis.feedback.missing && analysis.feedback.missing.length > 0) {
      feedbackText += '💡 개선할 점:\n' + analysis.feedback.missing.map((m: string) => `• ${m}`).join('\n') + '\n\n';
    }
    
    if (analysis.next_tip) {
      feedbackText += `🎯 다음 팁:\n${analysis.next_tip}\n`;
    }

    session.turnIndex++;
    sessions.set(userId, session);

    if (session.turnIndex >= scenario.turns.length) {
      feedbackText += '\n\n✅ 시나리오 완료!\n"시작"을 입력하면 새로운 시나리오를 연습할 수 있습니다.';
      sessions.delete(userId);

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [{ simpleText: { text: feedbackText } }],
          quickReplies: [
            { label: '🔄 다시 시작', action: 'message', messageText: '시작' },
          ],
        },
      });
    }

    const nextTurn = scenario.turns[session.turnIndex];
    feedbackText += `\n\n━━━━━━━━━━━━━━━━━━\n👨 환자: "${nextTurn.text}"\n💭 감정: ${nextTurn.emotion}\n\n👨‍⚕️ 어떻게 응대하시겠습니까?`;

    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [{ simpleText: { text: feedbackText } }],
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
              text: '오류가 발생했습니다. "시작"을 입력해서 다시 시도해주세요.',
            },
          },
        ],
      },
    });
  }
}