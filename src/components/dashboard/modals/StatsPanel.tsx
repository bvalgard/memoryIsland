import { motion, AnimatePresence } from 'motion/react';
import { X, BarChart2, Map, Zap, Activity, AlertCircle, Trophy, Award } from 'lucide-react';
import { Card, UserProgress } from '../../../hooks/useUserProgress';
import { cn } from '../../../lib/utils';

interface BlindSpotData {
  quadrants: {
    fastCorrect: Card[];
    slowCorrect: Card[];
    fastIncorrect: Card[];
    slowIncorrect: Card[];
  };
  classifiedCount: number;
  pendingCount: number;
}

interface StatsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  allCards: Card[];
  globalMasteredCount: number;
  globalLearningCount: number;
  globalStrugglingCount: number;
  trackingMode: 'srs' | 'status' | 'both';
  progress: UserProgress | null;
  forgettingCount: number;
  bestStudyHour: { hour: number; accuracy: number; sessions: number } | null;
  weakSpotCards: Card[];
  blindSpotData: BlindSpotData | null;
  formatStudyHour: (h: number) => string;
  blindSpotOpen: boolean;
  setBlindSpotOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  knowledgeGapOpen: boolean;
  setKnowledgeGapOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export default function StatsPanel({
  isOpen, onClose, allCards, globalMasteredCount, globalLearningCount, globalStrugglingCount,
  trackingMode, progress, forgettingCount, bestStudyHour, weakSpotCards, blindSpotData,
  formatStudyHour, blindSpotOpen, setBlindSpotOpen, knowledgeGapOpen, setKnowledgeGapOpen,
}: StatsPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-3xl bg-[#111] border border-white/10 rounded-[32px] p-8 shadow-2xl flex flex-col max-h-[85vh]"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-brand-muted hover:text-white transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="shrink-0">
              <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <BarChart2 className="w-6 h-6 text-brand-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Learning Statistics</h2>
              <p className="text-brand-muted text-sm leading-relaxed mb-8">
                Track your mastery across the entire archipelago.
              </p>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-4 -mr-4">
              {/* Global Stats */}
              <div className="mb-12">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Map className="w-5 h-5 text-brand-primary" />
                  Archipelago Total
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 border-b-2 border-b-white/20">
                    <div className="text-3xl font-black text-white mb-1">{allCards.length}</div>
                    <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted">Total Cards</div>
                  </div>
                  <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/20 border-b-2 border-b-emerald-500/40">
                    <div className="text-3xl font-black text-emerald-400 mb-1">{globalMasteredCount}</div>
                    <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-500/80">Mastered</div>
                  </div>
                  <div className="bg-amber-500/5 rounded-2xl p-4 border border-amber-500/20 border-b-2 border-b-amber-500/40">
                    <div className="text-3xl font-black text-amber-400 mb-1">{globalLearningCount}</div>
                    <div className="text-[10px] font-bold tracking-widest uppercase text-amber-500/80">Learning</div>
                  </div>
                  <div className="bg-red-500/5 rounded-2xl p-4 border border-red-500/20 border-b-2 border-b-red-500/40">
                    <div className="text-3xl font-black text-red-400 mb-1">{globalStrugglingCount}</div>
                    <div className="text-[10px] font-bold tracking-widest uppercase text-red-500/80">Struggling</div>
                  </div>
                </div>
              </div>

              {/* Activity & Records */}
              {progress?.stats && (
                <div className="mb-12">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-brand-primary" />
                    Activity & Records
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    <div className="bg-white/5 rounded-2xl p-4 border border-brand-primary/20 border-b-2 border-b-brand-primary/40 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Zap className="w-24 h-24" /></div>
                      <div className="text-3xl font-black text-white mb-1 relative z-10">{progress.stats.dailyReviewed}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted relative z-10">Today's Review</div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-emerald-500/20 border-b-2 border-b-emerald-500/40 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Activity className="w-24 h-24" /></div>
                      <div className="text-3xl font-black text-emerald-400 mb-1 relative z-10">{progress.stats.dailyMastered}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-500/80 relative z-10">Today Mastered</div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Trophy className="w-24 h-24" /></div>
                      <div className="text-3xl font-black text-white mb-1 relative z-10">{progress.stats.recordReviewed}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted relative z-10">Most Reviewed</div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-emerald-500/10 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Award className="w-24 h-24" /></div>
                      <div className="text-3xl font-black text-emerald-400/80 mb-1 relative z-10">{progress.stats.recordMastered}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-500/60 relative z-10">Most Mastered</div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 relative overflow-hidden group">
                      <div className="text-3xl font-black text-white mb-1 relative z-10">{progress.stats.totalStudySessions}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted relative z-10">Total Sessions</div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 relative overflow-hidden group">
                      <div className="text-3xl font-black text-white mb-1 relative z-10">{progress.stats.totalCardsCreated}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted relative z-10">Cards Authored</div>
                    </div>
                    {(progress.stats.calibrationTotal ?? 0) > 0 && (
                      <div className="bg-violet-500/5 rounded-2xl p-4 border border-violet-500/20 border-b-2 border-b-violet-500/40 relative overflow-hidden group col-span-2 sm:col-span-1">
                        <div className="text-3xl font-black text-violet-400 mb-1 relative z-10">
                          {Math.round((progress.stats.calibrationCorrect ?? 0) / (progress.stats.calibrationTotal ?? 1) * 100)}%
                        </div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-violet-500/80 relative z-10">Calibration</div>
                        <div className="text-[10px] text-brand-muted/60 relative z-10 mt-0.5">
                          {progress.stats.calibrationCorrect ?? 0} / {progress.stats.calibrationTotal ?? 0} predictions
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Streak Records */}
              {progress?.stats && (
                <div className="mb-12">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-500">
                    <Zap className="w-5 h-5 fill-current" />
                    Streak Achievements
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-amber-500/5 rounded-2xl p-6 border border-amber-500/20 border-b-2 border-b-amber-500/40 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-10 text-amber-500 group-hover:scale-110 transition-transform"><Zap className="w-24 h-24 fill-current" /></div>
                      <div className="text-4xl font-black text-amber-400 mb-1 relative z-10">{progress.stats.dailyStreak || 0}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-amber-500/80 relative z-10">Daily Streak (Days)</div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 border-b-2 border-b-white/20 relative overflow-hidden group">
                      <div className="text-4xl font-black text-white mb-1 relative z-10">{progress.stats.longestDailyStreak || 0}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted relative z-10">Record Daily Streak</div>
                    </div>
                    <div className="bg-brand-primary/5 rounded-2xl p-6 border border-brand-primary/20 border-b-2 border-b-brand-primary/40 relative overflow-hidden group">
                      <div className="text-4xl font-black text-brand-primary mb-1 relative z-10">{progress.stats.longestSessionStreak || 0}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-brand-primary/80 relative z-10">Best Card Streak</div>
                    </div>
                    <div className="bg-sky-500/5 rounded-2xl p-6 border border-sky-500/20 border-b-2 border-b-sky-500/40 relative overflow-hidden group">
                      <div className="text-4xl font-black text-sky-400 mb-1 relative z-10">{progress.stats.recordReviewed || 0}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-sky-500/80 relative z-10">Record Daily Reviewed</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Learning Insights */}
              {((trackingMode !== 'status' && (forgettingCount > 0 || bestStudyHour != null)) ||
                (trackingMode !== 'srs' && weakSpotCards.length > 0)) && (
                <div className="mb-12">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-brand-primary" />
                    Learning Insights
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {trackingMode !== 'status' && forgettingCount > 0 && (
                      <div className="bg-sky-500/5 rounded-2xl p-5 border border-sky-500/20">
                        <div className="text-2xl font-black text-sky-400 mb-1">{forgettingCount}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-sky-500/80">Cards due in 3 days</div>
                        <div className="text-xs text-brand-muted mt-1">Review soon to avoid forgetting</div>
                      </div>
                    )}
                    {trackingMode !== 'status' && bestStudyHour && (
                      <div className="bg-emerald-500/5 rounded-2xl p-5 border border-emerald-500/20">
                        <div className="text-2xl font-black text-emerald-400 mb-1">{formatStudyHour(bestStudyHour.hour)}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-500/80">Peak retention hour</div>
                        <div className="text-xs text-brand-muted mt-1">
                          {Math.round(bestStudyHour.accuracy * 100)}% accuracy over {bestStudyHour.sessions} sessions
                        </div>
                      </div>
                    )}
                  </div>
                  {trackingMode !== 'srs' && weakSpotCards.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted mb-3 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        Persistent Weak Spots
                      </div>
                      <div className="space-y-2">
                        {weakSpotCards.map(card => {
                          const accuracy = card.totalAnswers ? Math.round((card.totalCorrect ?? 0) / card.totalAnswers * 100) : null;
                          return (
                            <div key={card.id} className="flex items-center justify-between bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3 gap-4">
                              <p className="text-sm text-white/80 truncate flex-1">{card.front}</p>
                              <div className="flex items-center gap-3 shrink-0">
                                {accuracy !== null && (
                                  <span className={cn(
                                    "text-[10px] font-bold",
                                    accuracy < 40 ? "text-red-400" : accuracy < 70 ? "text-amber-400" : "text-emerald-400"
                                  )}>
                                    {accuracy}%
                                  </span>
                                )}
                                {(card.demotionCount ?? 0) >= 2 && (
                                  <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-bold whitespace-nowrap">
                                    {card.demotionCount}× demoted
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Blind Spot Matrix */}
              {blindSpotData && (
                <div className="mb-12">
                  <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    Blind Spot Matrix
                  </h3>
                  <p className="text-xs text-brand-muted mb-5">Speed vs. accuracy across {blindSpotData.classifiedCount} cards with enough data</p>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                      <div className="text-2xl font-black text-emerald-400">{blindSpotData.quadrants.fastCorrect.length}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-400/80 mt-0.5">Fluency</div>
                      <div className="text-[10px] text-brand-muted mt-1">Fast &amp; Correct</div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                      <div className="text-2xl font-black text-amber-400">{blindSpotData.quadrants.slowCorrect.length}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-amber-400/80 mt-0.5">Consolidating</div>
                      <div className="text-[10px] text-brand-muted mt-1">Slow &amp; Correct</div>
                    </div>
                    <div className={cn(
                      "border rounded-2xl p-4",
                      blindSpotData.quadrants.fastIncorrect.length > 0
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-white/5 border-white/10"
                    )}>
                      <div className={cn(
                        "text-2xl font-black",
                        blindSpotData.quadrants.fastIncorrect.length > 0 ? "text-red-400" : "text-white/40"
                      )}>{blindSpotData.quadrants.fastIncorrect.length}</div>
                      <div className={cn(
                        "text-[10px] font-bold tracking-widest uppercase mt-0.5",
                        blindSpotData.quadrants.fastIncorrect.length > 0 ? "text-red-400/80" : "text-brand-muted"
                      )}>Blind Spot ⚠</div>
                      <div className="text-[10px] text-brand-muted mt-1">Fast &amp; Incorrect</div>
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
                      <div className="text-2xl font-black text-orange-400">{blindSpotData.quadrants.slowIncorrect.length}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-orange-400/80 mt-0.5">Knowledge Gap</div>
                      <div className="text-[10px] text-brand-muted mt-1">Slow &amp; Incorrect</div>
                    </div>
                  </div>
                  {blindSpotData.quadrants.fastIncorrect.length > 0 && (
                    <div>
                      <button
                        onClick={() => setBlindSpotOpen(o => !o)}
                        className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-red-400 mb-3 hover:text-red-300 transition-colors"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        {blindSpotData.quadrants.fastIncorrect.length} blind spot card{blindSpotData.quadrants.fastIncorrect.length !== 1 ? 's' : ''} — answered quickly but incorrectly
                      </button>
                      {blindSpotOpen && (
                        <div className="space-y-2 mb-4">
                          {blindSpotData.quadrants.fastIncorrect.map(card => {
                            const accuracy = Math.round((card.totalCorrect ?? 0) / (card.totalAnswers ?? 1) * 100);
                            const times = (card as any).lastThreeNormalizedTimes ?? [];
                            const trend = times.length >= 2
                              ? times[times.length - 1] < times[0] * 0.9 ? '↑' : times[times.length - 1] > times[0] * 1.1 ? '↓' : ''
                              : '';
                            return (
                              <div key={card.id} className="flex items-center justify-between bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3 gap-4">
                                <p className="text-sm text-white/80 truncate flex-1">{card.front}</p>
                                <div className="flex items-center gap-2 shrink-0">
                                  {trend && (
                                    <span className={cn("text-xs font-bold", trend === '↑' ? 'text-emerald-400' : 'text-red-400')}>{trend}</span>
                                  )}
                                  <span className="text-[10px] font-bold text-red-400">{accuracy}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {blindSpotData.quadrants.slowIncorrect.length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => setKnowledgeGapOpen(o => !o)}
                        className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-orange-400 mb-3 hover:text-orange-300 transition-colors"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        {blindSpotData.quadrants.slowIncorrect.length} knowledge gap card{blindSpotData.quadrants.slowIncorrect.length !== 1 ? 's' : ''} — slow and incorrect
                      </button>
                      {knowledgeGapOpen && (
                        <div className="space-y-2 mb-4">
                          {blindSpotData.quadrants.slowIncorrect.map(card => {
                            const accuracy = Math.round((card.totalCorrect ?? 0) / (card.totalAnswers ?? 1) * 100);
                            return (
                              <div key={card.id} className="flex items-center justify-between bg-orange-500/5 border border-orange-500/10 rounded-xl px-4 py-3 gap-4">
                                <p className="text-sm text-white/80 truncate flex-1">{card.front}</p>
                                <span className="text-[10px] font-bold text-orange-400 shrink-0">{accuracy}%</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {blindSpotData.pendingCount > 0 && (
                    <p className="text-[10px] text-brand-muted/60">
                      {blindSpotData.pendingCount} card{blindSpotData.pendingCount !== 1 ? 's' : ''} not yet studied with timing data
                    </p>
                  )}
                </div>
              )}

              {/* Individual Islands */}
              <h3 className="text-lg font-bold mb-4">Island Breakdown</h3>
              <div className="space-y-4">
                {(progress?.islands || []).map(island => {
                  const mst = island.cards.filter(c => c.status === 'mastered').length;
                  const lrn = island.cards.filter(c => (!c.status && !c.needsWork) || c.status === 'learning').length;
                  const str = island.cards.filter(c => c.status === 'struggling' || c.needsWork).length;
                  return (
                    <div key={island.id} className="bg-black/40 rounded-2xl p-5 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="flex-1">
                        <h4 className="text-base font-bold mb-1">{island.name}</h4>
                        {trackingMode !== 'srs' && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden flex">
                              {island.cards.length > 0 && (
                                <>
                                  <div style={{ width: `${(mst / island.cards.length) * 100}%` }} className="h-full bg-emerald-500" />
                                  <div style={{ width: `${(lrn / island.cards.length) * 100}%` }} className="h-full bg-amber-500" />
                                  <div style={{ width: `${(str / island.cards.length) * 100}%` }} className="h-full bg-red-500" />
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {trackingMode !== 'srs' && (
                        <div className="flex gap-4 shrink-0">
                          <div className="text-center">
                            <div className="text-sm font-bold text-emerald-400">{mst}</div>
                            <div className="text-[9px] font-bold tracking-widest uppercase text-emerald-500/60">Mast</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-amber-400">{lrn}</div>
                            <div className="text-[9px] font-bold tracking-widest uppercase text-amber-500/60">Lrn</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-red-400">{str}</div>
                            <div className="text-[9px] font-bold tracking-widest uppercase text-red-500/60">Strg</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
