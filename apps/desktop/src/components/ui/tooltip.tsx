import { Tooltip as TooltipPrimitive } from 'radix-ui'
import * as React from 'react'

import { useI18n } from '@/i18n'
import { type InputModality, lastInputModality } from '@/lib/input-modality'
import { useKeybindHint } from '@/lib/keybinds/use-keybind-hint'
import { cn } from '@/lib/utils'

/** Default hover-open delay for `Tip`. Non-zero so a cursor sweeping across the
 *  chrome doesn't flash a trail of tips — they only appear on a deliberate,
 *  settled hover. Call sites that need an instant tip pass `delayDuration={0}`. */
const TIP_DELAY_MS = 200

/** True inside `RootTooltipProvider`. `Tip` uses this to decide whether it
 *  needs to supply its own provider — see the note on `Tip`. */
const HasTooltipProvider = React.createContext(false)

function TooltipProvider({
  delayDuration = 0,
  // Radix's "skip" grace: after one tip opens, every trigger touched within
  // this window opens INSTANTLY, delay bypassed. Its 300ms default meant a
  // cursor sweeping the chrome still flashed a trail of tips despite the
  // hover delay. Zero it so each tip independently honors `delayDuration`.
  skipDelayDuration = 0,
  // Tips are labels, not interactive surfaces. Hoverable content + Radix's
  // pointer-grace bridge is what leaves tips stuck open — especially over
  // Electron `-webkit-app-region: drag` chrome where pointermove never fires
  // to clear the grace area. Default off so open state tracks the trigger only.
  disableHoverableContent = true,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      disableHoverableContent={disableHoverableContent}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  )
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

// Radix opens a tooltip on ANY trigger focus (its pointer-down guard only
// covers clicks on the trigger itself). Menus and dialogs return focus to
// their trigger when they close, so "open the model menu, pick a model" left
// the trigger's tip stuck open over the fresh selection. Gate focus-opens to
// KEYBOARD focus so a mouse pick's focus restore is suppressed while Tab-focus
// still shows the tip for a11y. preventDefault doesn't cancel the focus itself
// — Radix's composed handler just skips its onOpen when defaultPrevented.
//
// `:focus-visible` ALONE is not that gate. Radix menus autofocus their content
// and keyboard-navigate their items, so Chromium is in keyboard modality by the
// time a mouse pick restores focus and matches `:focus-visible` — the model
// pill's tip reopened over every selection. Qualify it with the device behind
// the last real interaction, which a mouse pick reports as `pointer`.
export function suppressNonKeyboardFocusOpen(
  event: React.FocusEvent<HTMLElement>,
  modality: InputModality = lastInputModality()
): void {
  let keyboardFocus = modality === 'keyboard'

  try {
    keyboardFocus &&= event.currentTarget.matches(':focus-visible')
  } catch {
    // Selector unsupported (older jsdom) — fall back to the modality alone.
  }

  if (!keyboardFocus) {
    event.preventDefault()
  }
}

function TooltipTrigger({ onFocus, ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onFocus={event => {
        onFocus?.(event)
        suppressNonKeyboardFocusOpen(event)
      }}
      {...props}
    />
  )
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        // Match dropdown/popover chrome: elevated surface, soft border, blur.
        // Solid rounded chip (the old marker-style box-decoration-clone looked
        // like a plain inverted rectangle and fought the rest of the UI).
        // pointer-events-none: never steal hover/clicks from chrome underneath.
        className={cn(
          'pointer-events-none z-(--z-over-modal) w-fit max-w-72 select-none rounded-lg border border-(--ui-stroke-secondary) bg-[color-mix(in_srgb,var(--ui-bg-elevated)_94%,transparent)] px-2.5 py-1.5 text-[11px] font-medium leading-snug text-(--ui-text-primary) shadow-md backdrop-blur-md',
          className
        )}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        {...props}
      >
        {/* [&>*]:!inline-flex: a block-level label child (e.g. `flex`) collapses
            measurement so Radix parks an empty chip (#62022). Keep children
            inline-flex so every call site stays safe. */}
        <span className="[&>*]:!inline-flex">{children}</span>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

interface TipProps extends Omit<React.ComponentProps<typeof TooltipPrimitive.Content>, 'content'> {
  label: React.ReactNode
  children: React.ReactNode
  delayDuration?: number
}

// Drop-in replacement for native `title=`: wrap any single element. Instant,
// position-aware, themed. Renders the child untouched when label is falsy.
// Open state is trigger-hover only — never sticky, never click-blocking.
//
// NO per-instance `TooltipProvider`. There are ~107 `Tip` call sites, and each
// private provider is another subtree that re-renders whenever anything above
// it does. Measured on a sash drag with five mounted tiles: 52,784
// TooltipProvider renders and 18.3s of component time in a single gesture.
//
// Radix's provider holds only refs and stable callbacks (no reactive state), so
// hoisting one to the app root is exactly what it is designed for — see
// `RootTooltipProvider`, mounted in main.tsx. `Tooltip` still reads
// `delayDuration`/`disableHoverableContent` from context, and the per-Tip
// overrides below keep the previous behavior for anything that passed them.
//
// Deliberately NOT lazy-mounted: deferring the Radix subtree until hover was
// tried and reverted. `asChild` puts `data-slot="tooltip-trigger"` on the
// child element itself, so arming REPLACES that node — which broke 18 tests
// encoding that contract, and risks focus/ref identity at every call site.
function Tip({ label, children, delayDuration = TIP_DELAY_MS, ...props }: TipProps) {
  // A component rendered in isolation (every unit test, and any surface
  // mounted outside the app root) has no provider above it, and Radix throws
  // "`Tooltip` must be used within `TooltipProvider`". Fall back to a local
  // one there. Inside the app this is always false, so the common path is a
  // bare Tooltip and the ~107 providers collapse to one.
  const provided = React.useContext(HasTooltipProvider)

  if (!label) {
    return <>{children}</>
  }

  const tip = (
    <Tooltip delayDuration={delayDuration} disableHoverableContent>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent {...props}>{label}</TooltipContent>
    </Tooltip>
  )

  return provided ? tip : <TooltipProvider delayDuration={delayDuration}>{tip}</TooltipProvider>
}

/** The app's single tooltip provider. Mounted once at the root so no `Tip`
 *  needs its own. Defaults match what `Tip` used to pass per instance. */
function RootTooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <HasTooltipProvider value>
      <TooltipProvider delayDuration={0} disableHoverableContent>
        {children}
      </TooltipProvider>
    </HasTooltipProvider>
  )
}

interface TipHintLabelProps {
  text: string
  hint?: string
}

/** Tooltip label with an optional trailing hotkey hint. Keep this as an
 *  `inline-flex` row so keybind hints stay on one line inside Tip. */
function TipHintLabel({ text, hint }: TipHintLabelProps) {
  if (!hint) {
    return <>{text}</>
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span>{text}</span>
      <span className="opacity-55">{hint}</span>
    </span>
  )
}

interface TipKeybindLabelProps {
  /** Keybind action id — pulls the label from i18n AND the combo from the store. */
  actionId: string
  /** Override the i18n label (for context-dependent text like "Show"/"Hide"). */
  text?: string
}

/** TipHintLabel that auto-reads both its label and keybind from the action
 *  registry. Pass only `actionId` for the common case; pass `text` to override
 *  when the button's tooltip is context-dependent. */
function TipKeybindLabel({ actionId, text }: TipKeybindLabelProps) {
  const { t } = useI18n()
  const hint = useKeybindHint(actionId)

  const label = text ?? t.keybinds.actions[actionId] ?? actionId

  return <TipHintLabel hint={hint ?? undefined} text={label} />
}

export {
  RootTooltipProvider,
  Tip,
  TipHintLabel,
  TipKeybindLabel,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
}
