import { useEffect, useState } from 'react'
import { Play, RotateCcw, Trophy } from 'lucide-react'
import { useGameStore } from '@/store/useGameStore'
import { runtime } from '@/store/runtime'
import { formatNumber } from '@/lib/utils'
import { ControlBar } from '@/ui/ControlBar'
import { BoardCanvas } from '@/ui/BoardCanvas'
import { HudRow } from '@/ui/HudRow'
import { SidePanel } from '@/ui/SidePanel'
import { StatsPanel } from '@/ui/StatsPanel'
import { TouchControls } from '@/ui/TouchControls'
import { DecisionPanel } from '@/ui/DecisionPanel'
import { DecisionStageBar } from '@/ui/DecisionStageBar'
import { DecisionAnalytics } from '@/ui/DecisionAnalytics'
import { MoveTimeline } from '@/ui/MoveTimeline'
import { SettingsDialog } from '@/ui/SettingsDialog'
import { HelpDialog } from '@/ui/HelpDialog'

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    runtime.init()
    return () => runtime.dispose()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (event.key === 'p' || event.key === 'P') {
        runtime.togglePause()
        return
      }
      if (event.key === 'r' || event.key === 'R') {
        runtime.reset()
        return
      }
      if (useGameStore.getState().mode !== 'manual') return

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          runtime.manualMove(-1)
          break
        case 'ArrowRight':
          event.preventDefault()
          runtime.manualMove(1)
          break
        case 'ArrowDown':
          event.preventDefault()
          runtime.manualSoftDrop()
          break
        case 'ArrowUp':
        case 'x':
        case 'X':
          event.preventDefault()
          runtime.manualRotate(1)
          break
        case 'z':
        case 'Z':
        case 'Control':
          event.preventDefault()
          runtime.manualRotate(-1)
          break
        case ' ':
          event.preventDefault()
          runtime.manualHardDrop()
          break
        case 'c':
        case 'C':
        case 'Shift':
          event.preventDefault()
          runtime.manualHold()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="min-h-screen">
      <ControlBar onOpenSettings={() => setSettingsOpen(true)} onOpenHelp={() => setHelpOpen(true)} />

      <main className="mx-auto grid max-w-[1440px] gap-4 px-3 pb-10 pt-3 sm:px-4 lg:grid-cols-[minmax(400px,520px)_minmax(420px,1fr)] lg:items-start lg:gap-5">
        <section className="flex flex-col gap-3">
          <HudRow />

          <div className="panel p-3">
            <div className="flex gap-3">
              <div className="relative flex h-[54vh] min-h-[380px] flex-1 items-stretch lg:h-[min(70vh,640px)]">
                <BoardCanvas
                  onMove={(dx) => (dx < 0 ? runtime.manualMove(-1) : runtime.manualMove(1))}
                  onSoftDrop={() => runtime.manualSoftDrop()}
                  onRotate={() => runtime.manualRotate(1)}
                  onHardDrop={() => runtime.manualHardDrop()}
                />
                <BoardOverlay />
              </div>
              <SidePanel />
            </div>
          </div>

          <TouchControls
            onLeft={() => runtime.manualMove(-1)}
            onRight={() => runtime.manualMove(1)}
            onSoftDrop={() => runtime.manualSoftDrop()}
            onRotate={() => runtime.manualRotate(1)}
            onHardDrop={() => runtime.manualHardDrop()}
            onTogglePause={() => runtime.togglePause()}
          />

          <StatsPanel />

          <DecisionAnalytics />
        </section>

        <section className="flex flex-col gap-4">
          <DecisionStageBar />
          <DecisionPanel />
          <MoveTimeline />
        </section>
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}

/** 开局 / 暂停 / 结束遮罩，压在棋盘之上 */
function BoardOverlay() {
  const status = useGameStore((state) => state.status)
  const score = useGameStore((state) => state.stats.score)

  if (status === 'running') return null

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[18px] bg-white/72 backdrop-blur-md">
      {status === 'over' ? (
        <>
          <span className="label-key">本次成绩</span>
          <span className="font-fun text-[34px] font-bold leading-none text-candy-ink">{formatNumber(score)}</span>
          <button
            type="button"
            onClick={() => runtime.start()}
            className="clay-primary sheen relative mt-1 flex items-center gap-2 rounded-full px-6 py-3 font-fun text-sm font-bold"
          >
            <Trophy className="h-4 w-4" />
            再来一局
          </button>
        </>
      ) : (
        <>
          <span className="font-fun text-lg font-bold text-candy-ink">
            {status === 'paused' ? '已暂停' : '准备好了吗？'}
          </span>
          <span className="max-w-[190px] text-center text-[13px] leading-relaxed text-candy-muted">
            {status === 'paused'
              ? '点击继续，回到游戏。'
              : '点击开始，用手指滑动或底部按键操作方块，拼满整行就能消除。'}
          </span>
          <button
            type="button"
            onClick={() => runtime.start()}
            className="clay-primary sheen relative mt-1 flex items-center gap-2 rounded-full px-7 py-3 font-fun text-sm font-bold"
          >
            <Play className="h-4 w-4" />
            {status === 'paused' ? '继续游戏' : '开始游戏'}
          </button>
        </>
      )}
    </div>
  )
}
