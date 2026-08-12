import type * as React from 'react'

import { cn } from '@/lib/utils'

interface SidebarPanelLabelProps extends React.ComponentProps<'span'> {
  dotClassName?: string
  icon?: React.ReactNode
}

export function SidebarPanelLabel({
  children,
  className,
  dotClassName,
  icon,
  ...props
}: SidebarPanelLabelProps) {
  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-(--theme-primary)',
        className
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="grid size-3.5 shrink-0 place-items-center text-current">
          {icon}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn('inline-block size-2 shrink-0 rounded-[1px] bg-current', dotClassName)}
        />
      )}
      <span className="min-w-0 truncate leading-none">{children}</span>
    </span>
  )
}
