import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { scenarios } from '../../../../core/scenarios';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const SYSTEM_PROMPT = `당신은 환자경험카드® MOT 코치입니다. EOSEO 프레임워크로 분석하고 JSON만 출력합니다.

{
  "score": 85,
  "grade": "B",
  "eoseo": {"E": "✅ 감정인식함", "S": "✅ 상황파악", "O": "❌ 선택지없음", "E2": "✅ 시간안내", "O2": "✅ 결과안내"},
  "good": ["구체적 잘한점 1줄"],
  "missing": ["개선점 1줄"],
  "cards": ["💭 불안", "🎯 시간안내"],
  "tip": "다음엔 이렇게: [구체적 대사]"
}`;

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

// 빠른 키워드 분석 (0.5초 미만)
function quickAnalyze(userText: string, keywords: string[], emotion?: string) {
  const usedKeywords = keywords.filter(k => userText.includes(k));
  const score = keywords.length > 0 ? Math.round((usedKeywords.length / keywords.length) * 100) : 50;
  
  const cards: string[] = [];
  if (userText.includes('불안') || userText.includes('걱정')) cards.push('💭 불안');
  if (userText.includes('분노') || userText.includes('화')) cards.push('💭 분노');
  if (userText.includes('두려움')) cards.push('💭 두려움');
  if (userText.includes('사과') || userText.includes('죄송')) cards.push('🎯 사과');
  if (userText.includes('공감') || userText.includes('이해')) cards.push('🎯 공감');
  if (userText.includes('시간') || userText.includes('분')) cards.push('🎯 시간안내');
  
  const eoseo = {
    E: usedKeywords.some(k => ['불안', '걱정', '긴장'].includes(k)) ? '✅ 감정인식' : '❌ 감정인식 부족',
    S: userText.length > 20 ? '✅ 상황설명' : '⚠️ 더 구체적으로',
    O: usedKeywords.length > 1 ? '✅ 정보제공' : '❌ 정보 부족',
    E2: usedKeywords.some(k => ['시간', '분', '후'].includes(k)) ? '✅ 시간안내' : '⚠️ 시간 미안내',
    O2: '✅ 진행중'
  };
  
  let good = [], missing = [];
  if (score >= 70) good.push('핵심 키워드를 잘 사용했습니다');
  else missing.push('키워드를 더 활용하세요: ' + keywords.filter(k => !userText.includes(k)).slice(0, 2).join(', '));
  
  if (cards.length > 0) good.push('적절한 카드를 사용했습니다');
  else missing.push('감정/액션 카드를 더 활용하세요');
  
  return {
    score,
    grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
    eoseo,
    good: good.length > 0 ? good : ['답변을 제출했습니다'],
    missing: missing.length > 0 ? missing : [],
    cards,
    tip: '더 구체적인 시간과 절차를 안내해보세요'
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: KakaoRequest = await req.json();
    const userId = body.userRequest.user.id;
    const userInput = body.userRequest.utterance.trim();

    let session = await kv.get<Session>(`session:${userId}`);

    // 시작
    if (userInput === '시작') {
      await kv.del(`session:${userId}`);
      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [{
            simpleText: {
              text: '🏥 환자경험카드® 상담 시뮬레이터\n\n━━━━━━━━━━━━━━━━━━\n\n💎 VALUES: 공감·신뢰·책임\n💭 EMOTION: 불안·분노·두려움\n📍 MOT: 결정적 순간\n🎯 ACTION: 구체적 행동\n\n━━━━━━━━━━━━━━━━━━\n\n시나리오를 선택하세요:',
            },
          }],
          quickReplies: [
            { label: '😰 불안한 첫 내원', action: 'message', messageText: 'S1' },
            { label: '🤔 임플란트 망설임', action: 'message', messageText: 'S2' },
            { label: '😤 불만 전화', action: 'message', messageText: 'S3' },
            { label: '💰 비용 저항', action: 'message', messageText: 'S4' },
          ],
        },
      });
    }

    // 힌트
    if (userInput === '힌트' && session) {
      const scenario = scenarios[session.scenarioId];
      const currentTurn = scenario.turns[session.currentTurn];
      if (currentTurn.role === 'staff') {
        return NextResponse.json({
          version: '2.0',
          template: {
            outputs: [{
              simpleText: {
                text: `💡 힌트\n\n${currentTurn.ideal}\n\n✅ 키워드: ${currentTurn.keywords?.join(', ')}`,
              },
            }],
          },
        });
      }
    }

    // 시나리오 선택
    if (userInput === 'S1' || userInput === 'S2' || userInput === 'S3' || userInput === 'S4') {
      const scenario = scenarios[userInput];
      const firstTurn = scenario.turns[0];

      await kv.set(`session:${userId}`, {
        scenarioId: userInput,
        currentTurn: 0,
        answers: [],
        scores: [],
      }, { ex: 3600 });

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [{
            simpleText: {
              text: `📋 ${scenario.title}\n\n🏥 ${scenario.context}\n\n━━━━━━━━━━━━━━━━━━\n\n💭 ${firstTurn.emotion}\n\n👨 환자: "${firstTurn.text}"\n\n━━━━━━━━━━━━━━━━━━\n\n👨‍⚕️ 어떻게 응대하시겠습니까?\n\n(막히면 "힌트")`,
            },
          }],
        },
      });
    }

    if (!session) {
      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [{ simpleText: { text: '"시작"을 입력하세요!' } }],
        },
      });
    }

    const scenario = scenarios[session.scenarioId];
    const currentTurn = scenario.turns[session.currentTurn];
    
    // 환자 턴
    if (currentTurn.role === 'patient') {
      session.currentTurn += 1;
      await kv.set(`session:${userId}`, session, { ex: 3600 });
      const nextTurn = scenario.turns[session.currentTurn];
      
      if (!nextTurn) {
        return NextResponse.json({
          version: '2.0',
          template: {
            outputs: [{ simpleText: { text: '완료! "시작"을 입력하세요.' } }],
          },
        });
      }

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [{
            simpleText: {
              text: `━━━━━━━━━━━━━━━━━━\n\n💭 ${nextTurn.emotion || '복합감정'}\n\n👨 환자: "${nextTurn.text}"\n\n━━━━━━━━━━━━━━━━━━\n\n👨‍⚕️ 어떻게 응대하시겠습니까?\n\n(막히면 "힌트")`,
            },
          }],
        },
      });
    }

    // 상담사 턴 - 분석
    const prevTurn = scenario.turns[session.currentTurn - 1];
    const isFirstAnswer = session.answers.length === 0;
    
    let analysis;

    // 첫 답변만 Claude AI 사용
    if (isFirstAnswer) {
      try {
        const analysisPrompt = `환자: "${prevTurn.text}" (감정: ${prevTurn.emotion})\n상담사: "${userInput}"\n모범: "${currentTurn.ideal}"\n키워드: ${currentTurn.keywords?.join(', ')}\n\n분석하고 JSON만 출력:`;
        
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: analysisPrompt }],
        });

        const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch (e) {
        analysis = null;
      }
    }

    // AI 실패시 또는 2번째 이후는 빠른 분석
    if (!analysis) {
      analysis = quickAnalyze(userInput, currentTurn.keywords || [], prevTurn.emotion);
    }

    session.answers.push(userInput);
    session.scores.push(analysis.score);
    session.currentTurn += 1;

    const nextTurnIndex = session.currentTurn;
    
    // 시나리오 완료
    if (nextTurnIndex >= scenario.turns.length) {
      const totalScore = Math.round(session.scores.reduce((sum: number, s: number) => sum + s, 0) / session.scores.length);
      let grade = 'D', gradeText = '추가 학습 필요';
      if (totalScore >= 80) { grade = 'A'; gradeText = '전문가 수준'; }
      else if (totalScore >= 60) { grade = 'B'; gradeText = '숙련 단계'; }
      else if (totalScore >= 40) { grade = 'C'; gradeText = '초보 단계'; }

      await kv.del(`session:${userId}`);

      const eoseoLines = analysis.eoseo ? Object.values(analysis.eoseo).filter(Boolean).join('\n') : '';

      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [{
            simpleText: {
              text: `━━━━━━━━━━━━━━━━━━\n📊 마지막 분석\n━━━━━━━━━━━━━━━━━━\n\n점수: ${analysis.score}점 (${analysis.grade})\n\n🔍 EOSEO:\n${eoseoLines}\n\n${analysis.good?.length > 0 ? '✅ ' + analysis.good.join('\n✅ ') : ''}\n${analysis.missing?.length > 0 ? '\n\n💡 ' + analysis.missing.join('\n💡 ') : ''}\n${analysis.cards?.length > 0 ? '\n\n🎴 ' + analysis.cards.join(', ') : ''}\n${analysis.tip ? '\n\n🎯 ' + analysis.tip : ''}\n\n━━━━━━━━━━━━━━━━━━\n🎉 완료!\n━━━━━━━━━━━━━━━━━━\n\n최종: ${totalScore}점 / ${grade} (${gradeText})`,
            },
          }],
          quickReplies: [{ label: '🔄 처음으로', action: 'message', messageText: '시작' }],
        },
      });
    }

    // 다음 턴
    await kv.set(`session:${userId}`, session, { ex: 3600 });
    const nextTurn = scenario.turns[nextTurnIndex];
    const eoseoLines = analysis.eoseo ? Object.values(analysis.eoseo).filter(Boolean).join('\n') : '';

    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [{
          simpleText: {
            text: `━━━━━━━━━━━━━━━━━━\n📊 분석 (${session.answers.length}/${scenario.turns.filter((t: any) => t.role === 'staff').length})\n━━━━━━━━━━━━━━━━━━\n\n${analysis.score}점 (${analysis.grade})\n\n🔍 EOSEO:\n${eoseoLines}\n\n${analysis.good?.length > 0 ? '✅ ' + analysis.good.join('\n✅ ') : ''}\n${analysis.missing?.length > 0 ? '\n\n💡 ' + analysis.missing.join('\n💡 ') : ''}\n${analysis.cards?.length > 0 ? '\n\n🎴 ' + analysis.cards.join(', ') : ''}\n\n━━━━━━━━━━━━━━━━━━\n🔄 다음\n━━━━━━━━━━━━━━━━━━\n\n💭 ${nextTurn.emotion || '복합감정'}\n\n👨 "${nextTurn.text}"\n\n━━━━━━━━━━━━━━━━━━\n\n👨‍⚕️ 어떻게 응대하시겠습니까?`,
          },
        }],
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [{ simpleText: { text: '오류 발생\n\n"시작"을 입력하세요.' } }],
        quickReplies: [{ label: '🔄 처음으로', action: 'message', messageText: '시작' }],
      },
    });
  }
}