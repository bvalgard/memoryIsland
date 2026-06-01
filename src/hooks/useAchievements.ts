import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ACHIEVEMENT_MAP, Achievement, SessionMeta } from '../achievements';
import { UserProgress, CardUpdateRecord, saveUnlockedAchievements } from './useUserProgress';

interface CheckContext {
  progress: UserProgress;
  cardUpdates?: CardUpdateRecord;
  sessionMeta?: SessionMeta;
  trigger: 'session-complete' | 'session-abandon' | 'island-shared' | 'card-created' | 'app-load' | 'flare-resolved';
  islandId?: string;
  totalRescues?: number;
}

export function useAchievements() {
  const checkAndAwardAchievements = async (ctx: CheckContext): Promise<Achievement[]> => {
    const user = auth.currentUser;
    if (!user || !ctx.progress) return [];

    const alreadyUnlocked = new Set(ctx.progress.achievements || []);
    const newlyUnlocked: Achievement[] = [];

    const tryUnlock = (id: string) => {
      if (!alreadyUnlocked.has(id)) {
        const def = ACHIEVEMENT_MAP.get(id);
        if (def) {
          newlyUnlocked.push({ ...def, unlockedAt: Date.now() });
          alreadyUnlocked.add(id);
        }
      }
    };

    // --- RESILIENCE ---
    if (ctx.cardUpdates) {
      const updates = Object.values(ctx.cardUpdates);
      if (updates.some(u => u.wasDemoted)) tryUnlock('lost-in-the-fog');

      // against-the-current: card reaches mastered AND had 3+ prior demotions
      // demotionCount on the card reflects pre-session history (processSessionResults
      // increments it after this check runs, which is correct — mastery resets the streak,
      // not the demotion history).
      const allCardsFlat = ctx.progress.islands.flatMap(i => i.cards);
      const masteredWithDemotions = Object.entries(ctx.cardUpdates).some(([front, update]) => {
        if (update.status !== 'mastered') return false;
        const card = allCardsFlat.find(c => c.front === front);
        return !!card && (card.demotionCount || 0) >= 3;
      });
      if (masteredWithDemotions) tryUnlock('against-the-current');
    }

    // bermuda-triangle: apply cardUpdates as an overlay to avoid snapshot race
    {
      const allCards = ctx.progress.islands.flatMap(i => i.cards);
      const updatesByFront = ctx.cardUpdates || {};
      const chartingCount = allCards.filter(c => {
        const upd = updatesByFront[c.front];
        return upd ? upd.status === 'charting' : (c.status === 'charting' || !!c.needsWork);
      }).length;
      if (chartingCount >= 20) tryUnlock('bermuda-triangle');
    }

    // --- MOTIVATING: streak & cumulative stats ---
    const stats = ctx.progress.stats;
    if (stats) {
      if (stats.dailyStreak >= 7) tryUnlock('lighthouse-keeper-bronze');
      if (stats.dailyStreak >= 30) tryUnlock('lighthouse-keeper-silver');
      if (stats.dailyStreak >= 100) tryUnlock('lighthouse-keeper-gold');
      if (stats.totalCardsCreated >= 500) tryUnlock('master-cartographer-creation');
    }

    if (ctx.trigger === 'island-shared') tryUnlock('master-cartographer-share');

    // --- MOTIVATING: session-based ---
    if (ctx.trigger === 'session-complete' && ctx.sessionMeta) {
      const { cardCount, correctCount, sessionDurationMs, sessionStartHour } = ctx.sessionMeta;
      if (cardCount >= 20 && correctCount === cardCount) tryUnlock('perfect-voyage');
      // dailyActivityMap is pre-update in this snapshot, so add today's session manually
      const activityMap = stats?.dailyActivityMap ?? {};
      const today = new Date();
      const todayKey = today.toISOString().split('T')[0];
      const todayTotal = (activityMap[todayKey] ?? 0) + cardCount;
      let sevenDayStreak = todayTotal >= 10;
      for (let d = 1; d < 7 && sevenDayStreak; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() - d);
        const key = date.toISOString().split('T')[0];
        if ((activityMap[key] ?? 0) < 10) sevenDayStreak = false;
      }
      if (sevenDayStreak) tryUnlock('horizon-chaser');
      if (sessionStartHour >= 2 && sessionStartHour < 4) tryUnlock('night-watch');
      if (stats && stats.recordReviewed > 0) {
        const newDailyTotal = stats.dailyReviewed + cardCount;
        if (newDailyTotal > stats.recordReviewed) tryUnlock('high-tide');
      }
    }

    // --- MOTIVATING: passive island state ---
    {
      const allIslands = ctx.progress.islands;
      const sovereign = allIslands.find(
        i => i.cards.length >= 50 && i.cards.every(c => c.status === 'mastered')
      );
      if (sovereign) tryUnlock('archipelago-sovereign');

      const viral = allIslands.find(
        i => i.approvalStatus === 'approved' && (i.downloads || 0) >= 10
      );
      if (viral) tryUnlock('trade-winds');
    }

    // --- QUIRKY ---
    {
      const allCards = ctx.progress.islands.flatMap(i => i.cards);

      const neverReviewed = allCards.filter(c => !c.lastReviewed).length;
      if (neverReviewed >= 50) tryUnlock('the-hoarder');

      const hasStowaway = allCards.some(
        c => c.front.trim().split(/\s+/).length === 1 && c.back.trim().split(/\s+/).length === 1
      );
      if (hasStowaway) tryUnlock('stowaway');
    }

    if (ctx.trigger === 'session-abandon' && ctx.cardUpdates) {
      if (Object.keys(ctx.cardUpdates).length < 5) tryUnlock('shipwrecked');
    }

    // --- PEER RESCUE ---
    if (ctx.trigger === 'flare-resolved') {
      const rescues = ctx.totalRescues ?? 0;
      if (rescues >= 1) tryUnlock('life-saver');
      if (rescues >= 10) tryUnlock('coast-guard');
    }

    // On app load, check helper achievements via reputation doc (retroactive unlock)
    if (ctx.trigger === 'app-load') {
      try {
        const repSnap = await getDoc(doc(db, 'user_reputation', user.uid));
        if (repSnap.exists()) {
          const accepted = repSnap.data().totalAccepted ?? 0;
          if (accepted >= 1) tryUnlock('life-saver');
          if (accepted >= 10) tryUnlock('coast-guard');
        }
      } catch { /* silent — non-critical */ }
    }

    // Persist newly unlocked to Firestore
    if (newlyUnlocked.length > 0) {
      await saveUnlockedAchievements(user.uid, newlyUnlocked.map(a => a.id));
    }

    return newlyUnlocked;
  };

  return { checkAndAwardAchievements };
}
