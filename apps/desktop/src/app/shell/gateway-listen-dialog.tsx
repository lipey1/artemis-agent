import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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

export function listenGatewayDialogKind(running: boolean): 'configure' | 'stop' {
  return running ? 'stop' : 'configure'
}

type ListenGatewayFields = {
  host: string
  port: string
  token: string
}

const EMPTY_FIELDS: ListenGatewayFields = { host: '0.0.0.0', port: '8642', token: '' }

function readDesktopGateway() {
  return window.artemisDesktop?.listenGateway
}

export function GatewayListenDialogs({
  configureOpen,
  onConfigureOpenChange,
  stopOpen,
  onStopOpenChange,
  onRunningChange
}: {
  configureOpen: boolean
  onConfigureOpenChange: (open: boolean) => void
  stopOpen: boolean
  onStopOpenChange: (open: boolean) => void
  onRunningChange?: (running: boolean) => void
}) {
  const { t } = useI18n()
  const copy = t.titlebar
  const [fields, setFields] = useState<ListenGatewayFields>(EMPTY_FIELDS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<null | string>(null)

  useEffect(() => {
    if (!configureOpen) {
      return
    }

    setError(null)
    setBusy(false)
    const api = readDesktopGateway()
    if (!api) {
      return
    }

    void api.status().then(status => {
      setFields({
        host: status.host,
        port: String(status.port),
        token: status.token
      })
    })
  }, [configureOpen])

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

    setBusy(true)
    setError(null)

    try {
      const status = await api.start({ host: fields.host.trim(), port, token: fields.token })
      setFields({ host: status.host, port: String(status.port), token: status.token })
      onRunningChange?.(true)
      onConfigureOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.gatewayListenFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog onOpenChange={open => !busy && onConfigureOpenChange(open)} open={configureOpen}>
        <DialogContent className="max-w-sm" onInteractOutside={event => busy && event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{copy.gatewayListenTitle}</DialogTitle>
            <DialogDescription>{copy.gatewayListenDesc}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.6875rem] font-medium text-(--ui-text-tertiary)">{copy.gatewayListenHost}</span>
              <Input
                disabled={busy}
                onChange={event => setFields(current => ({ ...current, host: event.target.value }))}
                value={fields.host}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.6875rem] font-medium text-(--ui-text-tertiary)">{copy.gatewayListenPort}</span>
              <Input
                disabled={busy}
                inputMode="numeric"
                onChange={event => setFields(current => ({ ...current, port: event.target.value }))}
                value={fields.port}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.6875rem] font-medium text-(--ui-text-tertiary)">{copy.gatewayListenKey}</span>
              <Input
                disabled={busy}
                onChange={event => setFields(current => ({ ...current, token: event.target.value }))}
                placeholder={copy.gatewayListenKeyHint}
                value={fields.token}
              />
            </label>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button disabled={busy} onClick={() => onConfigureOpenChange(false)} type="button" variant="ghost">
              {t.common.cancel}
            </Button>
            <Button disabled={busy} onClick={() => void startGateway()} type="button">
              {busy ? copy.gatewayListenStarting : copy.gatewayListenStart}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        busyLabel={copy.gatewayListenStopping}
        confirmLabel={copy.gatewayListenStop}
        description={copy.gatewayListenStopBody}
        destructive
        doneLabel={copy.gatewayListenStopped}
        onClose={() => onStopOpenChange(false)}
        onConfirm={async () => {
          const api = readDesktopGateway()
          if (!api) {
            throw new Error(copy.gatewayListenUnavailable)
          }

          await api.stop()
          onRunningChange?.(false)
        }}
        open={stopOpen}
        title={copy.gatewayListenStopTitle}
      />
    </>
  )
}
