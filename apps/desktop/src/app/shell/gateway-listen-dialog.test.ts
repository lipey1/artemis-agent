import { describe, expect, it } from 'vitest'

import { listenGatewayDialogKind } from './gateway-listen-dialog'

describe('listenGatewayDialogKind', () => {
  it('opens settings when the gateway is off', () => {
    expect(listenGatewayDialogKind(false)).toBe('configure')
  })

  it('asks to stop when the gateway is already running', () => {
    expect(listenGatewayDialogKind(true)).toBe('stop')
  })
})
