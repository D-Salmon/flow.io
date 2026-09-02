(function () {
  'use strict';

  window.FlowWebPages = window.FlowWebPages || {};
  window.FlowWebPages.updates = {
    create: function createUpdatesPage(deps) {
      const tr = deps.tr;
      const getStorageValue = deps.getStorageValue;
      const setStorageValue = deps.setStorageValue;
      const fetchOkJson = deps.fetchOkJson;
      const createFormPostOptions = deps.createFormPostOptions;
      const normalizeUpgradeHttpErrorMessage = deps.normalizeUpgradeHttpErrorMessage;
      const currentWebLocaleTag = deps.currentWebLocaleTag;
      const isMicronovaProfile = deps.isMicronovaProfile;
      const isSupervisorProfile = deps.isSupervisorProfile;
      const isWaveshareProfile = deps.isWaveshareProfile;
      const isFlowIOProfile = deps.isFlowIOProfile;
      const getActivePageId = deps.getActivePageId;
      const loadWebMeta = deps.loadWebMeta;
      const bindClickAction = deps.bindClickAction;
      const upgradeUiSessionStorageKey = 'flow_upgrade_ui_session';
      const upgradeStatusPollActiveMs = 900;
      const upgradeStatusPollReconnectMs = 5000;
      const upgradeStatusPollDoneMs = 7000;
      const upgradeStatusPollIdleMs = 15000;
      const upgradeStatusPollErrorMs = 10000;
      const upgradeReconnectFetchTimeoutMs = 1400;
      const checkUpdatesBtn = document.getElementById('checkUpdates');
      const cancelUpgradeUiBtn = document.getElementById('cancelUpgradeUi');
      const upgradeCards = document.getElementById('upgradeCards');
      const upgradeTableBody = document.getElementById('upgradeTableBody');
      const upgradeProgressBar = document.getElementById('upgradeProgressBar');
      const upgradePct = document.getElementById('upgradePct');
      const upgradeJourneyLabel = document.getElementById('upgradeJourneyLabel');
      const upgradeSteps = document.getElementById('upgradeSteps');
      const upgradeFooterStatus = document.getElementById('upgradeFooterStatus');
      const upgradeEta = document.getElementById('upgradeEta');
      const upStatusChip = document.getElementById('upStatusChip');
      const systemStatusText = document.getElementById('systemStatusText');
      let upgradeManifestState = { manifest: null, manifestUrl: '', baseUrl: '' };
      let upgradeUiStatusMuted = false;
      const upgradeTargetDefs = {
        flowios3: { manifestKey: 'flowios3', target: 'flowios3', endpoint: '/fwupdate/waveshare', label: 'FlowIOS3', order: 10 },
        waveshare: { manifestKey: 'waveshare', target: 'waveshare', endpoint: '/fwupdate/waveshare', label: 'Waveshare', order: 10 },
        esp32s3: { manifestKey: 'esp32s3', target: 'esp32s3', endpoint: '/fwupdate/waveshare', label: 'ESP32-S3', order: 11 },
        'flowios3-spiffs': { manifestKey: 'flowios3-spiffs', target: 'spiffs', endpoint: '/fwupdate/spiffs', label: 'SPIFFS FlowIOS3', order: 39 },
        'esp32s3-spiffs': { manifestKey: 'esp32s3-spiffs', target: 'spiffs', endpoint: '/fwupdate/spiffs', label: 'SPIFFS ESP32-S3', order: 39 },
        'waveshare-spiffs': { manifestKey: 'waveshare-spiffs', target: 'spiffs', endpoint: '/fwupdate/spiffs', label: 'SPIFFS Waveshare', order: 39 },
        nextion: { manifestKey: 'nextion', target: 'nextion', endpoint: '/fwupdate/nextion', label: 'Nextion', order: 30 },
        spiffs: { manifestKey: 'spiffs', target: 'spiffs', endpoint: '/fwupdate/spiffs', label: 'SPIFFS', order: 40 }
      };
      const upgradeComponentDefs = [
        { key: 'flowio', title: 'FlowIOS3', subtitle: 'Firmware Waveshare', icon: 'layers', tone: 'blue', commentsAvailable: 'Ajout de nouvelles fonctionnalités et améliorations système', commentsCurrent: 'Firmware système actuel' },
        { key: 'spiffs', title: 'SPIFFS', subtitle: 'Fichiers système', icon: 'memory', tone: 'green', commentsAvailable: 'Nouveaux fichiers de configuration et ressources', commentsCurrent: 'Fichiers système actuels' },
        { key: 'nextion', title: 'Nextion', subtitle: 'Interface écran', icon: 'display_settings', tone: 'orange', commentsAvailable: 'Nouvelle interface écran disponible', commentsCurrent: 'Interface écran actuelle' }
      ];
      let upgradeStatusPoller = null;
      let upgradeReconnectStageTimer = null;
      let upgradeReconnectCompletionTimer = null;
      let upgradeReconnectMonitor = null;

    function currentUpgradeStatusPollDelayMs() {
      const current = readUpgradeUiSession();
      const phase = String(current && current.phase ? current.phase : 'idle');
      if (current && (current.awaitingReconnect || phase === 'reboot' || phase === 'reconnect')) {
        return upgradeStatusPollReconnectMs;
      }
      if (phase === 'target' || phase === 'download' || phase === 'flash') {
        return upgradeStatusPollActiveMs;
      }
      if (phase === 'done') return upgradeStatusPollDoneMs;
      if (phase === 'error') return upgradeStatusPollErrorMs;
      return upgradeStatusPollIdleMs;
    }

    function scheduleNextUpgradeStatusPoll(delayMs) {
      if (document.hidden || getActivePageId() !== 'page-system') return;
      const nextDelay = Math.max(0, Number.isFinite(delayMs) ? delayMs : currentUpgradeStatusPollDelayMs());
      upgradeStatusPoller.schedule(nextDelay);
    }

    async function pollUpgradeStatusTick() {
      if (document.hidden || getActivePageId() !== 'page-system') return;
      await refreshUpgradeStatus();
      scheduleNextUpgradeStatusPoll();
    }

    function startUpgradeStatusPolling(immediate) {
      if (immediate) {
        scheduleNextUpgradeStatusPoll(0);
        return;
      }
      scheduleNextUpgradeStatusPoll();
    }

    function stopUpgradeStatusPolling() {
      upgradeStatusPoller.stop();
    }




    function setUpgradeProgress(value) {
      const p = Math.max(0, Math.min(100, Number(value) || 0));
      if (upgradeProgressBar) {
        upgradeProgressBar.style.width = p + '%';
        upgradeProgressBar.classList.toggle('is-complete', p >= 100);
      }
      if (upgradePct) {
        upgradePct.textContent = p + '%';
      }
    }

    function setUpgradeMessage(text) {
      const message = String(text || '').trim() || tr('updates.none', 'Aucune opération en cours.');
      if (upgradeFooterStatus) {
        upgradeFooterStatus.innerHTML = '<span class="sdot"></span>' + message;
      }
    }

    function readUpgradeUiSession() {
      const raw = getStorageValue(sessionStorage, upgradeUiSessionStorageKey);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (err) {
        return null;
      }
    }

    function writeUpgradeUiSession(session) {
      if (!session || typeof session !== 'object') return;
      setStorageValue(sessionStorage, upgradeUiSessionStorageKey, JSON.stringify(session));
    }

    function clearUpgradeUiSession() {
      stopUpgradeReconnectFlow();
      try {
        sessionStorage.removeItem(upgradeUiSessionStorageKey);
      } catch (err) {
      }
    }

    function upgradeTargetLabel(target) {
      const key = String(target || '').trim().toLowerCase();
      if (key === 'flowios3' || key === 'esp32s3') return 'FlowIOS3';
      if (key === 'waveshare') return 'FlowIOS3';
      if (key === 'spiffs') return 'SPIFFS';
      if (key === 'nextion') return 'Nextion';
      return 'Firmware';
    }

    function upgradeUsesReconnect(target) {
      const key = String(target || '').trim().toLowerCase();
      return key === 'flowios3' || key === 'esp32s3' || key === 'waveshare' || key === 'spiffs';
    }

    function upgradeStepDefinitions(target) {
      return [
        { id: 'target', label: tr('updates.step.target', 'Initialisation') },
        { id: 'download', label: tr('updates.step.download', 'Connexion') },
        { id: 'flash', label: tr('updates.step.flash', 'Mise à jour') },
        { id: 'reboot', label: tr('updates.step.reboot', 'Redémarrage') },
        { id: 'reconnect', label: tr('updates.step.reconnect', 'Reconnexion') }
      ];
    }

    function upgradePhaseIndex(phase) {
      if (phase === 'target') return 0;
      if (phase === 'download') return 1;
      if (phase === 'flash') return 2;
      if (phase === 'reboot') return 3;
      if (phase === 'reconnect') return 4;
      if (phase === 'done') return 5;
      return -1;
    }

    function upgradePhasePercent(session) {
      const phase = String(session && session.phase ? session.phase : 'idle');
      const progress = Math.max(0, Math.min(100, Number(session && session.backendProgress) || 0));
      const reconnectProgress = Math.max(0, Math.min(100, Number(session && session.reconnectProgress) || 0));
      if (phase === 'target') return 1;
      if (phase === 'download') return 1 + Math.round(progress * 0.04);
      if (phase === 'flash') return 5 + Math.round(progress * 0.90);
      if (phase === 'reboot') return 97;
      if (phase === 'reconnect') return 97 + Math.round(reconnectProgress * 0.03);
      if (phase === 'done') return 100;
      if (phase === 'error') return Math.max(6, Math.min(96, Number(session && session.lastPercent) || 12));
      return 0;
    }

    function upgradeStepProgress(stepId, state, session) {
      if (state === 'done') return 100;
      if (state !== 'active') return null;
      const phase = String(session && session.phase ? session.phase : '');
      if (stepId !== phase) return null;
      if (phase === 'target') return 100;
      if (phase === 'download' || phase === 'flash') {
        return Math.max(0, Math.min(100, Number(session && session.backendProgress) || 0));
      }
      if (phase === 'reboot') return 100;
      if (phase === 'reconnect') {
        return Math.max(0, Math.min(100, Number(session && session.reconnectProgress) || 0));
      }
      if (phase === 'done') return 100;
      return null;
    }

    function upgradeStepStatusLabel(stepId, state, session) {
      if (state === 'done') return tr('updates.step.status.done', 'Terminé');
      const progress = upgradeStepProgress(stepId, state, session);
      if (state === 'active') {
        return progress !== null
          ? tr('updates.step.status.inProgressPct', 'En cours ({pct}%)').replace('{pct}', String(progress))
          : tr('updates.step.status.inProgress', 'En cours');
      }
      if (state === 'pending') return tr('updates.step.status.pending', 'En attente');
      if (state === 'error') return tr('updates.step.status.error', 'Erreur');
      return tr('updates.step.status.pending', 'En attente');
    }

    function upgradeStepState(stepId, session) {
      const phase = String(session && session.phase ? session.phase : 'idle');
      if (phase === 'idle') return 'pending';
      if (phase === 'error') {
        const failedStep = String(session && session.failedStep ? session.failedStep : 'flash');
        const failedIndex = upgradePhaseIndex(failedStep);
        const stepIndex = upgradePhaseIndex(stepId);
        if (stepIndex < failedIndex) return 'done';
        if (stepId === failedStep) return 'error';
        return 'pending';
      }
      const activeIndex = upgradePhaseIndex(phase);
      const stepIndex = upgradePhaseIndex(stepId);
      if (stepIndex < activeIndex) return 'done';
      if (stepIndex === activeIndex) return phase === 'done' ? 'done' : 'active';
      return 'pending';
    }

    function renderUpgradeSteps(session) {
      if (!upgradeSteps) return;
      const defs = upgradeStepDefinitions(session && session.target);
      upgradeSteps.innerHTML = '';
      defs.forEach((step) => {
        const state = upgradeStepState(step.id, session);
        const row = document.createElement('div');
        row.className = 'step-row';

        const icon = document.createElement('span');
        icon.className = 'step-ic ' + state;
        if (state === 'active') {
          const activeDot = document.createElement('span');
          activeDot.className = 'step-active-dot';
          activeDot.setAttribute('aria-hidden', 'true');
          icon.appendChild(activeDot);
        } else if (state === 'done') {
          const doneIcon = document.createElement('span');
          doneIcon.className = 'ui-msr';
          doneIcon.setAttribute('aria-hidden', 'true');
          doneIcon.textContent = 'check';
          icon.appendChild(doneIcon);
        } else if (state === 'error') {
          const errIcon = document.createElement('span');
          errIcon.className = 'ui-msr';
          errIcon.setAttribute('aria-hidden', 'true');
          errIcon.textContent = 'close';
          icon.appendChild(errIcon);
        } else {
          const pendingIcon = document.createElement('span');
          pendingIcon.className = 'ui-msr';
          pendingIcon.setAttribute('aria-hidden', 'true');
          pendingIcon.textContent = 'radio_button_unchecked';
          icon.appendChild(pendingIcon);
        }
        row.appendChild(icon);

        const meta = document.createElement('span');
        meta.className = 'step-meta';

        const label = document.createElement('span');
        label.className = 'step-lbl ' + state;
        label.textContent = step.label;
        meta.appendChild(label);

        const sub = document.createElement('span');
        sub.className = 'step-sub ' + state;
        sub.textContent = upgradeStepStatusLabel(step.id, state, session);
        meta.appendChild(sub);

        row.appendChild(meta);

        upgradeSteps.appendChild(row);
      });
    }

    function isUpgradeUiCancelable(session) {
      const phase = String(session && session.phase ? session.phase : 'idle');
      return !!(session && (session.awaitingReconnect || phase === 'target' || phase === 'download' || phase === 'flash' || phase === 'reboot' || phase === 'reconnect'));
    }

    function syncUpgradeCancelButton(session) {
      if (!cancelUpgradeUiBtn) return;
      const canCancel = isUpgradeUiCancelable(session);
      cancelUpgradeUiBtn.hidden = !canCancel;
      cancelUpgradeUiBtn.disabled = !canCancel;
    }

    function renderUpgradeJourney(session) {
      const safeSession = session && typeof session === 'object' ? session : { phase: 'idle', target: '' };
      const phase = String(safeSession.phase || 'idle');
      const detail = String(safeSession.detail || '');
      const targetLabel = upgradeTargetLabel(safeSession.target);
      const stateLabel = phase === 'idle'
        ? tr('updates.phase.idle', 'Prêt')
        : phase === 'target'
          ? tr('updates.phase.target', 'Cible sélectionnée')
          : phase === 'download'
            ? tr('updates.phase.download', 'Téléchargement')
            : phase === 'flash'
              ? tr('updates.phase.flash', 'Mise à jour')
              : phase === 'reboot'
                ? tr('updates.phase.reboot', 'Redémarrage')
                : phase === 'reconnect'
                  ? tr('updates.phase.reconnect', 'Attente de Reconnection')
                  : phase === 'done'
                    ? tr('updates.phase.done', 'Mise à jour terminée')
                    : tr('updates.phase.error', 'Erreur');

      if (upgradeJourneyLabel) {
        upgradeJourneyLabel.textContent = safeSession.target
          ? (tr('updates.progress', 'Statut de l’upgrade') + ' · ' + targetLabel)
          : tr('updates.progress', 'Statut de l’upgrade');
      }
      setUpgradeProgress(upgradePhasePercent(safeSession));
      setUpgradeMessage(detail || (phase === 'idle' ? tr('updates.none', 'Aucune opération en cours.') : stateLabel));
      renderUpgradeSteps(safeSession);
      if (upStatusChip) {
        upStatusChip.textContent = stateLabel;
      }
      syncUpgradeCancelButton(safeSession);
    }

    function updateUpgradeUiSession(patch) {
      const current = readUpgradeUiSession() || {
        phase: 'idle',
        target: '',
        detail: tr('updates.none', 'Aucune opération en cours.'),
        backendProgress: 0,
        lastPercent: 0,
        awaitingReconnect: false,
        reconnectShown: false,
        reconnectProgress: 0
      };
      const next = Object.assign({}, current, patch || {});
      next.lastPercent = upgradePhasePercent(next);
      writeUpgradeUiSession(next);
      renderUpgradeJourney(next);
      return next;
    }

    function startUpgradeUiSession(target) {
      stopUpgradeReconnectFlow();
      upgradeUiStatusMuted = false;
      return updateUpgradeUiSession({
        phase: 'target',
        target: target,
        detail: tr('updates.detail.targetSelected', 'Sélection de la cible {target}.')
          .replace('{target}', upgradeTargetLabel(target)),
        backendProgress: 0,
        awaitingReconnect: false,
        reconnectShown: false,
        reconnectProgress: 0,
        failedStep: ''
      });
    }

    function cancelUpgradeUiSession() {
      upgradeUiStatusMuted = true;
      stopUpgradeStatusPolling();
      clearUpgradeUiSession();
      renderUpgradeJourney({
        phase: 'idle',
        target: '',
        detail: tr('updates.none', 'Aucune opération en cours.')
      });
    }

    function stopUpgradeReconnectFlow() {
      upgradeReconnectStageTimer.stop();
      upgradeReconnectCompletionTimer.stop();
      upgradeReconnectMonitor.stop();
    }

    function scheduleUpgradeReconnectPhase(delayMs) {
      upgradeReconnectStageTimer.schedule(Math.max(0, Number(delayMs) || 0));
    }

    function startUpgradeReconnectMonitor() {
      upgradeReconnectMonitor.start();
    }

    function scheduleUpgradeReconnectCompletion(delayMs) {
      upgradeReconnectCompletionTimer.schedule(Math.max(0, Number(delayMs) || 0));
    }

    function markUpgradeUiAwaitingReconnect() {
      const current = readUpgradeUiSession();
      if (!current || !current.awaitingReconnect) return null;
      return updateUpgradeUiSession({
        phase: 'reconnect',
        detail: tr('updates.detail.awaitReconnect', 'Attente de Reconnection.'),
        reconnectShown: true,
        reconnectProgress: Math.max(5, Math.min(95, Number(current.reconnectProgress) || 0))
      });
    }

    function markUpgradeUiCompletedAfterReconnect() {
      const current = readUpgradeUiSession();
      if (!current || !current.awaitingReconnect) return null;
      stopUpgradeReconnectFlow();
      return updateUpgradeUiSession({
        phase: 'done',
        detail: tr('updates.detail.done', 'Mise à jour terminée.'),
        backendProgress: 100,
        awaitingReconnect: false,
        reconnectShown: true,
        reconnectProgress: 100,
        failedStep: ''
      });
    }

    function handleUpgradeReconnectSuccess() {
      const current = readUpgradeUiSession();
      if (!current || !current.awaitingReconnect) return null;
      if (!current.reconnectShown || current.phase === 'reboot') {
        upgradeReconnectStageTimer.stop();
        upgradeReconnectMonitor.stop();
        markUpgradeUiAwaitingReconnect();
        scheduleUpgradeReconnectCompletion(320);
        return readUpgradeUiSession();
      }
      return markUpgradeUiCompletedAfterReconnect();
    }

    function incrementUpgradeReconnectProgress() {
      const current = readUpgradeUiSession();
      if (!current || !current.awaitingReconnect) return null;
      const nextProgress = Math.max(5, Math.min(95, (Number(current.reconnectProgress) || 0) + 12));
      return updateUpgradeUiSession({
        phase: 'reconnect',
        detail: tr('updates.detail.awaitReconnect', 'Attente de Reconnection.'),
        reconnectShown: true,
        reconnectProgress: nextProgress
      });
    }

    function enterUpgradeReconnectPhase() {
      const current = readUpgradeUiSession();
      if (!current || !current.awaitingReconnect) return null;
      markUpgradeUiAwaitingReconnect();
      startUpgradeReconnectMonitor();
      return readUpgradeUiSession();
    }

    async function fetchUpgradeReconnectHeartbeat() {
      const supportsAbort = typeof AbortController === 'function';
      const controller = supportsAbort ? new AbortController() : null;
      const timeoutId = controller
        ? setTimeout(() => {
            try {
              controller.abort();
            } catch (err) {
            }
          }, upgradeReconnectFetchTimeoutMs)
        : null;
      try {
        return await fetchOkJson('/api/web/meta', {
          cache: 'no-store',
          signal: controller ? controller.signal : undefined
        }, 'meta web indisponible');
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    async function probeUpgradeReconnect() {
      const current = readUpgradeUiSession();
      if (!current || !current.awaitingReconnect) {
        stopUpgradeReconnectFlow();
        return;
      }
      try {
        await fetchUpgradeReconnectHeartbeat();
        handleUpgradeReconnectSuccess();
      } catch (err) {
        incrementUpgradeReconnectProgress();
      }
    }

    function resumeUpgradeReconnectFlow() {
      const current = readUpgradeUiSession();
      if (!current || !current.awaitingReconnect) return;
      if (current.reconnectShown || current.phase === 'reconnect') {
        startUpgradeReconnectMonitor();
        return;
      }
      scheduleUpgradeReconnectPhase(700);
    }

    function updateUpgradeView(data) {
      if (!data || data.ok !== true) return;
      const current = readUpgradeUiSession();
      const state = String(data.state || 'idle');
      const target = String(data.target || (current && current.target) || '').trim().toLowerCase();
      const progress = Math.max(0, Math.min(100, Number(data.progress) || 0));
      const msg = String(data.msg || '').trim();

      if (upgradeUiStatusMuted) {
        if (state !== 'idle' && state !== 'done' && state !== 'error') return;
        upgradeUiStatusMuted = false;
      }

      if (state === 'idle') {
        if (current && current.awaitingReconnect) {
          handleUpgradeReconnectSuccess();
        } else if (!current || current.phase === 'idle') {
          clearUpgradeUiSession();
          renderUpgradeJourney({ phase: 'idle', target: '', detail: tr('updates.none', 'Aucune opération en cours.') });
        }
        return;
      }

      if (state === 'queued') {
        stopUpgradeReconnectFlow();
        updateUpgradeUiSession({
          phase: 'target',
          target: target,
          detail: tr('updates.detail.targetSelected', 'Sélection de la cible {target}.')
            .replace('{target}', upgradeTargetLabel(target)),
          backendProgress: progress,
          awaitingReconnect: false,
          reconnectShown: false,
          reconnectProgress: 0,
          failedStep: ''
        });
        return;
      }

      if (state === 'downloading') {
        stopUpgradeReconnectFlow();
        updateUpgradeUiSession({
          phase: 'download',
          target: target,
          detail: 'Connexion au serveur.',
          backendProgress: progress,
          awaitingReconnect: false,
          reconnectShown: false,
          reconnectProgress: 0,
          failedStep: ''
        });
        return;
      }

      if (state === 'flashing') {
        stopUpgradeReconnectFlow();
        updateUpgradeUiSession({
          phase: 'flash',
          target: target,
          detail: 'Mise à jour en cours.',
          backendProgress: progress,
          awaitingReconnect: false,
          reconnectShown: false,
          reconnectProgress: 0,
          failedStep: ''
        });
        return;
      }

      if (state === 'rebooting') {
        stopUpgradeReconnectFlow();
        updateUpgradeUiSession({
          phase: 'reboot',
          target: target,
          detail: 'Redémarrage.',
          backendProgress: 100,
          awaitingReconnect: true,
          reconnectShown: false,
          reconnectProgress: 0,
          failedStep: ''
        });
        scheduleUpgradeReconnectPhase(900);
        return;
      }

      if (state === 'done') {
        if (upgradeUsesReconnect(target)) {
          stopUpgradeReconnectFlow();
          updateUpgradeUiSession({
            phase: 'reboot',
            target: target,
            detail: tr('updates.phase.reboot', 'Redémarrage') + '.',
            backendProgress: 100,
            awaitingReconnect: true,
            reconnectShown: false,
            reconnectProgress: 0,
            failedStep: ''
          });
          scheduleUpgradeReconnectPhase(900);
        } else {
          stopUpgradeReconnectFlow();
          updateUpgradeUiSession({
            phase: 'done',
            target: target,
            detail: tr('updates.detail.done', 'Mise à jour terminée.'),
            backendProgress: 100,
            awaitingReconnect: false,
            reconnectShown: true,
            reconnectProgress: 100,
            failedStep: ''
          });
        }
        return;
      }

      if (state === 'error') {
        stopUpgradeReconnectFlow();
        updateUpgradeUiSession({
          phase: 'error',
          target: target,
          detail: normalizeUpgradeHttpErrorMessage(msg, tr('updates.err.updateGeneric', 'Erreur de mise à jour.')),
          backendProgress: progress,
          awaitingReconnect: false,
          reconnectShown: false,
          reconnectProgress: 0,
          failedStep: current && current.phase && current.phase !== 'idle' ? current.phase : 'flash'
        });
      }
    }

    function normalizeFirmwareVersionForCompare(value) {
      return String(value || '').trim().split('+')[0].replace(/^v/i, '');
    }

    function compareFirmwareVersions(a, b) {
      const left = normalizeFirmwareVersionForCompare(a).split(/[.-]/).map((part) => Number.parseInt(part, 10));
      const right = normalizeFirmwareVersionForCompare(b).split(/[.-]/).map((part) => Number.parseInt(part, 10));
      const len = Math.max(left.length, right.length);
      for (let i = 0; i < len; ++i) {
        const av = Number.isFinite(left[i]) ? left[i] : 0;
        const bv = Number.isFinite(right[i]) ? right[i] : 0;
        if (av > bv) return 1;
        if (av < bv) return -1;
      }
      return 0;
    }

    function manifestArtifactList(manifest, key) {
      if (!manifest || typeof manifest !== 'object') return [];
      const artifacts = (manifest.artifacts && typeof manifest.artifacts === 'object') ? manifest.artifacts : manifest;
      const artifact = artifacts[key];
      if (Array.isArray(artifact)) {
        return artifact.filter((entry) => entry && typeof entry === 'object');
      }
      if (artifact && typeof artifact === 'object' && Array.isArray(artifact.versions)) {
        return artifact.versions
          .filter((entry) => entry && typeof entry === 'object')
          .map((entry) => Object.assign({}, artifact, entry, { versions: undefined }));
      }
      if (artifact && typeof artifact === 'object' && (artifact.version || artifact.path || artifact.url)) {
        return [artifact];
      }
      if (artifact && typeof artifact === 'object') {
        return Object.keys(artifact)
          .map((version) => {
            const entry = artifact[version];
            return entry && typeof entry === 'object' ? Object.assign({ version: version }, entry) : null;
          })
          .filter(Boolean);
      }
      return [];
    }

    function manifestBaseUrl(manifestUrl) {
      const url = String(manifestUrl || '').trim();
      const idx = url.lastIndexOf('/');
      return idx >= 0 ? url.slice(0, idx + 1) : '';
    }

    function joinManifestArtifactUrl(baseUrl, artifact) {
      if (!artifact || typeof artifact !== 'object') return '';
      const raw = String(artifact.url || artifact.path || '').trim();
      if (!raw) return '';
      if (/^https?:\/\//i.test(raw)) return raw;
      return String(baseUrl || '') + raw.replace(/^\/+/, '');
    }

    function formatManifestBuildDate(artifact) {
      if (!artifact || typeof artifact !== 'object') return '';
      return String(artifact.build_date || artifact.built_at || artifact.date || '').trim();
    }

    function endpointForUpgradeTarget(target) {
      const key = String(target || '').trim().toLowerCase();
      if (key === 'flowios3' || key === 'esp32s3') return '/fwupdate/waveshare';
      if (key === 'waveshare') return '/fwupdate/waveshare';
      if (key === 'spiffs') return '/fwupdate/spiffs';
      if (key === 'nextion') return '/fwupdate/nextion';
      return '';
    }

    function manifestTargetDef(key) {
      return upgradeTargetDefs[String(key || '').trim().toLowerCase()] || null;
    }

    function manifestCategoryVisibleForProfile(category) {
      const key = String(category || '').trim().toLowerCase();
      if (!key) return false;
      if (isMicronovaProfile() || isSupervisorProfile()) {
        return key === 'flowios3' || key === 'esp32s3' || key === 'waveshare'
          || key === 'spiffs' || key === 'flowios3-spiffs' || key === 'esp32s3-spiffs' || key === 'waveshare-spiffs'
          || key === 'nextion';
      }
      if (isWaveshareProfile()) {
        return key === 'flowios3' || key === 'esp32s3' || key === 'waveshare'
          || key === 'spiffs' || key === 'flowios3-spiffs' || key === 'esp32s3-spiffs' || key === 'waveshare-spiffs'
          || key === 'nextion';
      }
      if (isFlowIOProfile()) {
        return key === 'flowio';
      }
      return true;
    }

    function resolveArtifactTarget(category, artifact) {
      const explicit = String(artifact && (artifact.target || artifact.update_target) ? (artifact.target || artifact.update_target) : '').trim().toLowerCase();
      if (explicit) return explicit;
      const def = manifestTargetDef(category);
      return def && def.target ? def.target : String(category || '').trim().toLowerCase();
    }

    function resolveArtifactEndpoint(category, artifact, target) {
      const categoryKey = String(category || '').trim().toLowerCase();
      if (categoryKey === 'flowios3' || categoryKey === 'esp32s3' || categoryKey === 'waveshare') {
        return '/fwupdate/waveshare';
      }
      const explicit = String(artifact && (artifact.route || artifact.endpoint || artifact.update_route) ? (artifact.route || artifact.endpoint || artifact.update_route) : '').trim();
      if (explicit) {
        if (/^\/fwupdate\//.test(explicit)) return explicit;
        if (/^fwupdate\//.test(explicit)) return '/' + explicit;
        return endpointForUpgradeTarget(explicit);
      }
      const def = manifestTargetDef(category);
      return def && def.endpoint ? def.endpoint : endpointForUpgradeTarget(target);
    }

    function formatManifestArtifactTitle(category, artifact) {
      const def = manifestTargetDef(category);
      const title = String(artifact && (artifact.title || artifact.name) ? (artifact.title || artifact.name) : '').trim();
      if (title) return title;
      const label = String(artifact && artifact.label ? artifact.label : '').trim();
      if (label) return label;
      return def && def.label ? def.label : String(category || 'Firmware');
    }

    function manifestArtifactEntries(manifest, manifestUrl) {
      if (!manifest || typeof manifest !== 'object') return [];
      const baseUrl = manifestBaseUrl(manifestUrl);
      const artifacts = (manifest.artifacts && typeof manifest.artifacts === 'object') ? manifest.artifacts : manifest;
      return Object.keys(artifacts)
        .reduce((entries, category) => {
          if (!manifestCategoryVisibleForProfile(category)) return entries;
          const def = manifestTargetDef(category);
          const orderBase = def && Number.isFinite(def.order) ? def.order : 1000;
          manifestArtifactList(manifest, category)
            .filter((artifact) => joinManifestArtifactUrl(baseUrl, artifact))
            .sort((a, b) => compareFirmwareVersions(String(b.version || ''), String(a.version || '')))
            .forEach((artifact, index) => {
              const target = resolveArtifactTarget(category, artifact);
              entries.push({
                category: category,
                artifact: artifact,
                title: formatManifestArtifactTitle(category, artifact),
                version: String(artifact.version || '').trim() || 'version inconnue',
                buildDate: formatManifestBuildDate(artifact) || '-',
                notes: String(artifact.notes || artifact.release_notes || '').trim() || 'Notes de version indisponibles.',
                url: joinManifestArtifactUrl(baseUrl, artifact),
                target: target,
                endpoint: resolveArtifactEndpoint(category, artifact, target),
                order: orderBase + index / 100
              });
            });
          return entries;
        }, [])
        .sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          return compareFirmwareVersions(String(b.version || ''), String(a.version || ''));
        });
    }

    function setUpgradeCardsEmpty(text) {
      renderUpgradeCatalog();
      if (text) setUpgradeMessage(text);
    }

    function setUpgradeCardsError(detail) {
      renderUpgradeCatalog({ error: detail || tr('updates.err.checkGeneric', 'Échec de la vérification.') });
    }

    function splitUpgradeVersionStamp(rawVersion, fallbackBuildDate) {
      const raw = String(rawVersion || '').trim();
      const plusIndex = raw.indexOf('+');
      const main = (plusIndex >= 0 ? raw.slice(0, plusIndex) : raw).trim();
      const plusBuild = plusIndex >= 0 ? raw.slice(plusIndex + 1).trim() : '';
      return {
        version: main || '-',
        build: formatUpgradeBuildStamp(plusBuild || fallbackBuildDate || '')
      };
    }

    function formatUpgradeBuildStamp(rawValue) {
      const raw = String(rawValue || '').trim();
      if (!raw || raw === '-') return '-';
      const compact = raw.match(/^(\d{4})(\d{2})(\d{2})[._-]?(\d{2})(\d{2})(\d{2})$/);
      if (compact) {
        return compact[3] + '/' + compact[2] + '/' + compact[1] + ' ' + compact[4] + ':' + compact[5] + ':' + compact[6];
      }
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) {
        const d = new Date(parsed);
        return d.toLocaleDateString(currentWebLocaleTag()) + ' ' + d.toLocaleTimeString(currentWebLocaleTag(), {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
      return raw;
    }

    function upgradeBuildStampValue(rawValue) {
      const raw = String(rawValue || '').trim();
      if (!raw || raw === '-') return 0;
      const compact = raw.match(/^(\d{4})(\d{2})(\d{2})[._-]?(\d{2})(\d{2})(\d{2})$/);
      if (compact) {
        return Number(compact[1] + compact[2] + compact[3] + compact[4] + compact[5] + compact[6]);
      }
      const parsed = Date.parse(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function compareUpgradeArtifacts(a, b) {
      const versionCompare = compareFirmwareVersions(String(a && a.version ? a.version : ''), String(b && b.version ? b.version : ''));
      if (versionCompare !== 0) return versionCompare;
      const aStamp = splitUpgradeVersionStamp(a && a.version, formatManifestBuildDate(a)).build;
      const bStamp = splitUpgradeVersionStamp(b && b.version, formatManifestBuildDate(b)).build;
      const dateCompare = upgradeBuildStampValue(aStamp) - upgradeBuildStampValue(bStamp);
      if (dateCompare > 0) return 1;
      if (dateCompare < 0) return -1;
      return 0;
    }

    function upgradeManifestKeysForComponent(componentKey) {
      const key = String(componentKey || '').trim().toLowerCase();
      if (key === 'flowio') {
        return ['flowios3', 'waveshare', 'esp32s3'];
      }
      if (key === 'spiffs') {
        return ['spiffs', 'flowios3-spiffs', 'esp32s3-spiffs', 'waveshare-spiffs'];
      }
      return [key];
    }

    function latestUpgradeEntryForComponent(componentKey, manifest, manifestUrl) {
      if (!manifest || typeof manifest !== 'object') return null;
      const baseUrl = manifestBaseUrl(manifestUrl);
      const entries = [];
      upgradeManifestKeysForComponent(componentKey).forEach((category) => {
        manifestArtifactList(manifest, category)
          .filter((artifact) => joinManifestArtifactUrl(baseUrl, artifact))
          .forEach((artifact) => {
            const target = resolveArtifactTarget(category, artifact);
            const split = splitUpgradeVersionStamp(artifact.version, formatManifestBuildDate(artifact));
            entries.push({
              category: category,
              artifact: artifact,
              title: formatManifestArtifactTitle(category, artifact),
              version: split.version,
              buildDate: split.build,
              notes: String(artifact.notes || artifact.release_notes || '').trim(),
              url: joinManifestArtifactUrl(baseUrl, artifact),
              target: target,
              endpoint: resolveArtifactEndpoint(category, artifact, target)
            });
          });
      });
      if (!entries.length) return null;
      entries.sort((a, b) => compareUpgradeArtifacts(b.artifact, a.artifact));
      return entries[0];
    }

    function formatDetectedNextionVersion(rawValue) {
      const raw = String(rawValue || '').trim();
      if (!raw || raw === '0') return '-';
      if (raw.indexOf('.') >= 0) return raw;
      const n = Number.parseInt(raw, 10);
      if (!Number.isFinite(n) || n <= 0) return raw;
      if (n >= 100) {
        return Math.floor(n / 100) + '.' + (Math.floor(n / 10) % 10) + '.' + (n % 10);
      }
      return raw;
    }

    function currentUpgradeVersionForComponent(componentKey) {
      const key = String(componentKey || '').trim().toLowerCase();
      if (key === 'nextion') {
        return splitUpgradeVersionStamp(formatDetectedNextionVersion(deps.getNextionDisplayVersion()), '');
      }
      const supervisor = String(deps.getSupervisorFirmwareVersion() || '').trim();
      const flow = String(window.__flowIoFirmwareVersion || '').trim();
      const firmware = supervisor && supervisor !== '-' ? supervisor : flow;
      return splitUpgradeVersionStamp(firmware && firmware !== '-' ? firmware : '-', '');
    }

    function buildUpgradeComponentRows() {
      const manifest = upgradeManifestState && upgradeManifestState.manifest;
      const manifestUrl = upgradeManifestState && upgradeManifestState.manifestUrl;
      return upgradeComponentDefs.map((def) => {
        const current = currentUpgradeVersionForComponent(def.key);
        const latest = latestUpgradeEntryForComponent(def.key, manifest, manifestUrl);
        const available = latest
          ? { version: latest.version, build: latest.buildDate }
          : { version: '-', build: '-' };
        const comparableCurrent = current.version && current.version !== '-';
        const comparableAvailable = available.version && available.version !== '-';
        const updateAvailable = comparableAvailable && (!comparableCurrent || compareFirmwareVersions(available.version, current.version) > 0);
        return Object.assign({}, def, {
          current: current,
          available: available,
          updateAvailable: updateAvailable,
          entry: latest,
          comments: latest && latest.notes
            ? latest.notes
            : (updateAvailable ? def.commentsAvailable : def.commentsCurrent)
        });
      });
    }

    function appendUpgradeVersionCell(parent, versionInfo) {
      const wrap = document.createElement('div');
      wrap.className = 'update-version-stack';
      const version = document.createElement('strong');
      version.textContent = (versionInfo && versionInfo.version) || '-';
      const build = document.createElement('span');
      build.textContent = (versionInfo && versionInfo.build) || '-';
      wrap.appendChild(version);
      wrap.appendChild(build);
      parent.appendChild(wrap);
    }

    function createUpgradeComponentBadge(row, sizeClass) {
      const badge = document.createElement('span');
      badge.className = 'update-component-badge update-component-' + row.tone + (sizeClass ? ' ' + sizeClass : '');
      const icon = document.createElement('span');
      icon.className = 'ui-msr';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = row.icon;
      badge.appendChild(icon);
      return badge;
    }

    function createUpgradeStatusBadge(updateAvailable) {
      const badge = document.createElement('span');
      badge.className = 'update-status-badge ' + (updateAvailable ? 'is-available' : 'is-current');
      badge.textContent = updateAvailable
        ? tr('updates.status.available', 'Mise à jour disponible')
        : tr('updates.status.current', 'À jour');
      return badge;
    }

    function createUpgradeActionButton(row) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'update-action-btn';
      const icon = document.createElement('span');
      icon.className = 'ui-msr';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'system_update_alt';
      const label = document.createElement('span');
      label.textContent = tr('updates.updateButton', 'Mettre à jour');
      button.appendChild(icon);
      button.appendChild(label);
      const entry = row && row.entry;
      button.disabled = !(entry && entry.endpoint && entry.url);
      button.title = button.disabled
        ? tr('updates.checkRequired', 'Vérifiez les mises à jour avant de lancer cette action.')
        : tr('updates.updateButton', 'Mettre à jour');
      bindClickAction(button, () => {
        if (!entry) return;
        if (!confirmUpgradeLaunch(entry)) return;
        return startUpgrade(entry.target, entry.url, entry.endpoint);
      });
      return button;
    }

    function renderUpgradeSummaryCards(rows) {
      if (!upgradeCards) return;
      upgradeCards.innerHTML = '';
      upgradeCards.classList.remove('has-error');
      rows.forEach((row) => {
        const card = document.createElement('article');
        card.className = 'update-summary-card update-summary-' + row.tone;
        card.appendChild(createUpgradeComponentBadge(row, 'update-component-badge-lg'));

        const body = document.createElement('div');
        body.className = 'update-summary-body';
        const title = document.createElement('h3');
        title.textContent = row.title + ' ';
        const subtitle = document.createElement('span');
        subtitle.textContent = '(' + row.subtitle + ')';
        title.appendChild(subtitle);
        body.appendChild(title);

        const currentLine = document.createElement('div');
        currentLine.className = 'update-summary-line';
        currentLine.appendChild(document.createTextNode(tr('updates.currentVersion', 'Version actuelle')));
        const currentPill = document.createElement('b');
        currentPill.textContent = row.current.version || '-';
        currentLine.appendChild(currentPill);
        body.appendChild(currentLine);

        const availableLine = document.createElement('div');
        availableLine.className = 'update-summary-line';
        availableLine.appendChild(document.createTextNode(tr('updates.availableVersion', 'Version disponible')));
        const availablePill = document.createElement('b');
        availablePill.className = row.updateAvailable ? 'is-green' : '';
        availablePill.textContent = row.available.version || '-';
        availableLine.appendChild(availablePill);
        body.appendChild(availableLine);
        card.appendChild(body);

        const stateIcon = document.createElement('span');
        stateIcon.className = 'ui-msr update-summary-state';
        stateIcon.setAttribute('aria-hidden', 'true');
        stateIcon.textContent = row.updateAvailable ? 'arrow_upward' : 'horizontal_rule';
        card.appendChild(stateIcon);

        const foot = document.createElement('div');
        foot.className = 'update-summary-foot';
        const dot = document.createElement('span');
        dot.className = 'update-dot ' + (row.updateAvailable ? 'is-green' : 'is-blue');
        foot.appendChild(dot);
        foot.appendChild(document.createTextNode(row.updateAvailable
          ? tr('updates.status.available', 'Mise à jour disponible')
          : tr('updates.status.current', 'À jour')));
        card.appendChild(foot);

        upgradeCards.appendChild(card);
      });
    }

    function renderUpgradeTable(rows) {
      if (!upgradeTableBody) return;
      upgradeTableBody.innerHTML = '';
      rows.forEach((row) => {
        const trEl = document.createElement('tr');

        const componentCell = document.createElement('td');
        const component = document.createElement('div');
        component.className = 'update-component-cell';
        component.appendChild(createUpgradeComponentBadge(row, ''));
        const copy = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = row.title;
        const sub = document.createElement('span');
        sub.textContent = '(' + row.subtitle + ')';
        copy.appendChild(title);
        copy.appendChild(sub);
        component.appendChild(copy);
        componentCell.appendChild(component);
        trEl.appendChild(componentCell);

        const currentCell = document.createElement('td');
        appendUpgradeVersionCell(currentCell, row.current);
        trEl.appendChild(currentCell);

        const availableCell = document.createElement('td');
        appendUpgradeVersionCell(availableCell, row.available);
        trEl.appendChild(availableCell);

        const statusCell = document.createElement('td');
        statusCell.appendChild(createUpgradeStatusBadge(row.updateAvailable));
        trEl.appendChild(statusCell);

        const commentsCell = document.createElement('td');
        commentsCell.textContent = row.comments || '-';
        trEl.appendChild(commentsCell);

        const actionCell = document.createElement('td');
        actionCell.appendChild(createUpgradeActionButton(row));
        trEl.appendChild(actionCell);

        upgradeTableBody.appendChild(trEl);
      });
    }

    function renderUpgradeCatalog(options) {
      const rows = buildUpgradeComponentRows();
      renderUpgradeSummaryCards(rows);
      renderUpgradeTable(rows);
      if (options && options.error) {
        setUpgradeMessage(tr('updates.err.checkGeneric', 'Échec de la vérification.') + ' : ' + options.error);
      }
    }

    function resetUpgradeManifestSelections(text) {
      upgradeManifestState = { manifest: null, manifestUrl: '', baseUrl: '' };
      setUpgradeCardsEmpty(text || tr('updates.empty', 'Cliquez sur « Vérifier les mises à jour ».'));
    }

    function confirmUpgradeLaunch(entry) {
      const version = String(entry && entry.version ? entry.version : 'x.x.x').trim() || 'x.x.x';
      const target = upgradeTargetLabel(entry && entry.target ? entry.target : '');
      return confirm(
        tr('updates.confirmLaunch', 'Confirmer la mise à jour de {target} vers la version {version} ?')
          .replace('{target}', target)
          .replace('{version}', version)
      );
    }

    function confirmRebootLaunch(selectedAction) {
      const action = String(selectedAction || 'supervisor');
      const messages = {
        supervisor: isMicronovaProfile()
          ? tr('updates.confirmRebootMicronova', 'Confirmer le redémarrage de Micronova ?')
          : tr('updates.confirmRebootSupervisor', 'Confirmer le redémarrage du Supervisor ?'),
        flow_soft: tr('updates.confirmRebootFlowSoft', 'Confirmer le redémarrage logiciel de flow.io ?'),
        flow_hard: tr('updates.confirmRebootFlowHard', 'Confirmer le redémarrage matériel de flow.io ?'),
        nextion: tr('updates.confirmRebootNextion', 'Confirmer le redémarrage de Nextion ?'),
        factory_reset: tr('updates.confirmFactoryReset', 'Confirmer l\'initialisation usine de flow.io ? Cette action efface la configuration distante.')
      };
      return confirm(messages[action] || messages.supervisor);
    }

    function populateUpgradeManifestSelections(data) {
      const manifest = data && data.manifest && typeof data.manifest === 'object' ? data.manifest : null;
      const manifestUrl = String(data && data.manifest_url ? data.manifest_url : '').trim();
      upgradeManifestState = { manifest: manifest, manifestUrl: manifestUrl, baseUrl: manifestBaseUrl(manifestUrl) };
      renderUpgradeCatalog();
    }

    function describeManifestUpdates(data) {
      const manifest = data && data.manifest && typeof data.manifest === 'object' ? data.manifest : null;
      if (!manifest) return 'Manifest indisponible.';
      const rows = buildUpgradeComponentRows();
      const available = rows
        .filter((row) => row.updateAvailable)
        .map((row) => row.title + ' ' + row.current.version + ' -> ' + row.available.version);
      const listed = rows
        .filter((row) => row.available.version && row.available.version !== '-')
        .map((row) => row.title + ' ' + row.available.version);
      if (available.length > 0) {
        return 'Mise(s) à jour disponible(s) : ' + available.join(', ') + '.';
      }
      if (listed.length > 0) {
        return 'Manifest vérifié. Versions disponibles : ' + listed.join(', ') + '.';
      }
      return 'Manifest vérifié, aucun firmware listé.';
    }

    async function checkFirmwareUpdates() {
      if (checkUpdatesBtn) {
        checkUpdatesBtn.disabled = true;
        checkUpdatesBtn.classList.add('is-pending');
      }
      try {
        setUpgradeCardsEmpty(tr('updates.checking', 'Vérification du manifest...'));
        setUpgradeMessage(tr('updates.checking', 'Vérification du manifest...'));
        const data = await fetchOkJson('/api/fwupdate/check', { cache: 'no-store' }, 'échec vérification');
        populateUpgradeManifestSelections(data);
        setUpgradeMessage(describeManifestUpdates(data));
      } catch (err) {
        const errMsg = normalizeUpgradeHttpErrorMessage(String(err || ''), tr('updates.err.checkGeneric', 'Échec de la vérification.'));
        setUpgradeCardsError(errMsg);
        setUpgradeMessage(tr('updates.err.checkGeneric', 'Échec de la vérification.') + ' : ' + errMsg);
      } finally {
        if (checkUpdatesBtn) {
          checkUpdatesBtn.disabled = false;
          checkUpdatesBtn.classList.remove('is-pending');
        }
      }
    }

    async function refreshUpgradeStatus() {
      try {
        updateUpgradeView(await fetchOkJson('/api/fwupdate/status', { cache: 'no-store' }, 'échec lecture état'));
      } catch (err) {
        const current = readUpgradeUiSession();
        if (current && (current.awaitingReconnect || current.phase === 'reboot')) {
          enterUpgradeReconnectPhase();
          return;
        }
        setUpgradeMessage('Échec de lecture de l\'état : ' + err);
      }
    }

    async function startUpgrade(target, url, endpoint) {
      try {
        startUpgradeUiSession(target);
        startUpgradeStatusPolling(true);
        const selectedUrl = String(url || '').trim();
        if (!selectedUrl) {
          throw new Error('aucune image sélectionnée, lancez Vérifier');
        }
        const route = String(endpoint || endpointForUpgradeTarget(target)).trim();
        if (!route) {
          throw new Error('route de mise à jour indisponible');
        }
        await fetchOkJson(route, createFormPostOptions({ url: selectedUrl }), 'échec démarrage');
        await refreshUpgradeStatus();
      } catch (err) {
        stopUpgradeReconnectFlow();
        updateUpgradeUiSession({
          phase: 'error',
          target: target,
          detail: 'Échec de la mise à jour : ' + err,
          backendProgress: 0,
          awaitingReconnect: false,
          reconnectShown: false,
          reconnectProgress: 0,
          failedStep: 'target'
        });
        setUpgradeMessage('Échec de la mise à jour : ' + err);
      }
    }



    async function onUpgradePageShown() {
      renderUpgradeJourney(readUpgradeUiSession() || { phase: 'idle', target: '', detail: tr('updates.none', 'Aucune opération en cours.') });
      renderUpgradeCatalog();
      resumeUpgradeReconnectFlow();
      await loadWebMeta().catch(() => {});
      renderUpgradeCatalog();
      await refreshUpgradeStatus();
      if (!upgradeManifestState.manifest) {
        await checkFirmwareUpdates();
      }
      startUpgradeStatusPolling();
    }



      upgradeStatusPoller = deps.createTimeoutRunner(() => pollUpgradeStatusTick());
      upgradeReconnectStageTimer = deps.createTimeoutRunner(() => enterUpgradeReconnectPhase());
      upgradeReconnectCompletionTimer = deps.createTimeoutRunner(() => markUpgradeUiCompletedAfterReconnect());
      upgradeReconnectMonitor = deps.createIntervalRunner(() => probeUpgradeReconnect(), 1500);
      bindClickAction(checkUpdatesBtn, () => checkFirmwareUpdates());
      bindClickAction(cancelUpgradeUiBtn, () => cancelUpgradeUiSession());

      return {
        show: onUpgradePageShown,
        hide: stopUpgradeStatusPolling,
        renderInitial: function renderInitial() {
          renderUpgradeJourney(readUpgradeUiSession() || { phase: 'idle', target: '', detail: tr('updates.none', 'Aucune opération en cours.') });
          renderUpgradeCatalog();
          resumeUpgradeReconnectFlow();
        }
      };
    }
  };
})();
