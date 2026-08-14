import { type ComponentProps, type CSSProperties } from 'react'

import { cn } from '@/lib/utils'

export const BRAND_WORDMARK = 'ARTEMIS'

/** Collapse face from styles.css `.brand-wordmark`. Do not use `font-*`
 *  utilities here: tailwind-merge treats `font-['Collapse']` and `font-bold`
 *  as the same group and drops the face. */
export const BRAND_WORDMARK_CLASS = 'brand-wordmark'

/** Chat empty-state: blend against the themed surface. */
export const BRAND_WORDMARK_BLEND_CLASS =
  'text-midground mix-blend-plus-lighter dark:text-foreground/90'

export function BrandWordmark({
  blend = true,
  className,
  style,
  ...props
}: ComponentProps<'p'> & { blend?: boolean }) {
  return (
    <p
      aria-label={BRAND_WORDMARK}
      className={cn(
        BRAND_WORDMARK_CLASS,
        blend ? BRAND_WORDMARK_BLEND_CLASS : 'text-foreground',
        className
      )}
      style={style as CSSProperties}
      {...props}
    >
      {BRAND_WORDMARK}
    </p>
  )
}
