import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('artemisDesktop', {
  getConnection: profile => ipcRenderer.invoke('artemis:connection', profile),
  revalidateConnection: () => ipcRenderer.invoke('artemis:connection:revalidate'),
  touchBackend: profile => ipcRenderer.invoke('artemis:backend:touch', profile),
  getGatewayWsUrl: profile => ipcRenderer.invoke('artemis:gateway:ws-url', profile),
  openSessionWindow: (sessionId, opts) => ipcRenderer.invoke('artemis:window:openSession', sessionId, opts),
  openWindow: () => ipcRenderer.invoke('artemis:window:openInstance'),
  claimAmbientCue: key => ipcRenderer.invoke('artemis:ambient:claim', key),
  wakeIndicator: {
    getState: () => ipcRenderer.invoke('artemis:wake-indicator:get'),
    setState: state => ipcRenderer.send('artemis:wake-indicator:set', state),
    onState: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('artemis:wake-indicator:state', listener)

      return () => ipcRenderer.removeListener('artemis:wake-indicator:state', listener)
    }
  },
  petOverlay: {
    // Main renderer → main process: window lifecycle + drag. `request` is
    // `{ bounds, screen }`; resolves with the screen bounds it actually used.
    open: request => ipcRenderer.invoke('artemis:pet-overlay:open', request),
    close: () => ipcRenderer.invoke('artemis:pet-overlay:close'),
    setBounds: bounds => ipcRenderer.send('artemis:pet-overlay:set-bounds', bounds),
    setIgnoreMouse: ignore => ipcRenderer.send('artemis:pet-overlay:ignore-mouse', ignore),
    // Flip the overlay focusable (and focus it) while the composer needs keys.
    setFocusable: focusable => ipcRenderer.send('artemis:pet-overlay:set-focusable', focusable),
    // Main renderer → overlay (forwarded by main): push the latest pet state.
    pushState: payload => ipcRenderer.send('artemis:pet-overlay:state', payload),
    // Overlay → main renderer (forwarded by main): pop back in / composer submit.
    control: payload => ipcRenderer.send('artemis:pet-overlay:control', payload),
    // Overlay subscribes to state pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('artemis:pet-overlay:state', listener)

      return () => ipcRenderer.removeListener('artemis:pet-overlay:state', listener)
    },
    // Main renderer subscribes to overlay control messages.
    onControl: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('artemis:pet-overlay:control', listener)

      return () => ipcRenderer.removeListener('artemis:pet-overlay:control', listener)
    }
  },
  // HUD mode: the chrome-free floating chat. A full app renderer (own gateway)
  // sized as a floating bar, so it mounts the real composer. Main owns the
  // window; `onChanged` keeps every window's toggle truthful.
  hud: {
    open: request => ipcRenderer.invoke('artemis:hud:open', request),
    close: () => ipcRenderer.invoke('artemis:hud:close'),
    setIgnoreMouse: ignore => ipcRenderer.send('artemis:hud:ignore-mouse', ignore),
    moveBy: delta => ipcRenderer.send('artemis:hud:move-by', delta),
    setBounds: bounds => ipcRenderer.send('artemis:hud:set-bounds', bounds),
    setVibrancy: on => ipcRenderer.invoke('artemis:hud:vibrancy', on),
    // The HUD tells main which session it is on; main hands that back to the
    // app window when the HUD closes, so the app can re-home onto it.
    setSession: sessionId => ipcRenderer.send('artemis:hud:session', sessionId),
    onGoto: callback => {
      const listener = (_event, sessionId) => callback(sessionId)
      ipcRenderer.on('artemis:hud:goto', listener)

      return () => ipcRenderer.removeListener('artemis:hud:goto', listener)
    },
    onChanged: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('artemis:hud:changed', listener)

      return () => ipcRenderer.removeListener('artemis:hud:changed', listener)
    },
    // Linux only, and silent elsewhere: where the cursor is, in page
    // coordinates, or null when it has left the window. Stands in for the
    // mousemove that `setIgnoreMouseEvents(true, { forward: true })` delivers on
    // macOS and Windows but not here.
    onCursor: callback => {
      const listener = (_event, point) => callback(point)
      ipcRenderer.on('artemis:hud:cursor', listener)

      return () => ipcRenderer.removeListener('artemis:hud:cursor', listener)
    }
  },
  // Quick Entry: the global-hotkey mini composer window. Main owns the OS
  // shortcut + the persisted preference; the quick window only captures text
  // and hands it back, and the primary renderer submits it through the normal
  // prompt path.
  quickEntry: {
    getSettings: () => ipcRenderer.invoke('artemis:quick-entry:settings:get'),
    setSettings: patch => ipcRenderer.invoke('artemis:quick-entry:settings:set', patch),
    submit: payload => ipcRenderer.send('artemis:quick-entry:submit', payload),
    dismiss: () => ipcRenderer.send('artemis:quick-entry:dismiss'),
    // Primary renderer → main → quick window: gateway connection state + the
    // recent-session options the target picker offers. Main caches the latest
    // payload so a freshly spawned quick window starts from truth.
    pushState: payload => ipcRenderer.send('artemis:quick-entry:state', payload),
    // Quick window subscribes to those pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('artemis:quick-entry:state', listener)

      return () => ipcRenderer.removeListener('artemis:quick-entry:state', listener)
    },
    // Main → primary renderer: a submit captured by the quick window.
    onSubmit: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('artemis:quick-entry:submit', listener)

      return () => ipcRenderer.removeListener('artemis:quick-entry:submit', listener)
    },
    // Main → quick window: you were just summoned (reset draft + refocus).
    onShown: callback => {
      const listener = () => callback()
      ipcRenderer.on('artemis:quick-entry:shown', listener)

      return () => ipcRenderer.removeListener('artemis:quick-entry:shown', listener)
    }
  },
  getBootProgress: () => ipcRenderer.invoke('artemis:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('artemis:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('artemis:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('artemis:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('artemis:connection-config:test', payload),
  sshConfigHosts: () => ipcRenderer.invoke('artemis:ssh-config:hosts'),
  sshResolveHost: host => ipcRenderer.invoke('artemis:ssh-config:resolve', host),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('artemis:connection-config:probe', remoteUrl),
  oauthLoginConnectionConfig: remoteUrl => ipcRenderer.invoke('artemis:connection-config:oauth-login', remoteUrl),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('artemis:connection-config:oauth-logout', remoteUrl),
  profile: {
    get: () => ipcRenderer.invoke('artemis:profile:get'),
    set: name => ipcRenderer.invoke('artemis:profile:set', name)
  },
  api: request => ipcRenderer.invoke('artemis:api', request),
  notify: payload => ipcRenderer.invoke('artemis:notify', payload),
  requestMicrophoneAccess: () => ipcRenderer.invoke('artemis:requestMicrophoneAccess'),
  readWindowBelow: () => ipcRenderer.invoke('artemis:window:readBelow'),
  readFileDataUrl: filePath => ipcRenderer.invoke('artemis:readFileDataUrl', filePath),
  readFileDataUrlForAttach: filePath => ipcRenderer.invoke('artemis:readFileDataUrlForAttach', filePath),
  dataUrlReadMax: {
    get: () => ipcRenderer.invoke('artemis:data-url-read-max:get'),
    set: maxMb => ipcRenderer.invoke('artemis:data-url-read-max:set', maxMb)
  },
  readFileText: filePath => ipcRenderer.invoke('artemis:readFileText', filePath),
  selectPaths: options => ipcRenderer.invoke('artemis:selectPaths', options),
  selectSavePath: options => ipcRenderer.invoke('artemis:selectSavePath', options),
  writeClipboard: text => ipcRenderer.invoke('artemis:writeClipboard', text),
  readClipboard: () => ipcRenderer.invoke('artemis:readClipboard'),
  saveImageFromUrl: url => ipcRenderer.invoke('artemis:saveImageFromUrl', url),
  saveImageBuffer: (data, ext) => ipcRenderer.invoke('artemis:saveImageBuffer', { data, ext }),
  saveClipboardImage: () => ipcRenderer.invoke('artemis:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('artemis:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('artemis:watchPreviewFile', url),
  watchDirectory: dir => ipcRenderer.invoke('artemis:watchDirectory', dir),
  stopPreviewFileWatch: id => ipcRenderer.invoke('artemis:stopPreviewFileWatch', id),
  setActiveWork: payload => ipcRenderer.send('artemis:active-work', payload),
  setTitleBarTheme: payload => ipcRenderer.send('artemis:titlebar-theme', payload),
  setNativeTheme: mode => ipcRenderer.send('artemis:native-theme', mode),
  setTranslucency: payload => ipcRenderer.send('artemis:translucency', payload),
  setKeepAwake: on => ipcRenderer.send('artemis:keep-awake', on),
  setPreviewShortcutActive: active => ipcRenderer.send('artemis:previewShortcutActive', Boolean(active)),
  openExternal: url => ipcRenderer.invoke('artemis:openExternal', url),
  openPreviewInBrowser: url => ipcRenderer.invoke('artemis:openPreviewInBrowser', url),
  fetchLinkTitle: url => ipcRenderer.invoke('artemis:fetchLinkTitle', url),
  sanitizeWorkspaceCwd: cwd => ipcRenderer.invoke('artemis:workspace:sanitize', cwd),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('artemis:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('artemis:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('artemis:setting:defaultProjectDir:pick')
  },
  zoom: {
    // Current zoom of this window, as { level, percent }.
    get: () => ipcRenderer.invoke('artemis:zoom:get'),
    setPercent: percent => ipcRenderer.send('artemis:zoom:set-percent', percent),
    // Fires on every zoom change, including the Ctrl/Cmd +/-/0 shortcuts,
    // so the settings UI can stay in sync with the keyboard.
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('artemis:zoom:changed', listener)

      return () => ipcRenderer.removeListener('artemis:zoom:changed', listener)
    }
  },
  revealLogs: () => ipcRenderer.invoke('artemis:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('artemis:logs:recent'),
  // Fire-and-forget: persists a renderer error-boundary catch (with component
  // stack) to desktop.log so crashes survive the window (#79428).
  reportRendererError: report => ipcRenderer.send('artemis:logs:renderer-error', report),
  readDir: dirPath => ipcRenderer.invoke('artemis:fs:readDir', dirPath),
  gitRoot: startPath => ipcRenderer.invoke('artemis:fs:gitRoot', startPath),
  revealPath: targetPath => ipcRenderer.invoke('artemis:fs:reveal', targetPath),
  openDir: dirPath => ipcRenderer.invoke('artemis:fs:openDir', dirPath),
  desktopPluginsRoot: () => ipcRenderer.invoke('artemis:fs:desktopPluginsRoot'),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('artemis:fs:rename', targetPath, newName),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('artemis:fs:writeText', filePath, content),
  trashPath: targetPath => ipcRenderer.invoke('artemis:fs:trash', targetPath),
  git: {
    worktreeList: repoPath => ipcRenderer.invoke('artemis:git:worktreeList', repoPath),
    worktreeAdd: (repoPath, options) => ipcRenderer.invoke('artemis:git:worktreeAdd', repoPath, options),
    worktreeRemove: (repoPath, worktreePath, options) =>
      ipcRenderer.invoke('artemis:git:worktreeRemove', repoPath, worktreePath, options),
    branchSwitch: (repoPath, branch) => ipcRenderer.invoke('artemis:git:branchSwitch', repoPath, branch),
    branchList: repoPath => ipcRenderer.invoke('artemis:git:branchList', repoPath),
    baseBranchList: repoPath => ipcRenderer.invoke('artemis:git:baseBranchList', repoPath),
    repoStatus: repoPath => ipcRenderer.invoke('artemis:git:repoStatus', repoPath),
    fileDiff: (repoPath, filePath) => ipcRenderer.invoke('artemis:git:fileDiff', repoPath, filePath),
    scanRepos: (roots, options) => ipcRenderer.invoke('artemis:git:scanRepos', roots, options),
    review: {
      list: (repoPath, scope, baseRef) => ipcRenderer.invoke('artemis:git:review:list', repoPath, scope, baseRef),
      diff: (repoPath, filePath, scope, baseRef, staged) =>
        ipcRenderer.invoke('artemis:git:review:diff', repoPath, filePath, scope, baseRef, staged),
      stage: (repoPath, filePath) => ipcRenderer.invoke('artemis:git:review:stage', repoPath, filePath),
      unstage: (repoPath, filePath) => ipcRenderer.invoke('artemis:git:review:unstage', repoPath, filePath),
      revert: (repoPath, filePath) => ipcRenderer.invoke('artemis:git:review:revert', repoPath, filePath),
      revParse: (repoPath, ref) => ipcRenderer.invoke('artemis:git:review:revParse', repoPath, ref),
      commit: (repoPath, message, push) => ipcRenderer.invoke('artemis:git:review:commit', repoPath, message, push),
      commitContext: repoPath => ipcRenderer.invoke('artemis:git:review:commitContext', repoPath),
      push: repoPath => ipcRenderer.invoke('artemis:git:review:push', repoPath),
      shipInfo: repoPath => ipcRenderer.invoke('artemis:git:review:shipInfo', repoPath),
      prList: (repoPath, branches, numbers) =>
        ipcRenderer.invoke('artemis:git:review:prList', repoPath, branches, numbers),
      createPr: repoPath => ipcRenderer.invoke('artemis:git:review:createPr', repoPath)
    }
  },
  terminal: {
    cwd: id => ipcRenderer.invoke('artemis:terminal:cwd', id),
    dispose: id => ipcRenderer.invoke('artemis:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('artemis:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('artemis:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('artemis:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `artemis:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `artemis:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('artemis:close-preview-requested', listener)

    return () => ipcRenderer.removeListener('artemis:close-preview-requested', listener)
  },
  onOpenFolderRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('artemis:open-folder-requested', listener)

    return () => ipcRenderer.removeListener('artemis:open-folder-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('artemis:open-updates', listener)

    return () => ipcRenderer.removeListener('artemis:open-updates', listener)
  },
  onDeepLink: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('artemis:deep-link', listener)

    return () => ipcRenderer.removeListener('artemis:deep-link', listener)
  },
  signalDeepLinkReady: () => ipcRenderer.invoke('artemis:deep-link-ready'),
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('artemis:window-state-changed', listener)

    return () => ipcRenderer.removeListener('artemis:window-state-changed', listener)
  },
  onFocusSession: callback => {
    const listener = (_event, sessionId) => callback(sessionId)
    ipcRenderer.on('artemis:focus-session', listener)

    return () => ipcRenderer.removeListener('artemis:focus-session', listener)
  },
  onNotificationAction: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('artemis:notification-action', listener)

    return () => ipcRenderer.removeListener('artemis:notification-action', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('artemis:preview-file-changed', listener)

    return () => ipcRenderer.removeListener('artemis:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('artemis:backend-exit', listener)

    return () => ipcRenderer.removeListener('artemis:backend-exit', listener)
  },
  // Soft gateway-mode apply finished tearing down the primary backend. Renderer
  // should wipe session lists + re-dial without a window reload.
  onConnectionApplied: callback => {
    const listener = () => callback()
    ipcRenderer.on('artemis:connection:applied', listener)

    return () => ipcRenderer.removeListener('artemis:connection:applied', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('artemis:power-resume', listener)

    return () => ipcRenderer.removeListener('artemis:power-resume', listener)
  },
  // AC ↔ battery transitions; renderers slow their backstop polls on battery.
  getOnBattery: () => ipcRenderer.invoke('artemis:power-battery:get'),
  onBatteryChanged: callback => {
    const listener = (_event, onBattery) => callback(Boolean(onBattery))
    ipcRenderer.on('artemis:power-battery', listener)

    return () => ipcRenderer.removeListener('artemis:power-battery', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('artemis:boot-progress', listener)

    return () => ipcRenderer.removeListener('artemis:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.ts (apps/desktop/electron/bootstrap-runner.ts).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('artemis:bootstrap:get'),
  continueBootstrapLocal: () => ipcRenderer.invoke('artemis:bootstrap:continue-local'),
  resetBootstrap: () => ipcRenderer.invoke('artemis:bootstrap:reset'),
  repairBootstrap: () => ipcRenderer.invoke('artemis:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('artemis:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('artemis:bootstrap:event', listener)

    return () => ipcRenderer.removeListener('artemis:bootstrap:event', listener)
  },
  getVersion: () => ipcRenderer.invoke('artemis:version'),
  getRemoteDisplayReason: () => ipcRenderer.invoke('artemis:get-remote-display-reason'),
  uninstall: {
    summary: () => ipcRenderer.invoke('artemis:uninstall:summary'),
    run: mode => ipcRenderer.invoke('artemis:uninstall:run', { mode })
  },
  updates: {
    check: () => ipcRenderer.invoke('artemis:updates:check'),
    apply: opts => ipcRenderer.invoke('artemis:updates:apply', opts),
    getBranch: () => ipcRenderer.invoke('artemis:updates:branch:get'),
    setBranch: name => ipcRenderer.invoke('artemis:updates:branch:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('artemis:updates:progress', listener)

      return () => ipcRenderer.removeListener('artemis:updates:progress', listener)
    }
  },
  themes: {
    fetchMarketplace: id => ipcRenderer.invoke('artemis:vscode-theme:fetch', id),
    searchMarketplace: query => ipcRenderer.invoke('artemis:vscode-theme:search', query)
  },
  // Find-in-page (Ctrl/Cmd+F): delegates to Electron's
  // webContents.findInPage on the IPC sender's window so a Cmd+F pressed
  // in a secondary session window searches THAT window, not the primary.
  // `onFoundInPage` returns the unsubscribe fn; the renderer wires it via
  // `initFindInPageListener` in store/find-in-page.ts and tears it down
  // when the FindBar unmounts.
  findInPage: (query, options) => ipcRenderer.invoke('artemis:find-in-page', query, options),
  stopFindInPage: () => ipcRenderer.invoke('artemis:stop-find-in-page'),
  onFoundInPage: callback => {
    const listener = (_event, result) => callback(result)
    ipcRenderer.on('artemis:found-in-page', listener)

    return () => ipcRenderer.removeListener('artemis:found-in-page', listener)
  },
  listenGateway: {
    snapshot: () => ipcRenderer.invoke('artemis:listen-gateway:snapshot'),
    status: () => ipcRenderer.invoke('artemis:listen-gateway:status'),
    start: settings => ipcRenderer.invoke('artemis:listen-gateway:start', settings),
    stop: () => ipcRenderer.invoke('artemis:listen-gateway:stop'),
    setAutoStart: enabled => ipcRenderer.invoke('artemis:listen-gateway:set-auto-start', enabled)
  }
})
