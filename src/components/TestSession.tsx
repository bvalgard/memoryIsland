import { useRef } from 'react';
import StudySession from './StudySession';
import { Island, Card, CardUpdateRecord, UserSettings } from '../hooks/useUserProgress';
import { SessionMeta } from '../achievements';
import { TestConfig, TestSessionDoc, TestQuestionResult } from '../hooks/useTestMode';

interface Props {
  cards: Card[];
  config: TestConfig;
  settings?: UserSettings;
  friends?: string[];
  currentUserName?: string;
  isOnline?: boolean;
  onTestFinish: (report: Omit<TestSessionDoc, 'id'>) => void;
  onBack: () => void;
  uid: string;
}

export default function TestSession({
  cards,
  config,
  settings,
  friends = [],
  currentUserName = 'Explorer',
  isOnline = true,
  onTestFinish,
  onBack,
  uid,
}: Props) {
  const startedAt = useRef(Date.now());

  // Build a synthetic island from the combined card list
  const syntheticIsland: Island = {
    id: '__test__',
    name: 'Test Voyage',
    color_score: 0,
    cards,
  };

  const buildReport = (cardUpdates: CardUpdateRecord): Omit<TestSessionDoc, 'id'> => {
    const completedAt = Date.now();
    const islandBreakdown: TestSessionDoc['islandBreakdown'] = {};
    const questions: TestQuestionResult[] = [];

    for (const card of cards) {
      const update = cardUpdates[card.front];
      const correct = update ? (update.sessionCorrect ?? 0) > 0 : false;
      const timeMs = update?.responseTimeMs ?? 0;
      const islandId = card.islandId ?? '__unknown__';
      const islandName = card.islandName ?? 'Unknown Island';

      if (!islandBreakdown[islandId]) {
        islandBreakdown[islandId] = { islandName, correct: 0, total: 0 };
      }
      islandBreakdown[islandId].total += 1;
      if (correct) islandBreakdown[islandId].correct += 1;

      questions.push({
        cardId: card.id ?? card.front,
        islandId,
        islandName,
        correct,
        timeMs,
        front: card.front,
        back: card.back,
        type: card.type ?? 'flashcard',
      });
    }

    const totalCards = questions.length;
    const correctCards = questions.filter(q => q.correct).length;
    const scorePercent = totalCards > 0 ? Math.round((correctCards / totalCards) * 100) : 0;
    const avgTimeMs = totalCards > 0
      ? Math.round(questions.reduce((sum, q) => sum + q.timeMs, 0) / totalCards)
      : 0;

    return {
      uid,
      config,
      startedAt: startedAt.current,
      completedAt,
      totalCards,
      correctCards,
      scorePercent,
      avgTimeMs,
      islandBreakdown,
      questions,
    };
  };

  const handleFinish = (
    _scoreDelta: number,
    cardUpdates: CardUpdateRecord,
    _maxStreak: number,
    _sessionMeta: SessionMeta
  ) => {
    const report = buildReport(cardUpdates);
    onTestFinish(report);
  };

  return (
    <StudySession
      island={syntheticIsland}
      mode="all"
      settings={settings}
      friends={friends}
      currentUserName={currentUserName}
      isOnline={isOnline}
      isTestMode={true}
      timeoutPerCardSec={config.timeLimitMode === 'per-question' ? config.timeLimitSeconds : undefined}
      totalTimeLimitSec={config.timeLimitMode === 'total' ? config.totalTimeLimitSeconds : undefined}
      onFinish={handleFinish}
      onManage={handleFinish}
      onBackToMap={() => onBack()}
    />
  );
}
