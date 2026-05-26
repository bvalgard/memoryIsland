import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ChevronUp, Check, MessageSquare, Send, Loader2, ChevronDown } from 'lucide-react';
import { type Question, type Answer } from '../hooks/useQuestions';

interface QuestionDetailProps {
  question: Question;
  currentUserId: string;
  answers: Answer[];
  answersLoading: boolean;
  comments: Record<string, import('../hooks/useQuestions').Comment[]>;
  onBack: () => void;
  onVote: (questionId: string, answerId: string, currentUpvoterIds: Record<string, true>, helperId?: string) => Promise<void>;
  onAccept: (question: Question, answerId: string, helperId: string) => Promise<void>;
  onPostAnswer: (questionId: string, bodyText: string) => Promise<string | null>;
  onPostComment: (questionId: string, answerId: string, bodyText: string) => Promise<void>;
  onLoadComments: (questionId: string, answerId: string) => Promise<void>;
}

export default function QuestionDetail({
  question,
  currentUserId,
  answers,
  answersLoading,
  comments,
  onBack,
  onVote,
  onAccept,
  onPostAnswer,
  onPostComment,
  onLoadComments,
}: QuestionDetailProps) {
  const [answerText, setAnswerText] = useState('');
  const [postingAnswer, setPostingAnswer] = useState(false);
  const [answerPosted, setAnswerPosted] = useState(false);
  const [showFullCard, setShowFullCard] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState<Record<string, boolean>>({});
  const [voting, setVoting] = useState<Record<string, boolean>>({});
  const [accepting, setAccepting] = useState(false);
  const [selectingAnswer, setSelectingAnswer] = useState(false);

  const isAsker = currentUserId === question.askerId;

  const handlePostAnswer = async () => {
    const trimmed = answerText.trim();
    if (!trimmed || postingAnswer) return;
    setPostingAnswer(true);
    await onPostAnswer(question.id, trimmed);
    setAnswerText('');
    setAnswerPosted(true);
    setPostingAnswer(false);
  };

  const handleVote = async (answer: Answer) => {
    if (voting[answer.id]) return;
    setVoting(prev => ({ ...prev, [answer.id]: true }));
    await onVote(question.id, answer.id, answer.upvoterIds, answer.helperId);
    setVoting(prev => ({ ...prev, [answer.id]: false }));
  };

  const handleAccept = async (answer: Answer) => {
    if (accepting) return;
    setAccepting(true);
    await onAccept(question, answer.id, answer.helperId);
    setSelectingAnswer(false);
    setAccepting(false);
  };

  const toggleComments = async (answerId: string) => {
    const next = new Set(expandedComments);
    if (next.has(answerId)) {
      next.delete(answerId);
    } else {
      next.add(answerId);
      if (!comments[answerId]) {
        await onLoadComments(question.id, answerId);
      }
    }
    setExpandedComments(next);
  };

  const handlePostComment = async (answerId: string) => {
    const text = commentInputs[answerId]?.trim();
    if (!text) return;
    setPostingComment(prev => ({ ...prev, [answerId]: true }));
    await onPostComment(question.id, answerId, text);
    setCommentInputs(prev => ({ ...prev, [answerId]: '' }));
    await onLoadComments(question.id, answerId);
    setPostingComment(prev => ({ ...prev, [answerId]: false }));
  };

  const cardTypeLabel: Record<string, string> = {
    flashcard: 'Flashcard',
    mcq: 'Multiple Choice',
    'fill-in-the-blank': 'Fill in the Blank',
    'multi-select': 'Multi-Select',
    sequencing: 'Sequencing',
    matching: 'Matching',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button
          onClick={onBack}
          className="text-white/40 hover:text-white/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
            {question.askerName}
          </span>
          <div className="flex items-center gap-2">
            {question.status === 'answered' ? (
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md flex items-center gap-1">
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
            {question.cardType && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/30 bg-white/5 px-2 py-0.5 rounded-md">
                {cardTypeLabel[question.cardType] ?? question.cardType}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card context */}
      <button
        onClick={() => setShowFullCard(v => !v)}
        className="shrink-0 mb-4 p-4 rounded-2xl bg-white/5 border border-white/8 hover:border-white/15 hover:bg-white/8 transition-all text-left w-full"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-semibold text-white leading-snug flex-1">{question.frontText}</p>
          <div className="shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-white/30 mt-0.5">
            {showFullCard ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            <span>{showFullCard ? 'Hide' : 'View card'}</span>
          </div>
        </div>
        {question.backText && !showFullCard && (
          <div className="pt-2 border-t border-white/8">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/30 block mb-0.5">Answer</span>
            <p className="text-xs text-white/60 leading-snug">{question.backText}</p>
          </div>
        )}
        {showFullCard && (
          <div className="pt-2 border-t border-white/8 space-y-2">
            {/* All options for MCQ/multi-select */}
            {question.options && question.options.length > 0 ? (
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/30 block mb-1.5">All Choices</span>
                <div className="space-y-1.5">
                  {question.options.map((opt, i) => {
                    const isCorrect = opt === question.backText;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs leading-snug ${
                          isCorrect
                            ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300'
                            : 'bg-white/4 border border-white/6 text-white/50'
                        }`}
                      >
                        {isCorrect && <Check className="w-3 h-3 shrink-0 text-emerald-400" />}
                        {!isCorrect && <span className="w-3 h-3 shrink-0" />}
                        {opt}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : question.backText ? (
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/30 block mb-0.5">Answer</span>
                <p className="text-xs text-emerald-300 leading-snug">{question.backText}</p>
              </div>
            ) : null}
          </div>
        )}
      </button>

      {/* Asker's note */}
      {question.note && (
        <div className="shrink-0 mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1">What's confusing them</p>
          <p className="text-xs text-white/60 leading-relaxed">{question.note}</p>
        </div>
      )}

      {/* AI hint — shown when no crew answers yet and hint exists */}
      {question.aiHint && question.answerCount === 0 && (
        <div className="shrink-0 mb-4 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500/70 mb-1">AI Memory Hook — no crew answers yet</p>
          <p className="text-xs text-amber-100/60 leading-relaxed italic">{question.aiHint}</p>
        </div>
      )}

      {/* Answers */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
        {answersLoading && answers.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
          </div>
        )}

        {!answersLoading && answers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm font-semibold text-white/30">No answers yet</p>
            <p className="text-xs text-white/20 mt-1">Be the first to help</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {answers.map((answer, idx) => {
            const hasVoted = currentUserId in answer.upvoterIds;
            const isAccepted = answer.isAccepted;
            const answerComments = comments[answer.id] ?? [];
            const commentsOpen = expandedComments.has(answer.id);

            return (
              <motion.div
                key={answer.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`rounded-2xl border p-4 ${
                  isAccepted
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-white/5 border-white/8'
                }`}
              >
                <div className="flex gap-3">
                  {/* Vote column */}
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                    <button
                      onClick={() => handleVote(answer)}
                      disabled={!!voting[answer.id] || currentUserId === answer.helperId}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all disabled:cursor-not-allowed ${
                        hasVoted
                          ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                          : 'bg-white/5 border-white/10 text-white/30 hover:text-orange-400 hover:border-orange-500/30 hover:bg-orange-500/10 disabled:opacity-40'
                      }`}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <span className={`text-xs font-bold tabular-nums ${
                      answer.voteCount > 0 ? 'text-white/70' : 'text-white/25'
                    }`}>
                      {answer.voteCount}
                    </span>
                    {isAccepted && (
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mt-1" title="Accepted answer">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                    )}
                  </div>

                  {/* Answer body */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 block mb-1.5">
                      {answer.helperName}
                    </span>
                    <p className="text-sm text-white/80 leading-relaxed">{answer.bodyText}</p>

                    {/* Comment action only */}
                    <div className="flex items-center gap-3 mt-2.5">
                      <button
                        onClick={() => toggleComments(answer.id)}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        {answerComments.length > 0 ? answerComments.length : ''} Comment{answerComments.length !== 1 ? 's' : ''}
                      </button>
                    </div>

                    {/* Comments thread */}
                    {commentsOpen && (
                      <div className="mt-3 space-y-2 pl-3 border-l border-white/8">
                        {answerComments.map(c => (
                          <div key={c.id} className="text-xs">
                            <span className="font-semibold text-white/50">{c.authorName}: </span>
                            <span className="text-white/40">{c.bodyText}</span>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            placeholder="Add a comment…"
                            value={commentInputs[answer.id] || ''}
                            onChange={e => setCommentInputs(prev => ({ ...prev, [answer.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handlePostComment(answer.id); }}
                            className="flex-1 bg-white/5 border border-white/8 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-white/20"
                          />
                          <button
                            disabled={!commentInputs[answer.id]?.trim() || postingComment[answer.id]}
                            onClick={() => handlePostComment(answer.id)}
                            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/70 flex items-center justify-center transition-all disabled:opacity-30"
                          >
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Consolidated "Did any of these help?" — shown to asker when question is still open and there are answers */}
        {isAsker && question.status === 'open' && answers.length > 0 && (
          <div className="pt-3 mt-1 border-t border-white/8 shrink-0">
            {!selectingAnswer ? (
              <button
                onClick={() => setSelectingAnswer(true)}
                className="w-full h-9 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
              >
                <Check className="w-3 h-3" /> Did any of these help?
              </button>
            ) : (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2">Which answer helped you most?</p>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {answers.map(answer => (
                    <button
                      key={answer.id}
                      disabled={accepting}
                      onClick={() => handleAccept(answer)}
                      className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all disabled:opacity-40"
                    >
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 block mb-0.5">
                        {answer.helperName}
                      </span>
                      <p className="text-xs text-white/70 leading-snug line-clamp-2">{answer.bodyText}</p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSelectingAnswer(false)}
                  className="mt-2 w-full text-center text-[10px] text-white/25 hover:text-white/50 font-bold uppercase tracking-widest py-1 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Post answer — only for non-askers on open questions */}
        {!isAsker && question.status === 'open' && !answerPosted && (
          <div className="pt-2 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Your Answer</p>
            <textarea
              placeholder="Share a memory trick or mnemonic…"
              value={answerText}
              onChange={e => setAnswerText(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-orange-500/40 resize-none"
            />
            <button
              disabled={!answerText.trim() || postingAnswer}
              onClick={handlePostAnswer}
              className="mt-2 w-full h-9 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-400 hover:bg-orange-500/25 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {postingAnswer ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Post Answer
            </button>
          </div>
        )}

        {answerPosted && (
          <p className="text-center text-[10px] text-emerald-400/70 font-bold uppercase tracking-widest py-3">
            🛟 Answer posted!
          </p>
        )}
      </div>
    </div>
  );
}
