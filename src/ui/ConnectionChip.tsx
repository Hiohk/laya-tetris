import { Loader2, PlugZap, TriangleAlert } from 'lucide-react'
import { runtime } from '@/store/runtime'
import { useGameStore } from '@/store/useGameStore'
import { formatMs } from '@/lib/utils'

export function ConnectionChip() {
  const connection = useGameStore((state) => state.connection)
  const settings = useGameStore((state) => state.settings)

  const tone =
    connection.state === 'ok'
      ? 'border-candy-mint/50 bg-candy-mint/18 text-[#2AA46A]'
      : connection.state === 'error'
        ? 'border-candy-berry/50 bg-candy-berry/16 text-[#D9505F]'
        : 'border-candy-line bg-cloud-50 text-candy-muted'

  const label = settings.useMock
    ? 'Mock 模式'
    : connection.state === 'checking'
      ? '检测中'
      : connection.state === 'ok'
        ? `已连接 ${formatMs(connection.latencyMs)}`
        : connection.state === 'error'
          ? '连接异常'
          : '点此检测连接'

  return (
    <button
      type="button"
      onClick={() => void runtime.probeConnection()}
      title={connection.message}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-fun text-[13px] font-bold transition hover:brightness-110 ${tone}`}
    >
      {connection.state === 'checking' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : connection.state === 'error' ? (
        <TriangleAlert className="h-3.5 w-3.5" />
      ) : (
        <PlugZap className="h-3.5 w-3.5" />
      )}
      <span className="max-w-[180px] truncate">{label}</span>
    </button>
  )
}
