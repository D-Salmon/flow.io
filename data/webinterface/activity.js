(function () {
  'use strict';

  window.FlowWebPages = window.FlowWebPages || {};
  window.FlowWebPages.activity = {
    create: function createActivityPage(deps) {
      const tr = deps.tr;
      const currentWebLocaleTag = deps.currentWebLocaleTag;
      const fetchWithBusyRetry = deps.fetchWithBusyRetry;
      const listEl = document.getElementById('activityLogList');
      const statusEl = document.getElementById('activityLogStatus');
      const refreshBtn = document.getElementById('activityRefreshBtn');
      const purgeBtn = document.getElementById('activityPurgeBtn');
      const prevBtn = document.getElementById('activityPrevBtn');
      const nextBtn = document.getElementById('activityNextBtn');
      const rangeEl = document.getElementById('activityRangeText');
      const summaryTotal = document.getElementById('activitySummaryTotal');
      const summaryAlerts = document.getElementById('activitySummaryAlerts');
      const summaryManual = document.getElementById('activitySummaryManual');
      const summaryEquipment = document.getElementById('activitySummaryEquipment');
      const filterBtns = Array.from(document.querySelectorAll('[data-activity-filter]'));
      let filter = 'all';
      let windowShiftHours = 0;
      let eventsCache = [];
      let statsCache = null;
      let activeJob = null;

      function hide() {
        if (activeJob) activeJob.controller.abort();
        activeJob = null;
        if (refreshBtn) refreshBtn.disabled = false;
      }

      function eventDate(event) {
        const epoch = Number(event && event.epoch_s) || 0;
        return epoch > 0 ? new Date(epoch * 1000) : null;
      }

      function formatTime(date) {
        return date
          ? date.toLocaleTimeString(currentWebLocaleTag(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '--:--:--';
      }

      function formatDay(date) {
        return date
          ? date.toLocaleDateString(currentWebLocaleTag(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : tr('activity.date.unknown', 'Date inconnue');
      }

      function formatRelative(date) {
        if (!date) return tr('activity.time.unsynced', 'heure non synchronisée');
        const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
        if (seconds < 60) {
          return seconds <= 3
            ? tr('activity.time.now', 'Maintenant')
            : tr('activity.time.secondsAgo', 'Il y a') + ' ' + seconds + ' s';
        }
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return tr('activity.time.ago', 'Il y a') + ' ' + minutes + ' min';
        const hours = Math.round(minutes / 60);
        if (hours < 24) return tr('activity.time.ago', 'Il y a') + ' ' + hours + ' h';
        return tr('activity.time.ago', 'Il y a') + ' ' + Math.round(hours / 24) + ' j';
      }

      function isInWindow(event) {
        const date = eventDate(event);
        if (!date) return windowShiftHours === 0;
        const end = Date.now() - (windowShiftHours * 3 * 3600000);
        const timestamp = date.getTime();
        return timestamp >= end - (3 * 3600000) && timestamp <= end;
      }

      function isAlert(event) {
        const severity = String(event && event.severity_name || '').toLowerCase();
        return String(event && event.domain_name || '').toLowerCase() === 'alarm'
          || String(event && event.source_name || '').toLowerCase() === 'safety'
          || severity === 'warning'
          || severity === 'alarm';
      }

      function isEquipment(event) {
        const role = String(event && event.role_name || '').toLowerCase();
        return (role !== '' && role !== 'none' && role !== 'unknown')
          || String(event && event.domain_name || '').toLowerCase() === 'pooldevice';
      }

      function matchesFilter(event) {
        if (filter === 'all') return true;
        if (filter === 'equipment') return isEquipment(event);
        if (filter === 'automatic') {
          const source = String(event && event.source_name || '').toLowerCase();
          return source === 'auto' || source === 'scheduler' || source === 'pid';
        }
        if (filter === 'manual') return event.source_name === 'manual';
        if (filter === 'alerts') return isAlert(event);
        if (filter === 'system') return event.domain_name === 'system';
        return true;
      }

      function severityMeta(event) {
        const code = Number(event && event.code) || 0;
        if (code === 10) return { key: 'alarm', label: tr('activity.state.raised', 'Alarme déclenchée'), icon: 'notification_important' };
        if (code === 11) return { key: 'warning', label: tr('activity.state.acknowledge', 'À acquitter'), icon: 'notification_paused' };
        if (code === 12) return { key: 'resolved', label: tr('activity.state.resolved', 'Retour à la normale'), icon: 'task_alt' };
        const severity = String(event && event.severity_name || 'info').toLowerCase();
        if (severity === 'alarm') return { key: 'alarm', label: tr('activity.severity.alarm', 'Alarme'), icon: 'error' };
        if (severity === 'warning') return { key: 'warning', label: tr('activity.severity.warning', 'Attention'), icon: 'warning' };
        if (severity === 'success') return { key: 'success', label: tr('activity.severity.success', 'Réussi'), icon: 'check_circle' };
        return { key: 'info', label: tr('activity.severity.info', 'Information'), icon: 'info' };
      }

      function categoryLabel(event) {
        const domain = String(event && event.domain_name || '').toLowerCase();
        if (domain === 'alarm') return tr('activity.category.alert', 'Alerte');
        if (isEquipment(event)) return tr('activity.category.equipment', 'Équipement');
        if (domain === 'poollogic') return tr('activity.category.automation', 'Automatisme');
        return tr('activity.category.system', 'Système');
      }

      function sourceLabel(source) {
        const labels = {
          auto: tr('activity.source.auto', 'Automatique'),
          manual: tr('activity.source.manual', 'Manuel'),
          scheduler: tr('activity.source.scheduler', 'Programmation'),
          safety: tr('activity.source.safety', 'Sécurité'),
          pid: tr('activity.source.pid', 'Régulation'),
          boot: tr('activity.source.boot', 'Démarrage'),
          system: tr('activity.source.system', 'Système')
        };
        return labels[String(source || '').toLowerCase()] || '';
      }

      function roleLabel(role) {
        const labels = {
          filtration: tr('activity.role.filtration', 'Filtration'),
          swg: tr('activity.role.swg', 'Électrolyseur'),
          robot: tr('activity.role.robot', 'Robot'),
          filling: tr('activity.role.filling', 'Remplissage'),
          ph: tr('activity.role.ph', 'Pompe pH'),
          disinfection: tr('activity.role.disinfection', 'Désinfection'),
          heater: tr('activity.role.heater', 'Chauffage')
        };
        return labels[String(role || '').toLowerCase()] || '';
      }

      function stateLabel(state) {
        const labels = {
          requested_on: tr('activity.device.requestedOn', 'Mise en marche demandée'),
          requested_off: tr('activity.device.requestedOff', 'Arrêt demandé'),
          on: tr('activity.device.on', 'En marche'),
          off: tr('activity.device.off', 'Arrêté')
        };
        return labels[String(state || '').toLowerCase()] || '';
      }

      function updateRange() {
        if (!rangeEl) return;
        const end = new Date(Date.now() - (windowShiftHours * 3 * 3600000));
        const start = new Date(end.getTime() - (3 * 3600000));
        rangeEl.textContent = start.toLocaleDateString(currentWebLocaleTag(), { day: 'numeric', month: 'short' }) + ' · '
          + start.toLocaleTimeString(currentWebLocaleTag(), { hour: '2-digit', minute: '2-digit' }) + ' — '
          + end.toLocaleDateString(currentWebLocaleTag(), { day: 'numeric', month: 'short' }) + ' · '
          + end.toLocaleTimeString(currentWebLocaleTag(), { hour: '2-digit', minute: '2-digit' });
        if (nextBtn) nextBtn.disabled = windowShiftHours === 0;
      }

      function updateSummary(events) {
        const items = Array.isArray(events) ? events : [];
        if (summaryTotal) summaryTotal.textContent = String(items.length);
        if (summaryAlerts) summaryAlerts.textContent = String(items.filter(isAlert).length);
        if (summaryManual) summaryManual.textContent = String(items.filter((event) => event.source_name === 'manual').length);
        if (summaryEquipment) summaryEquipment.textContent = String(items.filter(isEquipment).length);
      }

      function makeBadge(text, className) {
        const badge = document.createElement('span');
        badge.className = 'activity-badge ' + String(className || '');
        badge.textContent = text;
        return badge;
      }

      function appendEventRow(rows, event) {
        const date = eventDate(event);
        const severity = severityMeta(event);
        const row = document.createElement('article');
        row.className = 'activity-row activity-severity-' + severity.key;
        const iconWrap = document.createElement('span');
        iconWrap.className = 'activity-row-icon-wrap';
        const icon = document.createElement('span');
        icon.className = 'ui-msr activity-row-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = String(event.icon || severity.icon || 'history');
        iconWrap.appendChild(icon);

        const main = document.createElement('div');
        main.className = 'activity-row-main';
        const head = document.createElement('div');
        head.className = 'activity-row-head';
        const title = document.createElement('strong');
        title.className = 'activity-row-title';
        title.textContent = String(event.title || tr('activity.event.default', 'Activité'));
        const badges = document.createElement('span');
        badges.className = 'activity-row-badges';
        badges.appendChild(makeBadge(categoryLabel(event), 'is-category'));
        badges.appendChild(makeBadge(severity.label, 'is-' + severity.key));
        head.appendChild(title);
        head.appendChild(badges);
        main.appendChild(head);

        if (event.detail) {
          const detail = document.createElement('div');
          detail.className = 'activity-row-detail';
          detail.textContent = String(event.detail);
          main.appendChild(detail);
        }

        const footer = document.createElement('div');
        footer.className = 'activity-row-footer';
        const meta = document.createElement('span');
        meta.className = 'activity-row-meta';
        meta.innerHTML = '<span class="ui-msr" aria-hidden="true">schedule</span>';
        meta.appendChild(document.createTextNode(formatTime(date) + ' · ' + formatRelative(date)));
        footer.appendChild(meta);
        const context = document.createElement('span');
        context.className = 'activity-row-context';
        [sourceLabel(event.source_name), roleLabel(event.role_name), stateLabel(event.state_name)]
          .filter(Boolean)
          .forEach((label) => context.appendChild(makeBadge(label, 'is-context')));
        if (context.childNodes.length) footer.appendChild(context);
        main.appendChild(footer);
        row.appendChild(iconWrap);
        row.appendChild(main);
        rows.appendChild(row);
      }

      function render(events, stats) {
        if (!listEl) return;
        listEl.innerHTML = '';
        updateRange();
        const periodEvents = (Array.isArray(events) ? events : []).filter(isInWindow);
        updateSummary(periodEvents);
        const filtered = periodEvents.filter(matchesFilter).sort((left, right) => {
          const leftEpoch = Number(left.epoch_s) || 0;
          const rightEpoch = Number(right.epoch_s) || 0;
          return leftEpoch !== rightEpoch
            ? rightEpoch - leftEpoch
            : (Number(right.seq) || 0) - (Number(left.seq) || 0);
        });

        if (!filtered.length) {
          const empty = document.createElement('div');
          empty.className = 'activity-empty';
          empty.innerHTML = '<span class="ui-msr" aria-hidden="true">event_busy</span><strong></strong><small></small>';
          empty.querySelector('strong').textContent = tr('activity.empty.title', 'Aucune activité sur cette période');
          empty.querySelector('small').textContent = tr('activity.empty.detail', 'Essayez un autre filtre ou consultez la période précédente.');
          listEl.appendChild(empty);
        } else {
          const groups = [];
          filtered.forEach((event) => {
            const day = formatDay(eventDate(event));
            let group = groups[groups.length - 1];
            if (!group || group.day !== day) {
              group = { day: day, events: [] };
              groups.push(group);
            }
            group.events.push(event);
          });
          groups.forEach((group) => {
            const section = document.createElement('section');
            section.className = 'activity-day-group';
            const heading = document.createElement('div');
            heading.className = 'activity-day-title';
            const day = document.createElement('strong');
            day.textContent = group.day;
            const count = document.createElement('span');
            count.textContent = group.events.length + ' ' + tr('activity.day.events', 'événement(s)');
            heading.appendChild(day);
            heading.appendChild(count);
            section.appendChild(heading);
            const rows = document.createElement('div');
            rows.className = 'activity-day-rows';
            group.events.forEach((event) => appendEventRow(rows, event));
            section.appendChild(rows);
            listEl.appendChild(section);
          });
        }

        if (statusEl) {
          let status = filtered.length + ' ' + tr('activity.status.visible', 'événement(s) affiché(s)')
            + ' · ' + periodEvents.length + ' ' + tr('activity.status.period', 'sur la période');
          const dropped = (Number(stats && stats.dropped) || 0) + (Number(stats && stats.persist_dropped) || 0);
          if (dropped > 0) status += ' · ' + dropped + ' ' + tr('activity.status.dropped', 'non conservé(s)');
          statusEl.textContent = status;
        }
      }

      function refresh(showBusy) {
        if (!listEl) return Promise.resolve();
        if (activeJob) return activeJob.promise;
        const job = { controller: new AbortController(), timedOut: false };
        activeJob = job;
        if (refreshBtn) refreshBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Chargement du journal...';
        job.promise = load(job).catch((error) => {
          if (activeJob !== job) return;
          if (statusEl) statusEl.textContent = 'Journal indisponible : ' + (job.timedOut
            ? 'le contrôleur ne répond pas dans le délai prévu.' : error.message);
        }).finally(() => {
          if (activeJob !== job) return;
          activeJob = null;
          if (refreshBtn) refreshBtn.disabled = false;
        });
        return job.promise;
      }

      async function load(job) {
        const events = [];
        let stats = null;
        let offset = 0;
        for (let pageNumber = 0; pageNumber < 48; pageNumber += 1) {
          const timeout = setTimeout(() => { job.timedOut = true; job.controller.abort(); }, 15000);
          let page;
          try {
            const response = await fetch('/api/activity/logs?offset=' + encodeURIComponent(offset) + '&limit=16', {
              cache: 'no-store', signal: job.controller.signal
            });
            if (!response.ok) throw new Error(response.status === 401 || response.status === 403
              ? 'connexion administrateur requise.' : 'HTTP ' + response.status);
            page = await response.json();
          } finally {
            clearTimeout(timeout);
          }
          if (activeJob !== job) return;
          if (page.ok === false || page.available === false || !Array.isArray(page.events)) {
            throw new Error('service du journal indisponible.');
          }
          stats = page;
          events.push(...page.events);
          eventsCache = events.slice();
          statsCache = stats;
          render(eventsCache, statsCache);
          if (page.complete || page.next == null || Number(page.count) === 0) break;
          const next = Number(page.next);
          if (!Number.isInteger(next) || next <= offset) throw new Error('pagination invalide.');
          offset = next;
          if (events.length >= 768) break;
          if (pageNumber === 47) throw new Error('chargement incomplet, veuillez actualiser.');
          if (statusEl) statusEl.textContent = 'Chargement du journal : ' + events.length + ' événement(s)...';
        }
        eventsCache = events;
        statsCache = stats;
        render(eventsCache, statsCache);
      }

      async function purge() {
        if (!confirm('Confirmer la purge du Journal d’Activité ? Cette action efface l’historique en mémoire et dans le SPIFFS.')) return;
        if (purgeBtn) purgeBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Purge du journal...';
        try {
          const response = await fetchWithBusyRetry('/api/activity/purge', { method: 'POST', cache: 'no-store' });
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const payload = await response.json().catch(() => ({}));
          if (payload && payload.ok === false) throw new Error('Purge refusée');
          windowShiftHours = 0;
          await refresh(false);
          if (statusEl) statusEl.textContent = 'Journal purgé.';
        } catch (error) {
          if (statusEl) statusEl.textContent = 'Purge impossible: ' + (error && error.message ? error.message : String(error));
        } finally {
          if (purgeBtn) purgeBtn.disabled = false;
        }
      }

      if (refreshBtn) refreshBtn.addEventListener('click', () => refresh(true).catch((error) => {
        if (statusEl) statusEl.textContent = 'Journal indisponible: ' + (error && error.message ? error.message : String(error));
      }));
      if (purgeBtn) purgeBtn.addEventListener('click', () => purge());
      if (prevBtn) prevBtn.addEventListener('click', () => {
        windowShiftHours += 1;
        render(eventsCache, statsCache);
      });
      if (nextBtn) nextBtn.addEventListener('click', () => {
        windowShiftHours = Math.max(0, windowShiftHours - 1);
        render(eventsCache, statsCache);
      });
      filterBtns.forEach((button) => button.addEventListener('click', () => {
        filter = String(button.dataset.activityFilter || 'all');
        filterBtns.forEach((item) => item.classList.toggle('is-active', item === button));
        render(eventsCache, statsCache);
      }));

      return {
        show: refresh,
        hide: hide,
        refresh: refresh
      };
    }
  };
})();
