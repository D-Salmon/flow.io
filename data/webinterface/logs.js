(function (global) {
  'use strict';

  var pages = global.FlowWebPages = global.FlowWebPages || {};

  pages.logs = {
    create: function createLogsPage(deps) {
      var tr = deps.tr;
      var isLocalRuntime = deps.isLocalRuntime;
      var term = document.getElementById('term');
      var wsStatus = document.getElementById('wsStatus');
      var sourceSelect = document.getElementById('logSourceSelect');
      var bootDumpBtn = document.getElementById('bootLogDumpBtn');
      var autoscrollInput = document.getElementById('toggleAutoscroll');
      var overlay = document.getElementById('logsOverlay');
      var closeBtn = document.getElementById('closeLogsOverlay');
      var socket = null;
      var opened = false;
      var autoScroll = true;
      var source = 'supervisor';
      var ansiState = { fg: null };
      var ansiRe = /\u001b\[([0-9;]*)m/g;
      var ansiColors = {
        30: '#94a3b8', 31: '#ef4444', 32: '#22c55e', 33: '#f59e0b',
        34: '#60a5fa', 35: '#f472b6', 36: '#22d3ee', 37: '#e2e8f0',
        90: '#64748b', 91: '#f87171', 92: '#4ade80', 93: '#fbbf24',
        94: '#93c5fd', 95: '#f9a8d4', 96: '#67e8f9', 97: '#f8fafc'
      };
      var sourceMeta = {
        supervisor: { cmd: 'src:supervisor', label: 'Supervisor', busy: 'occupé (1 terminal max)' },
        flowio: { cmd: 'src:flowio', label: 'flow.io', busy: 'occupé (1 terminal max)' }
      };

      function activeMeta() { return sourceMeta[source] || sourceMeta.supervisor; }
      function setStatus(status) {
        if (wsStatus) wsStatus.textContent = activeMeta().label + ' : ' + status;
      }
      function applySourceUi() {
        var localOnly = isLocalRuntime();
        if (sourceSelect) {
          sourceSelect.hidden = localOnly;
          sourceSelect.disabled = localOnly;
        }
        if (localOnly) source = 'supervisor';
        if (sourceSelect) sourceSelect.value = source;
      }
      function applySgr(raw) {
        var codes = raw === '' ? [0] : raw.split(';').map(Number).filter(Number.isFinite);
        codes.forEach(function (code) {
          if (code === 0 || code === 39) ansiState.fg = null;
          else if (Object.prototype.hasOwnProperty.call(ansiColors, code)) ansiState.fg = ansiColors[code];
        });
      }
      function decodeAnsi(raw) {
        var out = '';
        var cursor = 0;
        var color = ansiState.fg;
        raw.replace(ansiRe, function (full, codes, index) {
          out += raw.slice(cursor, index);
          applySgr(codes);
          if (ansiState.fg) color = ansiState.fg;
          cursor = index + full.length;
          return '';
        });
        return { text: out + raw.slice(cursor), color: color };
      }
      function appendLine(raw, withAnsi) {
        if (!term) return;
        var parsed = withAnsi ? decodeAnsi(raw) : { text: raw, color: null };
        var row = document.createElement('div');
        row.className = 'log-line';
        if (parsed.color) row.style.color = parsed.color;
        row.textContent = parsed.text;
        term.appendChild(row);
        while (term.childNodes.length > 1200) term.removeChild(term.firstChild);
        if (autoScroll) term.scrollTop = term.scrollHeight;
      }
      function disconnect() {
        if (!socket) return;
        socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null;
        try { socket.close(); } catch (err) {}
        socket = null;
      }
      function connect() {
        if (!opened || document.hidden) {
          disconnect();
          setStatus(tr('terminal.inactive', 'inactif'));
          return;
        }
        disconnect();
        setStatus(tr('terminal.connecting', 'connexion...'));
        var meta = activeMeta();
        var current = new WebSocket((location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/wslog');
        socket = current;
        current.onopen = function () {
          if (current !== socket) return;
          setStatus(tr('terminal.connected', 'connecté'));
          try { current.send(meta.cmd); } catch (err) {}
        };
        current.onclose = function (event) {
          if (current !== socket) return;
          socket = null;
          setStatus(event && event.code === 1008 ? meta.busy : tr('terminal.disconnected', 'déconnecté'));
        };
        current.onerror = function () { if (current === socket) setStatus(tr('terminal.error', 'erreur')); };
        current.onmessage = function (event) { if (current === socket) appendLine(String(event.data || ''), true); };
      }
      async function dumpBootLogs() {
        var offset = 0;
        var loaded = 0;
        if (bootDumpBtn) bootDumpBtn.disabled = true;
        try {
          while (true) {
            var response = await fetch('/api/logs/boot?offset=' + encodeURIComponent(offset) + '&limit=64');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            var page = await response.json();
            var lines = Array.isArray(page.lines) ? page.lines : [];
            lines.forEach(function (line) { appendLine(String(line || ''), false); });
            loaded += Number(page.count) || lines.length;
            setStatus('Boot logs : ' + loaded + '/' + (Number(page.entries) || loaded));
            if (page.complete || page.next == null || Number(page.count) === 0) break;
            offset = Number(page.next);
            if (!Number.isFinite(offset) || offset < 0) break;
          }
        } catch (err) {
          appendLine('Impossible de charger les logs de boot : ' + (err.message || String(err)), false);
        } finally {
          if (bootDumpBtn) bootDumpBtn.disabled = false;
        }
      }
      function open() {
        if (!overlay) return;
        applySourceUi();
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        opened = true;
        if (term) term.textContent = '';
        connect();
      }
      function close() {
        opened = false;
        disconnect();
        if (overlay) {
          overlay.hidden = true;
          overlay.setAttribute('aria-hidden', 'true');
        }
        setStatus(tr('terminal.inactive', 'inactif'));
      }

      if (closeBtn) closeBtn.addEventListener('click', close);
      if (overlay) overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
      if (sourceSelect) sourceSelect.addEventListener('change', function () {
        source = isLocalRuntime() ? 'supervisor' : String(sourceSelect.value || 'supervisor');
        if (term) term.textContent = '';
        if (opened) connect();
      });
      if (autoscrollInput) autoscrollInput.addEventListener('change', function () {
        autoScroll = !!autoscrollInput.checked;
        autoscrollInput.setAttribute('aria-checked', autoScroll ? 'true' : 'false');
        if (autoScroll && term) term.scrollTop = term.scrollHeight;
      });
      if (bootDumpBtn) bootDumpBtn.addEventListener('click', function () { dumpBootLogs(); });
      document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && opened) close(); });
      applySourceUi();
      setStatus(tr('terminal.inactive', 'inactif'));

      return {
        open: open,
        close: close,
        isOpen: function () { return opened; },
        visibilityChanged: function () { if (document.hidden) disconnect(); else if (opened) connect(); }
      };
    }
  };
})(window);
