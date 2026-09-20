(function () {
  'use strict';

  window.FlowWebPages = window.FlowWebPages || {};
  window.FlowWebPages.ioSummary = {
    create: function createIoSummaryPage(deps) {
      const tr = deps.tr;
      const fetchOkJson = deps.fetchOkJson;
      const createIntervalRunner = deps.createIntervalRunner;
      const getActivePageId = deps.getActivePageId;
      const ioSummaryCards = document.getElementById('ioSummaryCards');
      const ioSummaryTables = document.getElementById('ioSummaryTables');
      let ioSummaryReqSeq = 0;
      let ioSummaryLoadedOnce = false;
      const ioSummaryPoller = createIntervalRunner(() => {
        if (getActivePageId() !== 'page-io-summary' || document.hidden) return;
        return refreshIoSummary(false);
      }, 10000);

    function stopIoSummaryTimer() {
      ioSummaryPoller.stop();
    }

    function startIoSummaryTimer() {
      ioSummaryPoller.start();
    }

    function ioSummaryStateLabel(state) {
      const key = String(state || '').trim().toLowerCase();
      if (key === 'active') return tr('io.state.active', 'Actif');
      if (key === 'sleeping') return tr('io.state.sleeping', 'Veille');
      if (key === 'error') return tr('io.state.error', 'Erreur');
      if (key === 'disabled') return 'Désactivé';
      if (key === 'not_wired') return 'Non câblé';
      if (key === 'hardware_missing') return 'Matériel absent';
      if (key === 'unavailable') return 'Temporairement indisponible';
      if (key === 'safety_blocked') return 'Bloqué par une sécurité';
      return key || '-';
    }

    function ioSummaryStateClass(state) {
      const key = String(state || '').trim().toLowerCase();
      if (key === 'active') return 'is-active';
      if (key === 'error' || key === 'hardware_missing' || key === 'safety_blocked') return 'is-error';
      return 'is-sleeping';
    }

    function ioSummaryText(value, fallback) {
      const text = String(value === null || value === undefined ? '' : value).trim();
      return text || fallback || '-';
    }

    function ioSummaryNumber(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }

    function ioSummarySlotLabel(row) {
      const kind = ioSummaryText(row && row.io_slot, '');
      const idx = Number(row && row.io_slot_index);
      if (!kind) return '-';
      return Number.isFinite(idx) ? (kind + ' #' + idx) : kind;
    }

    function ioSummaryIoIdLabel(row) {
      const explicit = ioSummaryText(row && row.io_id_label, '');
      if (explicit) return explicit;
      const id = Number(row && row.io_id);
      if (!Number.isFinite(id) || id === 65535) return tr('io.unassigned', 'Non affecté');
      return String(id);
    }

    function appendIoSummaryCard(title, value, summary, state) {
      if (!ioSummaryCards) return;
      const card = document.createElement('div');
      card.className = 'status-card io-summary-card';

      const head = document.createElement('div');
      head.className = 'status-card-head';
      const copy = document.createElement('div');
      const h3 = document.createElement('h3');
      h3.textContent = title;
      const p = document.createElement('p');
      p.className = 'status-card-summary';
      p.textContent = summary;
      copy.appendChild(h3);
      copy.appendChild(p);

      const metric = document.createElement('span');
      metric.className = 'io-summary-card-value ' + ioSummaryStateClass(state);
      metric.textContent = String(value);
      head.appendChild(copy);
      head.appendChild(metric);
      card.appendChild(head);
      ioSummaryCards.appendChild(card);
    }

    function appendIoSummarySkeletonCard(title, summary) {
      if (!ioSummaryCards) return;
      const card = document.createElement('div');
      card.className = 'status-card io-summary-card status-card-skeleton';

      const head = document.createElement('div');
      head.className = 'status-card-head';
      const copy = document.createElement('div');
      const h3 = document.createElement('h3');
      h3.textContent = title;
      const p = document.createElement('p');
      p.className = 'status-card-summary';
      p.textContent = summary;
      copy.appendChild(h3);
      copy.appendChild(p);

      const metric = document.createElement('span');
      metric.className = 'io-summary-card-value is-sleeping';
      metric.appendChild(createSkeletonLine('io-summary-card-value-skeleton', 100));
      head.appendChild(copy);
      head.appendChild(metric);
      card.appendChild(head);
      ioSummaryCards.appendChild(card);
    }

    function createIoStateBadge(state) {
      const badge = document.createElement('span');
      badge.className = 'io-state-badge ' + ioSummaryStateClass(state);
      badge.textContent = ioSummaryStateLabel(state);
      return badge;
    }

    function createIoCompactTable(title, columns, rows) {
      const section = document.createElement('section');
      section.className = 'io-table-section';

      const heading = document.createElement('div');
      heading.className = 'control-section-title ui-heading-inline';
      const icon = document.createElement('span');
      icon.className = 'ui-msr ui-msr-sm';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'table_chart';
      const text = document.createElement('span');
      text.textContent = title;
      heading.appendChild(icon);
      heading.appendChild(text);
      section.appendChild(heading);

      const shell = document.createElement('div');
      shell.className = 'io-table-shell';
      const table = document.createElement('table');
      table.className = 'io-compact-table';

      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      columns.forEach((column) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = column.label;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      (rows || []).forEach((row) => {
        const trEl = document.createElement('tr');
        columns.forEach((column) => {
          const td = document.createElement('td');
          const rendered = typeof column.render === 'function' ? column.render(row) : row[column.key];
          if (rendered instanceof Node) {
            td.appendChild(rendered);
          } else {
            td.textContent = ioSummaryText(rendered, '-');
          }
          trEl.appendChild(td);
        });
        tbody.appendChild(trEl);
      });
      if (!rows || !rows.length) {
        const trEl = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = columns.length;
        td.className = 'io-empty-cell';
        td.textContent = tr('io.empty', 'Aucune donnée.');
        trEl.appendChild(td);
        tbody.appendChild(trEl);
      }
      table.appendChild(tbody);
      shell.appendChild(table);
      section.appendChild(shell);
      return section;
    }

    function createIoSummaryTableSkeleton(title, labels, rowCount) {
      const widths = [72, 54, 48, 42, 64, 58, 46];
      const columns = (labels || []).map((label, index) => ({
        key: 'c' + index,
        label,
        render: () => createSkeletonLine('io-table-skeleton-line', widths[index % widths.length])
      }));
      const rows = Array.from({ length: Math.max(1, rowCount || 1) }, () => ({}));
      return createIoCompactTable(title, columns, rows);
    }

    function renderIoSummarySkeleton() {
      if (ioSummaryCards) {
        ioSummaryCards.innerHTML = '';
        appendIoSummarySkeletonCard(
          tr('io.cards.bindingPorts', 'BindingPorts'),
          tr('io.cards.bindingPorts.summary', 'ports physiques actifs')
        );
        appendIoSummarySkeletonCard(
          tr('io.cards.ioslots', 'IOSlots'),
          tr('io.cards.ioslots.summary', 'slots logiques actifs')
        );
        appendIoSummarySkeletonCard(
          tr('io.cards.domainSlots', 'DomainSlots'),
          tr('io.cards.domainSlots.summary', 'slots domaine actifs')
        );
        appendIoSummarySkeletonCard(
          tr('io.cards.errors', 'Slots en erreur'),
          tr('io.status.loading', 'Chargement...')
        );
      }
      if (ioSummaryTables) {
        ioSummaryTables.innerHTML = '';
        ioSummaryTables.appendChild(createIoSummaryTableSkeleton(
          tr('io.table.drivers', 'Affectations par driver'),
          [
            tr('io.col.driver', 'Driver'),
            tr('io.col.active', 'Actifs'),
            tr('io.col.errors', 'Erreurs')
          ],
          3
        ));
        ioSummaryTables.appendChild(createIoSummaryTableSkeleton(
          tr('io.table.bindingPorts', 'BindingPorts'),
          [
            tr('io.col.port', 'Port'),
            tr('io.col.driver', 'Driver'),
            tr('io.col.channel', 'Canal'),
            tr('io.col.state', 'Etat'),
            tr('io.col.lastValue', 'Dernière valeur'),
            tr('io.col.ioId', 'IoId')
          ],
          4
        ));
        ioSummaryTables.appendChild(createIoSummaryTableSkeleton(
          tr('io.table.ioSlots', 'IOSlots'),
          [
            tr('io.col.slot', 'Slot'),
            tr('io.col.configName', 'Nom config'),
            tr('io.col.kind', 'Type'),
            tr('io.col.driver', 'Driver'),
            tr('io.col.state', 'Etat'),
            tr('io.col.lastValue', 'Dernière valeur'),
            tr('io.col.error', 'Erreur')
          ],
          4
        ));
        ioSummaryTables.appendChild(createIoSummaryTableSkeleton(
          tr('io.table.domainSlots', 'DomainSlots'),
          [
            tr('io.col.domainSlot', 'Domaine'),
            tr('io.col.ioName', 'IONAME'),
            tr('io.col.ioSlot', 'IOSlot'),
            tr('io.col.state', 'Etat'),
            tr('io.col.lastValue', 'Dernière valeur')
          ],
          4
        ));
      }
    }

    function renderIoSummary(data) {
      const summary = data && typeof data.summary === 'object' ? data.summary : {};
      const i2cAddresses = data && typeof data.i2c_addresses === 'object' ? data.i2c_addresses : {};
      const temperatureTransports = data && typeof data.temperature_transports === 'object' ? data.temperature_transports : {};
      const drivers = Array.isArray(data && data.drivers) ? data.drivers : [];
      const bindingPorts = Array.isArray(data && data.binding_ports) ? data.binding_ports : [];
      const ioSlots = Array.isArray(data && data.io_slots) ? data.io_slots : [];
      const domainSlots = Array.isArray(data && data.domain_slots) ? data.domain_slots : [];
      const visibleIoSlots = ioSlots.filter((row) => row && row.config_name !== 'io_chl_gen');
      const visibleDomainSlots = domainSlots.filter((row) => row && row.endpoint_id !== 'io_chl_gen');
      const errors = Array.isArray(data && data.error_slots) ? data.error_slots : [];
      const configuredNameLabel = (row, key) => {
        const bindingPort = Number(row && row.binding_port);
        if (bindingPort >= 200 && bindingPort <= 207) return 'DI' + String(bindingPort - 199);
        if (bindingPort >= 300 && bindingPort <= 307) return 'CH' + String(bindingPort - 299);
        return ioSummaryText(row && row[key], '-');
      };
      const domainDisplayLabel = (row) => (
        row && row.endpoint_id === 'io_chl_pmp'
          ? tr('pool.relay.disinfection', 'Désinfection')
          : ioSummaryText(row && row.display_name, '-')
      );
      const bindingPortLabel = (row) => {
        const port = Number(row && row.port_id);
        if (port >= 200 && port <= 207) return 'DI' + String(port - 199);
        if (port >= 300 && port <= 307) return 'CH' + String(port - 299);
        return ioSummaryText(row && row.port_id, '-');
      };
      const driverLabel = (row) => {
        const driver = ioSummaryText(row && row.driver, '-');
        if (driver === 'DS18B20') {
          const bindingPort = Number(row && row.binding_port);
          const slotIndex = Number(row && row.io_slot_index);
          const isWater = bindingPort === 120 || (row && row.io_slot === 'analog_in' && slotIndex === 4);
          const isAir = bindingPort === 121 || (row && row.io_slot === 'analog_in' && slotIndex === 5);
          if (!isWater && !isAir) return driver;
          const role = isWater ? 'eau' : 'air';
          const transport = Number(temperatureTransports[isWater ? 'water' : 'air']);
          return transport === 1
            ? 'DS18B20 directe - GPIO' + (isWater ? '20' : '19') + ' (' + role + ')'
            : 'I²C 0x18 - DS2484 / DS18B20 (' + role + ')';
        }
        const key = driver === 'ADS1115 int' ? 'ads1115_int' : (driver === 'ADS1115 ext' ? 'ads1115_ext' : '');
        if (!key) return driver;
        const address = Number(i2cAddresses[key]);
        if (address !== 72 && address !== 73) return driver;
        const channel = Number(row && row.channel);
        const role = key === 'ads1115_int' && Number.isInteger(channel) && channel >= 2
          ? 'ADS1115 interne'
          : (key === 'ads1115_int' ? 'ADS1115 carte pH/ORP' : 'ADS1115 externe');
        return 'I²C 0x' + address.toString(16).toUpperCase() + ' - ' + role
          + (Number.isInteger(channel) && channel >= 0 && channel <= 3 ? ', canal A' + String(channel) : '');
      };

      if (ioSummaryCards) {
        ioSummaryCards.innerHTML = '';
        appendIoSummaryCard(
          tr('io.cards.bindingPorts', 'BindingPorts'),
          ioSummaryNumber(summary.binding_ports_active) + '/' + ioSummaryNumber(summary.binding_ports_total),
          tr('io.cards.bindingPorts.summary', 'ports physiques actifs'),
          ioSummaryNumber(summary.binding_ports_error) ? 'error' : 'active'
        );
        appendIoSummaryCard(
          tr('io.cards.ioslots', 'IOSlots'),
          ioSummaryNumber(summary.io_slots_active) + '/' + ioSummaryNumber(summary.io_slots_total),
          tr('io.cards.ioslots.summary', 'slots logiques actifs'),
          ioSummaryNumber(summary.io_slots_error) ? 'error' : 'active'
        );
        appendIoSummaryCard(
          tr('io.cards.domainSlots', 'DomainSlots'),
          ioSummaryNumber(summary.domain_slots_active) + '/' + ioSummaryNumber(summary.domain_slots_total),
          tr('io.cards.domainSlots.summary', 'slots domaine actifs'),
          ioSummaryNumber(summary.domain_slots_error) ? 'error' : 'active'
        );
        appendIoSummaryCard(
          tr('io.cards.errors', 'Slots en erreur'),
          ioSummaryNumber(summary.error_slots),
          errors.length ? errors.map((slot) => ioSummaryText(slot.label, slot.io_slot)).slice(0, 3).join(', ') : tr('io.cards.errors.none', 'aucune erreur active'),
          errors.length ? 'error' : 'active'
        );
      }

      if (ioSummaryTables) {
        ioSummaryTables.innerHTML = '';
        ioSummaryTables.appendChild(createIoCompactTable(
          tr('io.table.drivers', 'Affectations par driver'),
          [
            { key: 'driver', label: tr('io.col.driver', 'Driver'), render: driverLabel },
            { key: 'active_slots', label: tr('io.col.active', 'Actifs') },
            { key: 'error_slots', label: tr('io.col.errors', 'Erreurs') }
          ],
          drivers
        ));
        ioSummaryTables.appendChild(createIoCompactTable(
          tr('io.table.bindingPorts', 'BindingPorts'),
          [
            { key: 'port_id', label: tr('io.col.port', 'Port'), render: bindingPortLabel },
            { key: 'driver', label: tr('io.col.driver', 'Driver'), render: driverLabel },
            { key: 'channel', label: tr('io.col.channel', 'Canal') },
            { key: 'state', label: tr('io.col.state', 'Etat'), render: (row) => createIoStateBadge(row.state) },
            { key: 'last_value', label: tr('io.col.lastValue', 'Dernière valeur') },
            { key: 'io_id', label: tr('io.col.ioId', 'IoId'), render: (row) => ioSummaryIoIdLabel(row) }
          ],
          bindingPorts
        ));
        ioSummaryTables.appendChild(createIoCompactTable(
          tr('io.table.ioSlots', 'IOSlots'),
          [
            { key: 'io_slot', label: tr('io.col.slot', 'Slot'), render: (row) => ioSummarySlotLabel(row) },
            { key: 'config_name', label: tr('io.col.configName', 'Nom config'), render: (row) => configuredNameLabel(row, 'config_name') },
            { key: 'kind', label: tr('io.col.kind', 'Type') },
            { key: 'driver', label: tr('io.col.driver', 'Driver'), render: driverLabel },
            { key: 'state', label: tr('io.col.state', 'Etat'), render: (row) => createIoStateBadge(row.state) },
            { key: 'last_value', label: tr('io.col.lastValue', 'Dernière valeur') },
            { key: 'error', label: tr('io.col.error', 'Erreur') }
          ],
          visibleIoSlots
        ));
        ioSummaryTables.appendChild(createIoCompactTable(
          tr('io.table.domainSlots', 'DomainSlots'),
          [
            { key: 'display_name', label: tr('io.col.domainSlot', 'Domaine'), render: domainDisplayLabel },
            { key: 'io_name', label: tr('io.col.ioName', 'IONAME'), render: (row) => configuredNameLabel(row, 'io_name') },
            { key: 'io_slot', label: tr('io.col.ioSlot', 'IOSlot'), render: (row) => ioSummarySlotLabel(row) },
            { key: 'state', label: tr('io.col.state', 'Etat'), render: (row) => createIoStateBadge(row.state) },
            { key: 'last_value', label: tr('io.col.lastValue', 'Dernière valeur') }
          ],
          visibleDomainSlots
        ));
      }
    }

    async function fetchIoSummary() {
      const results = await Promise.all([
        fetchOkJson('/api/io/summary', { cache: 'no-store' }, 'lecture entrées/sorties indisponible'),
        fetchOkJson('/api/pool/assets', { cache: 'no-store' }, 'état central indisponible').catch(() => null)
      ]);
      const data = results[0];
      if (!data || data.ok !== true) throw new Error('résumé entrées/sorties indisponible');
      const assets = results[1] && Array.isArray(results[1].assets) ? results[1].assets : [];
      const bySlot = new Map(assets.map((asset) => [Number(asset.slot), asset]));
      const byIoId = new Map(assets
        .filter((asset) => Number(asset.io_id) !== 65535)
        .map((asset) => [Number(asset.io_id), asset]));
      (data.domain_slots || []).forEach((row) => {
        const asset = bySlot.get(Number(row.domain_slot_id));
        if (!asset) return;
        row.state = asset.state;
        row.error = asset.reason || '';
        if (asset.has_value) row.last_value = String(asset.value);
      });
      (data.io_slots || []).forEach((row) => {
        const asset = byIoId.get(Number(row.io_id));
        if (!asset) return;
        row.state = asset.state;
        row.error = asset.reason || '';
        if (asset.has_value) row.last_value = String(asset.value);
      });
      return data;
    }

    async function refreshIoSummary(forceRefresh) {
      const reqSeq = ++ioSummaryReqSeq;
      if (forceRefresh || !ioSummaryLoadedOnce) renderIoSummarySkeleton();
      try {
        const data = await fetchIoSummary();
        if (reqSeq !== ioSummaryReqSeq) return;
        ioSummaryLoadedOnce = true;
        renderIoSummary(data);
      } catch (err) {
        if (reqSeq !== ioSummaryReqSeq) return;
        if (ioSummaryTables) ioSummaryTables.innerHTML = '';
      }
    }

    async function onIoSummaryPageShown() {
      startIoSummaryTimer();
      await refreshIoSummary(!ioSummaryLoadedOnce);
    }


      return {
        show: onIoSummaryPageShown,
        hide: stopIoSummaryTimer,
        refresh: refreshIoSummary
      };
    }
  };
})();
