import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  className,
  children,
  title,
  description,
}: {
  className?: string
  children: React.ReactNode
  title: string
  description?: string
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#2b4a70]/25 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(92vw,660px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[26px] border border-candy-line bg-cloud-50 shadow-lite backdrop-blur-2xl focus:outline-none',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-candy-line px-5 py-4">
          <div>
            <DialogPrimitive.Title className="font-fun text-base font-bold text-candy-ink">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-xs leading-relaxed text-candy-muted">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close className="rounded-full border border-candy-line bg-white p-2 text-candy-muted shadow-clay-sm transition hover:text-candy-ink active:translate-y-[2px]">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="max-h-[calc(88vh-84px)] overflow-y-auto no-scrollbar px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
