import { Keyboard, Network, ScrollText } from 'lucide-react'
import { Dialog, DialogContent } from './components/dialog'
import { Badge } from './components/badge'

const SHORTCUTS: Array<[string, string]> = [
  ['← / →', '左右平移'],
  ['↓', '软降（每格 +1 分）'],
  ['空格', '硬降并锁定'],
  ['↑ 或 X', '顺时针旋转'],
  ['Z 或 Ctrl', '逆时针旋转'],
  ['C 或 Shift', 'Hold 暂存 / 交换'],
  ['P', '暂停 / 继续'],
  ['R', '重置棋局'],
]

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="接入指引 · 协议速查 · 快捷键"
        description="本地 Laya 决策服务未开启 CORS 时，按下面第一种方案即可跑通，模型端零改动。"
      >
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.04em] text-[#2AA46A]">
            <Network className="h-3.5 w-3.5" /> 跨域（CORS）三种解法
          </h3>
          <ol className="space-y-2 text-[13px] leading-relaxed text-candy-muted">
            <li className="rounded-[12px] border border-candy-mint/25 bg-candy-mint/[0.06] p-3">
              <span className="font-semibold text-candy-ink">方案一（已内置，推荐）</span>：本工程在{' '}
              <code className="font-mono text-[#2AA46A]">vite.config.ts</code> 里把{' '}
              <code className="font-mono text-[#2AA46A]">/v1</code> 代理到{' '}
              <code className="font-mono text-[#2AA46A]">http://localhost:8000</code>。浏览器只访问同源
              <code className="font-mono text-[#2AA46A]"> /v1/systemone</code>，请求由 Vite 在 Node 层转发，
              不受同源策略限制。端口不同时在项目根目录建{' '}
              <code className="font-mono text-[#2AA46A]">.env.local</code> 写入{' '}
              <code className="font-mono text-[#2AA46A]">LAYA_TARGET=http://127.0.0.1:18110</code> 后重启 dev server。
            </li>
            <li className="rounded-[12px] border border-candy-line bg-cloud-50 p-3">
              <span className="font-semibold text-candy-ink">方案二</span>：给模型服务加 CORS 响应头。FastAPI 示例：
              <pre className="mt-1.5 overflow-x-auto no-scrollbar rounded-[16px] bg-cloud-100/90 p-2 font-mono text-[12px] text-[#2AA46A]">{`from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)`}</pre>
              之后把设置里的端点改成 <code className="font-mono text-[#2AA46A]">http://localhost:8000/v1/systemone</code> 直连即可。
            </li>
            <li className="rounded-[12px] border border-candy-line bg-cloud-50 p-3">
              <span className="font-semibold text-candy-ink">方案三（仅本地调试）</span>：用独立 Python 代理转发 /
              或以 <code className="font-mono text-[#2AA46A]">--disable-web-security</code> 启动 Chrome。后者会降低浏览器安全性，
              只建议临时使用。
            </li>
          </ol>
        </section>

        <section className="mt-5 space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.04em] text-[#6534B8]">
            <ScrollText className="h-3.5 w-3.5" /> 决策协议速查
          </h3>
          <div className="rounded-[12px] border border-candy-line bg-cloud-50 p-3 text-[13px] leading-relaxed text-candy-muted">
            <p>
              决策流程：枚举全部合法落点 → 启发式筛出 {`{N}`} 个候选 → 对每个候选并行 POST{' '}
              <code className="font-mono text-[#2AA46A]">/v1/systemone</code> → 取{' '}
              <code className="font-mono text-[#2AA46A]">answers.is_good_placement.noul</code> 最高的候落下；低于阈值则降级启发式。
            </p>
            <pre className="mt-2 overflow-x-auto no-scrollbar rounded-[16px] bg-cloud-100/90 p-2.5 font-mono text-[12px] leading-relaxed text-[#2AA46A]/90">{`{
  "model": "laya-multilingual-F16",
  "state": {
    "board": "..........\\n......##..\\n.#####.#..",
    "current_piece": "T",
    "next_pieces": ["I", "L"],
    "candidate_placement": "T 形以「尖朝上」的姿态落在第 4~6 列…",
    "board_metrics": { "lines_cleared": 1, "holes": 0,
      "max_height": 14, "bumpiness": 2, "well_depths": [...] }
  },
  "questions": {
    "is_good_placement": { "type": "noul", "instructions": "这个落点是一个好的落点吗？…" }
  }
}`}</pre>
            <p className="mt-2">
              响应取值路径固定为 <code className="font-mono text-[#2AA46A]">answers.is_good_placement.noul</code>（0~1），
              token 统计取 <code className="font-mono text-[#2AA46A]">usage.input_tokens</code>，路由说明取{' '}
              <code className="font-mono text-[#2AA46A]">routing.reason</code>。每张候选卡片右下角都能展开原始请求与响应核对。
            </p>
          </div>
        </section>

        <section className="mt-5 space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.04em] text-[#2AA46A]">
            <Keyboard className="h-3.5 w-3.5" /> 人工模式快捷键
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {SHORTCUTS.map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between rounded-[12px] border border-candy-line bg-cloud-50 px-3 py-2">
                <Badge tone="slate" className="font-mono lowercase tracking-normal">
                  {key}
                </Badge>
                <span className="text-[13px] text-candy-muted">{desc}</span>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-candy-muted">
            快捷键仅在「人工」模式下生效；切回「Laya 模型」后模型会立刻接管下一步决策，方便直观对比水平差异。
          </p>
        </section>

        <section className="mt-5 space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.04em] text-[#12708F]">
            <ScrollText className="h-3.5 w-3.5" /> 看清决策过程
          </h3>
          <div className="rounded-[12px] border border-candy-line bg-cloud-50 p-3 text-[13px] leading-relaxed text-candy-muted">
            <p>
              右侧「决策流程」链条会依次点亮五段：枚举落点 → 筛选候选 → 并行询问 → 选优判定 → 执行落子，每段都带真实数据。
              棋盘上被虚线框圈住的落点是模型最终选中项，其余浅色残影是落选候选，虚线引导线表示方块即将移动过去。
            </p>
            <p className="mt-2">
              落子被拆成「预览落点 → 旋转平移 → 悬停确认 → 硬降锁定」四段，节奏在
              <span className="text-candy-ink"> 设置 → 显示 </span>
              里调节，可直接用「演示节奏 / 标准 / 极速」预设切换；点「单步」会走完一个方块的完整链路后自动暂停。
            </p>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  )
}
