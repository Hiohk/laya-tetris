import { CircleHelp, Gauge, Pause, Play, RotateCcw, Settings2, SkipForward } from 'lucide-react'
import { PIECE_SKINS } from '@/core/constants'
import { useGameStore, type DriveMode } from '@/store/useGameStore'
import { runtime } from '@/store/runtime'
import { cn } from '@/lib/utils'
import { Button } from './components/button'
import { Slider } from './components/slider'
import { ConnectionChip } from './ConnectionChip'

const MODES: Array<{ id: DriveMode; label: string; hint: string }> = [
  { id: 'laya', label: 'Laya 模型', hint: '枚举候选 → 并行询问模型 → 取 noul 最高' },
  { id: 'heuristic', label: '启发式', hint: '纯 Dellacherie 特征评分，不联网' },
  { id: 'manual', label: '人工', hint: '方向键 / 触控操作，可随时切回 AI 对比' },
]

const STATUS_META: Record<string, { label: string; color: string }> = {
  ready: { label: '待机', color: '#6B8AAE' },
  running: { label: '运行中', color: '#4FD98B' },
  paused: { label: '已暂停', color: '#FFC93C' },
  over: { label: '已结束', color: '#FF7A8A' },
}

/** 像素化的 2×2 糖果方块标识 */
function BrandMark() {
  const cells = [PIECE_SKINS.T, PIECE_SKINS.O, PIECE_SKINS.S, PIECE_SKINS.J]
  return (
    <span className="grid h-10 w-10 shrink-0 grid-cols-2 grid-rows-2 gap-[2px] rounded-[12px] border border-candy-line bg-white p-[3px] shadow-clay-sm">
      {cells.map((skin, index) => (
        <span
          key={index}
          className="rounded-[3px]"
          style={{ background: skin.base, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)' }}
        />
      ))}
    </span>
  )
}

export function ControlBar({
  onOpenSettings,
  onOpenHelp,
}: {
  onOpenSettings: () => void
  onOpenHelp: () => void
}) {
  const mode = useGameStore((state) => state.mode)
  const setMode = useGameStore((state) => state.setMode)
  const status = useGameStore((state) => state.status)
  const thinking = useGameStore((state) => state.thinking)
  const settings = useGameStore((state) => state.settings)
  const setSettings = useGameStore((state) => state.setSettings)

  const meta = thinking ? { label: '思考中', color: '#3EC7F0' } : STATUS_META[status] ?? STATUS_META.ready

  const switchMode = (next: DriveMode) => {
    if (next !== mode) {
      setMode(next)
      runtime.onModeChanged()
    }
    // 点模式即接管：待机直接开局、暂停继续、已结束重开一局（点当前模式也会开局）
    if (useGameStore.getState().status !== 'running') runtime.start()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-candy-line bg-white/72 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2.5 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <div>
            <h1 className="font-fun text-base font-bold leading-none text-candy-ink">
              Laya<span className="text-[#12708F]">Tetris</span>
            </h1>
            <p className="mt-1 text-[12px] text-candy-muted">基于 Laya 决策模型的俄罗斯方块</p>
          </div>
        </div>

        <span className="flex items-center gap-2 rounded-full border border-candy-line bg-cloud-50 px-3 py-1.5">
          <span
            className={cn('h-2.5 w-2.5 rounded-full', thinking && 'animate-blink')}
            style={{ background: meta.color }}
            aria-hidden
          />
          <span className="font-fun text-[13px] font-bold" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </span>

        <div className="flex items-center gap-1 rounded-full border border-candy-line bg-cloud-50 p-1">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.hint}
              onClick={() => switchMode(item.id)}
              className={cn(
                'rounded-full px-3 py-1.5 font-fun text-[13px] font-bold transition-all duration-100',
                mode === item.id
                  ? 'bg-gradient-to-b from-candy-sky to-[#2FB4DE] text-candy-deep shadow-clay-sm'
                  : 'text-candy-muted hover:text-candy-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ConnectionChip />

          <div className="hidden items-center gap-2 rounded-full border border-candy-line bg-cloud-50 px-3 py-1.5 sm:flex">
            <Gauge className="h-3.5 w-3.5 text-[#12708F]" />
            <span className="font-fun text-[13px] font-bold text-candy-ink">{settings.speedScale.toFixed(0)}×</span>
            <div className="w-20">
              <Slider
                value={settings.speedScale}
                min={1}
                max={20}
                step={1}
                onValueChange={(speedScale) => setSettings({ speedScale })}
              />
            </div>
          </div>

          <Button
            variant={status === 'running' ? 'steel' : 'default'}
            onClick={() => (status === 'running' ? runtime.pause() : runtime.start())}
          >
            {status === 'running' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {status === 'running' ? '暂停' : status === 'paused' ? '继续' : '开始'}
          </Button>
          <Button
            variant="steel"
            className="hidden md:inline-flex"
            onClick={() => runtime.stepOnce()}
            disabled={thinking}
            title="完整走完一个方块的决策链路后自动暂停"
          >
            <SkipForward className="h-4 w-4" />
            单步
          </Button>
          <Button variant="steel" size="icon" onClick={() => runtime.reset()} title="重置棋局">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="steel" size="icon" onClick={onOpenSettings} title="设置">
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button variant="steel" size="icon" onClick={onOpenHelp} title="接入指引与快捷键">
            <CircleHelp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
