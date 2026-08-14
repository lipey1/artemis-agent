import type { ChatMessage } from '@/lib/chat-messages'

export type ThreadLoadingState = 'response' | 'session'

export function lastVisibleMessageIsUser(messages: ChatMessage[]): boolean {
  // Allocation-free reverse scan — runs in a hot $messages computed.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (!messages[i].hidden) {
      return messages[i].role === 'user'
    }
  }

  return false
}

export function threadLoadingState(
  loadingSession: boolean,
  busy: boolean,
  awaitingResponse: boolean,
  lastVisibleIsUser: boolean
): ThreadLoadingState | undefined {
  if (loadingSession) {
    return 'session'
  }

  if (busy && awaitingResponse && lastVisibleIsUser) {
    return 'response'
  }

  return undefined
}

/** Opaque cover over a COLD session paint (empty → messages → first-paint
 *  backfill → scroll settle). Warm switches already have messages in the same
 *  commit and must stay uncovered. An empty chat that finished loading is
 *  also uncovered, so the first typed turn is not treated as a resume. */
export function threadColdCover(input: {
  backfillDone: boolean
  cold: boolean
  hasGroups: boolean
  loadSettled: boolean
  sessionLoading: boolean
}): boolean {
  if (input.sessionLoading) {
    return true
  }

  if (!input.cold || !input.hasGroups) {
    return false
  }

  return !input.loadSettled || !input.backfillDone
}
