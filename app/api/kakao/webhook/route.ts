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

export async function POST(req: NextRequest) {
  try {
    const body: KakaoRequest = await req.json();
    const userInput = body.userRequest.utterance.trim();

    // 1. 시작 명령어
    if (userInput === '시작') {
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
              messageText: 'SCENARIO:S1',
            },
            {
              label: '🤔 임플란트 망설임',
              action: 'message',
              messageText: 'SCENARIO:S2',
            },
          ],
        },
      });
    }

    // 2. 시나리오 시작
    if (userInput.startsWith('SCENARIO:')) {
      const scenarioId = userInput.replace('SCENARIO:', '');
      const scenario = scenarios[scenarioId];
      
      if (!scenario) {
        return NextResponse.json({
          version: '2.0',
          template: {
            outputs: [{ simpleText: { text: '시나리오를 찾을 수 없습니다.' } }],
          },
        });
      }

      const firstTurn = scenario.turns[0];

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [
            {
              simpleText: {
                text: `📋 ${scenario.title}\n\n🏥 상황: ${scenario.context}\n\n━━━━━━━━━━━━━━━━━━\n\n👨 환자: "${firstTurn.text}"\n\n💭 감정: ${firstTurn.emotion}\n\n━━━━━━━━━━━━━━━━━━\n\n👨‍⚕️ 상담사님은 어떻게 응대하시겠습니까?\n\n💬 답변을 입력해주세요!`,
              },
            },
          ],
          quickReplies: [
            {
              label: '📝 답변 예시',
              action: 'message',
              messageText: `ANSWER:${scenarioId}:0:안녕하세요`,
            },
          ],
        },
      });
    }

    // 3. 턴 표시
    if (userInput.startsWith('TURN:')) {
      const parts = userInput.split(':');
      const scenarioId = parts[1];
      const turnIndex = parseInt(parts[2]);
      
      const scenario = scenarios[scenarioId];
      const turn = scenario.turns[turnIndex];

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [
            {
              simpleText: {
                text: `━━━━━━━━━━━━━━━━━━\n📌 ${scenario.title} - 턴 ${turnIndex + 1}\n━━━━━━━━━━━━━━━━━━\n\n👨 환자: "${turn.text}"\n\n💭 감정: ${turn.emotion}\n\n━━━━━━━━━━━━━━━━━━\n\n👨‍⚕️ 어떻게 응대하시겠습니까?\n\n💬 답변을 입력해주세요!`,
              },
            },
          ],
          quickReplies: [
            {
              label: '📝 답변 예시',
              action: 'message',
              messageText: `ANSWER:${scenarioId}:${turnIndex}:안녕하세요`,
            },
          ],
        },
      });
    }

    // 4. 답변 분석
    if (userInput.startsWith('ANSWER:')) {
      const parts = userInput.split(':');
      const scenarioId = parts[1];
      const turnIndex = parseInt(parts[2]);
      const counselorAnswer = parts.slice(3).join(':');

      const scenario = scenarios[scenarioId];
      const turn = scenario.turns[turnIndex];

      // Claude 분석
      const analysisPrompt = `
상황: ${scenario.context}
환자 말: "${turn.text}"
환자 감정: ${turn.emotion}
상담사 답변: "${counselorAnswer}"

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
          feedback: { good: ['답변을 제출했습니다.'], missing: ['분석 실패'] },
          next_tip: '다시 시도해보세요.'
        };
      } catch (e) {
        analysis = {
          score: 50,
          grade: 'C',
          feedback: { good: ['답변을 제출했습니다.'], missing: ['분석 중 오류'] },
          next_tip: '다시 시도해보세요.'
        };
      }

      let feedbackText = `━━━━━━━━━━━━━━━━━━\n📊 분석 결과\n━━━━━━━━━━━━━━━━━━\n\n점수: ${analysis.score}점 (${analysis.grade} 등급)\n\n`;
      
      if (analysis.feedback.good?.length > 0) {
        feedbackText += '✅ 잘한 점:\n' + analysis.feedback.good.map((g: string) => `• ${g}`).join('\n') + '\n\n';
      }
      
      if (analysis.feedback.warning) {
        feedbackText += `⚠️ 주의:\n• ${analysis.feedback.warning}\n\n`;
      }
      
      if (analysis.feedback.missing?.length > 0) {
        feedbackText += '💡 개선할 점:\n' + analysis.feedback.missing.map((m: string) => `• ${m}`).join('\n') + '\n\n';
      }
      
      if (analysis.next_tip) {
        feedbackText += `🎯 다음 팁:\n${analysis.next_tip}`;
      }

      const nextTurnIndex = turnIndex + 1;
      const hasMoreTurns = nextTurnIndex < scenario.turns.length;

      const quickReplies = hasMoreTurns
        ? [
            {
              label: '➡️ 다음 턴',
              action: 'message',
              messageText: `TURN:${scenarioId}:${nextTurnIndex}`,
            },
            {
              label: '🔄 처음으로',
              action: 'message',
              messageText: '시작',
            },
          ]
        : [
            {
              label: '🎉 완료! 처음으로',
              action: 'message',
              messageText: '시작',
            },
          ];

      if (!hasMoreTurns) {
        feedbackText += '\n\n━━━━━━━━━━━━━━━━━━\n✅ 시나리오 완료!\n\n모든 턴을 완료했습니다.\n수고하셨습니다! 🎉';
      }

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [{ simpleText: { text: feedbackText } }],
          quickReplies,
        },
      });
    }

    // 5. 일반 텍스트 입력 = 현재 진행 중인 답변으로 간주
    // 마지막으로 본 시나리오가 없으므로 시작으로 유도
    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [
          {
            simpleText: {
              text: '시나리오를 먼저 선택해주세요!\n\n"시작"을 입력하세요.',
            },
          },
        ],
        quickReplies: [
          {
            label: '🔄 시작하기',
            action: 'message',
            messageText: '시작',
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
          {
            label: '🔄 처음으로',
            action: 'message',
            messageText: '시작',
          },
        ],
      },
    });
  }
}