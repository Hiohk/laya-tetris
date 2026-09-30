import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

export function Slider({
  value,
  min,
  max,
  step,
  onValueChange,
  disabled = false,
  className,
}: {
  value: number
  min: number
  max: number
  step: number
  onValueChange: (value: number) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <SliderPrimitive.Root
      className={cn(
        'relative flex h-6 w-full cursor-pointer touch-none select-none items-center',
        disabled && 'cursor-not-allowed opacity-45',
        className,
      )}
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next[0])}
    >
      <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-cloud-200 shadow-[inset_0_2px_4px_rgba(30,58,95,0.12)]">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-gradient-to-r from-candy-sky to-[#2FB4DE]" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border border-candy-line bg-white shadow-clay-sm transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-candy-sky/50" />
    </SliderPrimitive.Root>
  )
}
