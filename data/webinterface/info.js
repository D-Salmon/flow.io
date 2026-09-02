(function () {
  'use strict';

  window.FlowWebPages = window.FlowWebPages || {};
  window.FlowWebPages.info = {
    create: function createInfoPage(deps) {
      const tr = deps.tr;
      const currentWebLocaleTag = deps.currentWebLocaleTag;
      const normalizeNetworkType = deps.normalizeNetworkType;
      const normalizeIpValue = deps.normalizeIpValue;
      const effectiveNetworkType = deps.effectiveNetworkType;
      const flowStatusDomainCache = deps.flowStatusDomainCache;
      const isFlowStatusDomainCacheValid = deps.isFlowStatusDomainCacheValid;
      const fetchRuntimeValues = deps.fetchRuntimeValues;
      const formatRuntimeDomainLabel = deps.formatRuntimeDomainLabel;
      const flowStatusDebugLog = deps.flowStatusDebugLog;
      const fmtFlowStatusVal = deps.fmtFlowStatusVal;
      const flowTimeStatusLabel = deps.flowTimeStatusLabel;
      const syncHeaderTimeSourceFromSystemDomain = deps.syncHeaderTimeSourceFromSystemDomain;
      const refreshAppHeader = deps.refreshAppHeader;
      const getActivePageId = deps.getActivePageId;
      const loadWebMeta = deps.loadWebMeta;
      const createIntervalRunner = deps.createIntervalRunner;
      const bindClickAction = deps.bindClickAction;
      const fetchOkJson = deps.fetchOkJson;
      const infoRefreshActiveMs = 10000;
      const infoSupervisorRefreshMs = 1000;
      const infoFlowRefreshActiveMs = 10000;
      const infoFlowRefreshIdleMs = 10000;
      let infoLastMac = deps.getInfoLastMac();
      const infoStatusChip = document.getElementById('infoStatusChip');
      const infoGrid = document.getElementById('infoGrid');
      const infoSystemLoader = document.getElementById('infoSystemLoader');
      const infoWifiLoader = document.getElementById('infoWifiLoader');
      const infoMqttLoader = document.getElementById('infoMqttLoader');
      const infoFlowDomainKeys = ['system', 'wifi', 'mqtt'];
      const infoRuntimeDomainEntries = Object.freeze({
        system: Object.freeze([{ id: 1301 }, { id: 1302 }, { id: 1303 }, { id: 1801 }, { id: 1802 }, { id: 1803 }, { id: 1804 }]),
        wifi: Object.freeze([{ id: 1001 }, { id: 1002 }, { id: 1003 }, { id: 1004 }]),
        mqtt: Object.freeze([{ id: 2101 }, { id: 2102 }, { id: 2103 }, { id: 2104 }, { id: 2105 }, { id: 2106 }])
      });
      const infoFlowLoaderNodes = { system: infoSystemLoader, wifi: infoWifiLoader, mqtt: infoMqttLoader };
      const infoFlowDomainLoading = { system: false, wifi: false, mqtt: false };
      let infoFlowLastAttemptAt = 0;
      let infoFlowLastSuccessAt = 0;
      let infoFlowRefreshPromise = null;
      let infoRuntimePoller = null;
      let infoSupervisorPoller = null;
      let infoNetworkRuntime = null;

    function formatInfoBytes(value) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return '-';
      if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
      if (n >= 1024) return (n / 1024).toFixed(1) + ' kB';
      return String(Math.trunc(n)) + ' B';
    }

    function formatInfoUptime(ms) {
      const totalMs = Number(ms);
      if (!Number.isFinite(totalMs) || totalMs < 0) return '-';
      const totalSec = Math.floor(totalMs / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (d > 0) return d + 'j ' + h + 'h ' + m + 'm';
      if (h > 0) return h + 'h ' + m + 'm';
      if (m > 0) return m + 'm ' + s + 's';
      return s + 's';
    }

    function deriveInfoPressure(heap) {
      const free = Number(heap && heap.free) || 0;
      const largest = Number(heap && heap.largest) || 0;
      const frag = Number(heap && heap.frag) || 0;

      // Supervisor nominal profile (ESP32 sans PSRAM):
      // - state is derived from current free/largest/frag only
      // - min_free is informational and intentionally excluded from pressure state
      // - each level requires all criteria to avoid false positives near nominal baseline
      if (free < 20000 && largest < 8000 && frag > 45) return 'panic';
      if (free < 24000 && largest < 12000 && frag > 35) return 'critical';
      if (free < 28000 && largest < 16000 && frag > 28) return 'shedding';
      if (free < 30000 && largest < 20000 && frag > 20) return 'constrained';
      return 'normal';
    }

    function buildInfoMetricRow(title, value) {
      const esc = (input) => String(input || '-')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      return (
        '<div class="info-row">' +
          '<span class="info-row-key">' + esc(title || '') + '</span>' +
          '<span class="info-row-value">' + esc(value || '-') + '</span>' +
        '</div>'
      );
    }

    function splitInfoFirmwareVersion(fullVersion) {
      const raw = String(fullVersion || '').trim();
      if (!raw || raw === '-') return { version: '-', build: '-' };
      const plusIndex = raw.indexOf('+');
      if (plusIndex < 0) return { version: raw, build: '-' };
      return {
        version: raw.slice(0, plusIndex).trim() || '-',
        build: formatInfoBuildStamp(raw.slice(plusIndex + 1))
      };
    }

    function formatInfoBuildStamp(stamp) {
      const raw = String(stamp || '').trim();
      const match = raw.match(/^(\d{4})(\d{2})(\d{2})[._-]?(\d{2})(\d{2})(\d{2})?$/);
      if (match) return match[1] + '.' + match[2] + '.' + match[3] + '-' + match[4] + match[5];
      return raw || '-';
    }

    function normalizeInfoMac(mac) {
      const raw = String(mac || '').trim();
      return raw ? raw.toUpperCase() : '-';
    }

    function setInfoFlowDomainLoading(domainKey, loading) {
      if (!Object.prototype.hasOwnProperty.call(infoFlowDomainLoading, domainKey)) return;
      const isLoading = !!loading;
      infoFlowDomainLoading[domainKey] = isLoading;
      const node = infoFlowLoaderNodes[domainKey];
      if (!node) return;
      node.classList.toggle('is-loading', isLoading);
      node.disabled = isLoading;
      node.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    }

    function infoFlowDomainLabel(domainKey) {
      if (domainKey === 'system') return tr('info.flowSystem', 'Système flow.io');
      if (domainKey === 'wifi') return tr('info.flowNetwork', tr('info.flowWifi', 'Réseau flow.io'));
      if (domainKey === 'mqtt') return tr('info.flowMqtt', 'MQTT flow.io');
      return formatRuntimeDomainLabel(domainKey);
    }

    function updateInfoLoadButtonsText() {
      const keys = Object.keys(infoFlowLoaderNodes);
      keys.forEach((domainKey) => {
        const node = infoFlowLoaderNodes[domainKey];
        if (!node) return;
        const label = tr('info.loadDomain', 'Charger');
        const domain = infoFlowDomainLabel(domainKey);
        const text = label + ' ' + domain;
        node.setAttribute('title', text);
        node.setAttribute('aria-label', text);
      });
    }

    function infoRuntimeValueMap(values) {
      const map = new Map();
      (Array.isArray(values) ? values : []).forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const id = Number(item.id);
        if (!Number.isFinite(id) || id <= 0) return;
        map.set(id, item);
      });
      return map;
    }

    function infoRuntimeValueAvailable(item) {
      if (!item || typeof item !== 'object') return false;
      if (item.status === 'unavailable' || item.status === 'not_found') return false;
      return Object.prototype.hasOwnProperty.call(item, 'value');
    }

    function infoRuntimeValue(valueById, runtimeId, fallback) {
      const item = valueById.get(Number(runtimeId));
      return infoRuntimeValueAvailable(item) ? item.value : fallback;
    }

    function cacheInfoRuntimeDomain(domainKey, entries, values) {
      const cacheEntry = flowStatusDomainCache[domainKey];
      if (!cacheEntry) return null;

      const domainEntries = Array.isArray(entries) ? entries : [];
      const valueById = infoRuntimeValueMap(values);
      const hasAnyValue = domainEntries.some((entry) => {
        const id = Number(entry && entry.id);
        if (!Number.isFinite(id) || id <= 0) return false;
        return infoRuntimeValueAvailable(valueById.get(id));
      });
      let data = {
        ok: false,
        err: {
          code: domainEntries.length ? 'RuntimeUnavailable' : 'RuntimeIdsMissing',
          where: 'info.runtime.' + domainKey
        }
      };

      if (hasAnyValue && domainKey === 'system') {
        data = {
          ok: true,
          fw: infoRuntimeValue(valueById, 1801, ''),
          upms: infoRuntimeValue(valueById, 1802, 0),
          time: {
            rdy: !!infoRuntimeValue(valueById, 1301, false),
            src: infoRuntimeValue(valueById, 1302, 'none'),
            qlt: infoRuntimeValue(valueById, 1303, '')
          },
          heap: {
            free: infoRuntimeValue(valueById, 1803, 0),
            min_free: infoRuntimeValue(valueById, 1804, 0)
          }
        };
      } else if (hasAnyValue && domainKey === 'wifi') {
        const previousWifi = (cacheEntry.data && cacheEntry.data.ok === true && cacheEntry.data.wifi && typeof cacheEntry.data.wifi === 'object')
          ? cacheEntry.data.wifi
          : {};
        const previousMac = normalizeInfoMac(previousWifi.mac);
        const rssiItem = valueById.get(1003);
        data = {
          ok: true,
          wifi: {
            rdy: !!infoRuntimeValue(valueById, 1001, false),
            typ: infoRuntimeValue(valueById, 1004, 'wifi'),
            ip: normalizeIpValue(infoRuntimeValue(valueById, 1002, '')),
            mac: previousMac !== '-' ? previousMac : '',
            rssi: infoRuntimeValue(valueById, 1003, null),
            hrss: infoRuntimeValueAvailable(rssiItem)
          }
        };
      } else if (hasAnyValue && domainKey === 'mqtt') {
        data = {
          ok: true,
          mqtt: {
            rdy: !!infoRuntimeValue(valueById, 2101, false),
            srv: infoRuntimeValue(valueById, 2102, ''),
            rxdrp: infoRuntimeValue(valueById, 2103, 0),
            prsf: infoRuntimeValue(valueById, 2104, 0),
            hndf: infoRuntimeValue(valueById, 2105, 0),
            ovr: infoRuntimeValue(valueById, 2106, 0)
          }
        };
      }

      cacheEntry.data = data;
      cacheEntry.fetchedAt = Date.now();
      return data;
    }

    async function refreshInfoFlowDomain(domainKey, forceRefresh) {
      if (!isInfoPageVisible()) return null;
      const cleanDomain = String(domainKey || '').trim().toLowerCase();
      if (!infoFlowDomainKeys.includes(cleanDomain)) return null;
      const cacheEntry = flowStatusDomainCache[cleanDomain];
      const cacheValid = isFlowStatusDomainCacheValid(cleanDomain);
      const shouldFetch = !!forceRefresh || !cacheValid || !(cacheEntry && cacheEntry.data);
      if (!shouldFetch) {
        renderInfoPanel();
        return cacheEntry ? cacheEntry.data : null;
      }

      setInfoFlowDomainLoading(cleanDomain, true);
      try {
        flowStatusDebugLog('info domain fetch start', {
          domain: cleanDomain,
          endpoint: '/api/runtime/values',
          force: !!forceRefresh
        });
        const entries = Array.isArray(infoRuntimeDomainEntries[cleanDomain])
          ? infoRuntimeDomainEntries[cleanDomain]
          : [];
        const ids = entries.map((entry) => Number(entry && entry.id)).filter((id) => Number.isFinite(id) && id > 0);
        const values = ids.length ? await fetchRuntimeValues(ids) : [];
        cacheInfoRuntimeDomain(cleanDomain, entries, values);
        infoFlowLastSuccessAt = Date.now();
        renderInfoPanel();
        const nextEntry = flowStatusDomainCache[cleanDomain];
        return nextEntry ? nextEntry.data : null;
      } finally {
        setInfoFlowDomainLoading(cleanDomain, false);
      }
    }

    async function refreshInfoFlowDomains(forceRefresh) {
      if (!isInfoPageVisible()) return null;
      const refreshWindowMs = (
        !document.hidden && getActivePageId() === 'page-info'
      ) ? infoFlowRefreshActiveMs : infoFlowRefreshIdleMs;
      const now = Date.now();
      if (infoFlowRefreshPromise) {
        return infoFlowRefreshPromise;
      }
      if (!forceRefresh && (now - infoFlowLastAttemptAt) < refreshWindowMs) {
        return null;
      }
      infoFlowLastAttemptAt = now;

      const promise = (async () => {
        const domainRefresh = (async () => {
          for (const domainKey of infoFlowDomainKeys) {
            try {
              await refreshInfoFlowDomain(domainKey, !!forceRefresh);
            } catch (err) {
            }
          }
        })();
        const runtimeRefresh = fetchOkJson('/api/wifi/config', { cache: 'no-store' }, 'état réseau indisponible')
          .then((data) => { infoNetworkRuntime = data; })
          .catch(() => {});
        await Promise.all([domainRefresh, runtimeRefresh]);
      })();

      infoFlowRefreshPromise = promise.finally(() => {
        infoFlowRefreshPromise = null;
        renderInfoPanel();
      });
      return infoFlowRefreshPromise;
    }

    function renderInfoMetricRows(node, rows) {
      if (!node) return;
      const safeRows = Array.isArray(rows) ? rows : [];
      node.innerHTML = safeRows.map((row) => buildInfoMetricRow(row[0], row[1])).join('');
    }

    function formatInfoBoolean(value, trueText, falseText) {
      if (typeof value !== 'boolean') return '-';
      return value ? (trueText || tr('info.state.connected', 'Connecté')) : (falseText || tr('info.state.disconnected', 'Déconnecté'));
    }

    function formatInfoDbm(value) {
      const n = Number(value);
      return Number.isFinite(n) ? (String(Math.trunc(n)) + ' dBm') : '-';
    }

    function formatInfoCount(value) {
      const n = Number(value);
      return Number.isFinite(n) ? String(Math.trunc(n)) : '-';
    }

    function formatInfoNetworkType(value) {
      const normalized = normalizeNetworkType(value);
      if (normalized === 'ethernet') return tr('info.netType.ethernet', 'Ethernet');
      if (normalized === 'wifi') return tr('info.netType.wifi', 'Wifi');
      const raw = String(value || '').trim().toLowerCase();
      if (!raw || raw === 'none' || raw === 'ap' || raw === 'accesspoint' || raw === 'access_point') {
        return tr('info.state.disconnected', 'Déconnecté');
      }
      return raw ? raw : '-';
    }

    function renderInfoPanel() {
      const systemDomain = (flowStatusDomainCache.system && flowStatusDomainCache.system.data && flowStatusDomainCache.system.data.ok === true)
        ? flowStatusDomainCache.system.data
        : null;
      const flowHeap = (systemDomain && systemDomain.heap && typeof systemDomain.heap === 'object') ? systemDomain.heap : {};

      const wifiDomain = (flowStatusDomainCache.wifi && flowStatusDomainCache.wifi.data && flowStatusDomainCache.wifi.data.ok === true)
        ? flowStatusDomainCache.wifi.data
        : null;
      const wifi = (wifiDomain && wifiDomain.wifi && typeof wifiDomain.wifi === 'object') ? wifiDomain.wifi : {};

      const mqttDomain = (flowStatusDomainCache.mqtt && flowStatusDomainCache.mqtt.data && flowStatusDomainCache.mqtt.data.ok === true)
        ? flowStatusDomainCache.mqtt.data
        : null;
      const mqtt = (mqttDomain && mqttDomain.mqtt && typeof mqttDomain.mqtt === 'object') ? mqttDomain.mqtt : {};
      const time = (systemDomain && systemDomain.time && typeof systemDomain.time === 'object') ? systemDomain.time : null;
      if (time) {
        syncHeaderTimeSourceFromSystemDomain();
      }
      const fullFirmware = systemDomain ? fmtFlowStatusVal(systemDomain.fw) : (deps.getSupervisorFirmwareVersion() || '-');
      const firmwareParts = splitInfoFirmwareVersion(fullFirmware);
      const currentMac = wifiDomain ? normalizeInfoMac(wifi.mac) : '-';
      if (currentMac !== '-') infoLastMac = currentMac;
      const mac = currentMac !== '-' ? currentMac : infoLastMac;
      const deviceName = String(systemDomain && systemDomain.devicename ? systemDomain.devicename : deps.getWebDeviceName() || 'flowio').trim() || 'flowio';
      const ethernetRuntime = infoNetworkRuntime && infoNetworkRuntime.ethernet ? infoNetworkRuntime.ethernet : null;
      const wifiRuntime = infoNetworkRuntime && infoNetworkRuntime.runtime ? infoNetworkRuntime.runtime : null;
      const ethernetState = ethernetRuntime
        ? formatInfoBoolean(!!ethernetRuntime.connected, tr('info.state.connected', 'Connecté'), tr('info.state.disconnected', 'Déconnecté'))
        : '-';
      const wifiConnected = wifiRuntime ? !!wifiRuntime.connected : !!(wifiDomain && wifi.rdy && normalizeNetworkType(wifi.typ) === 'wifi');
      const wifiState = formatInfoBoolean(wifiConnected, tr('info.state.connected', 'Connecté'), tr('info.state.disconnected', 'Déconnecté'));
      const wifiRssi = wifiConnected
        ? formatInfoDbm(wifiRuntime && Number.isFinite(Number(wifiRuntime.rssi)) ? wifiRuntime.rssi : wifi.rssi)
        : '-';
      const wifiStateWithSignal = wifiConnected && wifiRssi !== '-'
        ? wifiState + ' (' + wifiRssi + ')'
        : wifiState;
      const infoRows = [
        [tr('info.row.deviceName', 'Nom de l’appareil'), deviceName],
        [tr('info.row.firmwareVersion', 'Version firmware'), firmwareParts.version],
        [tr('info.row.buildVersion', 'Version build'), firmwareParts.build],
        [tr('info.row.uptime', 'Uptime'), systemDomain ? formatInfoUptime(systemDomain.upms) : formatInfoUptime(deps.getSupervisorUptimeMs())],
        [tr('info.row.ip', 'Adresse IP'), wifiDomain ? normalizeIpValue(wifi.ip) : '-'],
        [tr('info.row.mac', 'Adresse MAC'), mac],
        [tr('info.row.ethernet', 'Ethernet'), ethernetState],
        [tr('info.row.wifi', 'Wi-Fi'), wifiStateWithSignal],
        [tr('info.row.mqtt', 'MQTT'), mqttDomain ? formatInfoBoolean(!!mqtt.rdy, tr('info.state.connected', 'Connecté'), tr('info.state.disconnected', 'Déconnecté')) : '-'],
        [tr('info.row.time', 'Heure'), time ? flowTimeStatusLabel(time) : '-']
      ];
      if (systemDomain) {
        infoRows.push([tr('info.row.heapFree', 'Heap libre'), formatInfoBytes(flowHeap.free)]);
      }
      renderInfoMetricRows(infoGrid, infoRows);

      if (infoStatusChip) {
        infoStatusChip.textContent = tr('info.updatedAt', 'Mise à jour') + ': ' + new Date().toLocaleTimeString(currentWebLocaleTag());
      }
      refreshAppHeader(getActivePageId());
    }



    function isInfoPageVisible() {
      return !document.hidden && getActivePageId() === 'page-info';
    }

    async function pollInfoRuntimeTick() {
      if (!isInfoPageVisible()) {
        stopInfoPolling();
        return;
      }
      try {
        await refreshInfoFlowDomains(true);
      } catch (err) {
      }
      renderInfoPanel();
    }

    async function pollInfoSupervisorTick() {
      if (!isInfoPageVisible()) {
        stopInfoPolling();
        return;
      }
      try {
        await loadWebMeta({ skipDrawerRuntimeRender: true });
      } catch (err) {
      }
      renderInfoPanel();
    }

    function startInfoPolling() {
      if (!isInfoPageVisible()) return;
      infoRuntimePoller.start();
      infoSupervisorPoller.start();
    }

    function stopInfoPolling() {
      infoRuntimePoller.stop();
      infoSupervisorPoller.stop();
    }



      infoRuntimePoller = createIntervalRunner(() => pollInfoRuntimeTick(), infoRefreshActiveMs);
      infoSupervisorPoller = createIntervalRunner(() => pollInfoSupervisorTick(), infoSupervisorRefreshMs);
      bindClickAction(infoSystemLoader, () => refreshInfoFlowDomain('system', true));
      bindClickAction(infoWifiLoader, () => refreshInfoFlowDomain('wifi', true));
      bindClickAction(infoMqttLoader, () => refreshInfoFlowDomain('mqtt', true));
      updateInfoLoadButtonsText();

      return {
        show: async function show() {
          await loadWebMeta({ skipDrawerRuntimeRender: true });
          await refreshInfoFlowDomains(true);
          renderInfoPanel();
          if (isInfoPageVisible()) startInfoPolling();
        },
        hide: stopInfoPolling,
        refresh: refreshInfoFlowDomains,
        render: renderInfoPanel
      };
    }
  };
})();
