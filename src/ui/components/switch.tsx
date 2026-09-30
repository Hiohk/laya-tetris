import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

/** 圆润的糖果拨杆 */
export function Switch({
  checked,
  onCheckedChange,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        'relative h-7 w-12 shrink-0 cursor-pointer rounded-full border border-candy-line shadow-clay-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-candy-sky/50',
        checked ? 'bg-gradient-to-b from-candy-mint to-[#2FB86C]' : 'bg-cloud-200',
        className,
      )}
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-[3px] rounded-full border border-candy-line bg-white shadow-lite-sm transition-transform duration-150 data-[state=checked]:translate-x-[26px]" />
    </SwitchPrimitive.Root>
  )
}
