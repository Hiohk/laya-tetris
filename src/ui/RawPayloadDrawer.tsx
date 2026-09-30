import { useState, type ReactNode } from 'react'
import { Code2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from './components/dialog'
import { Button } from './components/button'
import { prettyJson } from '@/lib/utils'

export function RawPayloadDrawer({
  title = '原始请求 / 响应',
  description,
  request,
  response,
  children,
}: {
  title?: string
  description?: string
  request: unknown
  response: unknown
  children?: ReactNode
}) {
  const [tab, setTab] = useState<'request' | 'response'>('request')

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="ghost" size="sm">
            <Code2 className="h-3.5 w-3.5" />
            原始 JSON
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={title} description={description}>
        <div className="mb-3 flex gap-2">
          <Button
            size="sm"
            variant={tab === 'request' ? 'outline' : 'steel'}
            onClick={() => setTab('request')}
          >
            请求体
          </Button>
          <Button
            size="sm"
            variant={tab === 'response' ? 'outline' : 'steel'}
            onClick={() => setTab('response')}
          >
            响应体
          </Button>
        </div>
        <pre className="max-h-[52vh] overflow-auto no-scrollbar rounded-[16px] border border-candy-line bg-cloud-100/90 p-4 font-mono text-[13px] leading-relaxed text-[#2AA46A]/90">
          {prettyJson(tab === 'request' ? request : response)}
        </pre>
      </DialogContent>
    </Dialog>
  )
}
