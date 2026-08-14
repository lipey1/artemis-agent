import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { Loader2 } from '@/lib/icons'

export function listenGatewayDialogKind(running: boolean): 'configure' | 'stop' {
  return running ? 'stop' : 'configure'
}

export function ensureListenGatewayToken(token: string, generate: () => string): string {
  const trimmed = token.trim()

  return trimmed || generate()
}

export function generateListenGatewayToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

type ListenGatewayFields = {
  host: string
  port: string
  token: string
}

type ListenPhase = 'configure' | 'loading' | 'stop'

const EMPTY_FIELDS: ListenGatewayFields = { host: '0.0.0.0', port: '8642', token: '' }

function readDesktopGateway() {
  return window.artemisDesktop?.listenGateway
}

export function GatewayListenDialogs({
  onOpenChange,
  onRunningChange,
  open
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRunningChange?: (running: boolean) => void
}) {
  const { t } = useI18n()
  const copy = t.titlebar
  const [fields, setFields] = useState<ListenGatewayFields>(EMPTY_FIELDS)
  const [phase, setPhase] = useState<ListenPhase>('loading')
  const [busy, setBusy] = useState(false)
  const [started, setStarted] = useState(false)
  const [error, setError] = useState<null | string>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    setError(null)
    setBusy(false)
    setStarted(false)
    setPhase('loading')

    const api = readDesktopGateway()
    if (!api) {
      setPhase('configure')
      setError(copy.gatewayListenUnavailable)

      return
    }

    void api
      .status()
      .then(status => {
        if (cancelled) {
          return
        }

        setFields({
          host: status.host,
          port: String(status.port),
          token: status.token
        })
        onRunningChange?.(status.running)
        setPhase(listenGatewayDialogKind(status.running))
      })
      .catch(err => {
        if (cancelled) {
          return
        }

        setError(err instanceof Error ? err.message : copy.gatewayListenFailed)
        setPhase('configure')
      })

    return () => {
      cancelled = true
    }
  }, [copy.gatewayListenFailed, copy.gatewayListenUnavailable, onRunningChange, open])

  async function startGateway() {
    const api = readDesktopGateway()
    if (!api) {
      setError(copy.gatewayListenUnavailable)

      return
    }

    const port = Number.parseInt(fields.port, 10)
    if (!fields.host.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
      setError(copy.gatewayListenFailed)

      return
    }

    const token = ensureListenGatewayToken(fields.token, generateListenGatewayToken)
    setFields(current => ({ ...current, token }))
    setBusy(true)
    setError(null)

    try {
      const status = await api.start({ host: fields.host.trim(), port, token })
      setFields({ host: status.host, port: String(status.port), token: status.token })
      setStarted(true)
      onRunningChange?.(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.gatewayListenFailed)
    } finally {
      setBusy(false)
    }
  }

  async function stopGateway() {
    const api = readDesktopGateway()
    if (!api) {
      setError(copy.gatewayListenUnavailable)

      return
    }

    setBusy(true)
    setError(null)

    try {
      await api.stop()
      onRunningChange?.(false)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.gatewayListenFailed)
    } finally {
      setBusy(false)
    }
  }

  const loading = phase === 'loading'

  return (
    <Dialog onOpenChange={next => !busy && onOpenChange(next)} open={open}>
        <DialogContent className="max-w-sm" onInteractOutside={event => busy && event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{phase === 'stop' ? copy.gatewayListenStopTitle : copy.gatewayListenTitle}</DialogTitle>
          <DialogDescription>
            {loading ? copy.gatewayListenLoading : phase === 'stop' ? copy.gatewayListenStopBody : copy.gatewayListenDesc}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-24 flex-col items-center justify-center gap-2 py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{t.common.loading}</p>
          </div>
        ) : phase === 'stop' ? (
          error ? <p className="text-xs text-destructive">{error}</p> : null
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.6875rem] font-medium text-(--ui-text-tertiary)">{copy.gatewayListenHost}</span>
              <Input
                disabled={busy || started}
                onChange={event => setFields(current => ({ ...current, host: event.target.value }))}
                value={fields.host}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.6875rem] font-medium text-(--ui-text-tertiary)">{copy.gatewayListenPort}</span>
              <Input
                disabled={busy || started}
                inputMode="numeric"
                onChange={event => setFields(current => ({ ...current, port: event.target.value }))}
                value={fields.port}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.6875rem] font-medium text-(--ui-text-tertiary)">{copy.gatewayListenKey}</span>
              <div className="flex items-center gap-1">
                <Input
                  className="min-w-0 flex-1"
                  disabled={busy || started}
                  onChange={event => setFields(current => ({ ...current, token: event.target.value }))}
                  placeholder={copy.gatewayListenKeyHint}
                  value={fields.token}
                />
                {fields.token ? (
                  <CopyButton appearance="icon" buttonSize="icon-xs" className="shrink-0" text={fields.token} />
                ) : null}
              </div>
            </label>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          {loading ? (
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              {t.common.cancel}
            </Button>
          ) : phase === 'stop' ? (
            <>
              <Button disabled={busy} onClick={() => onOpenChange(false)} type="button" variant="ghost">
                {t.common.cancel}
              </Button>
              <Button disabled={busy} onClick={() => void stopGateway()} type="button" variant="destructive">
                {busy ? copy.gatewayListenStopping : copy.gatewayListenStop}
              </Button>
            </>
          ) : started ? (
            <Button onClick={() => onOpenChange(false)} type="button">
              {t.common.done}
            </Button>
          ) : (
            <>
              <Button disabled={busy} onClick={() => onOpenChange(false)} type="button" variant="ghost">
                {t.common.cancel}
              </Button>
              <Button disabled={busy} onClick={() => void startGateway()} type="button">
                {busy ? copy.gatewayListenStarting : copy.gatewayListenStart}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
