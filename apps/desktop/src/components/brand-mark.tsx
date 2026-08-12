import { useState } from 'react'

import { cn } from '@/lib/utils'

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

// Brand badge: Artemis mark on a dark tile. Size via className (default size-14).
export function BrandMark({ className, ...props }: React.ComponentProps<'span'>) {
  const [broken, setBroken] = useState(false)

  return (
    <span
      className={cn(
        'inline-flex aspect-square size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-transparent text-[0.64rem] font-semibold tracking-[0.16em] text-foreground',
        className
      )}
      {...props}
    >
      {broken ? (
        'A'
      ) : (
        <img
          alt="Artemis"
          className="size-full object-contain"
          onError={() => setBroken(true)}
          src={assetPath('artemis.png')}
        />
      )}
    </span>
  )
}
