import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** 圆润的糖果小标签：字号与颜色都保证可读 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-fun text-[12px] font-bold',
  {
    variants: {
      tone: {
        cyan: 'border-candy-sky/50 bg-candy-sky/20 text-[#12708F]',
        violet: 'border-candy-grape/50 bg-candy-grape/20 text-[#6534B8]',
        mint: 'border-candy-mint/60 bg-candy-mint/22 text-[#1F8B58]',
        amber: 'border-candy-lemon/70 bg-candy-lemon/28 text-[#96650A]',
        rose: 'border-candy-berry/55 bg-candy-berry/18 text-[#CC4453]',
        slate: 'border-candy-line bg-cloud-50 text-candy-muted',
      },
    },
    defaultVariants: { tone: 'slate' },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { badgeVariants }
