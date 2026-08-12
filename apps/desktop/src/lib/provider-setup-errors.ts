const PROVIDER_SETUP_ERROR_RE =
  /No (?:inference|Artemis) provider(?: is)? configured|no_provider_configured|set an API key/i

const SESSION_INFO_CREDENTIAL_WARNING_RE = /^No API key configured for provider '[^']*'\. First message will fail\.$/

const AGENT_INIT_FAILED_PREFIX = /^agent init failed:\s*/i

export function unwrapAgentInitErrorMessage(message: string): string {
  const trimmed = message.trim()
  const unwrapped = trimmed.replace(AGENT_INIT_FAILED_PREFIX, '').trim()

  return unwrapped || trimmed
}

export function sameGatewayFailure(left: string, right: string): boolean {
  const a = unwrapAgentInitErrorMessage(left)
  const b = unwrapAgentInitErrorMessage(right)

  if (!a || !b) {
    return false
  }

  return a === b || a.endsWith(b) || b.endsWith(a)
}

export function isProviderSetupErrorMessage(message: null | string | undefined): boolean {
  const text = message?.trim()

  if (!text) {
    return false
  }

  return PROVIDER_SETUP_ERROR_RE.test(text) || SESSION_INFO_CREDENTIAL_WARNING_RE.test(text)
}
