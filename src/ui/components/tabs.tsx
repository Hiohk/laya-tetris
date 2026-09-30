import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root
export const TabsContent = TabsPrimitive.Content

export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-full border border-candy-line bg-cloud-50 p-1',
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        // inline-flex 是关键：svg 在 Tailwind preflight 里是 display:block，缺了它图标会被顶到文字上一行
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-3.5 py-2 font-fun text-[13px] font-bold text-candy-muted transition-all duration-150',
        'hover:bg-white hover:text-candy-ink',
        'data-[state=active]:border-candy-line data-[state=active]:bg-gradient-to-b data-[state=active]:from-[#5FD3F6] data-[state=active]:to-[#2BA9DA] data-[state=active]:text-candy-deep data-[state=active]:shadow-clay-sm',
        className,
      )}
      {...props}
    />
  )
}
