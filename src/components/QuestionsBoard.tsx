import { useState, useEffect, FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, X, Globe, Users, Anchor, RefreshCw, Flag, ChevronUp, ChevronDown, Trash2, Check, MessageCircleQuestion, MessageSquare } from 'lucide-react';
import { useQuestions, type Question } from '../hooks/useQuestions';
import QuestionDetail from './QuestionDetail';

interface QuestionsBoardProps {
  onClose: () => void;
  currentUserId: string;
  ownedIslandIds: string[];
  friends: string[];
  initialTab?: 'all' | 'mine';
  initialQuestion?: Question;
}

type FeedTab = 'all' | 'friends' | 'my-islands' | 'mine';

export default function QuestionsBoard({ onClose, currentUserId, ownedIslandIds, friends, initialTab = 'all', initialQuestion }: QuestionsBoardProps) {
  const {
    feedQuestions, myQuestions,
    feedLoading, myQuestionsLoading,
    answers, answersLoading, comments,
    fetchFeed, fetchMyQuestions,
    loadAnswers, unsubscribeAnswers,
    voteAnswer, acceptAnswer,
    postAnswer, postComment, loadComments,
    updateVisibility, deleteQuestion,
    generateAIHintIfNeeded,
  } = useQuestions();

  const [activeTab, setActiveTab] = useState<FeedTab>(initialTab);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(initialQuestion ?? null);
  const [working, setWorking] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchFeed(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    if (activeTab === 'mine') {
      fetchMyQuestions(currentUserId);
    }
  }, [activeTab, currentUserId]);

  // Load answers when a question is opened; unsubscribe on close
  useEffect(() => {
    if (selectedQuestion) {
      loadAnswers(selectedQuestion.id);
    }
    return () => {
      if (selectedQuestion) unsubscribeAnswers(selectedQuestion.id);
    };
  }, [selectedQuestion?.id]);

  // Trigger AI hint for the first stale unanswered question in the feed (one per load cycle)
  useEffect(() => {
    const stale = feedQuestions.find(
      q => q.status === 'open' && q.answerCount === 0 && !q.aiHint &&
        Date.now() - (q.createdAt?.seconds ?? 0) * 1000 > 24 * 60 * 60 * 1000
    );
    if (stale) generateAIHintIfNeeded(stale);
  }, [feedQuestions]);

  const filteredFeed = feedQuestions.filter(q => {
    if (activeTab === 'friends') return friends.includes(q.askerId);
    if (activeTab === 'my-islands') return ownedIslandIds.includes(q.islandId);
    return true;
  });

  const handleVisibilitySwitch = async (question: Question) => {
    setWorking(prev => ({ ...prev, [question.id]: true }));
    const next: 'friends' | 'global' = question.visibility === 'friends' ? 'global' : 'friends';
    await updateVisibility(question.id, next, friends);
    setWorking(prev => ({ ...prev, [question.id]: false }));
  };

  const handleDelete = async (questionId: string) => {
    setWorking(prev => ({ ...prev, [questionId]: true }));
    await deleteQuestion(questionId);
  };

  const handleSelectQuestion = (question: Question) => {
    setSelectedQuestion(question);
  };

  const handleBack = () => {
    if (selectedQuestion) unsubscribeAnswers(selectedQuestion.id);
    setSelectedQuestion(null);
  };

  const isCurrentLoading = activeTab === 'mine' ? myQuestionsLoading : feedLoading;

  const tabs: { id: FeedTab; label: string; icon: typeof Globe }[] = [
    { id: 'all', label: 'All', icon: Globe },
    { id: 'friends', label: 'Crew', icon: Users },
    { id: 'my-islands', label: 'Islands', icon: Anchor },
    { id: 'mine', label: 'Mine', icon: Flag },
  ];

  const refresh = () => {
    if (activeTab === 'mine') fetchMyQuestions(currentUserId);
    else fetchFeed(currentUserId);
  };

  // If a question is selected, show detail view
  if (selectedQuestion) {
    return (
      <div className="flex flex-col h-full max-h-[85vh]">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
              <MessageCircleQuestion className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Community Q&A</h2>
              <p className="text-[11px] text-white/40">Help a fellow explorer</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <QuestionDetail
            question={selectedQuestion}
            currentUserId={currentUserId}
            answers={answers[selectedQuestion.id] ?? []}
            answersLoading={!!answersLoading[selectedQuestion.id]}
            comments={comments}
            onBack={handleBack}
            onVote={voteAnswer}
            onAccept={acceptAnswer}
            onPostAnswer={postAnswer}
            onPostComment={postComment}
            onLoadComments={loadComments}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
            <MessageCircleQuestion className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Community Q&A</h2>
            <p className="text-[11px] text-white/40">Help explorers who are stuck</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={isCurrentLoading}
            className="text-white/30 hover:text-white/70 transition-colors disabled:opacity-30"
          >
            <RefreshCw className={`w-4 h-4 ${isCurrentLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 shrink-0 bg-white/5 rounded-xl p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeTab === id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
            }`}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        {isCurrentLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* Mine tab */}
        {!isCurrentLoading && activeTab === 'mine' && (
          myQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
                <Flag className="w-7 h-7 text-orange-400/50" />
              </div>
              <p className="text-sm font-semibold text-white/40">No questions yet</p>
              <p className="text-xs text-white/25 mt-1">Ask the community from your study session</p>
            </div>
          ) : (
            <AnimatePresence>
              {myQuestions.map((q, idx) => (
                <MyQuestionCard
                  key={q.id}
                  question={q}
                  idx={idx}
                  working={!!working[q.id]}
                  onOpen={() => handleSelectQuestion(q)}
                  onSwitchVisibility={() => handleVisibilitySwitch(q)}
                  onDelete={() => handleDelete(q.id)}
                />
              ))}
            </AnimatePresence>
          )
        )}

        {/* Help-others tabs */}
        {!isCurrentLoading && activeTab !== 'mine' && (
          filteredFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
                <Radio className="w-7 h-7 text-orange-400/50" />
              </div>
              <p className="text-sm font-semibold text-white/40">All clear — no open questions</p>
              <p className="text-xs text-white/25 mt-1">When explorers need help, their questions appear here</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredFeed.map((q, idx) => (
                <motion.button
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => handleSelectQuestion(q)}
                  className="w-full p-4 rounded-2xl bg-white/5 border border-white/8 hover:border-white/15 hover:bg-white/8 transition-all text-left"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
                          {q.askerName}
                        </span>
                        {friends.includes(q.askerId) && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400/70 bg-blue-400/10 px-1.5 py-0.5 rounded-md">Crew</span>
                        )}
                        {ownedIslandIds.includes(q.islandId) && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/70 bg-emerald-400/10 px-1.5 py-0.5 rounded-md">Your Island</span>
                        )}
                        {q.status === 'answered' && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/70 bg-emerald-400/10 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Answered
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{q.frontText}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-[10px] text-white/30">
                      <MessageSquare className="w-3 h-3" />
                      {q.answerCount} answer{q.answerCount !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-white/30">
                      <ChevronUp className="w-3 h-3" />
                      {/* voteCount not on question — just show answer count for now */}
                      Click to view &amp; answer
                    </span>
                  </div>
                  {q.aiHint && (
                    <div className="mt-2 pt-2 border-t border-white/5 text-left pointer-events-none">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500/70 mb-0.5">AI Memory Hook</p>
                      <p className="text-[11px] text-amber-100/50 leading-snug italic">{q.aiHint}</p>
                    </div>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          )
        )}
      </div>
    </div>
  );
}

const MyQuestionCard: FC<{
  question: Question;
  idx: number;
  working: boolean;
  onOpen: () => void;
  onSwitchVisibility: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}> = ({ question, idx, working, onOpen, onSwitchVisibility, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isGlobal = question.visibility === 'global';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: idx * 0.04 }}
      className={`p-4 rounded-2xl border transition-colors ${
        question.status === 'answered'
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : question.status === 'expired'
          ? 'bg-white/3 border-white/5 opacity-60'
          : 'bg-white/5 border-white/8'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {question.status === 'answered' ? (
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">
            <Check className="w-2.5 h-2.5" /> Answered
          </span>
        ) : question.status === 'expired' ? (
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/30 bg-white/5 px-2 py-0.5 rounded-md">
            Closed
          </span>
        ) : (
          <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400/80 bg-orange-400/10 px-2 py-0.5 rounded-md">
            Open
          </span>
        )}
        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
          isGlobal ? 'text-blue-400/70 bg-blue-400/10' : 'text-white/40 bg-white/5'
        }`}>
          {isGlobal ? 'Coast Guard' : 'Crew only'}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/30 ml-auto">
          {question.answerCount} answer{question.answerCount !== 1 ? 's' : ''}
        </span>
      </div>

      <button
        onClick={onOpen}
        className="w-full text-left mb-3"
      >
        <p className="text-sm font-semibold text-white leading-snug hover:text-orange-200 transition-colors">{question.frontText}</p>
      </button>

      <div className="flex gap-2">
        {/* Open detail */}
        <button
          onClick={onOpen}
          className="flex-1 h-9 rounded-xl bg-orange-500/8 border border-orange-500/20 text-orange-400 hover:bg-orange-500/15 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
        >
          <MessageSquare className="w-3 h-3" /> View Answers
        </button>

        {/* Visibility toggle (only for open questions) */}
        {question.status === 'open' && (
          <button
            onClick={onSwitchVisibility}
            disabled={working}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isGlobal
                ? 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10'
                : 'border-orange-500/25 bg-orange-500/8 text-orange-400 hover:bg-orange-500/15'
            }`}
            title={isGlobal ? 'Switch to Crew' : 'Escalate to global'}
          >
            {isGlobal ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => { onDelete(); setConfirmDelete(false); }}
              disabled={working}
              className="h-9 px-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-40"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/70 text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={working}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 flex items-center justify-center transition-all disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
