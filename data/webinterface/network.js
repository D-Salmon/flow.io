(function (global) {
  'use strict';

  var pages = global.FlowWebPages = global.FlowWebPages || {};

  function create(deps) {
    if (!deps || typeof deps !== 'object') {
      throw new Error('network_page_dependencies_missing');
    }

    var tr = deps.tr;
    var fetchOkJson = deps.fetchOkJson;
    var createFormPostOptions = deps.createFormPostOptions;
    var fetchFlowStatusDomain = deps.fetchFlowStatusDomain;
    var normalizeNetworkType = deps.normalizeNetworkType;
    var getActivePageId = deps.getActivePageId;
    var bindClickAction = deps.bindClickAction;
    var updatePasswordVisibility = deps.updatePasswordVisibility;
    var togglePasswordVisibility = deps.togglePasswordVisibility;

    var wifiEnabled = document.getElementById('wifiEnabled');
    var wifiSsid = document.getElementById('wifiSsid');
    var wifiSsidList = document.getElementById('wifiSsidList');
    var wifiPass = document.getElementById('wifiPass');
    var toggleWifiPassBtn = document.getElementById('toggleWifiPass');
    var scanWifiBtn = document.getElementById('scanWifi');
    var applyWifiCfgBtn = document.getElementById('applyWifiCfg');
    var cancelWifiCfgBtn = document.getElementById('cancelWifiCfg');
    var applyEthernetCfgBtn = document.getElementById('applyEthernetCfg');
    var cancelEthernetCfgBtn = document.getElementById('cancelEthernetCfg');
    var applyMqttCfgBtn = document.getElementById('applyMqttCfg');
    var cancelMqttCfgBtn = document.getElementById('cancelMqttCfg');
    var wifiConfigStatus = document.getElementById('wifiConfigStatus');
    var wifiConfigFields = document.getElementById('wifiConfigFields');
    var ethernetEnabled = document.getElementById('ethernetEnabled');
    var ethernetDhcp = document.getElementById('ethernetDhcp');
    var ethernetStaticFields = document.getElementById('ethernetStaticFields');
    var ethernetIp = document.getElementById('ethernetIp');
    var ethernetSubnet = document.getElementById('ethernetSubnet');
    var ethernetGateway = document.getElementById('ethernetGateway');
    var ethernetDns1 = document.getElementById('ethernetDns1');
    var ethernetDns2 = document.getElementById('ethernetDns2');
    var ethernetConnectionState = document.getElementById('ethernetConnectionState');
    var wifiConnectionState = document.getElementById('wifiConnectionState');
    var mqttEnabled = document.getElementById('mqttEnabled');
    var mqttConfigFields = document.getElementById('mqttConfigFields');
    var mqttConnectionState = document.getElementById('mqttConnectionState');
    var mqttDeviceName = document.getElementById('mqttDeviceName');
    var mqttBaseTopic = document.getElementById('mqttBaseTopic');
    var mqttHost = document.getElementById('mqttHost');
    var mqttPort = document.getElementById('mqttPort');
    var mqttUser = document.getElementById('mqttUser');
    var mqttPass = document.getElementById('mqttPass');
    var toggleMqttPassBtn = document.getElementById('toggleMqttPass');
    var mqttTopicDeviceId = document.getElementById('mqttTopicDeviceId');

    var configLoadedOnce = false;
    var mqttPasswordConfigured = false;
    var wifiScanAutoRequested = false;
    var wifiScanTimer = null;
    var connectionStatusTimer = null;
    var visible = false;
    var initialized = false;
    var networkSnapshot = null;
    var mqttSnapshot = null;

    function translate(key, fallback) {
      return typeof tr === 'function' ? tr(key, fallback) : fallback;
    }

    function setStatus(text) {
      if (wifiConfigStatus) wifiConfigStatus.textContent = String(text || '');
    }

    function isVisible() {
      return visible && typeof getActivePageId === 'function' && getActivePageId() === 'page-wifi';
    }

    function toBool(value) {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        var normalized = value.trim().toLowerCase();
        return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
      }
      return false;
    }

    function validIpv4(value, required) {
      var text = String(value || '').trim();
      if (!text) return !required;
      var parts = text.split('.');
      if (parts.length !== 4) return false;
      if (!parts.every(function (part) {
        return /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255;
      })) return false;
      return !required || text !== '0.0.0.0';
    }

    function syncEthernetConfigUi() {
      if (!ethernetEnabled || !ethernetDhcp || !ethernetStaticFields) return;
      var enabled = ethernetEnabled.checked;
      var staticMode = !ethernetDhcp.checked;
      ethernetDhcp.disabled = !enabled;
      ethernetStaticFields.hidden = !enabled || !staticMode;
      [ethernetIp, ethernetSubnet, ethernetGateway, ethernetDns1, ethernetDns2].forEach(function (input) {
        if (input) input.disabled = !enabled || !staticMode;
      });
    }

    function syncWifiConfigUi() {
      if (!wifiEnabled) return;
      var enabled = wifiEnabled.checked;
      [wifiSsidList, wifiPass, toggleWifiPassBtn].forEach(function (control) {
        if (control) control.disabled = !enabled;
      });
      if (scanWifiBtn) scanWifiBtn.disabled = false;
      if (wifiConfigFields) wifiConfigFields.classList.toggle('is-disabled', !enabled);
    }

    function setSectionDirty(section, dirty) {
      var apply = section === 'ethernet' ? applyEthernetCfgBtn : (section === 'wifi' ? applyWifiCfgBtn : applyMqttCfgBtn);
      var cancel = section === 'ethernet' ? cancelEthernetCfgBtn : (section === 'wifi' ? cancelWifiCfgBtn : cancelMqttCfgBtn);
      if (apply) apply.disabled = !dirty;
      if (cancel) cancel.disabled = !dirty;
    }

    function appendWifiOption(value, label) {
      if (!wifiSsidList || !value) return;
      var exists = Array.from(wifiSsidList.options).some(function (option) { return option.value === value; });
      if (exists) return;
      var option = document.createElement('option');
      option.value = value;
      option.textContent = label || value;
      wifiSsidList.appendChild(option);
    }

    function syncMqttConfigUi() {
      if (!mqttEnabled) return;
      var enabled = mqttEnabled.checked;
      [mqttDeviceName, mqttBaseTopic, mqttHost, mqttPort, mqttUser, mqttPass, toggleMqttPassBtn, mqttTopicDeviceId]
        .forEach(function (control) {
          if (control) control.disabled = !enabled;
        });
      if (mqttConfigFields) mqttConfigFields.classList.toggle('is-disabled', !enabled);
    }

    function setNetworkConnectionState(node, state) {
      if (!node) return;
      var normalized = ['connected', 'disconnected', 'unavailable'].indexOf(state) >= 0 ? state : 'unavailable';
      node.classList.remove('is-connected', 'is-disconnected', 'is-unknown');
      node.classList.add(normalized === 'connected' ? 'is-connected' : (normalized === 'disconnected' ? 'is-disconnected' : 'is-unknown'));
      var textNode = node.querySelector('span:last-child');
      if (!textNode) return;
      if (normalized === 'connected') {
        textNode.textContent = translate('network.state.connected', 'Connecté');
      } else if (normalized === 'disconnected') {
        textNode.textContent = translate('network.state.disconnected', 'Déconnecté');
      } else {
        textNode.textContent = translate('network.state.unavailable', 'Indisponible');
      }
    }

    function stopWifiScanPolling() {
      if (wifiScanTimer !== null) {
        clearTimeout(wifiScanTimer);
        wifiScanTimer = null;
      }
    }

    function scheduleWifiScanPolling() {
      stopWifiScanPolling();
      if (!isVisible()) return;
      wifiScanTimer = setTimeout(function () {
        wifiScanTimer = null;
        if (!isVisible() || document.hidden) return;
        refreshWifiScanStatus(false).catch(function () {});
      }, 1200);
    }

    function stopConnectionStatusTimer() {
      if (connectionStatusTimer !== null) {
        clearTimeout(connectionStatusTimer);
        connectionStatusTimer = null;
      }
    }

    function scheduleConnectionStatusRefresh() {
      stopConnectionStatusTimer();
      if (!isVisible()) return;
      connectionStatusTimer = setTimeout(function () {
        connectionStatusTimer = null;
        if (!isVisible() || document.hidden) return;
        refreshConnectionStates(true)
          .catch(function () {})
          .finally(scheduleConnectionStatusRefresh);
      }, 5000);
    }

    function renderWifiScanList(data) {
      if (!wifiSsidList || !wifiSsid) return;
      var networks = data && Array.isArray(data.networks) ? data.networks : [];
      var currentSsid = String(wifiSsid.value || '').trim();
      var previousSelection = wifiSsidList.value || '';
      var maxLabelLength = 56;

      wifiSsidList.innerHTML = '';
      var emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = networks.length ? 'Choisir un réseau…' : 'Aucun réseau détecté';
      wifiSsidList.appendChild(emptyOption);

      networks.forEach(function (network) {
        if (!network || typeof network.ssid !== 'string' || network.ssid.length === 0 || network.hidden) return;
        var option = document.createElement('option');
        var security = network.secure ? ' (securise)' : ' (ouvert)';
        var signal = Number.isFinite(network.rssi) ? (' ' + network.rssi + ' dBm') : '';
        var fullLabel = network.ssid + security + signal;
        option.value = network.ssid;
        option.textContent = fullLabel.length > maxLabelLength
          ? (fullLabel.slice(0, maxLabelLength - 1) + '…')
          : fullLabel;
        wifiSsidList.appendChild(option);
      });

      appendWifiOption(currentSsid, currentSsid ? currentSsid + ' (configuré)' : '');
      var values = Array.from(wifiSsidList.options).map(function (option) { return option.value; });
      if (currentSsid && values.indexOf(currentSsid) >= 0) {
        wifiSsidList.value = currentSsid;
      } else if (previousSelection && values.indexOf(previousSelection) >= 0) {
        wifiSsidList.value = previousSelection;
      } else {
        wifiSsidList.value = '';
      }
    }

    function updateWifiScanStatusText(data, requestError) {
      if (requestError) {
        setStatus('Scan réseau indisponible: ' + requestError);
        return;
      }
      if (!data || data.ok !== true) {
        setStatus('Scan réseau : réponse invalide.');
        return;
      }
      var running = !!data.running;
      var requested = !!data.requested;
      var count = Number.isFinite(data.count) ? data.count : 0;
      var totalFound = Number.isFinite(data.total_found) ? data.total_found : count;
      if (running || requested) {
        setStatus('Scan réseau en cours...');
      } else if (count > 0) {
        setStatus('Scan réseau terminé : ' + count + ' réseaux affichés (' + totalFound + ' détectés).');
      } else {
        setStatus('Aucun réseau visible détecté.');
      }
    }

    async function requestWifiScan(force) {
      return fetchOkJson('/api/wifi/scan', createFormPostOptions({
        force: force ? '1' : '0'
      }), 'échec démarrage scan');
    }

    async function refreshWifiScanStatus(triggerScan) {
      try {
        if (triggerScan) await requestWifiScan(true);
        var data = await fetchOkJson('/api/wifi/scan', { cache: 'no-store' }, 'échec lecture état');
        renderWifiScanList(data);
        updateWifiScanStatusText(data, null);
        if (data.running || data.requested) scheduleWifiScanPolling();
        else stopWifiScanPolling();
      } catch (err) {
        stopWifiScanPolling();
        updateWifiScanStatusText(null, err);
      }
    }

    async function refreshConnectionStates(forceRefresh) {
      var results = await Promise.all([
        fetchFlowStatusDomain('wifi', !!forceRefresh, 'network-config').catch(function () { return null; }),
        fetchFlowStatusDomain('mqtt', !!forceRefresh, 'network-config').catch(function () { return null; }),
        fetchOkJson('/api/wifi/config', { cache: 'no-store' }, 'état réseau indisponible').catch(function () { return null; })
      ]);
      var wifiDomain = results[0];
      var mqttDomain = results[1];
      var runtimeConfig = results[2];
      var network = wifiDomain && wifiDomain.ok === true && wifiDomain.wifi && typeof wifiDomain.wifi === 'object'
        ? wifiDomain.wifi
        : null;
      var networkReady = !!(network && network.rdy);
      var networkType = network ? normalizeNetworkType(network.typ) : '';
      setNetworkConnectionState(
        ethernetConnectionState,
        runtimeConfig && runtimeConfig.ethernet
          ? (toBool(runtimeConfig.ethernet.connected) ? 'connected' : 'disconnected')
          : (network ? (networkReady && networkType === 'ethernet' ? 'connected' : 'disconnected') : 'unavailable')
      );
      setNetworkConnectionState(
        wifiConnectionState,
        runtimeConfig && runtimeConfig.runtime
          ? (toBool(runtimeConfig.runtime.connected) ? 'connected' : 'disconnected')
          : (network ? (networkReady && networkType === 'wifi' ? 'connected' : 'disconnected') : 'unavailable')
      );
      var mqtt = mqttDomain && mqttDomain.ok === true && mqttDomain.mqtt && typeof mqttDomain.mqtt === 'object'
        ? mqttDomain.mqtt
        : null;
      setNetworkConnectionState(mqttConnectionState, mqtt ? (mqtt.rdy ? 'connected' : 'disconnected') : 'unavailable');
    }

    async function loadWifiConfig() {
      try {
        var data = await fetchOkJson('/api/wifi/config', { cache: 'no-store' }, 'chargement réseau indisponible');
        if (wifiEnabled) wifiEnabled.checked = toBool(data.enabled);
        if (wifiSsid) wifiSsid.value = data.ssid || '';
        if (wifiSsidList) {
          appendWifiOption(data.ssid || '', data.ssid ? data.ssid + ' (configuré)' : '');
          wifiSsidList.value = data.ssid || '';
        }
        if (wifiPass) {
          wifiPass.value = '';
          wifiPass.placeholder = data.password_configured
            ? translate('wifi.password.keep', 'Conserver le mot de passe enregistré')
            : translate('wifi.password.enter', 'Saisir le mot de passe réseau');
        }
        var ethernet = data && data.ethernet && typeof data.ethernet === 'object' ? data.ethernet : {};
        if (ethernetEnabled) ethernetEnabled.checked = ethernet.enabled === undefined ? true : toBool(ethernet.enabled);
        if (ethernetDhcp) ethernetDhcp.checked = ethernet.dhcp === undefined || toBool(ethernet.dhcp);
        if (ethernetIp) ethernetIp.value = ethernet.ip || '';
        if (ethernetSubnet) ethernetSubnet.value = ethernet.subnet || '255.255.255.0';
        if (ethernetGateway) ethernetGateway.value = ethernet.gateway || '';
        if (ethernetDns1) ethernetDns1.value = ethernet.dns1 || '';
        if (ethernetDns2) ethernetDns2.value = ethernet.dns2 || '';
        syncEthernetConfigUi();
        syncWifiConfigUi();
        networkSnapshot = {
          wifiEnabled: !!(wifiEnabled && wifiEnabled.checked),
          wifiSsid: wifiSsid ? wifiSsid.value : '',
          ethernetEnabled: !!(ethernetEnabled && ethernetEnabled.checked),
          ethernetDhcp: !!(ethernetDhcp && ethernetDhcp.checked),
          ethernetIp: ethernetIp ? ethernetIp.value : '', ethernetSubnet: ethernetSubnet ? ethernetSubnet.value : '',
          ethernetGateway: ethernetGateway ? ethernetGateway.value : '', ethernetDns1: ethernetDns1 ? ethernetDns1.value : '',
          ethernetDns2: ethernetDns2 ? ethernetDns2.value : ''
        };
        setSectionDirty('ethernet', false);
        setSectionDirty('wifi', false);
        setStatus('Configuration réseau chargée.');
      } catch (err) {
        setStatus('Chargement réseau échoué: ' + err);
      }
    }

    async function loadMqttConfig() {
      try {
        var data = await fetchOkJson('/api/mqtt/config', { cache: 'no-store' }, 'chargement MQTT indisponible');
        if (mqttEnabled) mqttEnabled.checked = toBool(data.enabled);
        if (mqttHost) mqttHost.value = data.host || '';
        if (mqttPort) mqttPort.value = data.port || 8883;
        if (mqttUser) mqttUser.value = data.user || '';
        if (mqttBaseTopic) mqttBaseTopic.value = data.baseTopic || 'flowio';
        if (mqttTopicDeviceId) mqttTopicDeviceId.value = data.topicDeviceId || '';
        if (mqttDeviceName) mqttDeviceName.value = data.deviceName || '';
        mqttPasswordConfigured = toBool(data.password_configured);
        if (mqttPass) {
          mqttPass.value = '';
          mqttPass.placeholder = mqttPasswordConfigured
            ? translate('mqtt.password.keep', 'Conserver le mot de passe enregistré')
            : translate('mqtt.password.placeholder', 'Mot de passe MQTT');
        }
        syncMqttConfigUi();
        mqttSnapshot = {
          enabled: !!(mqttEnabled && mqttEnabled.checked), host: mqttHost ? mqttHost.value : '', port: mqttPort ? mqttPort.value : '',
          user: mqttUser ? mqttUser.value : '', baseTopic: mqttBaseTopic ? mqttBaseTopic.value : '',
          topicDeviceId: mqttTopicDeviceId ? mqttTopicDeviceId.value : '', deviceName: mqttDeviceName ? mqttDeviceName.value : ''
        };
        setSectionDirty('mqtt', false);
      } catch (err) {
        setStatus(translate('mqtt.loadFailed', 'Chargement MQTT échoué') + ': ' + err);
      }
    }

    async function saveWifiConfig(section) {
      if (wifiEnabled && !wifiEnabled.checked && ethernetEnabled && !ethernetEnabled.checked) {
        throw new Error('Ethernet et Wi-Fi ne peuvent pas être désactivés simultanément.');
      }
      var staticMode = !!(ethernetEnabled && ethernetEnabled.checked && ethernetDhcp && !ethernetDhcp.checked);
      if (staticMode &&
          (!validIpv4(ethernetIp && ethernetIp.value, true) ||
           !validIpv4(ethernetSubnet && ethernetSubnet.value, true) ||
           !validIpv4(ethernetGateway && ethernetGateway.value, true) ||
           !validIpv4(ethernetDns1 && ethernetDns1.value, false) ||
           !validIpv4(ethernetDns2 && ethernetDns2.value, false))) {
        throw new Error(translate('ethernet.static.invalid', 'Vérifiez l’adresse IP, le masque, la passerelle et les DNS.'));
      }
      var ethernetOnly = section === 'ethernet';
      var values = { scope: ethernetOnly ? 'ethernet' : 'wifi' };
      if (ethernetOnly) {
        values.eth_enabled = ethernetEnabled && ethernetEnabled.checked ? '1' : '0';
        values.eth_dhcp = ethernetDhcp && ethernetDhcp.checked ? '1' : '0';
        values.eth_ip = ethernetIp ? ethernetIp.value.trim() : '';
        values.eth_subnet = ethernetSubnet ? ethernetSubnet.value.trim() : '';
        values.eth_gateway = ethernetGateway ? ethernetGateway.value.trim() : '';
        values.eth_dns1 = ethernetDns1 ? ethernetDns1.value.trim() : '';
        values.eth_dns2 = ethernetDns2 ? ethernetDns2.value.trim() : '';
      } else {
        values.enabled = wifiEnabled && wifiEnabled.checked ? '1' : '0';
        values.ssid = wifiSsid ? wifiSsid.value.trim() : '';
        values.pass = wifiPass ? wifiPass.value : '';
      }
      await fetchOkJson('/api/wifi/config', createFormPostOptions(values), 'échec application');
    }

    function waitMs(delay) {
      return new Promise(function (resolve) { setTimeout(resolve, delay); });
    }

    async function validateNewWifiPassword() {
      var deadline = Date.now() + 18000;
      setStatus('Vérification du mot de passe Wi-Fi…');
      while (Date.now() < deadline) {
        await waitMs(1200);
        var data = await fetchOkJson('/api/wifi/config', { cache: 'no-store' }, 'vérification Wi-Fi indisponible')
          .catch(function () { return null; });
        if (data && data.runtime && toBool(data.runtime.connected)) {
          setNetworkConnectionState(wifiConnectionState, 'connected');
          setStatus('Mot de passe Wi-Fi correct · connexion établie' + (data.runtime.ip ? ' (' + data.runtime.ip + ')' : '') + '.');
          return true;
        }
      }

      await fetchOkJson('/api/wifi/config', createFormPostOptions({
        scope: 'wifi',
        enabled: '0',
        ssid: wifiSsid ? wifiSsid.value.trim() : '',
        pass: ''
      }), 'désactivation Wi-Fi impossible');
      if (wifiEnabled) wifiEnabled.checked = false;
      syncWifiConfigUi();
      setNetworkConnectionState(wifiConnectionState, 'disconnected');
      setStatus('Mot de passe Wi-Fi incorrect ou refusé par le réseau · Wi-Fi non activé.');
      return false;
    }

    async function saveMqttConfig() {
      var enabled = !!(mqttEnabled && mqttEnabled.checked);
      var host = mqttHost ? mqttHost.value.trim() : '';
      var port = Number.parseInt(mqttPort ? mqttPort.value : '', 10);
      var user = mqttUser ? mqttUser.value.trim() : '';
      if (enabled && !host) throw new Error(translate('mqtt.host.required', 'Le broker MQTT est obligatoire.'));
      if (enabled && (!Number.isInteger(port) || port < 1 || port > 65535)) {
        throw new Error(translate('mqtt.port.invalid', 'Le port MQTT doit être compris entre 1 et 65535.'));
      }
      if (enabled && !user) throw new Error(translate('mqtt.user.required', 'L’utilisateur MQTT est obligatoire.'));
      if (enabled && !mqttPasswordConfigured && !(mqttPass && mqttPass.value)) {
        throw new Error(translate('mqtt.password.required', 'Le mot de passe MQTT est obligatoire.'));
      }
      await fetchOkJson('/api/mqtt/config', createFormPostOptions({
        enabled: enabled ? '1' : '0',
        host: host,
        port: Number.isInteger(port) ? String(port) : '8883',
        user: user,
        pass: mqttPass ? mqttPass.value : '',
        baseTopic: mqttBaseTopic && mqttBaseTopic.value.trim() ? mqttBaseTopic.value.trim() : 'flowio',
        topicDeviceId: mqttTopicDeviceId ? mqttTopicDeviceId.value.trim() : '',
        deviceName: mqttDeviceName ? mqttDeviceName.value.trim() : ''
      }), 'échec application MQTT');
      if (mqttPass && mqttPass.value) mqttPasswordConfigured = true;
      if (mqttPass) {
        mqttPass.value = '';
        mqttPass.placeholder = mqttPasswordConfigured
          ? translate('mqtt.password.keep', 'Conserver le mot de passe enregistré')
          : translate('mqtt.password.placeholder', 'Mot de passe MQTT');
      }
    }

    async function saveNetworkConfig() {
      setStatus(translate('network.saving', 'Enregistrement des réglages réseau...'));
      await saveMqttConfig();
      await saveWifiConfig('wifi');
      await saveWifiConfig('ethernet');
      setStatus(translate('network.applied', 'Configuration réseau et MQTT appliquée (reconnexion en cours).'));
      setTimeout(function () {
        if (isVisible()) refreshConnectionStates(true).catch(function () {});
      }, 1800);
    }

    function restoreNetworkSection(section) {
      if (!networkSnapshot) return;
      if (section === 'wifi') {
        if (wifiEnabled) wifiEnabled.checked = networkSnapshot.wifiEnabled;
        if (wifiSsid) wifiSsid.value = networkSnapshot.wifiSsid;
        appendWifiOption(networkSnapshot.wifiSsid, networkSnapshot.wifiSsid ? networkSnapshot.wifiSsid + ' (configuré)' : '');
        if (wifiSsidList) wifiSsidList.value = networkSnapshot.wifiSsid;
        if (wifiPass) wifiPass.value = '';
        syncWifiConfigUi();
      } else {
        if (ethernetEnabled) ethernetEnabled.checked = networkSnapshot.ethernetEnabled;
        if (ethernetDhcp) ethernetDhcp.checked = networkSnapshot.ethernetDhcp;
        if (ethernetIp) ethernetIp.value = networkSnapshot.ethernetIp;
        if (ethernetSubnet) ethernetSubnet.value = networkSnapshot.ethernetSubnet;
        if (ethernetGateway) ethernetGateway.value = networkSnapshot.ethernetGateway;
        if (ethernetDns1) ethernetDns1.value = networkSnapshot.ethernetDns1;
        if (ethernetDns2) ethernetDns2.value = networkSnapshot.ethernetDns2;
        syncEthernetConfigUi();
      }
      setSectionDirty(section, false);
      setStatus('Modifications annulées.');
    }

    function restoreMqttSection() {
      if (!mqttSnapshot) return;
      if (mqttEnabled) mqttEnabled.checked = mqttSnapshot.enabled;
      if (mqttHost) mqttHost.value = mqttSnapshot.host;
      if (mqttPort) mqttPort.value = mqttSnapshot.port;
      if (mqttUser) mqttUser.value = mqttSnapshot.user;
      if (mqttBaseTopic) mqttBaseTopic.value = mqttSnapshot.baseTopic;
      if (mqttTopicDeviceId) mqttTopicDeviceId.value = mqttSnapshot.topicDeviceId;
      if (mqttDeviceName) mqttDeviceName.value = mqttSnapshot.deviceName;
      if (mqttPass) mqttPass.value = '';
      syncMqttConfigUi();
      setSectionDirty('mqtt', false);
      setStatus('Modifications MQTT annulées.');
    }

    function bindPasswordToggle(input, button, showKey, showFallback, hideKey, hideFallback) {
      if (!input || !button || typeof updatePasswordVisibility !== 'function' || typeof togglePasswordVisibility !== 'function') return;
      updatePasswordVisibility(input, button, translate(showKey, showFallback), translate(hideKey, hideFallback));
      button.addEventListener('click', function () {
        togglePasswordVisibility(input, button, translate(showKey, showFallback), translate(hideKey, hideFallback));
      });
    }

    function init() {
      if (initialized) return;
      initialized = true;
      bindPasswordToggle(
        wifiPass,
        toggleWifiPassBtn,
        'wifi.password.show',
        'Afficher le mot de passe réseau',
        'wifi.password.hide',
        'Masquer le mot de passe réseau'
      );
      bindPasswordToggle(
        mqttPass,
        toggleMqttPassBtn,
        'mqtt.password.show',
        'Afficher le mot de passe MQTT',
        'mqtt.password.hide',
        'Masquer le mot de passe MQTT'
      );
      if (wifiSsidList && wifiSsid) {
        wifiSsidList.addEventListener('change', function () {
          var selected = String(wifiSsidList.value || '').trim();
          if (wifiSsid) wifiSsid.value = selected;
          setSectionDirty('wifi', true);
        });
      }
      if (wifiEnabled) wifiEnabled.addEventListener('change', function () { syncWifiConfigUi(); setSectionDirty('wifi', true); });
      if (ethernetEnabled) ethernetEnabled.addEventListener('change', function () { syncEthernetConfigUi(); setSectionDirty('ethernet', true); });
      if (ethernetDhcp) ethernetDhcp.addEventListener('change', function () { syncEthernetConfigUi(); setSectionDirty('ethernet', true); });
      if (mqttEnabled) mqttEnabled.addEventListener('change', function () { syncMqttConfigUi(); setSectionDirty('mqtt', true); });
      [wifiPass].forEach(function (node) { if (node) node.addEventListener('input', function () { setSectionDirty('wifi', true); }); });
      [ethernetIp, ethernetSubnet, ethernetGateway, ethernetDns1, ethernetDns2].forEach(function (node) { if (node) node.addEventListener('input', function () { setSectionDirty('ethernet', true); }); });
      [mqttDeviceName, mqttBaseTopic, mqttHost, mqttPort, mqttUser, mqttPass, mqttTopicDeviceId].forEach(function (node) { if (node) node.addEventListener('input', function () { setSectionDirty('mqtt', true); }); });
      syncWifiConfigUi();
      syncEthernetConfigUi();
      syncMqttConfigUi();
      bindClickAction(scanWifiBtn, function () { return refreshWifiScanStatus(true); });
      bindClickAction(applyWifiCfgBtn, async function () {
        try {
          setStatus('Application de la configuration Wi-Fi…');
          var mustValidatePassword = !!(wifiEnabled && wifiEnabled.checked && wifiPass && wifiPass.value);
          await saveWifiConfig('wifi');
          if (mustValidatePassword && !(await validateNewWifiPassword())) return;
          await loadWifiConfig();
          if (mustValidatePassword) setStatus('Mot de passe Wi-Fi correct · connexion établie.');
        } catch (err) {
          setStatus(translate('system.action.wifiApplyFailed', 'Application réseau échouée') + ': ' + err);
        }
      });
      bindClickAction(applyEthernetCfgBtn, async function () {
        try { setStatus('Application de la configuration Ethernet…'); await saveWifiConfig('ethernet'); await loadWifiConfig(); }
        catch (err) { setStatus('Application Ethernet échouée : ' + err); }
      });
      bindClickAction(applyMqttCfgBtn, async function () {
        try { setStatus('Application de la configuration MQTT…'); await saveMqttConfig(); await loadMqttConfig(); }
        catch (err) { setStatus('Application MQTT échouée : ' + err); }
      });
      bindClickAction(cancelWifiCfgBtn, function () { restoreNetworkSection('wifi'); });
      bindClickAction(cancelEthernetCfgBtn, function () { restoreNetworkSection('ethernet'); });
      bindClickAction(cancelMqttCfgBtn, restoreMqttSection);
    }

    async function show() {
      visible = true;
      if (!configLoadedOnce) {
        configLoadedOnce = true;
        await Promise.all([loadWifiConfig(), loadMqttConfig()]);
      }
      if (!isVisible()) return;
      if (!wifiScanAutoRequested) {
        wifiScanAutoRequested = true;
        await refreshWifiScanStatus(true);
      } else {
        await refreshWifiScanStatus(false);
      }
      if (!isVisible()) return;
      await refreshConnectionStates(true);
      scheduleConnectionStatusRefresh();
    }

    function hide() {
      visible = false;
      stopWifiScanPolling();
      stopConnectionStatusTimer();
    }

    init();

    return {
      show: show,
      hide: hide,
      refresh: function () { return refreshConnectionStates(true); }
    };
  }

  pages.network = { create: create };
})(window);
