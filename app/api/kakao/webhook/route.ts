import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { scenarios } from '../../../../core/scenarios';

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

// 응답 분석 함수
function analyzeResponse(
  userText: string,
  keywords: string[],
  emotion?: string
): { score: number; usedCards: string[]; missingKeywords: string[]; feedback: string } {
  const usedKeywords = keywords.filter(k => userText.includes(k));
  const score = keywords.length > 0 ? Math.round((usedKeywords.length / keywords.length) * 100) : 50;
  
  const usedCards: string[] = [];
  
  // 감정 카드 감지
  if (userText.includes('불안') || userText.includes('걱정')) usedCards.push('💭 불안(Anxiety)');
  if (userText.includes('분노') || userText.includes('화')) usedCards.push('💭 분노(Anger)');
  if (userText.includes('두려움') || userText.includes('무섭')) usedCards.push('💭 두려움(Fear)');
  
  // 액션 카드 감지
  if (userText.includes('사과') || userText.includes('죄송')) usedCards.push('🎯 ACT-032: 사과한다');
  if (userText.includes('공감') || userText.includes('이해')) usedCards.push('🎯 ACT-011: 공감의 말을 전한다');
  if (userText.includes('시간') || userText.includes('분')) usedCards.push('🎯 ACT-037: 시간을 알려준다');
  if (userText.includes('설명')) usedCards.push('🎯 ACT-034: 설명한다');
  
  let feedback = '';
  if (score >= 70) feedback = '✅ 훌륭합니다! 환자의 감정을 잘 읽고 적절히 대응했습니다.';
  else if (score >= 40) feedback = '⚠️ 괜찮지만, 더 구체적인 안내가 필요합니다.';
  else feedback = '❌ 환자의 감정을 더 세심하게 읽어야 합니다.';
  
  return {
    score,
    usedCards,
    missingKeywords: keywords.filter(k => !userText.includes(k)),
    feedback
  };
}

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
                text: '🏥 환자경험카드® 상담 시뮬레이터\n\n실제 상황처럼 AI 환자와 대화하며\n4종 카드 활용법을 마스터하세요!\n\n━━━━━━━━━━━━━━━━━━\n\n연습할 시나리오를 선택하세요:',
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

    // 2. 시나리오 선택
    if (userInput === 'S1' || userInput === 'S2' || userInput === 'S3' || userInput === 'S4') {
      const scenario = scenarios[userInput];
      if (!scenario) {
        return NextResponse.json({
          version: '2.0',
          template: {
            outputs: [{ simpleText: { text: '시나리오를 찾을 수 없습니다.\n"시작"을 입력해주세요.' } }],
          },
        });
      }

      const firstTurn = scenario.turns[0];

      // 세션 생성
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
                text: `📋 ${scenario.title}\n${scenario.subtitle}\n\n━━━━━━━━━━━━━━━━━━\n\n🏥 상황:\n${scenario.context}\n\n━━━━━━━━━━━━━━━━━━\n\n💭 감정: ${firstTurn.emotion}\n\n👨 환자:\n"${firstTurn.text}"\n\n━━━━━━━━━━━━━━━━━━\n\n👨‍⚕️ 상담사님은 어떻게 응대하시겠습니까?\n\n💬 답변을 입력해주세요!`,
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
    if (!scenario) {
      await kv.del(`session:${userId}`);
      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [{ simpleText: { text: '세션 오류가 발생했습니다.\n"시작"을 입력해주세요.' } }],
        },
      });
    }

    const currentTurn = scenario.turns[session.currentTurn];
    
    // 환자 턴이면 다음으로
    if (currentTurn.role === 'patient') {
      session.currentTurn += 1;
      await kv.set(`session:${userId}`, session, { ex: 3600 });

      const nextTurn = scenario.turns[session.currentTurn];
      if (!nextTurn) {
        // 시나리오 종료
        return NextResponse.json({
          version: '2.0',
          template: {
            outputs: [{ simpleText: { text: '시나리오가 완료되었습니다!\n"시작"을 입력해서 다시 시작하세요.' } }],
          },
        });
      }

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [
            {
              simpleText: {
                text: `━━━━━━━━━━━━━━━━━━\n\n💭 감정: ${nextTurn.emotion || '알 수 없음'}\n\n👨 환자:\n"${nextTurn.text}"\n\n━━━━━━━━━━━━━━━━━━\n\n👨‍⚕️ 어떻게 응대하시겠습니까?\n\n💬 답변을 입력해주세요!`,
              },
            },
          ],
        },
      });
    }

    // 상담사 턴 - 분석
    const analysis = analyzeResponse(
      userInput,
      currentTurn.keywords || [],
      currentTurn.emotion
    );

    session.answers.push(userInput);
    session.scores.push(analysis.score);
    session.currentTurn += 1;

    // 다음 턴 확인
    const nextTurnIndex = session.currentTurn;
    if (nextTurnIndex >= scenario.turns.length) {
      // 시나리오 완료 - 결과 표시
      const totalScore = session.scores.length > 0
        ? Math.round(session.scores.reduce((sum, s) => sum + s, 0) / session.scores.length)
        : 0;
      
      let grade = 'D';
      let gradeText = '추가 학습 필요';
      if (totalScore >= 80) { grade = 'A'; gradeText = '전문가 수준'; }
      else if (totalScore >= 60) { grade = 'B'; gradeText = '숙련 단계'; }
      else if (totalScore >= 40) { grade = 'C'; gradeText = '초보 단계'; }

      await kv.del(`session:${userId}`);

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [
            {
              simpleText: {
                text: `━━━━━━━━━━━━━━━━━━\n📊 분석 결과 (${session.answers.length}/${scenario.turns.filter(t => t.role === 'staff').length})\n━━━━━━━━━━━━━━━━━━\n\n점수: ${analysis.score}점\n\n${analysis.feedback}\n\n${analysis.usedCards.length > 0 ? '✅ 사용한 카드:\n' + analysis.usedCards.map(c => `• ${c}`).join('\n') + '\n\n' : ''}${analysis.missingKeywords.length > 0 ? '💡 놓친 키워드:\n' + analysis.missingKeywords.join(', ') + '\n\n' : ''}━━━━━━━━━━━━━━━━━━\n🎉 시나리오 완료!\n━━━━━━━━━━━━━━━━━━\n\n최종 점수: ${totalScore}점\n등급: ${grade} (${gradeText})\n\n다른 시나리오를 연습하려면\n"시작"을 입력하세요!`,
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

    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [
          {
            simpleText: {
              text: `━━━━━━━━━━━━━━━━━━\n📊 분석 결과 (${session.answers.length}/${scenario.turns.filter(t => t.role === 'staff').length})\n━━━━━━━━━━━━━━━━━━\n\n점수: ${analysis.score}점\n\n${analysis.feedback}\n\n${analysis.usedCards.length > 0 ? '✅ 사용한 카드:\n' + analysis.usedCards.map(c => `• ${c}`).join('\n') + '\n\n' : ''}${analysis.missingKeywords.length > 0 ? '💡 놓친 키워드:\n' + analysis.missingKeywords.join(', ') + '\n\n' : ''}━━━━━━━━━━━━━━━━━━\n🔄 다음 상황\n━━━━━━━━━━━━━━━━━━\n\n💭 감정: ${nextTurn.emotion || ''}\n\n👨 환자:\n"${nextTurn.text}"\n\n━━━━━━━━━━━━━━━━━━\n\n👨‍⚕️ 어떻게 응대하시겠습니까?`,
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