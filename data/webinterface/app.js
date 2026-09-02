    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('overlay');
    const menuToggles = Array.from(document.querySelectorAll('[data-menu-toggle]'));
    const menuItems = Array.from(document.querySelectorAll('.menu-item'));
    const pages = Array.from(document.querySelectorAll('.page'));
    const mobileTopbarTitle = document.getElementById('mobileTopbarTitle');
    const desktopPageTitle = document.getElementById('desktopPageTitle');
    const headerNetworkIcon = document.getElementById('headerNetworkIcon');
    const networkConfigIcon = document.getElementById('networkConfigIcon');
    const applyNetworkIcon = document.getElementById('applyNetworkIcon');
    const headerWifiDot = document.getElementById('headerWifiDot');
    const headerWifiStatus = document.getElementById('headerWifiStatus');
    const headerReachabilityDot = document.getElementById('headerReachabilityDot');
    const headerDeviceStatus = document.getElementById('headerDeviceStatus');
    const headerSecurityStatus = document.getElementById('headerSecurityStatus');
    const headerClockLabel = document.getElementById('headerClockLabel');
    const headerClockStatus = document.getElementById('headerClockStatus');
    const usersSessionStatus = document.getElementById('usersSessionStatus');
    const usersSessionHelp = document.getElementById('usersSessionHelp');
    const usersLoginBtn = document.getElementById('usersLoginBtn');
    const themeToggle = document.getElementById('themeToggle');
    const flowWebAssetVersionStorageKey = 'flow_web_asset_version';
    const flowWebThemeStorageKey = 'flow_web_theme';
    const deferredVisualAssetsStateKey = 'flow_web_deferred_visual_assets';
    const rebootActionDelaySeconds = 5;
    const deferredMenuAssetStartDelayMs = 520;
    const deferredMenuAssetStepMs = 140;
    const deferredMenuAssetReloadDelayMs = 1400;
    const deferredMenuAssetReloadStepMs = 850;
    const deferredMenuAssetReloadFallbackDelayMs = 6500;
    const deviceReachabilityProbeMs = 5000;
    const deviceReachabilityFetchTimeoutMs = 2500;
    const deviceReachabilityLostThreshold = 3;
    const remoteMenuIconFontLinkId = 'flowMenuIconFontRemote';
    const remoteMenuIconFontHref = 'https://fonts.googleapis.com/icon?family=Material+Symbols+Rounded&display=block';
    const remoteMenuIconLigatures = {
      'icon-measures': 'water_damage',
      'icon-pool': 'pool',
      'icon-io': 'lan',
      'icon-calibration': 'science',
      'icon-terminal': 'list_alt',
      'icon-activity': 'history',
      'icon-system': 'system_update_alt',
      'icon-flowcfg': 'settings',
      'icon-network': 'wifi',
      'icon-info': 'info',
      'icon-users': 'manage_accounts'
    };
    const cfgI18nDebugEnabled = false;
    const flowStatusDebugEnabled = true;
    let webAssetVersion = '';
    let loadedWebAssetVersion = '';
    let supervisorFirmwareVersion = '-';
    let nextionDisplayVersion = '';
    let supervisorUptimeMs = 0;
    let supervisorHeap = {};
    let webProfileName = 'Supervisor';
    let webDeviceName = 'flowio';
    let infoLastMac = '-';
    let webProfileKey = 'supervisor';
    let webLocalConfigLabel = 'Config Store Supervisor';
    let webLocalRuntime = false;
    let webRemoteConfigEnabled = true;
    let webAdminAuthenticated = false;
    let webPhysicalRecoveryActive = false;
    let webPhysicalRecoveryRemainingSeconds = 0;
    let hideMenuSvg = false;
    let disableWebIcons = false;
    let unifyStatusCardIcons = false;
    let flowStatusLiveTimer = null;
    let pageLoadToken = 0;
    let currentPageId = '';
    let deferredVisualAssetsScheduled = false;
    let menuAssetsActivated = false;
    let deferredMenuAssetsArmed = false;
    let networkMode = 'none';
    let networkTransport = 'none';
    let currentFlowTimeSourceLabel = '';
    let useRemoteMenuIcons = false;
    let remoteMenuIconFontReady = false;
    let remoteMenuIconFontPromise = null;
    let appHeaderClockTimer = null;
    let deviceReachabilityTimer = null;
    let deviceReachabilityInFlight = false;
    let deviceReachabilityMisses = 0;
    let deviceReachabilityReachable = false;
    const pendingSystemActionCountdowns = new Map();
    let activeColorPickerPopover = null;
    let webUiLocale = 'fr';
    let webUiLocaleProbeInFlight = false;
    let webUiLocaleProbePromise = null;
    let webUiLocaleNextProbeAt = 0;
    const webUiLocaleProbeActiveMs = 5000;
    const webUiLocaleProbeIdleMs = 15000;
    let webUiI18n = { fr: {}, en: {} };
    const webUiLocaleBundleState = {
      loaded: {},
      loading: {}
    };

    function normalizeWebUiLocale(raw) {
      const value = String(raw || '').trim().toLowerCase().replace('_', '-');
      if (!value) return 'fr';
      if (value.startsWith('en')) return 'en';
      return 'fr';
    }

    function currentWebLocaleTag() {
      return webUiLocale === 'en' ? 'en-US' : 'fr-FR';
    }

    function tr(key, fallback) {
      const localized = webUiI18n[webUiLocale] && webUiI18n[webUiLocale][key];
      if (typeof localized === 'string' && localized.length > 0) return localized;
      const fr = webUiI18n.fr && webUiI18n.fr[key];
      if (typeof fr === 'string' && fr.length > 0) return fr;
      if (typeof fallback === 'string' && fallback.length > 0) return fallback;
      return key;
    }

    function cfgI18nDebugLog(message, details) {
      if (!cfgI18nDebugEnabled) return;
      if (!window || !window.console || typeof window.console.info !== 'function') return;
      if (typeof details === 'undefined') {
        window.console.info('[cfg-i18n] ' + String(message || ''));
        return;
      }
      window.console.info('[cfg-i18n] ' + String(message || ''), details);
    }

    function flowStatusDebugLog(message, details) {
      if (!flowStatusDebugEnabled) return;
      if (!window || !window.console || typeof window.console.warn !== 'function') return;
      if (typeof details === 'undefined') {
        window.console.warn('[flow-status] ' + String(message || ''));
        return;
      }
      window.console.warn('[flow-status] ' + String(message || ''), details);
    }

    function webI18nAssetUrlForLocale(locale) {
      const base = assetUrl('/webinterface/i18n/' + locale + '.json');
      const sep = base.indexOf('?') >= 0 ? '&' : '?';
      return base + sep + 'l=' + encodeURIComponent(locale);
    }

    async function ensureWebUiLocaleBundle(locale, forceReload) {
      const normalized = normalizeWebUiLocale(locale);
      if (!forceReload && webUiLocaleBundleState.loaded[normalized]) return true;
      if (webUiLocaleBundleState.loading[normalized]) {
        return webUiLocaleBundleState.loading[normalized];
      }

      const promise = (async () => {
        try {
          const response = await fetchWithBusyRetry(
            webI18nAssetUrlForLocale(normalized),
            { cache: 'no-store' }
          );
          const payload = await response.json().catch(() => null);
          const source = payload && typeof payload === 'object' && payload.translations && typeof payload.translations === 'object'
            ? payload.translations
            : payload;
          if (!response.ok || !source || typeof source !== 'object') return false;

          const mapped = {};
          Object.keys(source).forEach((rawKey) => {
            if (typeof source[rawKey] !== 'string') return;
            const key = String(rawKey || '').trim();
            if (!key) return;
            mapped[key] = source[rawKey];
          });
          webUiI18n[normalized] = mapped;
          webUiLocaleBundleState.loaded[normalized] = true;
          return true;
        } catch (err) {
          return false;
        } finally {
          delete webUiLocaleBundleState.loading[normalized];
        }
      })();

      webUiLocaleBundleState.loading[normalized] = promise;
      return promise;
    }

    function applyStaticTranslations() {
      document.querySelectorAll('[data-i18n]').forEach((node) => {
        const key = String(node.getAttribute('data-i18n') || '').trim();
        if (!key) return;
        const fallback = String(node.textContent || '').trim();
        node.textContent = tr(key, fallback);
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
        const key = String(node.getAttribute('data-i18n-placeholder') || '').trim();
        if (!key) return;
        const fallback = String(node.getAttribute('placeholder') || '').trim();
        node.setAttribute('placeholder', tr(key, fallback));
      });
      document.querySelectorAll('[data-i18n-title]').forEach((node) => {
        const key = String(node.getAttribute('data-i18n-title') || '').trim();
        if (!key) return;
        const fallback = String(node.getAttribute('title') || '').trim();
        node.setAttribute('title', tr(key, fallback));
      });
      document.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
        const key = String(node.getAttribute('data-i18n-aria-label') || '').trim();
        if (!key) return;
        const fallback = String(node.getAttribute('aria-label') || '').trim();
        node.setAttribute('aria-label', tr(key, fallback));
      });
    }

    function applyWebUiLocale(locale) {
      const normalized = normalizeWebUiLocale(locale);
      if (webUiLocale === normalized) {
        applyStaticTranslations();
        syncMobileTopbarTitle(getActivePageId());
        if (infoPage) infoPage.render();
        updateThemeToggleUi(currentThemePreference());
        if (configurationPage) configurationPage.refreshLocale(false).catch(() => {});
        ensureWebUiLocaleBundle(normalized, false).then((loaded) => {
          if (!loaded || webUiLocale !== normalized) return;
          applyStaticTranslations();
          syncMobileTopbarTitle(getActivePageId());
          if (infoPage) infoPage.render();
          updateThemeToggleUi(currentThemePreference());
          applyProfileUiText();
          syncMenuIconFallbacks();
          if (infoPage) infoPage.render();
          if (poolPage) poolPage.refreshLocale();
          if (configurationPage) configurationPage.refreshLocale(false).catch(() => {});
        }).catch(() => {});
        return;
      }
      webUiLocale = normalized;
      document.documentElement.lang = webUiLocale;
      document.body.setAttribute('data-ui-locale', webUiLocale);
      const knownLocalLabels = new Set([
        'Config Store Supervisor',
        'Config Store Micronova',
        'Supervisor Config Store',
        'Micronova Config Store'
      ]);
      if (knownLocalLabels.has(String(webLocalConfigLabel || '').trim())) {
        webLocalConfigLabel = isMicronovaProfile()
          ? tr('cfg.local.micronova', 'Config Store Micronova')
          : tr('cfg.local.supervisor', 'Config Store Supervisor');
      }
      applyStaticTranslations();
      syncMobileTopbarTitle(getActivePageId());
      if (infoPage) infoPage.render();
      updateThemeToggleUi(currentThemePreference());
      applyProfileUiText();
      syncMenuIconFallbacks();
      if (infoPage) infoPage.render();
      if (poolPage) poolPage.refreshLocale();
      if (configurationPage) configurationPage.refreshLocale(true).catch(() => {});

      ensureWebUiLocaleBundle(normalized, false).then((loaded) => {
        if (!loaded || webUiLocale !== normalized) return;
        applyStaticTranslations();
        syncMobileTopbarTitle(getActivePageId());
        if (infoPage) infoPage.render();
        updateThemeToggleUi(currentThemePreference());
        applyProfileUiText();
        syncMenuIconFallbacks();
        if (infoPage) infoPage.render();
        if (poolPage) poolPage.refreshLocale();
        if (configurationPage) configurationPage.refreshLocale(true).catch(() => {});
      }).catch(() => {});
    }

    async function fetchConfiguredWebUiLocale() {
      const res = await fetchWithBusyRetry('/api/supervisorcfg/module?name=system', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.ok !== true || !data.data || typeof data.data !== 'object') {
        cfgI18nDebugLog('supervisorcfg/system unavailable for locale probe', {
          ok: !!(data && data.ok),
          status: res ? res.status : 0
        });
        return null;
      }
      const payload = data.data;
      cfgI18nDebugLog('supervisorcfg/system locale payload', payload);
      const tryLocale = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        return normalizeWebUiLocale(raw);
      };

      const direct = tryLocale(payload.lang);
      if (direct) {
        cfgI18nDebugLog('locale resolved from key `lang`', { locale: direct });
        return direct;
      }

      const keyedCandidates = ['system/lang', 'system.lang', 'web/lang', 'web.lang'];
      for (const key of keyedCandidates) {
        if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
        const candidate = tryLocale(payload[key]);
        if (candidate) {
          cfgI18nDebugLog('locale resolved from key `' + key + '`', { locale: candidate });
          return candidate;
        }
      }

      const nestedCandidates = ['system', 'web'];
      for (const groupKey of nestedCandidates) {
        const group = payload[groupKey];
        if (!group || typeof group !== 'object') continue;
        const candidate = tryLocale(group.lang);
        if (candidate) {
          cfgI18nDebugLog('locale resolved from nested `' + groupKey + '.lang`', { locale: candidate });
          return candidate;
        }
      }

      cfgI18nDebugLog('locale probe failed: no matching key found', Object.keys(payload));
      return null;
    }

    async function refreshWebUiLocale(forceRefresh) {
      const now = Date.now();
      const probeWindow = (!document.hidden && getActivePageId() === 'page-info')
        ? webUiLocaleProbeActiveMs
        : webUiLocaleProbeIdleMs;
      if (!forceRefresh && now < webUiLocaleNextProbeAt) return;
      if (webUiLocaleProbeInFlight) {
        if (webUiLocaleProbePromise) {
          await webUiLocaleProbePromise.catch(() => {});
        }
        return;
      }
      webUiLocaleProbeInFlight = true;
      webUiLocaleProbePromise = (async () => {
        try {
          const next = await fetchConfiguredWebUiLocale();
          if (next) applyWebUiLocale(next);
        } catch (err) {
        } finally {
          webUiLocaleProbeInFlight = false;
          webUiLocaleNextProbeAt = Date.now() + probeWindow;
          webUiLocaleProbePromise = null;
        }
      })();
      await webUiLocaleProbePromise;
    }

    function normalizeNetworkMode(value) {
      const raw = String(value || '').trim().toLowerCase();
      if (raw === 'ap' || raw === 'accesspoint' || raw === 'access_point') return 'ap';
      if (raw === 'station' || raw === 'sta') return 'station';
      if (raw === 'ethernet') return 'ethernet';
      return 'none';
    }

    function normalizeNetworkType(value) {
      const raw = String(value || '').trim().toLowerCase();
      if (raw === 'ethernet' || raw === 'eth' || raw === 'wired') return 'ethernet';
      if (raw === 'wifi' || raw === 'wi-fi' || raw === 'station' || raw === 'sta') return 'wifi';
      return '';
    }

    function formatInfoNetworkType(value) {
      const normalized = normalizeNetworkType(value);
      if (normalized === 'ethernet') return tr('info.netType.ethernet', 'Ethernet');
      if (normalized === 'wifi') return tr('info.netType.wifi', 'Wifi');
      const raw = String(value || '').trim().toLowerCase();
      if (!raw || raw === 'none' || raw === 'ap' || raw === 'accesspoint' || raw === 'access_point') return '-';
      return String(value);
    }

    function normalizeNetworkTransport(value) {
      const raw = normalizeNetworkType(value);
      return raw || 'none';
    }

    function isAccessPointMode() {
      return normalizeNetworkMode(networkMode) === 'ap';
    }

    function applyMenuIconSourcePreference(useRemote) {
      useRemoteMenuIcons = !!useRemote;
      document.body.classList.toggle('menu-icons-remote', useRemoteMenuIcons);
      document.body.classList.toggle('menu-icons-letter-fallback', false);
      syncMenuIconFallbacks();
    }

    function menuIconLigatureForNode(iconNode) {
      if (!iconNode || !iconNode.classList) return '';
      const iconClasses = Object.keys(remoteMenuIconLigatures);
      for (let i = 0; i < iconClasses.length; i += 1) {
        const cls = iconClasses[i];
        if (iconNode.classList.contains(cls)) return remoteMenuIconLigatures[cls];
      }
      return '';
    }

    function ensureRemoteMenuIconFontLoaded() {
      if (remoteMenuIconFontReady) return Promise.resolve(true);
      if (remoteMenuIconFontPromise) return remoteMenuIconFontPromise;

      remoteMenuIconFontPromise = new Promise((resolve) => {
        let link = document.getElementById(remoteMenuIconFontLinkId);
        if (link) {
          remoteMenuIconFontReady = link.getAttribute('data-flow-ready') === '1';
          if (remoteMenuIconFontReady) {
            resolve(true);
            return;
          }
          link.remove();
        }
        link = document.createElement('link');
        link.id = remoteMenuIconFontLinkId;
        link.rel = 'stylesheet';
        link.href = remoteMenuIconFontHref;
        let done = false;
        const finalize = (ok) => {
          if (done) return;
          done = true;
          remoteMenuIconFontReady = !!ok;
          if (remoteMenuIconFontReady) {
            link.setAttribute('data-flow-ready', '1');
          }
          resolve(remoteMenuIconFontReady);
        };
        link.onload = () => finalize(true);
        link.onerror = () => finalize(false);
        document.head.appendChild(link);
        setTimeout(() => finalize(false), 2600);
      }).finally(() => {
        remoteMenuIconFontPromise = null;
      });

      return remoteMenuIconFontPromise;
    }

    function menuFallbackLetter(label) {
      const text = String(label || '').trim();
      if (!text) return '?';
      return Array.from(text)[0].toLocaleUpperCase(currentWebLocaleTag());
    }

    function iconCheckText() {
      return '✓';
    }

    function syncMenuIconFallbacks() {
      const useLetterFallback = document.body.classList.contains('menu-icons-letter-fallback');
      menuItems.forEach((item) => {
        if (!item) return;
        const icon = item.querySelector('.ico');
        const label = item.querySelector('.label');
        if (!icon || !label) return;
        const fallback = menuFallbackLetter(label.textContent);
        icon.setAttribute('data-fallback-text', fallback);
        if (disableWebIcons || useLetterFallback) {
          icon.textContent = fallback;
          return;
        }
        if (useRemoteMenuIcons) {
          icon.textContent = menuIconLigatureForNode(icon);
          return;
        }
        icon.textContent = '';
      });
    }

    function syncRenderedCheckFallbacks() {
      const checkText = iconCheckText();
      document.querySelectorAll('.step-ic.done').forEach((node) => {
        if (!node) return;
        node.textContent = checkText;
      });
      document.querySelectorAll('.status-flag-check.is-true').forEach((node) => {
        if (!node) return;
        node.textContent = checkText;
      });
      document.querySelectorAll('.measure-domain-chip-check').forEach((node) => {
        if (!node) return;
        node.textContent = checkText;
      });
      document.querySelectorAll('.control-field-apply').forEach((node) => {
        if (!node) return;
        node.textContent = checkText;
      });
    }

    function applyIconUsagePreference(disabled) {
      disableWebIcons = !!disabled;
      document.body.classList.toggle('web-icons-disabled', disableWebIcons);
      document.body.classList.toggle('menu-icons-letter-fallback', false);
      syncMenuIconFallbacks();
      syncRenderedCheckFallbacks();
    }

    function applyMenuIconPreference(hidden) {
      hideMenuSvg = !!hidden;
      document.body.classList.toggle('menu-icons-disabled', hideMenuSvg);
    }

    function applyStatusIconPreference(unified) {
      unifyStatusCardIcons = !!unified;
    }

    function resolveSupervisorFirmwareVersion() {
      try {
        const meta = window.__FLOW_WEB_META__;
        const version = String(meta && meta.firmware_version || '').trim();
        return version || '-';
      } catch (error) {
        return '-';
      }
    }

    function ingestWebProfileMeta(data) {
      if (!data || typeof data !== 'object') return;
      const rawProfile = String(data.profile_name || data.profile || '').trim();
      if (rawProfile) {
        webProfileName = rawProfile;
        webProfileKey = rawProfile.toLowerCase();
      }
      const rawDeviceName = String(data.devicename || data.deviceName || '').trim();
      webDeviceName = rawDeviceName || 'flowio';
      webLocalRuntime = data.local_runtime === true;
      const label = String(data.local_config_label || '').trim();
      webLocalConfigLabel = label || (isMicronovaProfile()
        ? tr('cfg.local.micronova', 'Config Store Micronova')
        : tr('cfg.local.supervisor', 'Config Store Supervisor'));
      webRemoteConfigEnabled = data.remote_config_enabled !== false;
      runtimeMeasureDomainKeys = runtimeDomainsForProfile();
      runtimeManifestDomainCache = null;
      runtimeManifestDomainLoadPromise = null;
      if (poolPage) poolPage.syncRuntimeDomains(isMicronovaProfile());
      document.body.classList.toggle('profile-micronova', isMicronovaProfile());
      applyProfileUiText();
      renderPoolMeasureDomainButtons();
    }

    async function applyMenuIconModeFromMeta(data) {
      const mode = normalizeNetworkMode(data && data.network_mode);
      networkMode = mode;
      networkTransport = normalizeNetworkTransport(data && (data.network_transport || data.transport));
      const remoteReady = await ensureRemoteMenuIconFontLoaded().catch(() => false);
      applyMenuIconSourcePreference(remoteReady);
    }

    function isMicronovaProfile() {
      return webProfileKey === 'micronova';
    }

    function isWaveshareProfile() {
      const key = String(webProfileKey || '').trim().toLowerCase();
      return key === 'waveshare'
        || key === 'flowios3'
        || key === 'esp32s3'
        || key === 'esp32-s3'
        || key === 'flowio-s3'
        || key.indexOf('waveshare') >= 0
        || key.indexOf('flowios3') >= 0;
    }

    function isFlowIOProfile() {
      return String(webProfileKey || '').trim().toLowerCase() === 'flowio';
    }

    function isSupervisorProfile() {
      const key = String(webProfileKey || '').trim().toLowerCase();
      return key === 'supervisor' || key.indexOf('supervisor') === 0;
    }

    function runtimeDomainsForProfile() {
      return isMicronovaProfile()
        ? ['micronova', 'alarm']
        : ['mode', 'equipements', 'sondes', 'alarm'];
    }

    function createRuntimeDomainState() {
      return { active: false, loading: false, entries: [], values: [], sondeSlots: [], alarmSlots: [], error: '', requestSeq: 0 };
    }

    function setLabelForInput(inputId, text) {
      const label = document.querySelector('label[for="' + inputId + '"]');
      if (label) label.textContent = text;
    }

    function hideFieldForInput(inputId, hidden) {
      const input = document.getElementById(inputId);
      const field = input ? input.closest('.field') : null;
      if (field) field.hidden = !!hidden;
    }

    function setSystemActionVisible(buttonId, visible) {
      const button = document.getElementById(buttonId);
      const action = button ? button.closest('.system-action') : null;
      if (action) action.hidden = !visible;
    }

    function setPageMenuVisible(pageId, visible) {
      const item = document.querySelector('[data-page="' + pageId + '"]');
      const page = document.getElementById(pageId);
      if (item) item.hidden = !visible;
      if (page) page.hidden = !visible;
    }

    function setBrandWordmark(firstPart) {
      const first = String(firstPart || '').trim() || 'Flow';
      document.querySelectorAll('.brand-flow').forEach((node) => {
        node.textContent = first;
      });
      document.querySelectorAll('.brand-wordmark,.mobile-title,.drawer-user').forEach((node) => {
        node.setAttribute('aria-label', first + '.io');
      });
      document.title = first + '.io';
    }

    function applyProfileUiText() {
      if (!document.body) return;
      setBrandWordmark(isMicronovaProfile() ? 'Pellet' : 'Flow');
      if (isMicronovaProfile()) {
        setPageMenuVisible('page-calibration', false);
        setPageMenuVisible('page-pool', false);
      }
      if (rebootDeviceTargetSelect) {
        const labelsByTarget = {
          supervisor: isMicronovaProfile() ? 'Micronova' : 'Supervisor',
          flow_soft: 'flow.io soft',
          flow_hard: 'flow.io hard',
          nextion: 'Nextion',
          factory_reset: 'Init Usine'
        };
        const blockValues = isMicronovaProfile()
          ? new Set(['flow_soft', 'flow_hard', 'nextion', 'factory_reset'])
          : (isWaveshareProfile() ? new Set(['supervisor', 'flow_hard']) : new Set());
        const hiddenValues = isWaveshareProfile()
          ? new Set(['supervisor', 'flow_hard'])
          : new Set();
        Array.from(rebootDeviceTargetSelect.options || []).forEach((option) => {
          if (!option) return;
          if (Object.prototype.hasOwnProperty.call(labelsByTarget, option.value)) {
            option.text = labelsByTarget[option.value];
          }
          option.disabled = blockValues.has(option.value);
          option.hidden = hiddenValues.has(option.value);
        });
        if (blockValues.has(rebootDeviceTargetSelect.value)) {
          const fallbackOption = Array.from(rebootDeviceTargetSelect.options || [])
            .find((option) => option && !option.disabled && !option.hidden);
          rebootDeviceTargetSelect.value = fallbackOption ? fallbackOption.value : 'supervisor';
        }
        if (factoryResetDeviceActionBtn) {
          factoryResetDeviceActionBtn.hidden = blockValues.has('factory_reset');
          factoryResetDeviceActionBtn.disabled = blockValues.has('factory_reset');
        }
      }
    }

    try {
      const browserLocale = (navigator && navigator.language) ? String(navigator.language) : '';
      webUiLocale = normalizeWebUiLocale(browserLocale);
    } catch (err) {
    }

    try {
      loadedWebAssetVersion = String(window.__FLOW_WEB_ASSET_VERSION__ || '').trim();
    } catch (err) {
      loadedWebAssetVersion = '';
    }
    webAssetVersion = loadedWebAssetVersion;
    if (!webAssetVersion) {
      webAssetVersion = getStorageValue(localStorage, flowWebAssetVersionStorageKey);
    }

    supervisorFirmwareVersion = resolveSupervisorFirmwareVersion();
    try {
      const initialMeta = window.__FLOW_WEB_META__;
      if (initialMeta && typeof initialMeta === 'object') {
        const initialFirmwareVersion = String(initialMeta.firmware_version || '').trim();
        if (initialFirmwareVersion) supervisorFirmwareVersion = initialFirmwareVersion;
        const initialNextionVersion = String(initialMeta.nextion_display_version || '').trim();
        if (initialNextionVersion && initialNextionVersion !== '0') {
          nextionDisplayVersion = initialNextionVersion;
        }
        const rawProfile = String(initialMeta.profile_name || initialMeta.profile || '').trim();
        if (rawProfile) {
          webProfileName = rawProfile;
          webProfileKey = rawProfile.toLowerCase();
        }
        const rawDeviceName = String(initialMeta.devicename || initialMeta.deviceName || '').trim();
        webDeviceName = rawDeviceName || 'flowio';
        const label = String(initialMeta.local_config_label || '').trim();
        webLocalConfigLabel = label || (isMicronovaProfile()
          ? tr('cfg.local.micronova', 'Config Store Micronova')
          : tr('cfg.local.supervisor', 'Config Store Supervisor'));
        webLocalRuntime = initialMeta.local_runtime === true;
        webRemoteConfigEnabled = initialMeta.remote_config_enabled !== false;
        networkMode = normalizeNetworkMode(initialMeta.network_mode);
        networkTransport = normalizeNetworkTransport(initialMeta.network_transport || initialMeta.transport);
      }
    } catch (err) {
    }

    function assetUrl(path) {
      if (!webAssetVersion) return path;
      const sep = path.indexOf('?') >= 0 ? '&' : '?';
      return path + sep + 'v=' + encodeURIComponent(webAssetVersion);
    }

    async function fetchWithBusyRetry(url, options, fetchImpl) {
      if (typeof fetchImpl === 'function') {
        const secured = window.FlowWebCore && typeof window.FlowWebCore.secureFetchOptions === 'function'
          ? window.FlowWebCore.secureFetchOptions(options)
          : options;
        return fetchImpl(url, secured);
      }
      if (window.FlowWebCore && typeof window.FlowWebCore.supervisorFetch === 'function') {
        return window.FlowWebCore.supervisorFetch(url, options, { retries: 4 });
      }
      return fetch(url, options);
    }

    function getStorageValue(storage, key) {
      try {
        return String(storage.getItem(key) || '').trim();
      } catch (err) {
        return '';
      }
    }

    function setStorageValue(storage, key, value) {
      try {
        storage.setItem(key, value);
      } catch (err) {
      }
    }

    function normalizeThemePreference(raw) {
      return String(raw || '').trim().toLowerCase() === 'dark' ? 'dark' : 'light';
    }

    function currentThemePreference() {
      return normalizeThemePreference(getStorageValue(localStorage, flowWebThemeStorageKey));
    }

    function themeToggleLabel(theme) {
      const isDark = theme === 'dark';
      if (webUiLocale === 'en') return isDark ? 'Light mode' : 'Dark mode';
      return isDark ? 'Mode clair' : 'Mode sombre';
    }

    function themeToggleTitle(theme) {
      const isDark = theme === 'dark';
      if (webUiLocale === 'en') return isDark ? 'Switch to light mode' : 'Switch to dark mode';
      return isDark ? 'Activer le mode clair' : 'Activer le mode sombre';
    }

    function updateThemeToggleUi(theme) {
      if (!themeToggle) return;
      const currentTheme = normalizeThemePreference(theme);
      const label = themeToggleLabel(currentTheme);
      const title = themeToggleTitle(currentTheme);
      const wrapper = themeToggle.closest('.theme-switch');
      const labelNode = wrapper ? wrapper.querySelector('.theme-toggle-label') : null;
      themeToggle.checked = currentTheme === 'dark';
      themeToggle.setAttribute('aria-label', title);
      if (wrapper) wrapper.setAttribute('title', title);
      if (labelNode) labelNode.textContent = label;
    }

    function applyThemePreference(theme, persist) {
      const currentTheme = normalizeThemePreference(theme);
      document.documentElement.setAttribute('data-theme', currentTheme);
      document.documentElement.style.colorScheme = currentTheme;
      if (persist) {
        setStorageValue(localStorage, flowWebThemeStorageKey, currentTheme);
      }
      updateThemeToggleUi(currentTheme);
    }

    async function fetchJsonResponse(url, options, fetchImpl) {
      const res = await fetchWithBusyRetry(url, options, fetchImpl);
      const data = await res.json().catch(() => null);
      return { res, data };
    }

    function extractApiErrorMessage(data, fallback) {
      if (!data || typeof data !== 'object') return fallback;
      const err = data.err;
      if (!err || typeof err !== 'object') return fallback;

      const msg = typeof err.msg === 'string' ? err.msg.trim() : '';
      const code = typeof err.code === 'string' ? err.code.trim() : '';
      const where = typeof err.where === 'string' ? err.where.trim() : '';
      const debugDetail = typeof err.detail === 'string' ? err.detail.trim() : '';
      const detail = msg || [code, where].filter(Boolean).join(' @ ');
      const composed = [detail, debugDetail].filter(Boolean).join(' | ');
      if (!composed) return fallback;
      return fallback ? (fallback + ' : ' + composed) : composed;
    }

    function normalizeUpgradeHttpErrorMessage(rawMessage, fallback) {
      const normalizedFallback = String(fallback || tr('updates.err.updateGeneric', 'Erreur de mise à jour.')).trim();
      let raw = String(rawMessage || '').trim().replace(/^error:\s*/i, '');
      if (normalizedFallback && raw.toLowerCase().startsWith(normalizedFallback.toLowerCase())) {
        raw = raw.slice(normalizedFallback.length).replace(/^\s*:\s*/, '').trim() || raw;
      }
      if (!raw) return normalizedFallback;
      const lower = raw.toLowerCase();
      const folded = typeof lower.normalize === 'function'
        ? lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : lower;

      if (folded.includes('serveur http injoignable') || folded.includes('failed to fetch') || folded.includes('load failed')) {
        return tr('updates.err.serverUnreachable', 'Serveur HTTP d’upgrade non joignable.');
      }

      if (folded.includes('manifest introuvable (404)')) {
        return tr('updates.err.manifestNotFound', 'Manifest d’upgrade introuvable sur le serveur (404).');
      }

      if (folded.includes('fichier de mise a jour introuvable (404)')) {
        return tr('updates.err.fileNotFound', 'Fichier de mise à jour introuvable sur le serveur (404).');
      }

      const httpStatusMatch = folded.match(/(?:erreur\s+http|http)\s+(-?\d+)/);
      if (httpStatusMatch && httpStatusMatch[1]) {
        const status = httpStatusMatch[1];
        if (status === '404') return tr('updates.err.fileNotFound', 'Fichier de mise à jour introuvable sur le serveur (404).');
        if (status.charAt(0) === '-') return tr('updates.err.serverUnreachable', 'Serveur HTTP d’upgrade non joignable.');
        return tr('updates.err.httpStatus', 'Erreur HTTP {status} renvoyée par le serveur d’upgrade.')
          .replace('{status}', status);
      }

      return raw;
    }

    function ensureOkJsonResponse(response, message) {
      if (!response.res.ok || !response.data || response.data.ok !== true) {
        if (response.res && response.res.status === 401) {
          throw new Error('connexion administrateur requise');
        }
        if (response.res && response.res.status === 403) {
          throw new Error('opération refusée : session administrateur ou jeton de sécurité requis');
        }
        throw new Error(extractApiErrorMessage(response.data, message));
      }
      return response.data;
    }

    async function fetchOkJson(url, options, message, fetchImpl) {
      return ensureOkJsonResponse(await fetchJsonResponse(url, options, fetchImpl), message);
    }

    function createUrlEncodedBody(values) {
      const body = new URLSearchParams();
      Object.keys(values || {}).forEach((key) => {
        const value = values[key];
        body.set(key, value === null || typeof value === 'undefined' ? '' : String(value));
      });
      return body.toString();
    }

    function createFormPostOptions(values) {
      return {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: createUrlEncodedBody(values)
      };
    }

    function utf8ByteLength(value) {
      const text = String(value || '');
      if (typeof TextEncoder === 'function') {
        return new TextEncoder().encode(text).length;
      }
      return text.length;
    }

    function runAsyncTaskSafely(task) {
      return Promise.resolve().then(task).catch(() => {});
    }

    function createIntervalRunner(task, delayMs) {
      let timer = null;
      return {
        start() {
          if (timer) return;
          timer = setInterval(() => {
            runAsyncTaskSafely(task);
          }, delayMs);
        },
        stop() {
          if (!timer) return;
          clearInterval(timer);
          timer = null;
        }
      };
    }

    function createTimeoutRunner(task) {
      let timer = null;
      return {
        schedule(delayMs) {
          this.stop();
          timer = setTimeout(() => {
            timer = null;
            runAsyncTaskSafely(task);
          }, delayMs);
        },
        stop() {
          if (!timer) return;
          clearTimeout(timer);
          timer = null;
        }
      };
    }

    function bindClickAction(el, handler) {
      if (!el) return;
      el.addEventListener('click', () => {
        runAsyncTaskSafely(handler);
      });
    }

    function getActivePageId() {
      if (currentPageId) return currentPageId;
      const active = document.querySelector('.page.active');
      return active ? active.id : '';
    }

    function buildNodeGrid(className, items) {
      const nodes = (items || []).filter((item) => item && typeof item.nodeType === 'number');
      if (nodes.length === 0) return null;
      const wrapper = document.createElement('div');
      wrapper.className = className;
      nodes.forEach((node) => wrapper.appendChild(node));
      return wrapper;
    }

    function currentDeferredVisualAssetsVersion() {
      return (webAssetVersion || loadedWebAssetVersion || 'noversion').trim() || 'noversion';
    }

    function getDeferredVisualAssetsWarmState() {
      return getStorageValue(localStorage, deferredVisualAssetsStateKey);
    }

    function hasWarmDeferredVisualAssets() {
      return getDeferredVisualAssetsWarmState() === currentDeferredVisualAssetsVersion();
    }

    function markDeferredVisualAssetsWarm() {
      setStorageValue(localStorage, deferredVisualAssetsStateKey, currentDeferredVisualAssetsVersion());
    }

    function navigationType() {
      try {
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries && navEntries[0] && typeof navEntries[0].type === 'string') {
          return navEntries[0].type;
        }
      } catch (err) {
      }
      try {
        if (performance && performance.navigation) {
          if (performance.navigation.type === 1) return 'reload';
          if (performance.navigation.type === 0) return 'navigate';
        }
      } catch (err) {
      }
      return '';
    }

    function isReloadNavigation() {
      return navigationType() === 'reload';
    }

    function activateMenuAssets() {
      if (menuAssetsActivated) return;
      menuAssetsActivated = true;
      markDeferredVisualAssetsWarm();
    }

    function armDeferredMenuAssets() {
      if (deferredMenuAssetsArmed || menuAssetsActivated) return;
      deferredMenuAssetsArmed = true;
      activateMenuAssets();
    }

    function scheduleDeferredVisualAssets() {
      if (deferredVisualAssetsScheduled) return;
      deferredVisualAssetsScheduled = true;
      armDeferredMenuAssets();
    }

    async function loadWebMeta(options) {
      try {
        const data = await fetchOkJson('/api/web/meta', { cache: 'no-store' }, 'meta web indisponible');
        ingestWebProfileMeta(data);
        // Capture version fields before any optional visual/i18n work: a
        // missing secondary asset must never blank the Updates page.
        if (typeof data.firmware_version === 'string') {
          const trimmed = data.firmware_version.trim();
          if (trimmed) supervisorFirmwareVersion = trimmed;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'nextion_display_version')) {
          const rawNextionVersion = String(data.nextion_display_version || '').trim();
          nextionDisplayVersion = rawNextionVersion && rawNextionVersion !== '0'
            ? rawNextionVersion
            : '';
        }
        webAdminAuthenticated = data.admin_authenticated === true;
        webPhysicalRecoveryActive = data.physical_recovery_active === true;
        webPhysicalRecoveryRemainingSeconds = Math.max(0, Number(data.physical_recovery_remaining_s) || 0);
        refreshUsersSessionUi();

        if (typeof data.web_asset_version === 'string') {
          const announcedVersion = data.web_asset_version.trim();
          if (announcedVersion) {
            const previousVersion = (webAssetVersion || '').trim();
            webAssetVersion = announcedVersion;
            if (previousVersion && previousVersion !== announcedVersion) {
              runtimeManifestDomainCache = null;
              runtimeManifestDomainLoadPromise = null;
            }
            setStorageValue(localStorage, flowWebAssetVersionStorageKey, announcedVersion);
            if (loadedWebAssetVersion && loadedWebAssetVersion !== announcedVersion) {
              const reloadKey = 'flow_web_asset_reload_once';
              try {
                if (sessionStorage.getItem(reloadKey) !== announcedVersion) {
                  sessionStorage.setItem(reloadKey, announcedVersion);
                  window.location.reload();
                  return;
                }
              } catch (err) {
                window.location.reload();
                return;
              }
            }
            try {
              if (sessionStorage.getItem('flow_web_asset_reload_once') === announcedVersion) {
                sessionStorage.removeItem('flow_web_asset_reload_once');
              }
            } catch (err) {
            }
          }
        }
        applyIconUsagePreference(false);
        applyMenuIconPreference(false);
        applyStatusIconPreference(!!data.unify_status_card_icons);
        await applyMenuIconModeFromMeta(data);
        await refreshWebUiLocale(false);
        if (!disableWebIcons && hasWarmDeferredVisualAssets()) {
          activateMenuAssets(false);
        }
        scheduleDeferredVisualAssets();
        supervisorUptimeMs = Number(data.upms) || 0;
        supervisorHeap = (data.heap && typeof data.heap === 'object') ? data.heap : {};
        if (updatesPage) updatesPage.renderInitial();
        refreshAppHeader(getActivePageId());
        if (isPageActive('page-status')) {
          refreshFlowStatus(false).catch(() => {});
        }
      } catch (err) {
        scheduleDeferredVisualAssets();
      }
    }

    function isMobileLayout() {
      return window.innerWidth <= 900;
    }

    function resolvePageMenuLabel(pageId) {
      const item = document.querySelector('[data-page="' + pageId + '"]');
      if (!item) return '';
      const label = item.querySelector('.label');
      return String(label && label.textContent ? label.textContent : '').trim();
    }

    function formatHeaderNetworkStatus() {
      try {
        const wifiDomain = (flowStatusDomainCache.wifi && flowStatusDomainCache.wifi.data && flowStatusDomainCache.wifi.data.ok === true)
          ? flowStatusDomainCache.wifi.data
          : null;
        const wifi = (wifiDomain && wifiDomain.wifi && typeof wifiDomain.wifi === 'object') ? wifiDomain.wifi : null;
        if (wifi) {
          if (typeof wifi.rdy === 'boolean') {
            return wifi.rdy ? tr('info.state.connected', 'Connecté') : tr('info.state.disconnected', 'Déconnecté');
          }
          const type = formatInfoNetworkType(wifi.typ);
          if (type && type !== '-') return type;
        }
      } catch (err) {
      }
      const mode = normalizeNetworkMode(networkMode);
      if (mode === 'ap') return 'AP';
      const type = currentFlowNetworkType();
      if (type) return formatInfoNetworkType(type);
      if (mode === 'station') return tr('info.netType.wifi', 'Wifi');
      if (mode === 'ethernet') return tr('info.netType.ethernet', 'Ethernet');
      return '-';
    }

    function effectiveNetworkType(wifi, domainReady) {
      const transport = normalizeNetworkType(networkTransport);
      if (transport) return transport;

      const ready = wifi && typeof wifi.rdy === 'boolean'
        ? wifi.rdy
        : !!domainReady;
      if (!ready) return '';

      const runtimeType = normalizeNetworkType(wifi && wifi.typ);
      if (runtimeType) return runtimeType;

      const mode = normalizeNetworkMode(networkMode);
      if (mode === 'ethernet') return 'ethernet';
      if (mode === 'station') return 'wifi';
      return '';
    }

    function currentFlowNetworkType() {
      try {
        const wifiDomain = (flowStatusDomainCache.wifi && flowStatusDomainCache.wifi.data && flowStatusDomainCache.wifi.data.ok === true)
          ? flowStatusDomainCache.wifi.data
          : null;
        const wifi = (wifiDomain && wifiDomain.wifi && typeof wifiDomain.wifi === 'object') ? wifiDomain.wifi : null;
        const type = effectiveNetworkType(wifi, !!wifiDomain);
        if (type) return type;
      } catch (err) {
      }
      const transport = normalizeNetworkType(networkTransport);
      if (transport) return transport;
      const mode = normalizeNetworkMode(networkMode);
      if (mode === 'ethernet') return 'ethernet';
      if (mode === 'station') return 'wifi';
      return '';
    }

    function currentFlowNetworkIcon() {
      return currentFlowNetworkType() === 'ethernet' ? 'settings_ethernet' : 'wifi';
    }

    function isHeaderWifiConnected() {
      try {
        const wifiDomain = (flowStatusDomainCache.wifi && flowStatusDomainCache.wifi.data && flowStatusDomainCache.wifi.data.ok === true)
          ? flowStatusDomainCache.wifi.data
          : null;
        const wifi = (wifiDomain && wifiDomain.wifi && typeof wifiDomain.wifi === 'object') ? wifiDomain.wifi : null;
        if (wifi && typeof wifi.rdy === 'boolean') return wifi.rdy;
      } catch (err) {
      }
      if (normalizeNetworkType(networkTransport)) return true;
      const mode = normalizeNetworkMode(networkMode);
      return mode === 'station' || mode === 'ethernet';
    }

    function refreshUsersSessionUi() {
      if (!usersSessionStatus) return;
      usersSessionStatus.classList.remove('is-ok', 'is-alert');
      if (webAdminAuthenticated) {
        usersSessionStatus.textContent = tr('header.security.admin', 'Administrateur connecté');
        usersSessionStatus.classList.add('is-ok');
        if (usersSessionHelp) usersSessionHelp.textContent = 'Les opérations protégées sont autorisées pour cette session.';
        if (usersLoginBtn) usersLoginBtn.hidden = true;
        return;
      }
      usersSessionStatus.classList.add('is-alert');
      if (usersLoginBtn) usersLoginBtn.hidden = false;
      if (webPhysicalRecoveryActive) {
        const minutes = Math.max(1, Math.ceil(webPhysicalRecoveryRemainingSeconds / 60));
        usersSessionStatus.textContent = 'Mode récupération · ' + minutes + ' min';
        if (usersSessionHelp) usersSessionHelp.textContent = 'Accès physique temporaire obtenu par le bouton BOOT. Une connexion administrateur reste recommandée.';
      } else {
        usersSessionStatus.textContent = tr('header.security.unauthenticated', 'Accès non authentifié');
        if (usersSessionHelp) usersSessionHelp.textContent = 'Connectez-vous comme administrateur pour étalonner, mettre à jour et modifier le réseau.';
      }
    }

    async function refreshAdminSession() {
      try {
        const response = await fetch('/api/wifi/config', { cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) throw new Error('auth');
        await response.json();
        webAdminAuthenticated = true;
      } catch (err) {
        webAdminAuthenticated = false;
      }
      refreshUsersSessionUi();
      refreshAppHeader(getActivePageId());
      return webAdminAuthenticated;
    }

    function hasAdminAuthReturnFlag() {
      try {
        return new URLSearchParams(window.location.search || '').get('auth') === '1';
      } catch (err) {
        return false;
      }
    }

    function refreshAppHeader(pageId) {
      const activePage = pageId || getActivePageId();
      const label = resolvePageMenuLabel(activePage) || webProfileName || 'flow.io';
      if (desktopPageTitle) {
        desktopPageTitle.textContent = label;
      }
      if (headerWifiStatus) {
        headerWifiStatus.textContent = formatHeaderNetworkStatus();
      }
      if (headerNetworkIcon) {
        headerNetworkIcon.textContent = currentFlowNetworkIcon();
      }
      if (networkConfigIcon) {
        networkConfigIcon.textContent = currentFlowNetworkIcon();
      }
      if (applyNetworkIcon) {
        applyNetworkIcon.textContent = currentFlowNetworkType() === 'ethernet' ? 'settings_ethernet' : 'wifi_protected_setup';
      }
      if (headerWifiDot) {
        headerWifiDot.classList.toggle('is-connected', isHeaderWifiConnected());
      }
      if (headerSecurityStatus) {
        if (webPhysicalRecoveryActive) {
          const minutes = Math.max(1, Math.ceil(webPhysicalRecoveryRemainingSeconds / 60));
          headerSecurityStatus.textContent = tr(
            'header.security.recovery',
            'Récupération · {minutes} min'
          ).replace('{minutes}', String(minutes));
        } else if (webAdminAuthenticated) {
          headerSecurityStatus.textContent = tr('header.security.admin', 'Administrateur connecté');
        } else {
          headerSecurityStatus.textContent = tr('header.security.unauthenticated', 'Accès non authentifié');
        }
      }
      renderHeaderReachability();
    }

    function refreshAppHeaderClock() {
      if (headerClockLabel) {
        const baseLabel = tr('header.time', 'Heure');
        headerClockLabel.textContent = currentFlowTimeSourceLabel
          ? baseLabel + ' (' + currentFlowTimeSourceLabel + ')'
          : baseLabel;
      }
      if (!headerClockStatus) return;
      headerClockStatus.textContent = new Date().toLocaleTimeString(currentWebLocaleTag());
    }

    function startAppHeaderClock() {
      refreshAppHeaderClock();
      if (appHeaderClockTimer || !headerClockStatus) return;
      appHeaderClockTimer = setInterval(refreshAppHeaderClock, 1000);
    }

    function syncHeaderTimeSourceFromSystemDomain() {
      try {
        const systemDomain = (flowStatusDomainCache.system && flowStatusDomainCache.system.data && flowStatusDomainCache.system.data.ok === true)
          ? flowStatusDomainCache.system.data
          : null;
        const time = (systemDomain && systemDomain.time && typeof systemDomain.time === 'object') ? systemDomain.time : null;
        const nextTimeLabel = flowTimeHeaderLabel(time);
        if (nextTimeLabel) {
          currentFlowTimeSourceLabel = nextTimeLabel;
          refreshAppHeaderClock();
        }
      } catch (err) {
      }
    }

    function renderHeaderReachability() {
      const unreachable = deviceReachabilityMisses >= deviceReachabilityLostThreshold;
      const reachable = deviceReachabilityReachable && !unreachable;
      if (headerDeviceStatus) {
        headerDeviceStatus.textContent = unreachable
          ? tr('header.device.unreachable', 'Hors ligne')
          : (reachable ? tr('header.device.reachable', 'En ligne') : tr('header.device.pending', 'Vérification...'));
      }
      if (headerReachabilityDot) {
        headerReachabilityDot.classList.toggle('is-reachable', reachable);
        headerReachabilityDot.classList.toggle('is-pending', !reachable && !unreachable);
        headerReachabilityDot.classList.toggle('is-unreachable', unreachable);
      }
    }

    async function fetchHeaderReachabilityHello() {
      const supportsAbort = typeof AbortController === 'function';
      const controller = supportsAbort ? new AbortController() : null;
      const timeoutId = controller
        ? setTimeout(() => {
            try {
              controller.abort();
            } catch (err) {
            }
          }, deviceReachabilityFetchTimeoutMs)
        : null;
      try {
        const res = await fetch('/api/web/meta', {
          cache: 'no-store',
          signal: controller ? controller.signal : undefined
        });
        if (!res.ok) throw new Error('hello_http_' + res.status);
        const data = await res.json().catch(() => null);
        if (!data || data.ok !== true) throw new Error('hello_payload');
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    async function probeHeaderReachability() {
      if (deviceReachabilityInFlight) return;
      deviceReachabilityInFlight = true;
      try {
        await fetchHeaderReachabilityHello();
        deviceReachabilityMisses = 0;
        deviceReachabilityReachable = true;
      } catch (err) {
        deviceReachabilityMisses = Math.min(deviceReachabilityLostThreshold, deviceReachabilityMisses + 1);
      } finally {
        deviceReachabilityInFlight = false;
        renderHeaderReachability();
      }
    }

    function startHeaderReachabilityProbe() {
      renderHeaderReachability();
      probeHeaderReachability().catch(() => {});
      if (deviceReachabilityTimer || !headerDeviceStatus) return;
      deviceReachabilityTimer = setInterval(() => {
        if (document.hidden) return;
        probeHeaderReachability().catch(() => {});
        refreshAppHeaderTime(false).catch(() => {});
      }, deviceReachabilityProbeMs);
    }

    async function refreshAppHeaderWifi(forceRefresh) {
      try {
        await fetchFlowStatusDomain('wifi', !!forceRefresh, 'header');
      } catch (err) {
      }
      refreshAppHeader(getActivePageId());
    }

    async function refreshAppHeaderTime(forceRefresh) {
      try {
        await fetchFlowStatusDomain('system', !!forceRefresh, 'header');
        syncHeaderTimeSourceFromSystemDomain();
      } catch (err) {
      }
      refreshAppHeaderClock();
    }

    function syncMobileTopbarTitle(pageId) {
      if (!mobileTopbarTitle) return;
      const label = resolvePageMenuLabel(pageId) || webProfileName;
      mobileTopbarTitle.textContent = label;
      refreshAppHeader(pageId);
    }


    function isDrawerExpanded() {
      return isMobileLayout()
        ? drawer.classList.contains('mobile-open')
        : !drawer.classList.contains('collapsed');
    }

    function setMobileDrawerOpen(open) {
      drawer.classList.toggle('mobile-open', open);
      overlay.classList.toggle('visible', open);
    }

    function closeMobileDrawer() {
      if (isMobileLayout()) {
        setMobileDrawerOpen(false);
      }
    }



    let flowRemoteFetchQueue = Promise.resolve();

    function fetchFlowRemoteQueued(url, options) {
      const queued = flowRemoteFetchQueue
        .catch(() => {})
        .then(() => fetchWithBusyRetry(url, options));
      flowRemoteFetchQueue = queued.catch(() => {});
      return queued;
    }

    function fetchFlowCfgEndpoint(url, options) {
      return isWaveshareProfile()
        ? fetchWithBusyRetry(url, options)
        : fetchFlowRemoteQueued(url, options);
    }

    function waitMs(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function ensureLogsPage() {
      if (logsPage) return logsPage;
      if (!logsPageLoadPromise) {
        logsPageLoadPromise = (async () => {
          if (!window.FlowWebCore || typeof window.FlowWebCore.loadScriptOnce !== 'function') {
            throw new Error('chargeur de modules indisponible');
          }
          await window.FlowWebCore.loadScriptOnce(assetUrl('/webinterface/logs.js'), { retries: 3, timeoutMs: 9000 });
          const factory = window.FlowWebPages && window.FlowWebPages.logs;
          if (!factory || typeof factory.create !== 'function') throw new Error('module des logs indisponible');
          return factory.create({ tr, isLocalRuntime: () => webLocalRuntime === true });
        })().then((page) => {
          logsPage = page;
          return page;
        }).catch((error) => {
          logsPageLoadPromise = null;
          throw error;
        });
      }
      return logsPageLoadPromise;
    }

    async function openLogsOverlay() {
      const page = await ensureLogsPage();
      page.open();
    }

    async function ensureNetworkPage() {
      if (networkPage) return networkPage;
      if (networkPageLoadPromise) return networkPageLoadPromise;
      networkPageLoadPromise = (async () => {
        if (!window.FlowWebCore
          || typeof window.FlowWebCore.loadScriptOnce !== 'function'
          || typeof window.FlowWebCore.loadCssOnce !== 'function') {
          throw new Error('chargeur de page réseau indisponible');
        }
        await Promise.all([
          window.FlowWebCore.loadCssOnce(
            assetUrl('/webinterface/network.css'),
            { retries: 3, timeoutMs: 8000 }
          ),
          window.FlowWebCore.loadScriptOnce(
            assetUrl('/webinterface/network.js'),
            { retries: 3, timeoutMs: 9000 }
          )
        ]);
        const factory = window.FlowWebPages && window.FlowWebPages.network
          ? window.FlowWebPages.network.create
          : null;
        if (typeof factory !== 'function') {
          throw new Error('module de page réseau indisponible');
        }
        networkPage = factory({
          tr,
          fetchOkJson,
          createFormPostOptions,
          fetchFlowStatusDomain,
          normalizeNetworkType,
          getActivePageId,
          bindClickAction,
          updatePasswordVisibility: mettreAJourEtatVisibiliteMotDePasse,
          togglePasswordVisibility: basculerVisibiliteMotDePasse
        });
        return networkPage;
      })().finally(() => {
        networkPageLoadPromise = null;
      });
      return networkPageLoadPromise;
    }

    async function onNetworkPageShown() {
      const page = await ensureNetworkPage();
      if (getActivePageId() !== 'page-wifi' || document.hidden) {
        page.hide();
        return;
      }
      await page.show();
    }

    async function ensureActivityPage() {
      if (activityPage) return activityPage;
      if (activityPageLoadPromise) return activityPageLoadPromise;
      activityPageLoadPromise = (async () => {
        if (!window.FlowWebCore
          || typeof window.FlowWebCore.loadScriptOnce !== 'function'
          || typeof window.FlowWebCore.loadCssOnce !== 'function') {
          throw new Error("chargeur du journal d'activité indisponible");
        }
        await Promise.all([
          window.FlowWebCore.loadCssOnce(
            assetUrl('/webinterface/activity.css'),
            { retries: 3, timeoutMs: 8000 }
          ),
          window.FlowWebCore.loadScriptOnce(
            assetUrl('/webinterface/activity.js'),
            { retries: 3, timeoutMs: 9000 }
          )
        ]);
        const factory = window.FlowWebPages && window.FlowWebPages.activity
          ? window.FlowWebPages.activity.create
          : null;
        if (typeof factory !== 'function') {
          throw new Error("module du journal d'activité indisponible");
        }
        activityPage = factory({
          tr,
          currentWebLocaleTag,
          fetchWithBusyRetry
        });
        return activityPage;
      })().finally(() => {
        activityPageLoadPromise = null;
      });
      return activityPageLoadPromise;
    }

    async function onActivityPageShown(showBusy) {
      try {
        const page = await ensureActivityPage();
        if (getActivePageId() !== 'page-activity-log' || document.hidden) return;
        await page.show(!!showBusy);
      } catch (error) {
        const status = document.getElementById('activityLogStatus');
        if (status && getActivePageId() === 'page-activity-log' && !document.hidden) {
          status.textContent = 'Journal indisponible : ' + error.message;
        }
      }
    }

    async function ensureIoSummaryPage() {
      if (ioSummaryPage) return ioSummaryPage;
      if (ioSummaryPageLoadPromise) return ioSummaryPageLoadPromise;
      ioSummaryPageLoadPromise = (async () => {
        if (!window.FlowWebCore
          || typeof window.FlowWebCore.loadScriptOnce !== 'function'
          || typeof window.FlowWebCore.loadCssOnce !== 'function') {
          throw new Error('chargeur de la page entrées/sorties indisponible');
        }
        await Promise.all([
          window.FlowWebCore.loadCssOnce(assetUrl('/webinterface/io-summary.css'), { retries: 3, timeoutMs: 8000 }),
          window.FlowWebCore.loadScriptOnce(assetUrl('/webinterface/io-summary.js'), { retries: 3, timeoutMs: 9000 })
        ]);
        const factory = window.FlowWebPages && window.FlowWebPages.ioSummary
          ? window.FlowWebPages.ioSummary.create
          : null;
        if (typeof factory !== 'function') throw new Error('module entrées/sorties indisponible');
        ioSummaryPage = factory({
          tr,
          fetchOkJson,
          createIntervalRunner,
          getActivePageId
        });
        return ioSummaryPage;
      })().finally(() => {
        ioSummaryPageLoadPromise = null;
      });
      return ioSummaryPageLoadPromise;
    }

    async function onIoSummaryModuleShown() {
      const page = await ensureIoSummaryPage();
      if (getActivePageId() !== 'page-io-summary' || document.hidden) {
        page.hide();
        return;
      }
      await page.show();
    }

    async function ensureConfigurationPage() {
      if (configurationPage) return configurationPage;
      if (configurationPageLoadPromise) return configurationPageLoadPromise;
      configurationPageLoadPromise = (async () => {
        if (!window.FlowWebCore
          || typeof window.FlowWebCore.loadScriptOnce !== 'function') {
          throw new Error('chargeur de la configuration indisponible');
        }
        await window.FlowWebCore.loadScriptOnce(
          assetUrl('/webinterface/config.js'),
          { retries: 3, timeoutMs: 15000 }
        );
        const factory = window.FlowWebPages && window.FlowWebPages.configuration
          ? window.FlowWebPages.configuration.create
          : null;
        if (typeof factory !== 'function') throw new Error('module de configuration indisponible');
        configurationPage = factory({
          tr,
          cfgI18nDebugLog,
          assetUrl,
          fetchWithBusyRetry,
          fetchFlowRemoteQueued,
          fetchJsonResponse,
          fetchOkJson,
          createFormPostOptions,
          extractApiErrorMessage,
          utf8ByteLength,
          waitMs,
          createSkeletonLine,
          getActivePageId,
          isPageActive,
          isMicronovaProfile,
          isWaveshareProfile,
          normalizeWebUiLocale,
          currentWebLocaleTag,
          refreshWebUiLocale,
          updatePasswordVisibility: mettreAJourEtatVisibiliteMotDePasse,
          togglePasswordVisibility: basculerVisibiliteMotDePasse,
          bindClickAction,
          iconCheckText,
          getWebLocalConfigLabel: () => webLocalConfigLabel,
          getWebRemoteConfigEnabled: () => webRemoteConfigEnabled,
          getWebProfileName: () => webProfileName,
          getSupervisorFirmwareVersion: () => supervisorFirmwareVersion
        });
        return configurationPage;
      })().finally(() => {
        configurationPageLoadPromise = null;
      });
      return configurationPageLoadPromise;
    }

    async function onConfigurationPageShown() {
      const page = await ensureConfigurationPage();
      if (getActivePageId() !== 'page-control' || document.hidden) {
        page.hide();
        return;
      }
      await page.show();
    }

    async function ensureCalibrationPage() {
      if (calibrationPage) return calibrationPage;
      if (calibrationPageLoadPromise) return calibrationPageLoadPromise;
      calibrationPageLoadPromise = (async () => {
        if (!window.FlowWebCore
          || typeof window.FlowWebCore.loadScriptOnce !== 'function'
          || typeof window.FlowWebCore.loadCssOnce !== 'function') {
          throw new Error("chargeur de la page d'étalonnage indisponible");
        }
        await Promise.all([
          window.FlowWebCore.loadCssOnce(assetUrl('/webinterface/calibration.css'), { retries: 3, timeoutMs: 8000 }),
          window.FlowWebCore.loadScriptOnce(assetUrl('/webinterface/calibration.js'), { retries: 3, timeoutMs: 9000 })
        ]);
        const factory = window.FlowWebPages && window.FlowWebPages.calibration
          ? window.FlowWebPages.calibration.create
          : null;
        if (typeof factory !== 'function') throw new Error("module d'étalonnage indisponible");
        calibrationPage = factory({
          tr,
          fetchOkJson,
          fetchFlowRemoteQueued,
          fetchRuntimeValues,
          fetchJsonResponse,
          createFormPostOptions,
          formatFlowCfgApplyError: function (data) {
            if (data && data.err && data.err.message) return String(data.err.message);
            if (data && data.err && data.err.code) return String(data.err.code);
            return "application de l'étalonnage refusée";
          },
          nettoyerNomFlowCfg: function (value) {
            return String(value || '').trim().replace(/^\/+|\/+$/g, '');
          },
          bindClickAction
        });
        return calibrationPage;
      })().finally(() => {
        calibrationPageLoadPromise = null;
      });
      return calibrationPageLoadPromise;
    }

    async function onCalibrationModuleShown() {
      const page = await ensureCalibrationPage();
      if (getActivePageId() !== 'page-calibration' || document.hidden) return;
      await page.show();
    }

    async function ensureInfoPage() {
      if (infoPage) return infoPage;
      if (infoPageLoadPromise) return infoPageLoadPromise;
      infoPageLoadPromise = (async () => {
        if (!window.FlowWebCore
          || typeof window.FlowWebCore.loadScriptOnce !== 'function') {
          throw new Error("chargeur de la page d'informations indisponible");
        }
        await window.FlowWebCore.loadScriptOnce(
          assetUrl('/webinterface/info.js'),
          { retries: 3, timeoutMs: 9000 }
        );
        const factory = window.FlowWebPages && window.FlowWebPages.info
          ? window.FlowWebPages.info.create
          : null;
        if (typeof factory !== 'function') throw new Error("module d'informations indisponible");
        infoPage = factory({
          tr,
          currentWebLocaleTag,
          normalizeNetworkType,
          normalizeIpValue,
          effectiveNetworkType,
          flowStatusDomainCache,
          isFlowStatusDomainCacheValid,
          fetchRuntimeValues,
          formatRuntimeDomainLabel,
          flowStatusDebugLog,
          fmtFlowStatusVal,
          flowTimeStatusLabel,
          syncHeaderTimeSourceFromSystemDomain,
          refreshAppHeader,
          getActivePageId,
          loadWebMeta,
          createIntervalRunner,
          bindClickAction,
          fetchOkJson,
          getInfoLastMac: () => infoLastMac,
          getSupervisorFirmwareVersion: () => supervisorFirmwareVersion,
          getSupervisorUptimeMs: () => supervisorUptimeMs,
          getWebDeviceName: () => webDeviceName
        });
        return infoPage;
      })().finally(() => {
        infoPageLoadPromise = null;
      });
      return infoPageLoadPromise;
    }

    async function onInfoPageShown() {
      const page = await ensureInfoPage();
      if (getActivePageId() !== 'page-info' || document.hidden) {
        page.hide();
        return;
      }
      ensureRemoteMenuIconFontLoaded().catch(() => false);
      await page.show();
    }

    async function ensureUpdatesPage() {
      if (updatesPage) return updatesPage;
      if (updatesPageLoadPromise) return updatesPageLoadPromise;
      updatesPageLoadPromise = (async () => {
        if (!window.FlowWebCore
          || typeof window.FlowWebCore.loadScriptOnce !== 'function') {
          throw new Error('chargeur de la page des mises à jour indisponible');
        }
        await window.FlowWebCore.loadScriptOnce(
          assetUrl('/webinterface/updates.js'),
          { retries: 3, timeoutMs: 9000 }
        );
        const factory = window.FlowWebPages && window.FlowWebPages.updates
          ? window.FlowWebPages.updates.create
          : null;
        if (typeof factory !== 'function') throw new Error('module des mises à jour indisponible');
        updatesPage = factory({
          tr,
          getStorageValue,
          setStorageValue,
          fetchOkJson,
          createFormPostOptions,
          normalizeUpgradeHttpErrorMessage,
          currentWebLocaleTag,
          isMicronovaProfile,
          isSupervisorProfile,
          isWaveshareProfile,
          isFlowIOProfile,
          getActivePageId,
          loadWebMeta,
          bindClickAction,
          createTimeoutRunner,
          createIntervalRunner,
          getSupervisorFirmwareVersion: () => supervisorFirmwareVersion,
          getNextionDisplayVersion: () => nextionDisplayVersion
        });
        updatesPage.renderInitial();
        return updatesPage;
      })().finally(() => {
        updatesPageLoadPromise = null;
      });
      return updatesPageLoadPromise;
    }

    async function onUpdatesPageShown() {
      const page = await ensureUpdatesPage();
      if (getActivePageId() !== 'page-system' || document.hidden) {
        page.hide();
        return;
      }
      await page.show();
    }

    async function ensurePoolPage() {
      if (poolPage) return poolPage;
      if (poolPageLoadPromise) return poolPageLoadPromise;
      poolPageLoadPromise = (async () => {
        if (!window.FlowWebCore
          || typeof window.FlowWebCore.loadScriptOnce !== 'function') {
          throw new Error('chargeur des pages piscine indisponible');
        }
        await window.FlowWebCore.loadScriptOnce(
          assetUrl('/webinterface/pool.js'),
          { retries: 3, timeoutMs: 12000 }
        );
        const factory = window.FlowWebPages && window.FlowWebPages.pool
          ? window.FlowWebPages.pool.create
          : null;
        if (typeof factory !== 'function') throw new Error('module piscine indisponible');
        poolPage = factory({
          tr,
          getActivePageId,
          fetchOkJson,
          createFormPostOptions,
          waitMs,
          fetchRuntimeValues,
          fetchFlowStatusDomain,
          runtimeMeasureEntriesForDomain,
          normalizeRuntimeMeasureDomainKey,
          formatRuntimeDomainLabel,
          formatRuntimeGroupCardTitle,
          runtimeMeasureCssSlug,
          formatRuntimeDurationMs,
          appendFlowStatusRow,
          buildFlowReadonlyStateGrid,
          buildFlowReadonlyStateTile,
          buildFlowRssiGauge,
          buildFlowThresholdValueNode,
          createFlowFiveZoneBands,
          createSkeletonLine,
          configDocFor: (...args) => configurationPage ? configurationPage.configDocFor(...args) : null,
          ensureCfgDocsForModule: async (...args) => (await ensureConfigurationPage()).ensureCfgDocsForModule(...args),
          iconCheckText,
          isWaveshareProfile,
          isMicronovaProfile,
          nettoyerNomFlowCfg: (value) => configurationPage
            ? configurationPage.nettoyerNomFlowCfg(value)
            : String(value || '').trim().replace(/^\/+|\/+$/g, ''),
          currentWebLocaleTag,
          showPage,
          createIntervalRunner,
          createRuntimeDomainState,
          bindClickAction,
          getRuntimeMeasureDomainKeys: () => runtimeMeasureDomainKeys,
          isAdminAuthenticated: () => webAdminAuthenticated,
          isPhysicalRecoveryActive: () => webPhysicalRecoveryActive,
          getPhysicalRecoveryRemainingSeconds: () => webPhysicalRecoveryRemainingSeconds
        });
        return poolPage;
      })().finally(() => {
        poolPageLoadPromise = null;
      });
      return poolPageLoadPromise;
    }

    async function onPoolDashboardShown() {
      const page = await ensurePoolPage();
      if (getActivePageId() !== 'page-pool-measures' || document.hidden) {
        page.hideDashboard();
        return;
      }
      await page.showDashboard();
    }

    async function onPoolPageShown(forceRefresh) {
      const page = await ensurePoolPage();
      if (getActivePageId() !== 'page-pool' || document.hidden) {
        page.hidePool();
        return;
      }
      await page.showPool(!!forceRefresh);
    }

    function isPageActive(pageId) {
      const el = document.getElementById(pageId);
      return !!(el && el.classList.contains('active'));
    }

    function stopFlowStatusLiveTimer() {
      if (!flowStatusLiveTimer) return;
      clearInterval(flowStatusLiveTimer);
      flowStatusLiveTimer = null;
    }

    function schedulePageTask(pageId, token, delayMs, task) {
      const run = () => {
        if (token !== pageLoadToken || !isPageActive(pageId)) return;
        Promise.resolve().then(task).catch((err) => {
          if (window.console && typeof window.console.error === 'function') {
            window.console.error('[flow-web] page load failed', pageId, err);
          }
        });
      };
      if (delayMs > 0) {
        setTimeout(run, delayMs);
      } else {
        run();
      }
    }

    function showPage(pageId, options) {
      const opts = options || {};
      if (configurationPage && configurationPage.isBusy()
        && currentPageId === 'page-control' && pageId !== 'page-control') {
        configurationPage.setLeaveWarning();
        return;
      }
      const deferredHeavyMs = Math.max(0, Number(opts.deferHeavyMs) || 0);
      const pageToken = ++pageLoadToken;
      currentPageId = pageId;
      if (pageId !== 'page-activity-log' && activityPage) activityPage.hide();
      if (pageId !== 'page-info' && infoPage) infoPage.hide();
      pages.forEach((el) => el.classList.toggle('active', el.id === pageId));
      menuItems.forEach((el) => el.classList.toggle('active', el.dataset.page === pageId));
      syncMobileTopbarTitle(pageId);
      if (pageId === 'page-activity-log') {
        schedulePageTask(pageId, pageToken, deferredHeavyMs, () => onActivityPageShown(false));
      }
      if (pageId === 'page-pool-measures') {
        schedulePageTask(pageId, pageToken, deferredHeavyMs, () => onPoolDashboardShown());
      } else {
        if (poolPage) poolPage.hideDashboard();
      }
      if (pageId === 'page-pool') {
        schedulePageTask(pageId,
                         pageToken,
                         deferredHeavyMs > 0 ? (deferredHeavyMs + 120) : 0,
                         () => onPoolPageShown(false));
      } else {
        if (poolPage) poolPage.hidePool();
      }
      if (pageId === 'page-io-summary') {
        schedulePageTask(pageId, pageToken, deferredHeavyMs, () => onIoSummaryModuleShown());
      } else {
        if (ioSummaryPage) ioSummaryPage.hide();
      }
      if (pageId === 'page-calibration') {
        schedulePageTask(pageId,
                         pageToken,
                         deferredHeavyMs > 0 ? (deferredHeavyMs + 180) : 0,
                         () => onCalibrationModuleShown());
      }
      if (pageId === 'page-status') {
        schedulePageTask(pageId, pageToken, deferredHeavyMs, () => refreshFlowStatus(false));
      } else {
        stopFlowStatusLiveTimer();
      }
      if (pageId === 'page-system') {
        schedulePageTask(pageId,
                         pageToken,
                         deferredHeavyMs > 0 ? (deferredHeavyMs + 180) : 0,
                         () => onUpdatesPageShown());
      }
      if (pageId === 'page-wifi') {
        schedulePageTask(pageId,
                         pageToken,
                         deferredHeavyMs > 0 ? (deferredHeavyMs + 180) : 0,
                         () => onNetworkPageShown());
      } else if (networkPage) {
        networkPage.hide();
      }
      if (pageId === 'page-control') {
        schedulePageTask(pageId,
                         pageToken,
                         deferredHeavyMs > 0 ? (deferredHeavyMs + 220) : 0,
                         () => onConfigurationPageShown());
      } else {
        if (configurationPage) configurationPage.hide();
      }
      if (pageId === 'page-info') {
        schedulePageTask(pageId,
                         pageToken,
                         deferredHeavyMs > 0 ? (deferredHeavyMs + 120) : 0,
                         () => onInfoPageShown());
      }
      if (pageId === 'page-users') {
        refreshUsersSessionUi();
        schedulePageTask(pageId, pageToken, 0, async () => {
          const verifyAdmin = hasAdminAuthReturnFlag() || webAdminAuthenticated;
          await loadWebMeta();
          if (verifyAdmin) await refreshAdminSession();
        });
      }
      if (pageId !== 'page-system') {
        if (updatesPage) updatesPage.hide();
      }
      closeMobileDrawer();
    }

    function resolveInitialPageId() {
      try {
        const params = new URLSearchParams(window.location.search || '');
        let requestedPage = String(params.get('page') || '').trim();
        if (requestedPage === 'page-status') {
          requestedPage = 'page-pool-measures';
        }
        if (requestedPage && pages.some((el) => el.id === requestedPage)) {
          return requestedPage;
        }
      } catch (err) {
      }
      const activePage = document.querySelector('.page.active');
      if (activePage && activePage.id) {
        return activePage.id;
      }
      return 'page-pool-measures';
    }

    menuItems.forEach((item) => item.addEventListener('click', () => showPage(item.dataset.page)));

    menuToggles.forEach((btn) => btn.addEventListener('click', () => {
      if (isMobileLayout()) {
        setMobileDrawerOpen(!drawer.classList.contains('mobile-open'));
      } else {
        if (hideMenuSvg) return;
        drawer.classList.toggle('collapsed');
      }
    }));

    overlay.addEventListener('click', closeMobileDrawer);
    window.addEventListener('resize', () => {
      if (!isMobileLayout()) {
        setMobileDrawerOpen(false);
      }
    });

    const openLogsOverlayBtn = document.getElementById('openLogsOverlay');

    const rebootDeviceTargetSelect = document.getElementById('rebootDeviceTarget');
    const rebootDeviceActionBtn = document.getElementById('rebootDeviceAction');
    const kioskShutdownAction = document.getElementById('kioskShutdownAction');
    const kioskShutdownActionBtn = document.getElementById('kioskShutdownActionBtn');
    const factoryResetDeviceActionBtn = document.getElementById('factoryResetDeviceAction');
    const systemStatusText = document.getElementById('systemStatusText');
    const flowStatusRefreshBtn = document.getElementById('flowStatusRefresh');
    const flowStatusChip = document.getElementById('flowStatusChip');
    const flowStatusGrid = document.getElementById('flowStatusGrid');
    const flowStatusRaw = document.getElementById('flowStatusRaw');
    let networkPage = null;
    let networkPageLoadPromise = null;
    let activityPage = null;
    let activityPageLoadPromise = null;
    let ioSummaryPage = null;
    let ioSummaryPageLoadPromise = null;
    let calibrationPage = null;
    let calibrationPageLoadPromise = null;
    let infoPage = null;
    let infoPageLoadPromise = null;
    let updatesPage = null;
    let updatesPageLoadPromise = null;
    let poolPage = null;
    let poolPageLoadPromise = null;
    let configurationPage = null;
    let configurationPageLoadPromise = null;
    let logsPage = null;
    let logsPageLoadPromise = null;
    let flowStatusReqSeq = 0;
    const flowStatusDomainTtlMs = 20000;
    const flowStatusDomainKeys = ['system', 'wifi', 'mqtt', 'pool', 'i2c'];
    const flowStatusDomainCache = {
      system: { data: null, fetchedAt: 0 },
      wifi: { data: null, fetchedAt: 0 },
      mqtt: { data: null, fetchedAt: 0 },
      pool: { data: null, fetchedAt: 0 },
      i2c: { data: null, fetchedAt: 0 },
      alarm: { data: null, fetchedAt: 0 }
    };
    const infoFlowDomainKeys = ['system', 'wifi', 'mqtt'];
    let runtimeMeasureDomainKeys = runtimeDomainsForProfile();
    let runtimeManifestDomainCache = null;
    let runtimeManifestDomainLoadPromise = null;

    const iconeOeilOuvert = 'Cacher';
    const iconeOeilBarre = 'Voir';

    function mettreAJourEtatVisibiliteMotDePasse(inputEl, toggleBtn, labelAfficher, labelMasquer) {
      if (!inputEl || !toggleBtn) return;
      const isVisible = inputEl.type === 'text';
      toggleBtn.innerHTML = isVisible ? iconeOeilOuvert : iconeOeilBarre;
      toggleBtn.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
      toggleBtn.setAttribute('aria-label', isVisible ? labelMasquer : labelAfficher);
      toggleBtn.setAttribute('title', isVisible ? 'Mot de passe en clair' : 'Mot de passe masqué');
    }

    function basculerVisibiliteMotDePasse(inputEl, toggleBtn, labelAfficher, labelMasquer) {
      if (!inputEl || !toggleBtn) return;
      const isMasked = inputEl.type === 'password';
      inputEl.type = isMasked ? 'text' : 'password';
      mettreAJourEtatVisibiliteMotDePasse(inputEl, toggleBtn, labelAfficher, labelMasquer);
    }
    if (openLogsOverlayBtn) {
      openLogsOverlayBtn.addEventListener('click', () => openLogsOverlay().catch((error) => {
        console.error('[flow-web] logs module load failed', error);
      }));
    }


    function fmtFlowStatusVal(v) {
      if (v === null || typeof v === 'undefined') return '-';
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (!trimmed || /^__FLOW_[A-Z0-9_]+__$/.test(trimmed)) return '-';
        return trimmed;
      }
      return String(v);
    }

    function flowTimeSourceLabel(src) {
      const key = String(src || '').trim().toLowerCase();
      if (key === 'ntp') return 'NTP';
      if (key === 'internal_rtc') return 'RTC';
      if (key === 'manual') return 'manuel';
      return '';
    }

    function flowTimeQualityLabel(quality) {
      const key = String(quality || '').trim().toLowerCase();
      if (key === 'ntp_synced') return 'NTP';
      if (key === 'rtc_trusted') return currentWebLocaleTag().toLowerCase().startsWith('en') ? 'RTC' : 'RTC';
      if (key === 'manual') return currentWebLocaleTag().toLowerCase().startsWith('en') ? 'manual' : 'manuel';
      if (key === 'rtc_untrusted') return 'RTC?';
      if (key === 'invalid') return '';
      return '';
    }

    function flowTimeIsReady(time) {
      if (!time || typeof time !== 'object') return false;
      return !!time.rdy || !!flowTimeQualityLabel(time.qlt) || !!flowTimeSourceLabel(time.src);
    }

    function flowTimeHeaderLabel(time) {
      if (!time || typeof time !== 'object') return '';
      const quality = flowTimeQualityLabel(time.qlt);
      if (quality) return quality;
      const source = flowTimeSourceLabel(time.src);
      if (source) return source;
      return flowTimeIsReady(time) ? tr('info.state.synced', 'Synchronisée') : tr('info.state.unsynced', 'Non synchronisée');
    }

    function flowTimeStatusLabel(time) {
      if (!time || typeof time !== 'object') return '';
      if (!flowTimeIsReady(time)) return tr('info.state.unsynced', 'Non synchronisée');
      const source = flowTimeQualityLabel(time.qlt) || flowTimeSourceLabel(time.src);
      return source
        ? tr('info.state.synced', 'Synchronisée') + ' (' + source + ')'
        : tr('info.state.synced', 'Synchronisée');
    }

    function fmtFlowCount(v) {
      const n = Number(v);
      return Number.isFinite(n) ? String(Math.max(0, Math.round(n))) : '-';
    }

    function buildFlowStatusBoolIcon(v) {
      const ok = !!v;
      const span = document.createElement('span');
      span.className = ok ? 'status-bool is-true' : 'status-bool is-false';
      span.setAttribute('role', 'img');
      span.setAttribute('aria-label', ok ? 'OK' : 'NOK');
      span.title = ok ? 'OK' : 'NOK';
      span.textContent = ok ? 'OK' : 'KO';
      return span;
    }

    function buildFlowStatusReadonlySwitch(v) {
      const on = !!v;
      const sw = document.createElement('span');
      sw.className = 'md3-switch status-toggle-readonly';
      sw.setAttribute('role', 'img');
      sw.setAttribute('aria-label', on ? 'Actif' : 'Inactif');
      sw.title = on ? 'Actif' : 'Inactif';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = on;
      input.disabled = true;
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');

      const track = document.createElement('span');
      track.className = 'md3-track';

      const thumb = document.createElement('span');
      thumb.className = 'md3-thumb';

      sw.appendChild(input);
      sw.appendChild(track);
      sw.appendChild(thumb);
      return sw;
    }

    function buildFlowReadonlyStateTile(label, value, options) {
      const stateKnown = typeof value === 'boolean';
      const opts = options && typeof options === 'object' ? options : {};
      const activeText = typeof opts.activeText === 'string' && opts.activeText.trim()
        ? opts.activeText.trim()
        : 'Actif';
      const inactiveText = typeof opts.inactiveText === 'string' && opts.inactiveText.trim()
        ? opts.inactiveText.trim()
        : 'Inactif';
      const unknownText = typeof opts.unknownText === 'string' && opts.unknownText.trim()
        ? opts.unknownText.trim()
        : 'Indisponible';

      const tile = document.createElement('div');
      tile.className = 'status-state-tile ' + (stateKnown ? (value ? 'is-true' : 'is-false') : 'is-empty');
      tile.setAttribute('role', 'img');
      tile.setAttribute(
        'aria-label',
        label + ' : ' + (stateKnown ? (value ? activeText : inactiveText) : unknownText)
      );

      const title = document.createElement('div');
      title.className = 'status-state-title';
      title.textContent = label;
      tile.appendChild(title);

      const state = document.createElement('div');
      state.className = 'status-state-value';

      const dot = document.createElement('span');
      dot.className = 'status-state-dot';
      state.appendChild(dot);

      const text = document.createElement('span');
      text.textContent = stateKnown ? (value ? activeText : inactiveText) : unknownText;
      state.appendChild(text);

      tile.appendChild(state);
      return tile;
    }

    function buildFlowReadonlyStateGrid(items) {
      return buildNodeGrid('status-state-grid', items);
    }

    function fmtFlowUptime(ms) {
      if (!Number.isFinite(ms) || ms < 0) return '-';
      const sec = Math.floor(ms / 1000);
      if (sec < 60) return sec + (sec > 1 ? ' secondes' : ' seconde');
      const min = Math.floor(sec / 60);
      if (min < 60) return min + (min > 1 ? ' minutes' : ' minute');
      const hours = Math.floor(min / 60);
      if (hours < 24) return hours + (hours > 1 ? ' heures' : ' heure');
      const days = Math.floor(hours / 24);
      if (days < 30) return days + (days > 1 ? ' jours' : ' jour');
      const months = Math.floor(days / 30);
      return months + (months > 1 ? ' mois' : ' mois');
    }

    function fmtFlowRelativeAge(ms) {
      if (!Number.isFinite(ms) || ms < 0) return '-';
      const sec = Math.floor(ms / 1000);
      if (sec < 60) return sec + ' s';
      const min = Math.floor(sec / 60);
      if (min < 60) return min + ' min';
      const hours = Math.floor(min / 60);
      if (hours < 24) return hours + ' h';
      const days = Math.floor(hours / 24);
      if (days < 30) return days + ' j';
      const months = Math.floor(days / 30);
      return months + ' mois';
    }

    function fmtFlowBytes(bytes) {
      const n = Number(bytes);
      if (!Number.isFinite(n) || n < 0) return '-';
      if (n < 1024) return Math.round(n) + ' B';
      if (n < (1024 * 1024)) return Math.round(n / 1024) + ' kB';
      return (n / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function fmtFlowFixed(value, decimals, unit) {
      if (value === null || typeof value === 'undefined') return '-';
      if (typeof value === 'string' && value.trim().length === 0) return '-';
      const n = Number(value);
      if (!Number.isFinite(n)) return '-';
      const rendered = decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
      return unit ? (rendered + ' ' + unit) : rendered;
    }

    function clampFlowValue(v, min, max) {
      if (v < min) return min;
      if (v > max) return max;
      return v;
    }

    function rssiToPercent(rssi) {
      const n = Number(rssi);
      if (!Number.isFinite(n)) return null;
      const bounded = clampFlowValue(n, -95, -50);
      return Math.round(((bounded + 95) / 45) * 100);
    }

    function describeFlowRssi(percent) {
      if (!Number.isFinite(percent)) return 'Indisponible';
      if (percent >= 75) return 'Tres bon';
      if (percent >= 55) return 'Bon';
      if (percent >= 35) return 'Correct';
      return 'Faible';
    }

    function buildFlowRssiGauge(rssi, hasRssi) {
      const wrapper = document.createElement('div');
      wrapper.className = 'status-gauge' + (hasRssi ? '' : ' is-empty');

      const label = document.createElement('span');
      label.className = 'status-gauge-label';

      const track = document.createElement('span');
      track.className = 'status-gauge-track';
      const fill = document.createElement('span');
      fill.className = 'status-gauge-fill';

      if (hasRssi) {
        const percent = rssiToPercent(rssi);
        fill.style.width = (percent === null ? 0 : percent) + '%';
        label.textContent = describeFlowRssi(percent) + ' (' + fmtFlowStatusVal(rssi) + ' dBm)';
      } else {
        fill.style.width = '0%';
        label.textContent = 'Signal indisponible';
      }

      track.appendChild(fill);
      wrapper.appendChild(track);
      wrapper.appendChild(label);
      return wrapper;
    }

    function fmtFlowGaugeNumber(value, decimals) {
      const n = Number(value);
      if (!Number.isFinite(n)) return '-';
      return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
    }

    function createFlowFiveZoneBands(config) {
      const min = Number(config && config.min);
      const max = Number(config && config.max);
      const criticalLowEnd = Number(config && config.criticalLowEnd);
      const warningLowEnd = Number(config && config.warningLowEnd);
      const warningHighStart = Number(config && config.warningHighStart);
      const criticalHighStart = Number(config && config.criticalHighStart);

      if (
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        !Number.isFinite(criticalLowEnd) ||
        !Number.isFinite(warningLowEnd) ||
        !Number.isFinite(warningHighStart) ||
        !Number.isFinite(criticalHighStart)
      ) {
        return [];
      }

      if (
        !(min < criticalLowEnd) ||
        !(criticalLowEnd < warningLowEnd) ||
        !(warningLowEnd < warningHighStart) ||
        !(warningHighStart < criticalHighStart) ||
        !(criticalHighStart < max)
      ) {
        return [];
      }

      return [
        { from: min, to: criticalLowEnd, color: config.criticalLowColor || '#D14C66' },
        { from: criticalLowEnd, to: warningLowEnd, color: config.warningLowColor || '#F0B255' },
        { from: warningLowEnd, to: warningHighStart, color: config.okColor || '#2F9E68' },
        { from: warningHighStart, to: criticalHighStart, color: config.warningHighColor || '#F0B255' },
        { from: criticalHighStart, to: max, color: config.criticalHighColor || '#D14C66' }
      ];
    }

    function resolveFlowGaugeValueColor(value, bands) {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) return '#102B4C';
      if (!Array.isArray(bands) || bands.length === 0) return '#102B4C';
      const minBound = Number(bands[0].from);
      const maxBound = Number(bands[bands.length - 1].to);
      const clampedValue = (
        Number.isFinite(minBound) &&
        Number.isFinite(maxBound) &&
        maxBound > minBound
      ) ? clampFlowValue(numericValue, minBound, maxBound) : numericValue;
      for (let i = 0; i < bands.length; ++i) {
        const band = bands[i];
        const from = Number(band.from);
        const to = Number(band.to);
        if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
        if (clampedValue >= from && clampedValue <= to) {
          return band.color || '#102B4C';
        }
      }
      return '#102B4C';
    }

    function buildFlowThresholdValueNode(config) {
      const value = Number(config && config.value);
      const hasValue = Number.isFinite(value);
      const min = Number(config && config.min);
      const max = Number(config && config.max);
      const unit = typeof (config && config.unit) === 'string' ? config.unit.trim() : '';
      const decimals = Math.max(0, Number(config && config.decimals) || 0);
      const bands = Array.isArray(config && config.bands) ? config.bands : [];

      const node = document.createElement('span');
      node.className = 'status-threshold-value' + (hasValue ? '' : ' is-empty');
      if (!hasValue) {
        node.textContent = 'Indisponible';
        return node;
      }
      const text = fmtFlowGaugeNumber(value, decimals);
      node.textContent = unit ? (text + ' ' + unit) : text;

      const activeBands = (Number.isFinite(min) && Number.isFinite(max) && max > min)
        ? bands
            .map((band) => ({
              from: clampFlowValue(Number(band.from), min, max),
              to: clampFlowValue(Number(band.to), min, max),
              color: band.color || '#102B4C'
            }))
            .filter((band) => Number.isFinite(band.from) && Number.isFinite(band.to) && band.to > band.from)
        : [];
      const color = resolveFlowGaugeValueColor(value, activeBands);
      if (color) node.style.color = color;
      return node;
    }

    function appendFlowStatusRow(kv, label, value) {
      const line = document.createElement('div');
      const key = document.createElement('span');
      key.textContent = label;
      const renderedValue = document.createElement('b');
      if (value && typeof value === 'object' && typeof value.nodeType === 'number') {
        renderedValue.appendChild(value);
      } else {
        renderedValue.textContent = fmtFlowStatusVal(value);
      }
      line.appendChild(key);
      line.appendChild(renderedValue);
      kv.appendChild(line);
    }

    function createFlowLiveValue(kind, initialMs, nowMs) {
      const node = document.createElement('span');
      node.dataset.flowLive = kind;
      node.dataset.baseMs = String(Number(initialMs) || 0);
      node.dataset.baseNow = String(Number(nowMs) || Date.now());
      updateFlowLiveValue(node, Date.now());
      return node;
    }

    function updateFlowLiveValue(node, nowMs) {
      if (!node) return;
      const kind = String(node.dataset.flowLive || '');
      if (kind !== 'uptime') return;
      const baseMs = Number(node.dataset.baseMs) || 0;
      const baseNow = Number(node.dataset.baseNow) || nowMs;
      const value = baseMs + Math.max(0, nowMs - baseNow);
      node.textContent = formatRuntimeDurationMs(value);
    }

    function refreshFlowStatusLiveValues() {
      if (!isPageActive('page-status') || !flowStatusGrid) return;
      const nowMs = Date.now();
      flowStatusGrid.querySelectorAll('[data-flow-live]').forEach((node) => updateFlowLiveValue(node, nowMs));
    }

    function ensureFlowStatusLiveTimer() {
      if (flowStatusLiveTimer) return;
      flowStatusLiveTimer = setInterval(() => {
        refreshFlowStatusLiveValues();
      }, 1000);
    }

    function buildFlowStatusCardIcon(iconKey, ok, label) {
      const iconText = {
        wifi: 'wifi',
        ethernet: 'settings_ethernet',
        supervisor: 'SUP',
        system: 'SYS',
        mqtt: 'MQ',
        pool: 'PL',
        pump: 'PP'
      };
      const span = document.createElement('span');
      span.className = ok ? 'status-card-icon is-true' : 'status-card-icon is-false';
      if (iconKey === 'wifi' || iconKey === 'ethernet') {
        span.classList.add('status-card-icon-msr');
      }
      span.setAttribute('role', 'img');
      span.setAttribute('aria-label', label || (ok ? 'OK' : 'NOK'));
      span.title = label || (ok ? 'OK' : 'NOK');
      span.textContent = iconText[iconKey] || iconText.system;
      return span;
    }

    function buildMqttStatsStrip(items) {
      const wrapper = document.createElement('div');
      wrapper.className = 'status-mqtt-strip';
      (items || []).forEach((item) => {
        const numericValue = Number(item ? item.value : null);
        const hasIssue = Number.isFinite(numericValue) && numericValue > 0;
        const cell = document.createElement('div');
        cell.className = 'status-mqtt-metric ' + (hasIssue ? 'is-alert' : 'is-ok');
        if (item && typeof item.title === 'string' && item.title.trim()) {
          cell.title = item.title.trim() + ' : ' + fmtFlowCount(item.value);
          cell.setAttribute('aria-label', cell.title);
        }

        const label = document.createElement('span');
        label.className = 'status-mqtt-metric-label';
        label.textContent = String(item && item.label ? item.label : '').slice(0, 1) || '-';

        const value = document.createElement('strong');
        value.className = 'status-mqtt-metric-value';
        value.textContent = fmtFlowCount(item ? item.value : null);

        cell.appendChild(label);
        cell.appendChild(value);
        wrapper.appendChild(cell);
      });
      return wrapper;
    }

    function normalizeIpValue(ip) {
      if (typeof ip === 'string') {
        const trimmed = ip.trim();
        return trimmed || '-';
      }
      if (Array.isArray(ip)) {
        return ip.map((part) => String(part)).join('.') || '-';
      }
      if (ip && typeof ip === 'object') {
        const keys = Object.keys(ip).sort((a, b) => Number(a) - Number(b));
        if (keys.length > 0) {
          return keys.map((key) => String(ip[key])).join('.') || '-';
        }
      }
      if (typeof ip === 'number' && Number.isFinite(ip)) {
        return String(ip);
      }
      return '-';
    }

    function buildFlowStatusFromDomains(domainData) {
      const merged = { ok: true };
      let anyDomainOk = false;

      const system = domainData.system;
      if (system && system.ok === true) {
        anyDomainOk = true;
        merged.fw = system.fw || '';
        merged.upms = system.upms ?? 0;
        merged.heap = (system.heap && typeof system.heap === 'object') ? system.heap : {};
        if (system.time && typeof system.time === 'object') {
          merged.time = system.time;
        }
      }

      const wifi = domainData.wifi;
      if (wifi && wifi.ok === true && wifi.wifi && typeof wifi.wifi === 'object') {
        anyDomainOk = true;
        merged.wifi = Object.assign({}, wifi.wifi, { ip: normalizeIpValue(wifi.wifi.ip) });
      }

      const mqtt = domainData.mqtt;
      if (mqtt && mqtt.ok === true && mqtt.mqtt && typeof mqtt.mqtt === 'object') {
        anyDomainOk = true;
        merged.mqtt = mqtt.mqtt;
      }

      const pool = domainData.pool;
      if (pool && pool.ok === true && pool.pool && typeof pool.pool === 'object') {
        anyDomainOk = true;
        merged.pool = pool.pool;
      }

      const i2c = domainData.i2c;
      if (i2c && i2c.ok === true && i2c.i2c && typeof i2c.i2c === 'object') {
        anyDomainOk = true;
        merged.i2c = i2c.i2c;
      }

      return anyDomainOk ? merged : null;
    }

    function getCachedFlowStatusData() {
      const domainData = {};
      flowStatusDomainKeys.forEach((domainKey) => {
        domainData[domainKey] = flowStatusDomainCache[domainKey].data;
      });
      return buildFlowStatusFromDomains(domainData);
    }

    function isFlowStatusDomainCacheValid(domainKey, nowMs) {
      const cacheEntry = flowStatusDomainCache[domainKey];
      if (!cacheEntry || !cacheEntry.data) return false;
      const now = Number.isFinite(nowMs) ? nowMs : Date.now();
      return (now - cacheEntry.fetchedAt) < flowStatusDomainTtlMs;
    }

    function cacheFlowStatusFromAggregate(data, fetchedAtMs) {
      if (!data || typeof data !== 'object') return;
      const stamp = Number.isFinite(fetchedAtMs) ? fetchedAtMs : Date.now();

      if (
        (typeof data.fw === 'string' && data.fw.length > 0) ||
        typeof data.upms !== 'undefined' ||
        (data.heap && typeof data.heap === 'object')
      ) {
        flowStatusDomainCache.system.data = {
          ok: true,
          devicename: data.devicename || '',
          fw: data.fw || '',
          upms: data.upms ?? 0,
          heap: (data.heap && typeof data.heap === 'object') ? data.heap : {}
        };
        flowStatusDomainCache.system.fetchedAt = stamp;
      }

      if (data.wifi && typeof data.wifi === 'object') {
        const wifiData = Object.assign({}, data.wifi, { ip: normalizeIpValue(data.wifi.ip) });
        const wifiMac = normalizeInfoMac(wifiData.mac);
        if (wifiMac !== '-') infoLastMac = wifiMac;
        flowStatusDomainCache.wifi.data = { ok: true, wifi: wifiData };
        flowStatusDomainCache.wifi.fetchedAt = stamp;
      }

      if (data.mqtt && typeof data.mqtt === 'object') {
        flowStatusDomainCache.mqtt.data = { ok: true, mqtt: data.mqtt };
        flowStatusDomainCache.mqtt.fetchedAt = stamp;
      }

      if (data.pool && typeof data.pool === 'object') {
        flowStatusDomainCache.pool.data = { ok: true, pool: data.pool };
        flowStatusDomainCache.pool.fetchedAt = stamp;
      }

      if (data.i2c && typeof data.i2c === 'object') {
        flowStatusDomainCache.i2c.data = { ok: true, i2c: data.i2c };
        flowStatusDomainCache.i2c.fetchedAt = stamp;
      }

      if (data.time && typeof data.time === 'object') {
        const systemData = flowStatusDomainCache.system.data && typeof flowStatusDomainCache.system.data === 'object'
          ? flowStatusDomainCache.system.data
          : { ok: true };
        systemData.time = data.time;
        flowStatusDomainCache.system.data = systemData;
        flowStatusDomainCache.system.fetchedAt = stamp;
      }
    }

    async function fetchFlowStatusAggregate(forceRefresh, sourceTag) {
      // Legacy path kept for compatibility. Info page no longer uses aggregate.
      // Dashboard status is built from per-domain calls.
      flowStatusDebugLog('aggregate fetch path disabled', {
        force: !!forceRefresh,
        src: String(sourceTag || '').trim() || 'unknown'
      });
      throw new Error('aggregate flow status disabled');
    }

    async function fetchFlowStatusDomain(domainKey, forceRefresh, sourceTag) {
      const cacheEntry = flowStatusDomainCache[domainKey];
      const now = Date.now();
      const cacheValid = isFlowStatusDomainCacheValid(domainKey, now);
      if (!forceRefresh && cacheValid) {
        return cacheEntry.data;
      }

      try {
        const src = String(sourceTag || '').trim().toLowerCase();
        let endpoint = '/api/flow/status/domain?d=' + encodeURIComponent(domainKey);
        if (src) {
          endpoint += '&src=' + encodeURIComponent(src);
        }
        const { res, data } = await fetchJsonResponse(
          endpoint,
          { cache: 'no-store' },
          fetchFlowRemoteQueued
        );
        if (!data || typeof data !== 'object') {
          throw new Error('statut ' + domainKey + ' invalide');
        }
        // For per-domain runtime fetches, keep structured `ok:false` payloads
        // as valid responses so Info cards can show unavailable state cleanly.
        if (!res.ok) {
          const fallback = extractApiErrorMessage(data, 'statut ' + domainKey + ' indisponible');
          throw new Error(fallback);
        }
        if (data.ok !== true) {
          flowStatusDebugLog('domain fetch returned ok=false', {
            domain: domainKey,
            src: src || 'unknown',
            status: res.status,
            err: data && data.err ? data.err : null,
            body: data || null
          });
        }
        cacheEntry.data = data;
        cacheEntry.fetchedAt = Date.now();
        return data;
      } catch (err) {
        if (cacheEntry.data) {
          return cacheEntry.data;
        }
        throw err;
      }
    }

    function appendFlowStatusCard(config) {
      const card = document.createElement('div');
      card.className = 'status-card';
      if (config.cardClass) {
        card.classList.add(config.cardClass);
      }

      const head = document.createElement('div');
      head.className = 'status-card-head';
      const titleBlock = document.createElement('div');

      const heading = document.createElement('h3');
      heading.textContent = config.title;
      titleBlock.appendChild(heading);

      if (config.summary) {
        const summary = document.createElement('p');
        summary.className = 'status-card-summary';
        summary.textContent = config.summary;
        titleBlock.appendChild(summary);
      }

      head.appendChild(titleBlock);
      head.appendChild(buildFlowStatusCardIcon(config.icon, !!config.ok, config.iconLabel));
      card.appendChild(head);

      const rows = Array.isArray(config.rows) ? config.rows : [];
      if (rows.length > 0) {
        const kv = document.createElement('div');
        kv.className = 'status-kv';
        rows.forEach((row) => appendFlowStatusRow(kv, row[0], row[1]));
        card.appendChild(kv);
      }
      (config.extras || []).forEach((extra) => {
        if (!extra || typeof extra.nodeType !== 'number') return;
        card.appendChild(extra);
      });
      flowStatusGrid.appendChild(card);
    }

    function createSkeletonLine(className, widthPercent) {
      const line = document.createElement('div');
      line.className = className ? ('skeleton-line ' + className) : 'skeleton-line';
      if (Number.isFinite(widthPercent) && widthPercent > 0) {
        line.style.width = widthPercent + '%';
      }
      return line;
    }

    function appendFlowStatusSkeletonCard() {
      const card = document.createElement('div');
      card.className = 'status-card status-card-skeleton';
      const title = createSkeletonLine('skeleton-title', 46);
      card.appendChild(title);

      const kv = document.createElement('div');
      kv.className = 'status-kv';
      const widths = [
        [44, 24],
        [40, 30],
        [35, 20],
        [48, 26]
      ];
      widths.forEach((pair) => {
        const row = document.createElement('div');
        row.appendChild(createSkeletonLine('skeleton-key', pair[0]));
        row.appendChild(createSkeletonLine('skeleton-value', pair[1]));
        kv.appendChild(row);
      });
      card.appendChild(kv);
      flowStatusGrid.appendChild(card);
    }

    function renderFlowStatusSkeleton() {
      flowStatusChip.textContent = 'chargement...';
      flowStatusGrid.innerHTML = '';
      for (let i = 0; i < 6; ++i) {
        appendFlowStatusSkeletonCard();
      }
      flowStatusRaw.hidden = true;
      flowStatusRaw.classList.remove('is-skeleton');
      flowStatusRaw.innerHTML = '';
    }

    function renderFlowStatus(data) {
      const wifi = (data && typeof data.wifi === 'object') ? data.wifi : {};
      const mqtt = (data && typeof data.mqtt === 'object') ? data.mqtt : {};
      const pool = (data && typeof data.pool === 'object') ? data.pool : {};
      const time = (data && typeof data.time === 'object') ? data.time : {};
      const heap = (data && data.heap && typeof data.heap === 'object') ? data.heap : {};
      const i2c = (data && data.i2c && typeof data.i2c === 'object') ? data.i2c : {};
      const firmware = fmtFlowStatusVal(data.fw);
      window.__flowIoFirmwareVersion = firmware;
      const uptimeMs = Number(data.upms) || 0;
      const wifiReady = !!wifi.rdy;
      const wifiIp = normalizeIpValue(wifi.ip);
      const wifiHasRssi = !!wifi.hrss;
      const wifiRssi = wifi.rssi ?? '-';
      const networkType = effectiveNetworkType(wifi, true);
      const networkIsEthernet = networkType === 'ethernet';
      const mqttReady = !!mqtt.rdy;
      if (data && Object.prototype.hasOwnProperty.call(data, 'time')) {
        currentFlowTimeSourceLabel = flowTimeHeaderLabel(time);
      }
      refreshAppHeaderClock();
      const mqttServer = fmtFlowStatusVal(mqtt.srv);
      const mqttRxDrop = mqtt.rxdrp ?? 0;
      const mqttParseFail = mqtt.prsf ?? 0;
      const mqttHandlerFail = mqtt.hndf ?? 0;
      const mqttOversizeDrop = mqtt.ovr ?? 0;
      const i2cLinkOk = !!i2c.lnk;
      const mqttIssueCount = (Number(mqttRxDrop) || 0) +
        (Number(mqttParseFail) || 0) +
        (Number(mqttHandlerFail) || 0) +
        (Number(mqttOversizeDrop) || 0);
      const waterTemp = pool.wat;
      const airTemp = pool.air;
      const phValue = pool.ph;
      const orpValue = pool.orp;
      const hasPoolModes = !!pool.has;
      const autoModeOn = hasPoolModes ? !!pool.auto : null;
      const winterModeOn = hasPoolModes ? !!pool.wint : null;
      const filtrationOn = (typeof pool.fil === 'boolean') ? pool.fil : null;
      const poolMetricsReady =
        Number.isFinite(Number(waterTemp)) ||
        Number.isFinite(Number(airTemp)) ||
        Number.isFinite(Number(phValue)) ||
        Number.isFinite(Number(orpValue));
      const poolStatesReady =
        typeof autoModeOn === 'boolean' ||
        typeof filtrationOn === 'boolean' ||
        typeof winterModeOn === 'boolean';
      const heapFree = ('free' in heap) ? heap.free : null;
      const heapMin = ('min_free' in heap) ? heap.min_free : null;
      const systemReady = firmware !== '-' || uptimeMs > 0 || heapFree !== null;
      const supervisorHeapFree = ('free' in supervisorHeap) ? supervisorHeap.free : null;
      const supervisorHeapMin = ('min_free' in supervisorHeap) ? supervisorHeap.min_free : null;
      const supervisorReady =
        supervisorFirmwareVersion !== '-' ||
        supervisorUptimeMs > 0 ||
        supervisorHeapFree !== null;
      const poolMetricRows = [
        [
          'Temperature eau',
          buildFlowThresholdValueNode({
            value: waterTemp,
            min: 0,
            max: 40,
            unit: '°C',
            decimals: 1,
            bands: createFlowFiveZoneBands({
              min: 0,
              criticalLowEnd: 8,
              warningLowEnd: 14,
              warningHighStart: 30,
              criticalHighStart: 34,
              max: 40
            })
          })
        ],
        [
          'Temperature air',
          buildFlowThresholdValueNode({
            value: airTemp,
            min: -10,
            max: 45,
            unit: '°C',
            decimals: 1,
            bands: createFlowFiveZoneBands({
              min: -10,
              criticalLowEnd: 0,
              warningLowEnd: 8,
              warningHighStart: 28,
              criticalHighStart: 35,
              max: 45
            })
          })
        ],
        [
          'pH',
          buildFlowThresholdValueNode({
            value: phValue,
            min: 6.4,
            max: 8.4,
            decimals: 2,
            bands: createFlowFiveZoneBands({
              min: 6.4,
              criticalLowEnd: 6.8,
              warningLowEnd: 7.0,
              warningHighStart: 7.6,
              criticalHighStart: 7.8,
              max: 8.4
            })
          })
        ],
        [
          'ORP',
          buildFlowThresholdValueNode({
            value: orpValue,
            min: 350,
            max: 900,
            unit: 'mV',
            decimals: 0,
            bands: createFlowFiveZoneBands({
              min: 350,
              criticalLowEnd: 500,
              warningLowEnd: 620,
              warningHighStart: 760,
              criticalHighStart: 820,
              max: 900
            })
          })
        ]
      ];
      const poolStateGrid = buildFlowReadonlyStateGrid([
        buildFlowReadonlyStateTile('Mode auto', autoModeOn, {
          activeText: 'Actif',
          inactiveText: 'Manuel'
        }),
        buildFlowReadonlyStateTile('Filtration', filtrationOn, {
          activeText: 'En marche',
          inactiveText: 'Arret'
        }),
        buildFlowReadonlyStateTile('Hivernage', winterModeOn, {
          activeText: 'Actif',
          inactiveText: 'Arret'
        })
      ]);

      flowStatusGrid.innerHTML = '';
      const networkRows = [
        [tr('info.row.ip', 'Adresse IP'), wifiIp],
        [tr('info.row.networkType', 'Type réseau'), formatInfoNetworkType(networkType)]
      ];
      if (!networkIsEthernet) {
        networkRows.push([tr('info.row.signal', 'Signal'), buildFlowRssiGauge(wifiRssi, wifiHasRssi)]);
      }
      appendFlowStatusCard({
        title: tr('header.wifi', 'Réseau'),
        icon: networkIsEthernet ? 'ethernet' : 'wifi',
        ok: wifiReady,
        iconLabel: wifiReady ? tr('info.state.connected', 'Connecté') : tr('info.state.disconnected', 'Déconnecté'),
        rows: networkRows
      });
      appendFlowStatusCard({
        title: 'MQTT',
        cardClass: 'status-card-mqtt',
        icon: 'mqtt',
        ok: mqttReady,
        iconLabel: mqttReady ? 'MQTT connecte' : 'MQTT deconnecte',
        rows: [
          ['Serveur', mqttServer]
        ],
        extras: [
          buildMqttStatsStrip([
            {
              label: 'Anomalies',
              title: 'Anomalies MQTT totalisees (ignores + contenu invalide + erreurs de traitement)',
              value: mqttIssueCount
            },
            {
              label: 'Ignores',
              title: 'Messages MQTT ignores ou rejetes (drops RX + payload trop volumineux)',
              value: (Number(mqttRxDrop) || 0) + (Number(mqttOversizeDrop) || 0)
            },
            {
              label: 'Contenu',
              title: 'Messages MQTT recus mais invalides ou impossibles a parser',
              value: mqttParseFail
            },
            {
              label: 'Traitement',
              title: 'Messages MQTT recus mais ayant echoue pendant le traitement applicatif',
              value: mqttHandlerFail
            }
          ])
        ]
      });
      appendFlowStatusCard({
        title: 'Mesures Bassin',
        cardClass: 'status-card-pool-metrics',
        icon: 'pool',
        ok: poolMetricsReady,
        iconLabel: poolMetricsReady ? 'Mesures bassin disponibles' : 'Mesures bassin indisponibles',
        rows: poolMetricRows
      });
      appendFlowStatusCard({
        title: 'Etats Bassin',
        icon: 'pump',
        ok: poolStatesReady,
        iconLabel: poolStatesReady ? 'Etats bassin disponibles' : 'Etats bassin indisponibles',
        rows: [],
        extras: poolStateGrid ? [poolStateGrid] : []
      });
      appendFlowStatusCard({
        title: 'Superviseur',
        icon: 'system',
        ok: supervisorReady,
        iconLabel: supervisorReady ? 'Superviseur disponible' : 'Superviseur indisponible',
        rows: [
          ['Firmware', supervisorFirmwareVersion],
          ['Uptime', createFlowLiveValue('uptime', supervisorUptimeMs, Date.now())],
          ['Heap libre', fmtFlowBytes(supervisorHeapFree)],
          ['Heap min', fmtFlowBytes(supervisorHeapMin)]
        ]
      });
      appendFlowStatusCard({
        title: 'flow.io',
        icon: 'system',
        ok: systemReady,
        iconLabel: systemReady ? 'Systeme joignable' : 'Systeme indisponible',
        rows: [
          ['Firmware', firmware],
          ['Uptime', createFlowLiveValue('uptime', uptimeMs, Date.now())],
          ['Heap libre', fmtFlowBytes(heapFree)],
          ['Heap min', fmtFlowBytes(heapMin)]
        ]
      });

      flowStatusChip.textContent = i2cLinkOk
        ? 'flow.io disponible'
        : 'Connexion flow.io a verifier';
      flowStatusRaw.hidden = true;
      flowStatusRaw.classList.remove('is-skeleton');
      flowStatusRaw.innerHTML = '';
      refreshFlowStatusLiveValues();
      const pageStatus = document.getElementById('page-status');
      if (pageStatus && pageStatus.classList.contains('active')) {
        ensureFlowStatusLiveTimer();
      } else {
        stopFlowStatusLiveTimer();
      }
    }

    async function refreshFlowStatus(forceRefresh) {
      const reqSeq = ++flowStatusReqSeq;
      const cachedData = !forceRefresh ? getCachedFlowStatusData() : null;
      if (cachedData) {
        renderFlowStatus(cachedData);
      } else {
        renderFlowStatusSkeleton();
      }
      try {
        const domainData = {};
        for (const domainKey of flowStatusDomainKeys) {
          domainData[domainKey] = await fetchFlowStatusDomain(domainKey, !!forceRefresh, 'status');
          if (reqSeq !== flowStatusReqSeq) return;
        }
        const data = buildFlowStatusFromDomains(domainData);
        if (!data) throw new Error('statut indisponible');
        renderFlowStatus(data);
      } catch (err) {
        if (reqSeq !== flowStatusReqSeq) return;
        const fallbackData = getCachedFlowStatusData();
        if (fallbackData) {
          renderFlowStatus(fallbackData);
          flowStatusChip.textContent = 'statut affiche depuis le cache local';
          return;
        }
        flowStatusRaw.hidden = true;
        flowStatusRaw.classList.remove('is-skeleton');
        flowStatusChip.textContent = 'erreur lecture statut';
        flowStatusGrid.innerHTML = '';
        flowStatusRaw.innerHTML = '';
      }
    }


    function normalizeRuntimeMeasureDomainKey(domain) {
      const key = String(domain || '').trim().toLowerCase();
      return runtimeMeasureDomainKeys.includes(key) ? key : '';
    }

    function runtimeManifestDomainKeys() {
      const keys = runtimeMeasureDomainKeys.slice();
      infoFlowDomainKeys.forEach((domainKey) => {
        if (!keys.includes(domainKey)) keys.push(domainKey);
      });
      return keys;
    }

    function normalizeRuntimeManifestDomainKey(domain) {
      const key = String(domain || '').trim().toLowerCase();
      return runtimeManifestDomainKeys().includes(key) ? key : '';
    }

    function createEmptyRuntimeManifestDomainCache() {
      const cache = {};
      runtimeManifestDomainKeys().forEach((domainKey) => {
        cache[domainKey] = [];
      });
      return cache;
    }

    function registerRuntimeManifestEntry(cache, entry) {
      if (!entry || !Number.isFinite(Number(entry.id))) return;
      const domainKey = normalizeRuntimeManifestDomainKey(entry.domain);
      if (!domainKey || !Array.isArray(cache[domainKey])) return;
      cache[domainKey].push(entry);
    }

    async function parseRuntimeManifestStreamIntoCache(response, cache) {
      const data = await response.json().catch(() => null);
      if (!data || typeof data !== 'object') {
        throw new Error('manifeste runtime invalide');
      }
      const values = Array.isArray(data.values) ? data.values : [];
      values.forEach((entry) => registerRuntimeManifestEntry(cache, entry));
    }

    async function loadRuntimeManifestDomains(forceRefresh) {
      if (!forceRefresh && runtimeManifestDomainCache) {
        return runtimeManifestDomainCache;
      }
      if (!forceRefresh && runtimeManifestDomainLoadPromise) {
        return runtimeManifestDomainLoadPromise;
      }

      runtimeManifestDomainLoadPromise = (async () => {
        const response = await fetchWithBusyRetry(assetUrl('/api/runtime/manifest'), {
          cache: forceRefresh ? 'no-store' : 'default'
        });
        if (!response.ok) throw new Error('manifeste runtime indisponible');
        const nextCache = createEmptyRuntimeManifestDomainCache();
        await parseRuntimeManifestStreamIntoCache(response, nextCache);
        runtimeManifestDomainCache = nextCache;
        return runtimeManifestDomainCache;
      })();

      try {
        return await runtimeManifestDomainLoadPromise;
      } finally {
        runtimeManifestDomainLoadPromise = null;
      }
    }

    async function runtimeMeasureEntriesForDomain(domainKey, forceRefresh) {
      const cleanDomain = normalizeRuntimeManifestDomainKey(domainKey);
      if (!cleanDomain) return [];
      const cache = await loadRuntimeManifestDomains(!!forceRefresh);
      return Array.isArray(cache[cleanDomain]) ? cache[cleanDomain] : [];
    }

    function formatRuntimeDomainLabel(domain) {
      const key = String(domain || '').trim().toLowerCase();
      if (key === 'mode') return 'Mode';
      if (key === 'equipements') return tr('dashboard.domain.equipements', 'Equipements');
      if (key === 'sondes') return 'Sondes';
      if (key === 'micronova') return 'Micronova';
      if (key === 'mqtt') return 'MQTT';
      if (key === 'wifi') return tr('header.wifi', 'Réseau');
      if (key === 'i2c') return 'I2C';
      if (key === 'system') return 'Système';
      if (key === 'alarm') return 'Alarmes';
      if (!key) return 'Runtime';
      return key.charAt(0).toUpperCase() + key.slice(1);
    }

    function formatRuntimeGroupCardTitle(domain, group) {
      const domainLabel = formatRuntimeDomainLabel(domain);
      const groupLabel = String(group || '').trim();
      if (!groupLabel) return domainLabel;
      const comparableTitle = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        const ascii = typeof normalized.normalize === 'function'
          ? normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          : normalized;
        return ascii.replace(/[^a-z0-9]+/g, '').replace(/s$/, '');
      };
      if (comparableTitle(groupLabel) === comparableTitle(domainLabel)) return domainLabel;
      return domainLabel + ' · ' + groupLabel;
    }

    function runtimeMeasureCssSlug(value) {
      const source = String(value || '').trim().toLowerCase();
      if (!source) return 'default';
      const normalized = typeof source.normalize === 'function'
        ? source.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : source;
      const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      return slug || 'default';
    }

    function formatRuntimeDurationMs(ms) {
      const totalMs = Number(ms);
      if (!Number.isFinite(totalMs) || totalMs < 0) return '-';
      if (totalMs < 1000) return Math.round(totalMs) + ' ms';

      const totalSec = Math.floor(totalMs / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      const parts = [];

      if (days > 0) parts.push(days + ' j');
      if (hours > 0) parts.push(hours + ' h');
      if (minutes > 0) parts.push(minutes + ' min');
      if (seconds > 0 || parts.length === 0) parts.push(seconds + ' s');

      return parts.slice(0, 2).join(' ');
    }

    async function fetchRuntimeValues(ids) {
      const cleanIds = (ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);
      if (!cleanIds.length) return [];
      const query = cleanIds.join(',');
      const data = await fetchOkJson(
        '/api/runtime/values?ids=' + encodeURIComponent(query),
        { cache: 'no-store' },
        'lecture runtime indisponible',
        fetchFlowRemoteQueued
      );
      if (!Array.isArray(data.values)) throw new Error('lecture runtime indisponible');
      return data.values;
    }




    async function callSystemAction(target, action) {
      const flowLocalProfile = isWaveshareProfile();
      let endpoint = '/api/system/reboot';
      if (target === 'flow' && action === 'reboot') {
        endpoint = flowLocalProfile ? '/api/system/reboot' : '/api/flow/system/reboot';
      }
      else if (target === 'flow' && action === 'hardware_reboot') endpoint = '/api/flow/system/hardware-reboot';
      else if (target === 'nextion' && action === 'reboot') endpoint = '/api/system/nextion/reboot';
      else if (target === 'flow' && action === 'factory_reset') endpoint = flowLocalProfile ? '/api/system/factory-reset' : '/api/flow/system/factory-reset';
      else if (target === 'supervisor' && action === 'factory_reset') endpoint = '/api/system/factory-reset';
      const flowUsesRemote = target === 'flow' && !flowLocalProfile;
      await fetchOkJson(endpoint, { method: 'POST' }, 'échec action', flowUsesRemote ? fetchFlowRemoteQueued : fetch);
      if (target === 'flow' && action === 'factory_reset') {
        if (systemStatusText) systemStatusText.textContent = 'Reset flow.io en cours';
      } else if (target === 'flow' && action === 'hardware_reboot') {
        if (systemStatusText) systemStatusText.textContent = 'Reset matériel flow.io';
      } else if (target === 'flow' && action === 'reboot') {
        if (systemStatusText) systemStatusText.textContent = 'Redémarrage flow.io';
      } else if (target === 'nextion' && action === 'reboot') {
        if (systemStatusText) systemStatusText.textContent = 'Redémarrage Nextion';
      } else if (target === 'supervisor' && action === 'factory_reset') {
        if (systemStatusText) systemStatusText.textContent = 'Reset superviseur en cours';
      } else {
        if (systemStatusText) systemStatusText.textContent = 'Redémarrage superviseur';
      }
    }

    function clearPendingSystemAction(button) {
      if (!button) return;
      const pending = pendingSystemActionCountdowns.get(button);
      if (pending && pending.timer) {
        clearTimeout(pending.timer);
      }
      pendingSystemActionCountdowns.delete(button);
      button.disabled = false;
      if (button.dataset.defaultHtml) {
        button.innerHTML = button.dataset.defaultHtml;
      } else {
        button.textContent = button.dataset.defaultLabel || 'Redémarrer';
      }
    }

    function startDelayedSystemAction(button, countdownLabel, actionRunner, failurePrefix) {
      if (!button || typeof actionRunner !== 'function') return;
      if (!button.dataset.defaultHtml) {
        button.dataset.defaultHtml = button.innerHTML || '';
      }
      if (!button.dataset.defaultLabel) {
        const labelNode = button.querySelector('[data-i18n]');
        const label = labelNode && labelNode.textContent
          ? String(labelNode.textContent).trim()
          : String(button.textContent || '').trim();
        button.dataset.defaultLabel = label || 'Redémarrer';
      }
      clearPendingSystemAction(button);

      let remaining = rebootActionDelaySeconds;
      button.disabled = true;

      const tick = () => {
        button.textContent = remaining + ' s';
        if (systemStatusText) systemStatusText.textContent = countdownLabel + ' dans ' + remaining + ' s';

        if (remaining <= 1) {
          pendingSystemActionCountdowns.delete(button);
          runAsyncTaskSafely(async () => {
            button.textContent = '...';
            try {
              await actionRunner();
            } catch (err) {
              clearPendingSystemAction(button);
              if (systemStatusText) systemStatusText.textContent = failurePrefix;
              return;
            }
            clearPendingSystemAction(button);
          });
          return;
        }

        remaining -= 1;
        const timer = setTimeout(tick, 1000);
        pendingSystemActionCountdowns.set(button, { timer });
      };

      tick();
    }

    function initStatusBindings() {
      bindClickAction(flowStatusRefreshBtn, async () => {
        try {
          await refreshFlowStatus(true);
        } catch (err) {
          flowStatusChip.textContent = 'erreur lecture statut';
        }
      });
    }

    function initSystemBindings() {
      let rpiKioskSession = false;
      try {
        rpiKioskSession = new URLSearchParams(window.location.search).get('flowio_kiosk') === 'rpi';
      } catch (err) {
        rpiKioskSession = false;
      }
      if (kioskShutdownAction) {
        kioskShutdownAction.hidden = !rpiKioskSession;
      }
      bindClickAction(kioskShutdownActionBtn, () => {
        if (!rpiKioskSession) return;
        window.location.assign('http://127.0.0.1:8765/');
      });
      bindClickAction(rebootDeviceActionBtn, () => {
        if (!rebootDeviceTargetSelect || !rebootDeviceActionBtn) return;
        const selected = String(rebootDeviceTargetSelect.value || 'supervisor');
        if (!confirmRebootLaunch(selected)) return;
        const actionMap = {
          supervisor: {
            countdown: isMicronovaProfile() ? 'Reboot Micronova' : 'Reboot Supervisor',
            failure: isMicronovaProfile() ? 'Reboot Micronova échoué' : 'Reboot Supervisor échoué',
            runner: () => callSystemAction('supervisor', 'reboot')
          },
          flow_soft: {
            countdown: 'Reboot flow.io',
            failure: 'Reboot flow.io échoué',
            runner: () => callSystemAction('flow', 'reboot')
          },
          flow_hard: {
            countdown: 'Reset matériel flow.io',
            failure: 'Reset matériel flow.io échoué',
            runner: () => callSystemAction('flow', 'hardware_reboot')
          },
          nextion: {
            countdown: 'Reboot Nextion',
            failure: 'Reboot Nextion échoué',
            runner: () => callSystemAction('nextion', 'reboot')
          },
          factory_reset: {
            countdown: 'Init usine flow.io',
            failure: 'Init usine flow.io échouée',
            runner: () => callSystemAction('flow', 'factory_reset')
          }
        };
        const chosen = actionMap[selected] || actionMap.supervisor;
        startDelayedSystemAction(
          rebootDeviceActionBtn,
          chosen.countdown,
          chosen.runner,
          chosen.failure
        );
      });
      bindClickAction(factoryResetDeviceActionBtn, () => {
        if (!factoryResetDeviceActionBtn) return;
        if (!confirmRebootLaunch('factory_reset')) return;
        startDelayedSystemAction(
          factoryResetDeviceActionBtn,
          'Init usine flow.io',
          () => callSystemAction('flow', 'factory_reset'),
          'Init usine flow.io échouée'
        );
      });
    }

    function initGlobalUiBindings() {
      if (themeToggle) {
        themeToggle.addEventListener('change', () => {
          applyThemePreference(themeToggle.checked ? 'dark' : 'light', true);
        });
      }
      document.addEventListener('visibilitychange', () => {
        const activePageId = getActivePageId();
        const onUpgradePage = activePageId === 'page-system';
        if (document.hidden || !onUpgradePage) {
          if (updatesPage) updatesPage.hide();
        } else {
          onUpdatesPageShown().catch(() => {});
        }
        if (poolPage) poolPage.visibilityChanged(activePageId);
        if (document.hidden || activePageId !== 'page-control') {
          if (configurationPage) configurationPage.hide();
        } else {
          onConfigurationPageShown().catch(() => {});
        }
        if (document.hidden || activePageId !== 'page-io-summary') {
          if (ioSummaryPage) ioSummaryPage.hide();
        } else {
          onIoSummaryModuleShown().catch(() => {});
        }
        if (document.hidden || activePageId !== 'page-wifi') {
          if (networkPage) networkPage.hide();
        } else {
          onNetworkPageShown().catch(() => {});
        }
        if (logsPage) logsPage.visibilityChanged();
        if (!document.hidden && activePageId === 'page-activity-log') {
          onActivityPageShown(false).catch(() => {});
        } else if (activityPage) {
          activityPage.hide();
        }
        if (document.hidden || activePageId !== 'page-info') {
          if (infoPage) infoPage.hide();
        } else {
          onInfoPageShown().catch(() => {});
        }
        if (!document.hidden) {
          refreshWebUiLocale(true).catch(() => {});
          refreshAppHeaderWifi(true).catch(() => {});
          refreshAppHeaderTime(true).catch(() => {});
          probeHeaderReachability().catch(() => {});
        }
      });
    }

    initStatusBindings();
    initSystemBindings();
    initGlobalUiBindings();

    applyThemePreference(currentThemePreference(), false);
    applyWebUiLocale(webUiLocale);
    syncMenuIconFallbacks();
    refreshWebUiLocale(true).catch(() => {});
    startAppHeaderClock();
    startHeaderReachabilityProbe();
    refreshAppHeader(resolveInitialPageId());
    const initialPageId = resolveInitialPageId();
    const startInitialUi = async () => {
      await loadWebMeta().catch(() => {});
      refreshAppHeaderWifi(true).catch(() => {});
      refreshAppHeaderTime(true).catch(() => {});
      showPage(initialPageId, { deferHeavyMs: 260 });
    };
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        startInitialUi().catch(() => {});
      });
    } else {
      setTimeout(() => {
        startInitialUi().catch(() => {});
      }, 16);
    }
    window.__FLOW_WEB_APP_READY__ = true;
