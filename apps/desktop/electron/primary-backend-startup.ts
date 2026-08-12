import type { FirstRunSetupDecision } from './first-run-setup-gate'

export interface PrimaryBackendStartupOptions<Backend, RuntimeBackend, Remote, Connection> {
  connectRemote: (remote: Remote) => Promise<Connection>
  ensureLocalRuntime: (backend: Backend) => Promise<RuntimeBackend>
  prepareLocalBackend: () => Backend | Promise<Backend>
  resolveRemote: () => Promise<Remote | null>
  waitForDecision: (backend: Backend) => Promise<FirstRunSetupDecision>
  waitForLocalStart: () => Promise<unknown>
}

export type PrimaryBackendStartupResult<RuntimeBackend, Connection> =
  { kind: 'local'; backend: RuntimeBackend } | { kind: 'remote'; connection: Connection }

export class FirstRunSetupResetError extends Error {
  readonly firstRunSetupReset = true

  constructor() {
    super('First-run setup was reset before a choice completed.')
    this.name = 'FirstRunSetupResetError'
  }
}

/** Thrown from ensureLocalRuntime when the user cancels local install and then
 *  applies a remote gateway from the re-prompted first-run choice. The startup
 *  orchestrator switches to the remote path instead of treating it as a boot
 *  failure. */
export class FirstRunRemoteAppliedError extends Error {
  readonly firstRunRemoteApplied = true

  constructor() {
    super('First-run remote setup was applied after local install was cancelled.')
    this.name = 'FirstRunRemoteAppliedError'
  }
}

// Owns the production startArtemis path up to the local process spawn. Keeping
// the full ordering here makes the first-run remote boundary executable in a
// test: an already-saved remote wins immediately; otherwise update exclusion
// and local backend resolution happen before the setup gate, and a remote Apply
// re-resolves persisted config without ever entering ensureRuntime/bootstrap.
export async function runPrimaryBackendStartup<Backend, RuntimeBackend, Remote, Connection>({
  connectRemote,
  ensureLocalRuntime,
  prepareLocalBackend,
  resolveRemote,
  waitForDecision,
  waitForLocalStart
}: PrimaryBackendStartupOptions<Backend, RuntimeBackend, Remote, Connection>): Promise<
  PrimaryBackendStartupResult<RuntimeBackend, Connection>
> {
  const savedRemote = await resolveRemote()

  if (savedRemote) {
    return { kind: 'remote', connection: await connectRemote(savedRemote) }
  }

  await waitForLocalStart()

  const backend = await prepareLocalBackend()
  const decision = await waitForDecision(backend)

  if (decision === 'remote-applied') {
    const appliedRemote = await resolveRemote()

    if (!appliedRemote) {
      throw new Error('First-run remote setup completed without a saved remote backend.')
    }

    return { kind: 'remote', connection: await connectRemote(appliedRemote) }
  }

  if (decision === 'reset') {
    throw new FirstRunSetupResetError()
  }

  try {
    return { kind: 'local', backend: await ensureLocalRuntime(backend) }
  } catch (error) {
    if (!(error instanceof FirstRunRemoteAppliedError) && !(error as { firstRunRemoteApplied?: boolean })?.firstRunRemoteApplied) {
      throw error
    }

    const appliedRemote = await resolveRemote()

    if (!appliedRemote) {
      throw new Error('First-run remote setup completed without a saved remote backend.')
    }

    return { kind: 'remote', connection: await connectRemote(appliedRemote) }
  }
}
