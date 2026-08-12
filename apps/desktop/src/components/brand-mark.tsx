import { useState } from 'react'

import { cn } from '@/lib/utils'

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

// Brand mark: just the Artemis PNG (already a squircle). No card chrome,
// border, or shadow - those made a white square "frame" around the logo.
export function BrandMark({ className, ...props }: React.ComponentProps<'span'>) {
  const [broken, setBroken] = useState(false)

  return (
    <span
      className={cn(
        'inline-flex aspect-square size-14 shrink-0 items-center justify-center overflow-hidden bg-transparent text-[0.64rem] font-semibold tracking-[0.16em] text-foreground shadow-none ring-0',
        className
      )}
      {...props}
    >
      {broken ? (
        'A'
      ) : (
        <img
          alt="Artemis"
          className="size-full object-contain drop-shadow-none"
          draggable={false}
          onError={() => setBroken(true)}
          src={assetPath('artemis.png')}
        />
      )}
    </span>
  )
}
