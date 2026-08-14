import { describe, expect, it } from 'vitest'

import { listenGatewayDialogKind, ensureListenGatewayToken } from './gateway-listen-dialog'

describe('listenGatewayDialogKind', () => {
  it('opens settings when the gateway is off', () => {
    expect(listenGatewayDialogKind(false)).toBe('configure')
  })

  it('asks to stop when the gateway is already running', () => {
    expect(listenGatewayDialogKind(true)).toBe('stop')
  })
})

describe('ensureListenGatewayToken', () => {
  it('keeps a typed key', () => {
    expect(ensureListenGatewayToken('  abc  ', () => 'generated')).toBe('abc')
  })

  it('generates when the field is blank', () => {
    expect(ensureListenGatewayToken('   ', () => 'generated-key')).toBe('generated-key')
  })
})
