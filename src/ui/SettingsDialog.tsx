import { Loader2, RotateCcw, Save } from 'lucide-react'
import { DEFAULT_SETTINGS, type AppSettings } from '@/ai/settings'
import { useGameStore } from '@/store/useGameStore'
import { runtime } from '@/store/runtime'
import { formatMs } from '@/lib/utils'
import { Dialog, DialogContent } from './components/dialog'
import { Button } from './components/button'
import { Switch } from './components/switch'
import { Slider } from './components/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-candy-line py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-candy-ink">{label}</div>
          {hint ? <div className="mt-0.5 text-[13px] leading-relaxed text-candy-muted">{hint}</div> : null}
        </div>
        {children}
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-[14px] border border-candy-line bg-white px-3 py-2 font-fun text-xs text-candy-ink shadow-[inset_0_2px_6px_rgba(30,58,95,0.08)] outline-none transition focus:border-candy-sky/60 focus:ring-2 focus:ring-candy-sky/25'

/** 一键切换落子节奏：演示版最慢，极速版几乎瞬间完成 */
const PACING_PRESETS: Array<{
  id: string
  label: string
  hint: string
  values: Pick<AppSettings, 'previewMs' | 'moveDelayMs' | 'hoverMs' | 'settleMs'>
}> = [
  {
    id: 'demo',
    label: '演示节奏',
    hint: '每段都拉长，适合讲解与录屏',
    values: { previewMs: 460, moveDelayMs: 200, hoverMs: 420, settleMs: 360 },
  },
  {
    id: 'standard',
    label: '标准',
    hint: '默认节奏，兼顾可读性与流畅度',
    values: { previewMs: 340, moveDelayMs: 150, hoverMs: 300, settleMs: 280 },
  },
  {
    id: 'turbo',
    label: '极速',
    hint: '几乎瞬间落子，适合压测与长跑',
    values: { previewMs: 0, moveDelayMs: 30, hoverMs: 0, settleMs: 0 },
  },
]

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const settings = useGameStore((state) => state.settings)
  const setSettings = useGameStore((state) => state.setSettings)
  const resetSettings = useGameStore((state) => state.resetSettings)
  const connection = useGameStore((state) => state.connection)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="游戏与模型设置"
        description="端点、决策参数与显示偏好都会保存在浏览器本地，刷新后继续生效。"
      >
        <Tabs defaultValue="connection">
          <TabsList className="mb-3">
            <TabsTrigger value="connection">连接</TabsTrigger>
            <TabsTrigger value="decision">决策</TabsTrigger>
            <TabsTrigger value="display">显示</TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="space-y-3">
            <Field label="模型端点" hint="默认走 Vite 代理的相对路径，也可填绝对地址直连（需服务端开启 CORS）">
              <span className="font-fun text-[12px] text-candy-muted">POST</span>
            </Field>
            <input
              className={inputClass}
              value={settings.endpoint}
              onChange={(event) => setSettings({ endpoint: event.target.value })}
              placeholder="/v1/systemone"
            />
            <div>
              <div className="text-xs font-semibold text-candy-ink">模型名</div>
              <input
                className={`${inputClass} mt-1.5`}
                value={settings.model}
                onChange={(event) => setSettings({ model: event.target.value })}
                placeholder="laya-multilingual-F16"
              />
            </div>
            <Field label="Mock 模式" hint="模型未启动时用模拟概率跑通全流程，便于演示与截图">
              <Switch checked={settings.useMock} onCheckedChange={(useMock) => setSettings({ useMock })} />
            </Field>
            <div className="flex items-center gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => void runtime.probeConnection()}>
                {connection.state === 'checking' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                测试连接
              </Button>
              <span
                className={`font-fun text-[13px] ${
                  connection.state === 'ok' ? 'text-[#1F8B58]' : connection.state === 'error' ? 'text-[#CC4453]' : 'text-candy-muted'
                }`}
              >
                {connection.message}
                {connection.latencyMs ? `（${formatMs(connection.latencyMs)}）` : ''}
              </span>
            </div>
          </TabsContent>

          <TabsContent value="decision" className="space-y-3">
            <Field label={`候选数量 · ${settings.candidateCount}`} hint="协议建议 4~8 个；每个候选一次并行请求">
              <div className="w-40">
                <Slider
                  value={settings.candidateCount}
                  min={4}
                  max={8}
                  step={1}
                  onValueChange={(candidateCount) => setSettings({ candidateCount })}
                />
              </div>
            </Field>
            <Field label={`并发上限 · ${settings.concurrency}`} hint="避免同时打爆本地单实例推理服务">
              <div className="w-40">
                <Slider
                  value={settings.concurrency}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={(concurrency) => setSettings({ concurrency })}
                />
              </div>
            </Field>
            <Field
              label={`单次超时 · ${settings.timeoutMs} ms`}
              hint={`本地 Laya 服务是串行推理（单个约 0.3s），${settings.candidateCount} 个候选排队后最后一个约 ${(
                settings.candidateCount * 0.35
              ).toFixed(1)}s。低于这个数会大面积超时并被误判成「模型不通」`}
            >
              <div className="w-40">
                <Slider
                  value={settings.timeoutMs}
                  min={500}
                  max={20000}
                  step={250}
                  onValueChange={(timeoutMs) => setSettings({ timeoutMs })}
                />
              </div>
            </Field>
            <Field label="允许启发式兜底" hint="关闭后完全由模型决策：直接采用 noul 最高的候选，不再看阈值；仅在全部请求失败时才降级">
              <Switch
                checked={settings.heuristicFallback}
                onCheckedChange={(heuristicFallback) => setSettings({ heuristicFallback })}
              />
            </Field>
            <Field
              label={`概率阈值 · ${settings.threshold.toFixed(2)}`}
              hint={
                settings.heuristicFallback
                  ? '最高 noul 低于该值时，按协议降级为启发式最优落点并在界面标注'
                  : '已关闭启发式兜底，该阈值当前不生效'
              }
            >
              <div className="w-40">
                <Slider
                  value={settings.threshold}
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={!settings.heuristicFallback}
                  onValueChange={(threshold) => setSettings({ threshold })}
                />
              </div>
            </Field>
            <Field label="棋盘行序翻转" hint="协议文档存在冲突：默认第一行为最顶行，若你的服务相反可打开此开关">
              <Switch checked={settings.flipBoardRows} onCheckedChange={(flipBoardRows) => setSettings({ flipBoardRows })} />
            </Field>
            <Field label="思考期间冻结重力" hint="避免模型还在推理时方块自己下落触发锁定">
              <Switch
                checked={settings.freezeWhileThinking}
                onCheckedChange={(freezeWhileThinking) => setSettings({ freezeWhileThinking })}
              />
            </Field>
            <div>
              <div className="text-xs font-semibold text-candy-ink">noul 问题的评判标准</div>
              <textarea
                className={`${inputClass} mt-1.5 h-20 resize-none leading-relaxed`}
                value={settings.instructions}
                onChange={(event) => setSettings({ instructions: event.target.value })}
              />
            </div>
          </TabsContent>

          <TabsContent value="display" className="space-y-3">
            <div className="rounded-[16px] border border-candy-line bg-cloud-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-candy-ink">落子演示节奏</span>
                <div className="flex gap-1.5">
                  {PACING_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      size="sm"
                      variant="steel"
                      onClick={() => setSettings(preset.values)}
                      title={preset.hint}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-candy-muted">
                落子被拆成四段：先预览目标落点，再旋转平移，接着悬停核对幽灵块，最后硬降。时间都调大就能把每一步看清楚。
              </p>
            </div>

            <Field label={`① 落点预览停留 · ${settings.previewMs} ms`} hint="决策完成后先高亮目标落点，方块暂不移动">
              <div className="w-40">
                <Slider
                  value={settings.previewMs}
                  min={0}
                  max={1200}
                  step={20}
                  onValueChange={(previewMs) => setSettings({ previewMs })}
                />
              </div>
            </Field>
            <Field label={`② 移动步进间隔 · ${settings.moveDelayMs} ms`} hint="每次旋转或平移之间的间隔，越大动作越慢越清楚">
              <div className="w-40">
                <Slider
                  value={settings.moveDelayMs}
                  min={30}
                  max={400}
                  step={10}
                  onValueChange={(moveDelayMs) => setSettings({ moveDelayMs })}
                />
              </div>
            </Field>
            <Field label={`③ 落子前悬停 · ${settings.hoverMs} ms`} hint="对齐落点后停一下，方便对比幽灵块与目标虚线框">
              <div className="w-40">
                <Slider
                  value={settings.hoverMs}
                  min={0}
                  max={1200}
                  step={20}
                  onValueChange={(hoverMs) => setSettings({ hoverMs })}
                />
              </div>
            </Field>
            <Field label={`④ 落定观察窗口 · ${settings.settleMs} ms`} hint="硬降后的停留，避免下一条决策盖掉消行闪光">
              <div className="w-40">
                <Slider
                  value={settings.settleMs}
                  min={0}
                  max={1000}
                  step={20}
                  onValueChange={(settleMs) => setSettings({ settleMs })}
                />
              </div>
            </Field>
            <Field label="叠加候选落点预览" hint="在棋盘上用半透明方块标出所有候选位置">
              <Switch
                checked={settings.showCandidateOverlay}
                onCheckedChange={(showCandidateOverlay) => setSettings({ showCandidateOverlay })}
              />
            </Field>
            <Field label="启动后自动开始" hint="刷新页面后直接进入自动对战">
              <Switch checked={settings.autoStart} onCheckedChange={(autoStart) => setSettings({ autoStart })} />
            </Field>
            <div className="pt-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  resetSettings()
                  runtime.onModeChanged()
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                恢复默认配置
              </Button>
              <span className="ml-2 font-fun text-[12px] text-candy-muted">
                默认候选 {DEFAULT_SETTINGS.candidateCount} 个 · 阈值 {DEFAULT_SETTINGS.threshold}
              </span>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
