import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** 休闲游戏按钮：圆润、黏土质感，按下时整块下沉 */
const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full border font-fun font-bold transition-all duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-candy-sky/60 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border-candy-line bg-gradient-to-b from-[#5FD3F6] to-[#2BA9DA] text-candy-deep shadow-clay hover:brightness-[1.04]',
        steel: 'border-candy-line bg-white text-candy-ink shadow-clay-sm hover:border-candy-sky/60 hover:bg-cloud-50',
        ghost: 'border-transparent bg-transparent text-candy-muted hover:bg-cloud-100 hover:text-candy-ink',
        outline: 'border-candy-mint bg-candy-mint/18 text-[#1F8B58] hover:bg-candy-mint/30',
        danger: 'border-candy-berry/50 bg-candy-berry/15 text-[#CC4453] hover:bg-candy-berry/25',
      },
      size: {
        sm: 'h-9 px-3.5 text-[13px]',
        default: 'h-11 px-5 text-sm',
        lg: 'h-12 px-7 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'steel', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), 'active:translate-y-[3px] active:shadow-clay-pressed', className)}
      {...props}
    />
  ),
)
Button.displayName = 'Button'

export { buttonVariants }
