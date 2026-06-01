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
  totalDueCards?: number;
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

      // stuck-like-a-barnacle: mastered with 3+ prior demotions AND SRS interval >= 14 days
      const allCardsFlatForBarnacle = ctx.progress.islands.flatMap(i => i.cards);
      const barnacled = Object.entries(ctx.cardUpdates).some(([front, update]) => {
        if (update.status !== 'mastered') return false;
        if ((update.srsInterval ?? 0) < 14) return false;
        const card = allCardsFlatForBarnacle.find(c => c.front === front);
        return !!card && (card.demotionCount || 0) >= 3;
      });
      if (barnacled) tryUnlock('stuck-like-a-barnacle');
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
      const updatesByFront = ctx.cardUpdates || {};

      const sovereign = allIslands.find(
        i => i.cards.length >= 50 && i.cards.every(c => c.status === 'mastered')
      );
      if (sovereign) tryUnlock('archipelago-sovereign');

      // land-ho: every card across an entire archipelago is mastered (50+ cards total)
      const islandsByArch = new Map<string, typeof allIslands[0][]>();
      for (const island of allIslands) {
        if (!island.archipelagoId) continue;
        const arr = islandsByArch.get(island.archipelagoId) ?? [];
        arr.push(island);
        islandsByArch.set(island.archipelagoId, arr);
      }
      for (const [, islands] of islandsByArch) {
        const archCards = islands.flatMap(i => i.cards);
        if (archCards.length < 50) continue;
        const allMastered = archCards.every(c => {
          const upd = updatesByFront[c.front];
          return upd ? upd.status === 'mastered' : c.status === 'mastered';
        });
        if (allMastered) { tryUnlock('land-ho'); break; }
      }

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

    // --- VOYAGE MILESTONES ---
    if (ctx.trigger === 'session-complete' && stats) {
      const newTotal = stats.totalStudySessions + 1;
      if (newTotal >= 50) tryUnlock('the-helmsman');
      if (newTotal >= 100) tryUnlock('the-navigator');
      if (newTotal >= 500) tryUnlock('the-captain');
      if (newTotal >= 1000) tryUnlock('the-fleet-admiral');
    }

    // --- DEEP WATER NAVIGATOR: 3 different archipelagos in one day ---
    if (ctx.trigger === 'session-complete' && stats && ctx.sessionMeta?.archipelagoId) {
      const todayKey = new Date().toISOString().split('T')[0];
      const prevSet = new Set(stats.dailyArchipelagoMap?.[todayKey] ?? []);
      prevSet.add(ctx.sessionMeta.archipelagoId);
      if (prevSet.size >= 3) tryUnlock('deep-water-navigator');
    }

    // --- RETURN VOYAGE: island not studied in 45+ days ---
    if (ctx.trigger === 'session-complete' && ctx.islandId && ctx.islandId !== 'archipelago' && ctx.islandId !== 'multi-select') {
      const island = ctx.progress.islands.find(i => i.id === ctx.islandId);
      if (island) {
        const reviewedTimestamps = island.cards.map(c => c.lastReviewed).filter((t): t is number => !!t);
        if (reviewedTimestamps.length > 0) {
          const mostRecent = Math.max(...reviewedTimestamps);
          const days45Ms = 45 * 24 * 60 * 60 * 1000;
          if (Date.now() - mostRecent >= days45Ms) tryUnlock('return-voyage');
        }
      }
    }

    // --- STEADY WINDS: active 25 of last 30 days ---
    if (ctx.trigger === 'session-complete' && ctx.sessionMeta && stats) {
      const { cardCount } = ctx.sessionMeta;
      const activityMap = stats.dailyActivityMap ?? {};
      const today = new Date();
      const todayKey = today.toISOString().split('T')[0];
      const activityWithToday = { ...activityMap, [todayKey]: (activityMap[todayKey] ?? 0) + cardCount };
      let daysActive = 0;
      for (let d = 0; d < 30; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() - d);
        const key = date.toISOString().split('T')[0];
        if ((activityWithToday[key] ?? 0) > 0) daysActive++;
      }
      if (daysActive >= 25) tryUnlock('steady-winds');
    }

    // --- ILLUMINATED MANUSCRIPT: 50 cards with 'Why' explanations ---
    {
      const allCards = ctx.progress.islands.flatMap(i => i.cards);
      const withExplanation = allCards.filter(c => c.explanation && c.explanation.trim().length > 0);
      if (withExplanation.length >= 50) tryUnlock('illuminated-manuscript');
    }

    // --- INTO THE FOG: full session in charting mode ---
    if (ctx.trigger === 'session-complete' && ctx.sessionMeta?.studyMode === 'charting' && (ctx.sessionMeta.cardCount ?? 0) > 0) {
      tryUnlock('into-the-fog');
    }

    // --- THE HARD WAY: entire island session using only fill-in-the-blank ---
    if (ctx.trigger === 'session-complete' && ctx.islandId && ctx.islandId !== 'archipelago' && ctx.islandId !== 'multi-select' && ctx.cardUpdates) {
      const island = ctx.progress.islands.find(i => i.id === ctx.islandId);
      if (island) {
        const updatedFronts = new Set(Object.keys(ctx.cardUpdates));
        const reviewedCards = island.cards.filter(c => updatedFronts.has(c.front));
        if (reviewedCards.length >= 5 && reviewedCards.every(c => c.type === 'fill-in-the-blank')) {
          tryUnlock('the-hard-way');
        }
      }
    }

    // --- PEER RESCUE ---
    if (ctx.trigger === 'flare-resolved') {
      const rescues = ctx.totalRescues ?? 0;
      if (rescues >= 1) tryUnlock('life-saver');
      if (rescues >= 10) tryUnlock('coast-guard');
    }

    // --- CALM SEAS, CLEAR MIND: weekend + zero cards due ---
    if (ctx.trigger === 'app-load' && ctx.totalDueCards === 0) {
      const day = new Date().getDay();
      const totalCards = ctx.progress.islands.flatMap(i => i.cards).length;
      if ((day === 0 || day === 6) && totalCards > 0) tryUnlock('calm-seas-clear-mind');
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
