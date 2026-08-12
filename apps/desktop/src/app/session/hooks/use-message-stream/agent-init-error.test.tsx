import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClientSessionState } from '@/app/types'
import { textPart } from '@/lib/chat-messages'
import { createClientSessionState } from '@/lib/chat-runtime'
import { $notifications, clearNotifications } from '@/store/notifications'
import type { RpcEvent } from '@/types/artemis'

import { useMessageStream } from './index'

const SID = 'rt-new-session'

let handleEvent: ((event: RpcEvent) => void) | null = null
let sessionStates: Map<string, ClientSessionState> | null = null

function Harness() {
  const activeSessionIdRef = useRef<string | null>(SID)
  const sessionStateByRuntimeIdRef = useRef(new Map<string, ClientSessionState>())
  const queryClientRef = useRef(new QueryClient())

  const stream = useMessageStream({
    activeSessionIdRef,
    hydrateFromStoredSession: vi.fn(async () => undefined),
    queryClient: queryClientRef.current,
    refreshArtemisConfig: vi.fn(async () => undefined),
    refreshSessions: vi.fn(async () => undefined),
    sessionStateByRuntimeIdRef,
    updateSessionState: (sessionId, updater) => {
      const current = sessionStateByRuntimeIdRef.current.get(sessionId) ?? createClientSessionState()
      const next = updater(current)
      sessionStateByRuntimeIdRef.current.set(sessionId, next)

      return next
    }
  })

  useEffect(() => {
    handleEvent = stream.handleGatewayEvent
    sessionStates = sessionStateByRuntimeIdRef.current
  }, [stream.handleGatewayEvent])

  return null
}

async function mountStream() {
  render(<Harness />)
  await waitFor(() => expect(handleEvent).not.toBeNull())
}

/** Seed the session as it looks right after a first-message submit: the
 *  optimistic user row is present, the turn is awaiting its response. */
function seedOptimisticFirstMessage() {
  sessionStates!.set(SID, {
    ...createClientSessionState('stored-new-session', [
      { id: 'user-123-abc', role: 'user', parts: [textPart('first message of a new chat')] }
    ]),
    busy: true,
    awaitingResponse: true
  })
}

describe('useMessageStream agent-init error surfacing (#63078)', () => {
  beforeEach(() => {
    handleEvent = null
    sessionStates = null
    clearNotifications()
  })

  afterEach(() => {
    cleanup()
    clearNotifications()
    vi.restoreAllMocks()
  })

  it('renders an agent-init failure as a visible in-transcript error and keeps the optimistic first message', async () => {
    await mountStream()
    seedOptimisticFirstMessage()

    act(() =>
      handleEvent!({
        payload: {
          message:
            'agent initialization timed out after 601s — your message was not sent; retry once the session is ready'
        },
        session_id: SID,
        type: 'error'
      })
    )

    const state = sessionStates!.get(SID)!

    // The user's optimistic first message must survive — the failure mode of
    // #63078 was the message silently vanishing into a blank session.
    const userRows = state.messages.filter(m => m.role === 'user')
    expect(userRows).toHaveLength(1)
    expect(userRows[0]!.id).toBe('user-123-abc')

    // The failure is VISIBLE in the session view: an assistant error bubble...
    const errorRows = state.messages.filter(m => m.role === 'assistant' && m.error)
    expect(errorRows).toHaveLength(1)
    expect(errorRows[0]!.error).toContain('your message was not sent')

    // ...and the composer is released (no forever-spinner on a dead turn).
    expect(state.busy).toBe(false)
    expect(state.awaitingResponse).toBe(false)

    // A global toast also fired (turn-ending errors are easy to miss inline).
    expect($notifications.get().some(n => n.kind === 'error' && n.message?.includes('was not sent'))).toBe(true)
  })

  it('collapses wrapped agent-init error event and terminal frame into one toast and one bubble', async () => {
    const raw =
      "No inference provider configured. Run 'artemis model' to choose a provider and model, or set an API key (OPENROUTER_API_KEY, OPENAI_API_KEY, etc.) in ~/.artemis/.env."

    await mountStream()
    seedOptimisticFirstMessage()

    act(() =>
      handleEvent!({
        payload: { message: `agent init failed: ${raw}` },
        session_id: SID,
        type: 'error'
      })
    )
    act(() =>
      handleEvent!({
        payload: { error: raw, status: 'error', text: `Error: ${raw}` },
        session_id: SID,
        type: 'message.complete'
      })
    )

    const state = sessionStates!.get(SID)!
    const errorRows = state.messages.filter(m => m.role === 'assistant' && m.error)

    expect(errorRows).toHaveLength(1)
    expect(errorRows[0]!.error).toBe(raw)

    const errorToasts = $notifications.get().filter(n => n.kind === 'error')

    // Provider-setup copy opens onboarding instead of a toast; either way
    // the wrapped and raw variants must not stack two notifications.
    expect(errorToasts).toHaveLength(0)
    expect(errorRows[0]!.error).not.toMatch(/^agent init failed:/)
  })

  it('collapses wrapped and raw agent-init toasts for non-provider failures', async () => {
    await mountStream()
    seedOptimisticFirstMessage()

    act(() =>
      handleEvent!({
        payload: { message: 'agent init failed: boom' },
        session_id: SID,
        type: 'error'
      })
    )
    act(() =>
      handleEvent!({
        payload: { error: 'boom', status: 'error', text: 'Error: boom' },
        session_id: SID,
        type: 'message.complete'
      })
    )

    const errorToasts = $notifications.get().filter(n => n.kind === 'error')

    expect(errorToasts).toHaveLength(1)
    expect(errorToasts[0]!.message).toBe('boom')
    expect(sessionStates!.get(SID)!.messages.filter(m => m.role === 'assistant' && m.error)).toHaveLength(1)
  })

  it('renders the pre-ready cancel error event (#65567 server emit) visibly', async () => {
    await mountStream()
    seedOptimisticFirstMessage()

    act(() =>
      handleEvent!({
        payload: { message: 'Turn cancelled before the agent was ready' },
        session_id: SID,
        type: 'error'
      })
    )

    const state = sessionStates!.get(SID)!
    expect(state.messages.some(m => m.role === 'assistant' && m.error?.includes('cancelled'))).toBe(true)
    expect(state.messages.some(m => m.id === 'user-123-abc')).toBe(true)
    expect(state.busy).toBe(false)
  })
})
