import React from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { ACADEMY_LESSONS } from '../../data/tutorials';
import type { TutorialLesson, WorkspaceAppMode } from '../../types/artStudio';

interface TutorialAcademyDrawerProps {
  open: boolean;
  onClose: () => void;
  activeApp: WorkspaceAppMode;
  onSwitchApp: (app: WorkspaceAppMode) => void;
  completedLessonIds: string[];
  onCompleteLesson: (lessonId: string) => void;
  onResetProgress: () => void;
  activeLessonId: string | null;
  activeStepIdx: number;
  onSelectLesson: (lessonId: string | null, stepIdx?: number) => void;
}

export const TutorialAcademyDrawer: React.FC<TutorialAcademyDrawerProps> = ({
  open,
  onClose,
  activeApp,
  onSwitchApp,
  completedLessonIds,
  onCompleteLesson,
  onResetProgress,
  activeLessonId,
  activeStepIdx,
  onSelectLesson,
}) => {
  const [filterApp, setFilterApp] = React.useState<'all' | WorkspaceAppMode>(activeApp);
  const [filterDifficulty, setFilterDifficulty] = React.useState<'All' | 'Beginner' | 'Advanced'>('All');

  React.useEffect(() => {
    setFilterApp(activeApp);
  }, [activeApp]);

  const activeLesson: TutorialLesson | undefined = ACADEMY_LESSONS.find(
    (l) => l.id === activeLessonId
  );

  // Highlight active targetTourId element gently without blocking clicks
  React.useEffect(() => {
    if (!activeLesson) return;
    const step = activeLesson.steps[activeStepIdx];
    if (!step?.targetTourId) return;
    const el = document.querySelector(`[data-tour-id="${step.targetTourId}"]`) as HTMLElement | null;
    if (!el) return;
    el.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2', 'ring-offset-[#111216]');
    return () => {
      el.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2', 'ring-offset-[#111216]');
    };
  }, [activeLesson, activeStepIdx]);

  const filtered = ACADEMY_LESSONS.filter((l) => {
    if (filterApp !== 'all' && l.app !== filterApp) return false;
    if (filterDifficulty !== 'All' && l.difficulty !== filterDifficulty) return false;
    return true;
  });

  const artCompleted = ACADEMY_LESSONS.filter(
    (l) => l.app === 'art_studio' && completedLessonIds.includes(l.id)
  ).length;
  const uiCompleted = ACADEMY_LESSONS.filter(
    (l) => l.app === 'ui_workshop' && completedLessonIds.includes(l.id)
  ).length;

  return (
    <>
      {/* Non-blocking Floating Step Coachbar when a lesson is active */}
      {activeLesson && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(94vw,540px)] rounded-xl border border-amber-500/40 bg-[#16181D]/95 backdrop-blur-md p-3.5 shadow-2xl text-xs"
          role="region"
          aria-label="Active tutorial step"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{activeLesson.title}</span>
                <span className="text-[10px] font-mono text-zinc-400">
                  Step {activeStepIdx + 1}/{activeLesson.steps.length}
                </span>
              </div>
              <div className="font-medium text-zinc-100">
                {activeLesson.steps[activeStepIdx]?.title}
              </div>
              <p className="text-zinc-300 leading-relaxed">
                {activeLesson.steps[activeStepIdx]?.instruction}
              </p>
              <div className="text-[11px] text-amber-300/90">
                Practice: {activeLesson.steps[activeStepIdx]?.actionHint}
              </div>
            </div>
            <button
              type="button"
              aria-label="Exit guided lesson"
              onClick={() => onSelectLesson(null)}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {activeLesson.app !== activeApp && (
                <button
                  type="button"
                  onClick={() => onSwitchApp(activeLesson.app)}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  Switch to {activeLesson.app === 'art_studio' ? 'Art Studio' : 'UI Workshop'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={activeStepIdx === 0}
                onClick={() => onSelectLesson(activeLesson.id, Math.max(0, activeStepIdx - 1))}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              {activeStepIdx < activeLesson.steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => onSelectLesson(activeLesson.id, activeStepIdx + 1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onCompleteLesson(activeLesson.id);
                    onSelectLesson(null);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Complete Lesson
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Academy Drawer */}
      {open && (
        <aside
          className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-zinc-800 bg-[#16181D] text-zinc-100 shadow-2xl flex flex-col"
          aria-label="Creative Ecosystem Tutorial Academy"
        >
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold">Interactive Academy</h2>
            </div>
            <button
              type="button"
              aria-label="Close Academy"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress Summary */}
          <div className="p-3.5 border-b border-zinc-800 bg-[#111318] space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-medium text-zinc-200">
                <Award className="w-4 h-4 text-amber-400" />
                {completedLessonIds.length} / {ACADEMY_LESSONS.length} Lessons Completed
              </span>
              {completedLessonIds.length > 0 && (
                <button
                  type="button"
                  onClick={onResetProgress}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                <div className="text-zinc-400">Art Studio</div>
                <div className="font-mono font-semibold text-emerald-400">{artCompleted} / 13</div>
              </div>
              <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                <div className="text-zinc-400">UI Workshop</div>
                <div className="font-mono font-semibold text-blue-400">{uiCompleted} / 10</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {(
                [
                  { id: 'art_studio', label: 'Art Studio (13)' },
                  { id: 'ui_workshop', label: 'UI Workshop (10)' },
                  { id: 'all', label: 'All (23)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterApp(tab.id)}
                  className={`px-2.5 py-1 rounded font-medium ${
                    filterApp === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <select
                aria-label="Filter difficulty"
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value as 'All' | 'Beginner' | 'Advanced')}
                className="ml-auto px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200"
              >
                <option value="All">All Levels</option>
                <option value="Beginner">Beginner</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>

          {/* Lessons List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
            {filtered.map((lesson) => {
              const done = completedLessonIds.includes(lesson.id);
              const isRunning = activeLessonId === lesson.id;
              return (
                <div
                  key={lesson.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    isRunning
                      ? 'border-amber-500 bg-amber-950/20'
                      : 'border-zinc-800 bg-[#111318] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-600 shrink-0" />
                        )}
                        <span className="font-semibold text-zinc-100">{lesson.title}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed pl-5">
                        {lesson.summary}
                      </p>
                      <div className="pl-5 flex items-center gap-2 text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-medium ${
                            lesson.app === 'art_studio'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                              : 'bg-blue-950 text-blue-300 border border-blue-800/50'
                          }`}
                        >
                          {lesson.app === 'art_studio' ? 'Art Studio' : 'UI Workshop'}
                        </span>
                        <span className="text-zinc-500">{lesson.difficulty}</span>
                        <span className="text-zinc-500">· {lesson.steps.length} steps</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (lesson.app !== activeApp) {
                          onSwitchApp(lesson.app);
                        }
                        onSelectLesson(lesson.id, 0);
                        onClose();
                      }}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium"
                    >
                      <Play className="w-3 h-3" />
                      {done ? 'Replay' : 'Start'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      )}
    </>
  );
};
