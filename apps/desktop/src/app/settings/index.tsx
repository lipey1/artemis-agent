import { useCallback, useEffect, useMemo, useRef, type ChangeEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { Tip } from '@/components/ui/tooltip'
import { getArtemisConfigDefaults, getArtemisConfigRecord, saveArtemisConfig } from '@/artemis'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import {
  Archive,
  Bell,
  Download,
  Globe,
  Info,
  Keyboard,
  KeyRound,
  Package,
  RefreshCw,
  Settings2,
  Upload,
  Wrench,
  Zap
} from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'

import { setArtemisConfigCache } from '../hooks/use-config-record'

import { useRouteEnumParam } from '../hooks/use-route-enum-param'
import { OverlayIconButton } from '../overlays/overlay-chrome'
import { OverlayMain, OverlayNav, type OverlayNavGroup, OverlaySplitLayout } from '../overlays/overlay-split-layout'
import { OverlayView } from '../overlays/overlay-view'
import { SKILLS_ROUTE } from '../routes'

import { AboutSettings } from './about-settings'
import { AppearanceSettings } from './appearance-settings'
import { ConfigSettings } from './config-settings'
import { SECTIONS } from './constants'
import { GatewaySettings } from './gateway-settings'
import { KeybindSettings } from './keybind-settings'
import { KEYS_VIEWS, KeysSettings, type KeysView } from './keys-settings'
import { NotificationsSettings } from './notifications-settings'
import { PluginsSettings } from './plugins-settings'
import { PROVIDER_VIEWS, ProvidersSettings, type ProviderView } from './providers-settings'
import { SessionsSettings } from './sessions-settings'
import type { SettingsPageProps, SettingsView as SettingsViewId } from './types'

const SETTINGS_VIEWS: readonly SettingsViewId[] = [
  ...SECTIONS.map(s => `config:${s.id}` as SettingsViewId),
  'providers',
  'gateway',
  'keybinds',
  'keys',
  'notifications',
  'plugins',
  'sessions',
  'about'
]

export function SettingsView({ onClose, onConfigSaved, onMainModelChanged }: SettingsPageProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hash, pathname, search } = useLocation()

  // MCP moved out of Settings into Capabilities (/skills?tab=mcp). Keep old
  // `/settings?tab=mcp` deep links working — `useRouteEnumParam` would silently
  // coerce the unknown tab to the default view otherwise. Preserve `server=` so
  // an old bookmark still lands on (and highlights) the selected server.
  // Billing was removed from Settings; send leftover `?tab=billing` to API keys.
  useEffect(() => {
    const params = new URLSearchParams(search)

    if (params.get('tab') === 'mcp') {
      const server = params.get('server')
      const suffix = server ? `&server=${encodeURIComponent(server)}` : ''
      navigate(`${SKILLS_ROUTE}?tab=mcp${suffix}`, { replace: true })
      return
    }

    if (params.get('tab') === 'billing') {
      params.set('tab', 'providers')
      params.delete('bview')
      const qs = params.toString()
      navigate({ hash, pathname, search: qs ? `?${qs}` : '' }, { replace: true })
    }
  }, [hash, navigate, pathname, search])

  const [activeView, setActiveView] = useRouteEnumParam('tab', SETTINGS_VIEWS, 'config:model' as SettingsViewId)
  // Providers subnav (API keys vs custom endpoints) lives in its own param so
  // each sub-view is deep-linkable and survives a refresh. Unknown values
  // (including the retired `accounts` view) fall back to keys.
  const [providerView] = useRouteEnumParam<ProviderView>('pview', PROVIDER_VIEWS, 'keys')
  const [keysView] = useRouteEnumParam<KeysView>('kview', KEYS_VIEWS, 'tools')

  // Jump to a section + its sub-view in one navigate. Two sequential setters
  // would each read the same stale `search` and the second would clobber the
  // first's `tab` — so the sub-view never opened on narrow screens.
  const openSubView = useCallback(
    (tab: SettingsViewId, param: string, value: string, fallback: string) => {
      const params = new URLSearchParams(search)
      params.set('tab', tab)

      if (value === fallback) {
        params.delete(param)
      } else {
        params.set(param, value)
      }

      const qs = params.toString()
      navigate({ hash, pathname, search: qs ? `?${qs}` : '' }, { replace: true })
    },
    [hash, navigate, pathname, search]
  )

  const openProviderView = useCallback(
    (view: ProviderView) => openSubView('providers', 'pview', view, 'keys'),
    [openSubView]
  )

  const openKeysView = useCallback((view: KeysView) => openSubView('keys', 'kview', view, 'tools'), [openSubView])

  const importInputRef = useRef<HTMLInputElement | null>(null)

  const exportConfig = async () => {
    try {
      const cfg = await getArtemisConfigRecord()
      const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'artemis-config.json'
      a.click()
      URL.revokeObjectURL(url)
      triggerHaptic('success')
    } catch (err) {
      notifyError(err, t.settings.exportFailed)
    }
  }

  // File input lives here (not inside ConfigSettings) so Import works from any
  // settings tab — About, Gateway, etc. Previously the hidden <input> only
  // mounted on config:* views, so the footer Upload button was a no-op.
  const handleImportConfig = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      void (async () => {
        try {
          const parsed = JSON.parse(String(reader.result)) as Record<string, unknown>
          await saveArtemisConfig(parsed)
          setArtemisConfigCache(parsed)
          triggerHaptic('success')
          notify({
            kind: 'success',
            title: t.settings.config.imported,
            message: t.common.saving
          })
          onConfigSaved?.()
        } catch (err) {
          notifyError(err, t.settings.config.invalidJson)
        }
      })()
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const resetConfig = async () => {
    if (!window.confirm(t.settings.resetConfirm)) {
      return
    }

    try {
      await saveArtemisConfig(await getArtemisConfigDefaults())
      triggerHaptic('success')
      onConfigSaved?.()
    } catch (err) {
      notifyError(err, t.settings.resetFailed)
    }
  }

  const navGroups: OverlayNavGroup[] = useMemo(
    () => [
      ...SECTIONS.map(s => {
        const view = `config:${s.id}` as SettingsViewId

        return {
          active: activeView === view,
          icon: s.icon,
          id: view,
          label: t.settings.sections[s.id] ?? s.label,
          onSelect: () => setActiveView(view)
        }
      }),
      {
        active: activeView === 'notifications',
        icon: Bell,
        id: 'notifications',
        label: t.settings.nav.notifications,
        onSelect: () => setActiveView('notifications')
      },
      {
        active: activeView === 'providers',
        children: [
          {
            active: activeView === 'providers' && providerView === 'keys',
            icon: KeyRound,
            id: 'pview:keys',
            label: t.settings.nav.providerApiKeys,
            onSelect: () => openProviderView('keys')
          },
          {
            active: activeView === 'providers' && providerView === 'custom-endpoints',
            icon: Globe,
            id: 'pview:custom-endpoints',
            label: t.settings.nav.providerCustomEndpoints,
            onSelect: () => openProviderView('custom-endpoints')
          }
        ],
        icon: Zap,
        id: 'providers',
        label: t.settings.nav.providers,
        onSelect: () => setActiveView('providers')
      },
      {
        active: activeView === 'gateway',
        icon: Globe,
        id: 'gateway',
        label: t.settings.nav.gateway,
        onSelect: () => setActiveView('gateway')
      },
      {
        active: activeView === 'keybinds',
        icon: Keyboard,
        id: 'keybinds',
        label: t.settings.nav.keybinds,
        onSelect: () => setActiveView('keybinds')
      },
      {
        active: activeView === 'keys',
        children: [
          {
            active: activeView === 'keys' && keysView === 'tools',
            icon: Wrench,
            id: 'kview:tools',
            label: t.settings.nav.keysTools,
            onSelect: () => openKeysView('tools')
          },
          {
            active: activeView === 'keys' && keysView === 'settings',
            icon: Settings2,
            id: 'kview:settings',
            label: t.settings.nav.keysSettings,
            onSelect: () => openKeysView('settings')
          }
        ],
        icon: KeyRound,
        id: 'keys',
        label: t.settings.nav.apiKeys,
        onSelect: () => setActiveView('keys')
      },
      {
        active: activeView === 'plugins',
        icon: Package,
        id: 'plugins',
        label: t.settings.nav.plugins,
        onSelect: () => setActiveView('plugins')
      },
      {
        active: activeView === 'sessions',
        icon: Archive,
        id: 'sessions',
        label: t.settings.nav.archivedChats,
        onSelect: () => setActiveView('sessions')
      },
      {
        active: activeView === 'about',
        icon: Info,
        id: 'about',
        label: t.settings.nav.about,
        onSelect: () => setActiveView('about')
      }
    ],
    [activeView, keysView, providerView, t, setActiveView, openProviderView, openKeysView]
  )

  const navFooter = (
    <>
      <Tip label={t.settings.exportConfig}>
        <OverlayIconButton onClick={() => void exportConfig()}>
          <Download />
        </OverlayIconButton>
      </Tip>
      <Tip label={t.settings.importConfig}>
        <OverlayIconButton
          onClick={() => {
            triggerHaptic('open')
            importInputRef.current?.click()
          }}
        >
          <Upload />
        </OverlayIconButton>
      </Tip>
      <Tip label={t.settings.resetToDefaults}>
        <OverlayIconButton
          className="hover:text-destructive"
          onClick={() => {
            triggerHaptic('warning')
            void resetConfig()
          }}
        >
          <RefreshCw />
        </OverlayIconButton>
      </Tip>
    </>
  )

  return (
    <OverlayView closeLabel={t.settings.closeSettings} onClose={onClose}>
      <input
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportConfig}
        ref={importInputRef}
        type="file"
      />
      <OverlaySplitLayout>
        <OverlayNav footer={navFooter} groups={navGroups} />

        <OverlayMain className="px-0 pb-0">
          {activeView === 'config:appearance' ? (
            <AppearanceSettings />
          ) : activeView === 'about' ? (
            <AboutSettings />
          ) : activeView === 'gateway' ? (
            <GatewaySettings />
          ) : activeView === 'keybinds' ? (
            <KeybindSettings />
          ) : activeView.startsWith('config:') ? (
            <ConfigSettings
              activeSectionId={activeView.slice('config:'.length)}
              onConfigSaved={onConfigSaved}
              onMainModelChanged={onMainModelChanged}
            />
          ) : activeView === 'providers' ? (
            <ProvidersSettings
              onConfigSaved={onConfigSaved}
              onMainModelChanged={onMainModelChanged}
              view={providerView}
            />
          ) : activeView === 'keys' ? (
            <KeysSettings onConfigSaved={onConfigSaved} view={keysView} />
          ) : activeView === 'notifications' ? (
            <NotificationsSettings />
          ) : activeView === 'plugins' ? (
            <PluginsSettings />
          ) : (
            <SessionsSettings />
          )}
        </OverlayMain>
      </OverlaySplitLayout>
    </OverlayView>
  )
}

export { SettingsView as SettingsPage }
