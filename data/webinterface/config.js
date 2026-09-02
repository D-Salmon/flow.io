(function () {
  'use strict';

  window.FlowWebPages = window.FlowWebPages || {};
  window.FlowWebPages.configuration = {
    create: function createConfigurationPage(deps) {
      const tr = deps.tr;
      const cfgI18nDebugLog = deps.cfgI18nDebugLog;
      const assetUrl = deps.assetUrl;
      const fetchWithBusyRetry = deps.fetchWithBusyRetry;
      const fetchFlowRemoteQueued = deps.fetchFlowRemoteQueued;
      const fetchJsonResponse = deps.fetchJsonResponse;
      const fetchOkJson = deps.fetchOkJson;
      const createFormPostOptions = deps.createFormPostOptions;
      const extractApiErrorMessage = deps.extractApiErrorMessage;
      const utf8ByteLength = deps.utf8ByteLength;
      const waitMs = deps.waitMs;
      const createSkeletonLine = deps.createSkeletonLine;
      const getActivePageId = deps.getActivePageId;
      const isPageActive = deps.isPageActive;
      const isMicronovaProfile = deps.isMicronovaProfile;
      const isWaveshareProfile = deps.isWaveshareProfile;
      const normalizeWebUiLocale = deps.normalizeWebUiLocale;
      const currentWebLocaleTag = deps.currentWebLocaleTag;
      const refreshWebUiLocale = deps.refreshWebUiLocale;
      const mettreAJourEtatVisibiliteMotDePasse = deps.updatePasswordVisibility;
      const basculerVisibiliteMotDePasse = deps.togglePasswordVisibility;

    const flowCfgRefreshBtn = document.getElementById('flowCfgRefresh');
    const flowCfgExportBtn = document.getElementById('flowCfgExport');
    const flowCfgImportBtn = document.getElementById('flowCfgImport');
    const flowCfgImportFileInput = document.getElementById('flowCfgImportFile');
    const flowCfgApplyBtn = document.getElementById('flowCfgApply');
    const flowCfgFiltrationRecalcBtn = document.getElementById('flowCfgFiltrationRecalc');
    const flowCfgTree = document.getElementById('flowCfgTree');
    const flowCfgPathLabel = document.getElementById('flowCfgCurrentPath');
    const flowCfgPathMeta = document.getElementById('flowCfgPathMeta');
    const flowCfgFields = document.getElementById('flowCfgFields');
    const flowCfgApplyBusy = document.getElementById('flowCfgApplyBusy');
    const flowCfgStatus = document.getElementById('flowCfgStatus');
    const flowCfgBackupStatus = document.getElementById('flowCfgBackupStatus');
    const flowCfgBackupProgress = document.getElementById('flowCfgBackupProgress');
    const flowCfgBackupProgressLabel = document.getElementById('flowCfgBackupProgressLabel');
    const flowCfgBackupPct = document.getElementById('flowCfgBackupPct');
    const flowCfgBackupProgressBar = document.getElementById('flowCfgBackupProgressBar');
    const flowCfgBackupProgressDot = document.getElementById('flowCfgBackupProgressDot');
    const flowCfgTreePane = flowCfgTree ? flowCfgTree.closest('.cfg-pane') : null;
    const flowCfgDetailPane = flowCfgFields ? flowCfgFields.closest('.cfg-pane') : null;
    let flowCfgCurrentModule = '';
    let flowCfgCurrentData = {};
    let flowCfgCurrentPdmExtension = null;
    let flowCfgChildrenCache = {};
    let flowCfgPath = [];
    let flowCfgExpandedNodes = new Set();
    let flowCfgRootExpanded = true;
    let cfgTreeSelectedSource = 'flow';
    let cfgDocSources = [];
    let flowCfgDocsLoaded = false;
    let flowCfgDocIndex = null;
    let flowCfgDocIndexUnavailable = false;
    const flowCfgDocModuleCache = new Map();
    const flowCfgDocModuleLoadPromises = new Map();
    let flowCfgDocIndexPromise = null;
    let flowCfgDocI18nLocale = '';
    let flowCfgDocI18nMap = {};
    let flowCfgDocI18nPromise = null;
    let flowCfgTreeLoadingDepth = 0;
    let flowCfgDetailLoadingDepth = 0;
    let flowCfgLoadPromise = null;
    let flowCfgRetryTimer = null;
    let flowCfgFlowOnlyFailureStreak = 0;
    let flowCfgLocalApplyBusyDepth = 0;
    let flowCfgApplyBtnSavedText = '';


      let flowCfgLoadedOnce = false;
    let cfgTreeAliases = [];
    let cfgTreeVirtualBranches = [];
    let cfgTreeHiddenPaths = [];
    const cfgTreeNodeTextNames = { supervisor: {}, flow: {} };
    const cfgTreeNodeTextNamePending = { supervisor: new Set(), flow: new Set() };
    const poolLogicDeviceIoOutputNames = { supervisor: {}, flow: {} };
    let supCfgCurrentModule = '';
    let supCfgCurrentData = {};
    let supCfgCurrentPdmExtension = null;
    let supCfgTreePath = '';
    let supCfgChildrenCache = {};
    let supCfgExpandedNodes = new Set();
    let supCfgRootExpanded = true;
    const ioOutputPdmLabels = Object.freeze({
      0: 'Filtration',
      1: 'Pompe pH',
      2: 'Pompe chlore',
      3: 'Robot',
      4: 'Pompe remplissage',
      5: 'Electrolyse',
      6: 'Eclairage',
      7: 'Chauffage eau',
      8: 'COMP01',
      9: 'COMP02',
      10: 'COMP03',
      11: 'COMP04',
      12: 'COMP05',
      13: 'COMP06',
      14: 'COMP07',
      15: 'COMP08'
    });


    const flowCfgBackupFormat = 'flowio-configstore-backup';
    const flowCfgBackupVersion = 1;
    const flowCfgBackupRedactedToken = '__REDACTED__';
    const flowCfgBackupPatchTargetBytes = 1300;
    let flowCfgBackupBusy = false;

      function cfgDocTr(token, fallback) {
        const key = String(token || '').trim();
        if (!key) return String(fallback || '');
        const localized = flowCfgDocI18nMap && flowCfgDocI18nMap[key];
        if (typeof localized === 'string' && localized.length > 0) return localized;
        if (typeof fallback === 'string' && fallback.length > 0) return fallback;
        return key;
      }


    async function onControlPageShown() {
      const shouldShowInitialTreeSkeleton = !flowCfgLoadedOnce;
      if (shouldShowInitialTreeSkeleton) {
        beginFlowCfgLoading('Chargement de la configuration distante...', { tree: true, detail: false });
      }
      try {
        await ensureFlowCfgLoaded(false);
        await refreshCfgDocLocaleRuntime(true);
      } finally {
        if (shouldShowInitialTreeSkeleton) {
          endFlowCfgLoading({ tree: true, detail: false });
        }
      }
    }



    function nettoyerNomFlowCfg(moduleName) {
      return String(moduleName || '').trim().replace(/^\/+|\/+$/g, '');
    }

    function cheminFlowCfgCourant() {
      return flowCfgPath.length > 0 ? flowCfgPath.join('/') : '';
    }

    function cfgPathHasPrefix(pathValue, prefix) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      const cleanPrefix = nettoyerNomFlowCfg(prefix);
      if (!cleanPrefix) return true;
      return cleanPath === cleanPrefix || cleanPath.startsWith(cleanPrefix + '/');
    }

    function cfgDocPathCandidates(pathValue) {
      const cleanDisplay = nettoyerNomFlowCfg(pathValue);
      const candidates = [];
      const pushCandidate = (candidate) => {
        const cleanCandidate = nettoyerNomFlowCfg(candidate);
        if (!cleanCandidate) return;
        if (candidates.indexOf(cleanCandidate) >= 0) return;
        candidates.push(cleanCandidate);
      };

      let mappedStore = null;
      for (const alias of cfgTreeAliases) {
        if (!cfgPathHasPrefix(cleanDisplay, alias.display)) continue;
        if (!mappedStore || alias.display.length > mappedStore.display.length) {
          mappedStore = alias;
        }
      }

      if (mappedStore) {
        pushCandidate(mappedStore.store + cleanDisplay.slice(mappedStore.display.length));
      }

      pushCandidate(cleanDisplay);
      return candidates;
    }

    function cfgStorePathFromDisplayPath(pathValue) {
      const cleanDisplay = nettoyerNomFlowCfg(pathValue);
      if (!cleanDisplay) return '';
      for (const branch of cfgTreeVirtualBranches) {
        if (branch.display === cleanDisplay) return null;
      }
      const candidates = cfgDocPathCandidates(cleanDisplay);
      return candidates.length > 0 ? candidates[0] : cleanDisplay;
    }

    function cfgDisplayPathFromStorePath(pathValue) {
      const cleanStore = nettoyerNomFlowCfg(pathValue);
      if (!cleanStore) return '';
      let bestAlias = null;
      for (const alias of cfgTreeAliases) {
        if (!cfgPathHasPrefix(cleanStore, alias.store)) continue;
        if (!bestAlias || alias.store.length > bestAlias.store.length) {
          bestAlias = alias;
        }
      }
      if (!bestAlias) return cleanStore;
      return bestAlias.display + cleanStore.slice(bestAlias.store.length);
    }

    function cfgVirtualChildrenForDisplayPath(pathValue) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      for (const branch of cfgTreeVirtualBranches) {
        if (branch.display === cleanPath) {
          return branch.children.slice().sort((a, b) => a.localeCompare(b));
        }
      }
      return null;
    }

    function cfgIsAliasStoreShadowPath(pathValue) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      if (!cleanPath) return false;
      for (const alias of cfgTreeAliases) {
        const inStoreBranch = cfgPathHasPrefix(cleanPath, alias.store) || cfgPathHasPrefix(alias.store, cleanPath);
        if (!inStoreBranch) continue;
        const inDisplayBranch = cfgPathHasPrefix(cleanPath, alias.display) || cfgPathHasPrefix(alias.display, cleanPath);
        if (!inDisplayBranch) return true;
      }
      return false;
    }

    function cfgChildTokenForDisplayPath(parentPath, childPath) {
      const cleanParent = nettoyerNomFlowCfg(parentPath);
      const cleanChild = nettoyerNomFlowCfg(childPath);
      if (!cleanChild) return '';
      if (!cleanParent) {
        const rootSegments = cleanChild.split('/');
        return rootSegments.length > 0 ? rootSegments[0] : '';
      }
      if (!cfgPathHasPrefix(cleanChild, cleanParent) || cleanChild === cleanParent) {
        return '';
      }
      const suffix = cleanChild.slice(cleanParent.length + 1);
      const slashIndex = suffix.indexOf('/');
      return slashIndex >= 0 ? suffix.slice(0, slashIndex) : suffix;
    }

    function cfgPathLabel(pathValue) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      if (!cleanPath) return 'Racine';
      const meta = configPathMeta(cleanPath);
      if (meta && typeof meta.label === 'string' && meta.label.length > 0) {
        return meta.label;
      }
      const segs = cleanPath.split('/');
      return segs[segs.length - 1] || cleanPath;
    }

    function cfgTreeNodeRefInfo(pathValue) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      if (!cleanPath) return null;
      const matchIo = cleanPath.match(/^io\/input\/(?:analog\/)?(a\d{2})$/i)
        || cleanPath.match(/^io\/input\/(?:digital\/)?(i\d{2})$/i)
        || cleanPath.match(/^io\/output\/(d\d{2})$/i);
      if (matchIo) {
        const ref = String(matchIo[1] || '').toLowerCase();
        if (!ref) return null;
        return {
          type: 'io',
          ref: ref,
          modulePath: cleanPath,
          nameKey: ref + '_name'
        };
      }
      return null;
    }

    async function fetchCfgTreeNodeTextName(source, pathValue) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      const info = cfgTreeNodeRefInfo(cleanPath);
      if (!info || info.type !== 'io') return;
      if (!cfgTreeNodeTextNames[source]) cfgTreeNodeTextNames[source] = {};
      if (!cfgTreeNodeTextNamePending[source]) cfgTreeNodeTextNamePending[source] = new Set();

      const existing = cfgTreeNodeTextNames[source][cleanPath];
      if (typeof existing !== 'undefined') return;
      if (cfgTreeNodeTextNamePending[source].has(cleanPath)) return;

      cfgTreeNodeTextNamePending[source].add(cleanPath);
      try {
        const storePath = cfgStorePathFromDisplayPath(cleanPath) || info.modulePath;
        if (!storePath) return;
        const url = source === 'supervisor'
          ? ('/api/supervisorcfg/module?name=' + encodeURIComponent(storePath))
          : ('/api/flowcfg/module?name=' + encodeURIComponent(storePath));
        const fetchFn = source === 'supervisor' ? fetch : fetchFlowRemoteQueued;
        const res = await fetchFn(url, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.ok !== true || typeof data.data !== 'object') {
          cfgTreeNodeTextNames[source][cleanPath] = '';
          return;
        }
        const raw = data.data[info.nameKey];
        const textName = (typeof raw === 'string') ? raw.trim() : '';
        cfgTreeNodeTextNames[source][cleanPath] = textName;
      } catch (err) {
        cfgTreeNodeTextNames[source][cleanPath] = '';
      } finally {
        cfgTreeNodeTextNamePending[source].delete(cleanPath);
        renderFlowCfgTree();
      }
    }

    function cfgTreeDecoratedNodeLabel(source, pathValue, baseLabel) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      const info = cfgTreeNodeRefInfo(cleanPath);
      if (!info) return baseLabel;

      const ref = info.ref || String(baseLabel || '').trim();
      if (!ref) return baseLabel;

      const sourceCache = cfgTreeNodeTextNames[source] || {};
      const cached = sourceCache[cleanPath];
      if (typeof cached !== 'undefined') {
        return (typeof cached === 'string' && cached.length > 0) ? (ref + ' [' + cached + ']') : ref;
      }
      fetchCfgTreeNodeTextName(source, cleanPath).catch(() => {});
      return ref;
    }

    function clearCfgTreeNodeTextNameCache(source) {
      if (source !== 'flow' && source !== 'supervisor') return;
      cfgTreeNodeTextNames[source] = {};
      cfgTreeNodeTextNamePending[source] = new Set();
    }

    function flowCfgTitreDepuisChemin(pathValue) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      if (!cleanPath) return 'Racine';
      const segs = cleanPath.split('/');
      let prefix = '';
      return segs.map((seg) => {
        prefix = prefix ? (prefix + '/' + seg) : seg;
        return cfgPathLabel(prefix);
      }).join(' / ');
    }

    function cfgCacheKey(prefix) {
      const p = nettoyerNomFlowCfg(prefix);
      return p.length > 0 ? p : '__root__';
    }

    function cfgChildrenCacheForSource(source) {
      return source === 'supervisor' ? supCfgChildrenCache : flowCfgChildrenCache;
    }

    function cfgFilteredChildren(source, prefix) {
      const p = nettoyerNomFlowCfg(prefix);
      const node = cfgChildrenCacheForSource(source)[cfgCacheKey(p)];
      if (!node || !Array.isArray(node.children)) return [];
      return node.children
        .filter((name) => {
          const childPath = p ? (p + '/' + name) : name;
          return !isConfigPathHidden(childPath, source) && !cfgIsAliasStoreShadowPath(childPath);
        })
        .slice();
    }

    function cfgExpandAncestors(source, pathValue) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      if (!cleanPath) return;
      const expandedSet = source === 'supervisor' ? supCfgExpandedNodes : flowCfgExpandedNodes;
      const segs = cleanPath.split('/');
      let prefix = '';
      for (let i = 0; i < segs.length; ++i) {
        prefix = prefix ? (prefix + '/' + segs[i]) : segs[i];
        expandedSet.add(prefix);
      }
    }

    function cfgNodeForPath(source, pathValue) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      return cfgChildrenCacheForSource(source)[cfgCacheKey(cleanPath)] || null;
    }

    async function chargerCfgChildren(source, prefix, forceReload) {
      const p = nettoyerNomFlowCfg(prefix);
      const cache = cfgChildrenCacheForSource(source);
      const key = cfgCacheKey(p);
      if (!forceReload && cache[key]) {
        return cache[key];
      }

      const virtualChildren = cfgVirtualChildrenForDisplayPath(p);
      if (virtualChildren) {
        const node = {
          prefix: p,
          hasExact: false,
          children: virtualChildren.filter((name) => {
            const childPath = p ? (p + '/' + name) : name;
            return !isConfigPathHidden(childPath, source) && !cfgIsAliasStoreShadowPath(childPath);
          })
        };
        cache[key] = node;
        return node;
      }

      const storePrefix = cfgStorePathFromDisplayPath(p);
      const baseUrl = source === 'supervisor' ? '/api/supervisorcfg/children' : '/api/flowcfg/children';
      const url = storePrefix && storePrefix.length > 0
        ? (baseUrl + '?prefix=' + encodeURIComponent(storePrefix))
        : baseUrl;
      const fetchFn = source === 'supervisor' ? fetch : fetchFlowRemoteQueued;
      const res = await fetchFn(url, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.ok !== true || !Array.isArray(data.children)) {
        const fallback = source === 'supervisor'
          ? 'liste enfants supervisor indisponible'
          : 'liste enfants indisponible';
        throw new Error(extractApiErrorMessage(data, fallback));
      }

      const children = data.children
        .filter((name) => typeof name === 'string' && name.length > 0)
        .map((name) => nettoyerNomFlowCfg(name))
        .filter((name) => name.length > 0)
        .map((child) => {
          const storeChildPath = storePrefix ? (storePrefix + '/' + child) : child;
          return cfgDisplayPathFromStorePath(storeChildPath);
        })
        .map((displayChildPath) => cfgChildTokenForDisplayPath(p, displayChildPath))
        .filter((name) => name.length > 0)
        .filter((name) => {
          const childPath = p ? (p + '/' + name) : name;
          return !isConfigPathHidden(childPath, source) && !cfgIsAliasStoreShadowPath(childPath);
        });

      const node = {
        prefix: p,
        hasExact: !!data.has_exact,
        children: Array.from(new Set(children)).sort((a, b) => a.localeCompare(b))
      };
      cache[key] = node;
      return node;
    }

    async function ensureCfgPathLoaded(source, pathValue, forceReload) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      await chargerCfgChildren(source, '', !!forceReload);
      if (!cleanPath) return cfgNodeForPath(source, '');

      const segs = cleanPath.split('/');
      let prefix = '';
      let node = null;
      for (let i = 0; i < segs.length; ++i) {
        prefix = prefix ? (prefix + '/' + segs[i]) : segs[i];
        node = await chargerCfgChildren(source, prefix, !!forceReload);
      }
      return node;
    }

    function currentCfgTreePath(source) {
      return source === 'supervisor' ? nettoyerNomFlowCfg(supCfgTreePath) : cheminFlowCfgCourant();
    }

    function cfgSourceLabel(source) {
      if (source !== 'supervisor') {
        return tr('cfg.remote.flow', 'Config Store flow.io');
      }
      if (deps.getWebLocalConfigLabel()) return deps.getWebLocalConfigLabel();
      return isMicronovaProfile()
        ? tr('cfg.local.micronova', 'Config Store Micronova')
        : tr('cfg.local.supervisor', 'Config Store Supervisor');
    }

    function renderFlowCfgCurrentPath(source, pathValue, node) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      const childCount = cfgFilteredChildren(source, cleanPath).length;
      const level = cleanPath ? cleanPath.split('/').length : 0;
      const hasExact = !!(node && node.hasExact);
      const sourceLabel = cfgSourceLabel(source);

      flowCfgPathLabel.textContent = cleanPath ? (sourceLabel + ' / ' + flowCfgTitreDepuisChemin(cleanPath)) : sourceLabel;
      flowCfgPathLabel.setAttribute('aria-label', cleanPath ? (tr('config.branch', 'Branche') + ' ' + cleanPath) : sourceLabel);
      flowCfgApplyBtn.textContent = source === 'supervisor' ? tr('cfg.apply.local', 'Appliquer localement') : tr('config.apply', 'Appliquer');

      if (!cleanPath) {
        flowCfgPathMeta.textContent = childCount > 0
          ? (childCount + ' branche(s) disponible(s) dans ' + sourceLabel + '.')
          : ('Aucune branche disponible dans ' + sourceLabel + '.');
        return;
      }

      const details = [];
      details.push(tr('config.level', 'Niveau') + ' ' + level);
      if (hasExact) {
        details.push(tr('config.variablesConfigurable', 'variables configurables'));
      }
      if (childCount > 0) {
        details.push(childCount + ' ' + tr('config.subBranches', 'sous-branche(s)'));
      }
      if (details.length === 0) {
        details.push(tr('config.branchEmpty', 'branche vide'));
      }
      flowCfgPathMeta.textContent = details.join(' | ');
    }

    function buildFlowCfgTreeItem(source, pathValue) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      const label = cfgTreeDecoratedNodeLabel(source, cleanPath, cfgPathLabel(cleanPath));
      const cachedNode = cfgNodeForPath(source, cleanPath);
      const children = cfgFilteredChildren(source, cleanPath);
      const isExpanded = source === 'supervisor' ? supCfgExpandedNodes.has(cleanPath) : flowCfgExpandedNodes.has(cleanPath);
      const isSelected = source === cfgTreeSelectedSource && cleanPath === currentCfgTreePath(source);
      const hasKnownChildren = children.length > 0;
      const canExpand = !cachedNode || hasKnownChildren;

      const item = document.createElement('li');
      item.className = 'cfg-tree-item';
      item.setAttribute('role', 'treeitem');
      item.setAttribute('aria-expanded', canExpand ? String(isExpanded) : 'false');

      const row = document.createElement('div');
      row.className = 'cfg-tree-row' + (canExpand ? '' : ' is-leaf');

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'cfg-tree-toggle' + (isExpanded ? ' is-expanded' : '') + (canExpand ? '' : ' is-leaf');
      toggle.setAttribute('aria-label', canExpand ? ('Afficher ' + label) : (label + ' sans sous-branche'));
      if (canExpand) {
        const glyph = document.createElement('span');
        glyph.className = 'cfg-tree-toggle-glyph' + (isExpanded ? ' is-minus' : ' is-plus');
        glyph.textContent = isExpanded ? '-' : '+';
        toggle.appendChild(glyph);
      }
      toggle.disabled = !canExpand;
      if (canExpand) {
        toggle.addEventListener('click', async (event) => {
          event.stopPropagation();
          await toggleFlowCfgBranch(source, cleanPath);
        });
      }
      row.appendChild(toggle);

      const nodeBtn = document.createElement('button');
      nodeBtn.type = 'button';
      nodeBtn.className = 'cfg-tree-node'
        + (isSelected ? ' is-selected' : '')
        + (cachedNode && cachedNode.hasExact ? ' is-exact' : '');
      nodeBtn.setAttribute('aria-current', isSelected ? 'true' : 'false');
      nodeBtn.addEventListener('click', async () => {
        if (canExpand && isExpanded) {
          await toggleFlowCfgBranch(source, cleanPath);
          return;
        }
        await selectFlowCfgPath(source, cleanPath, false);
      });

      const nodeLabel = document.createElement('span');
      nodeLabel.className = 'cfg-tree-node-label';
      nodeLabel.textContent = label;
      nodeBtn.appendChild(nodeLabel);
      row.appendChild(nodeBtn);
      item.appendChild(row);

      if (isExpanded && hasKnownChildren) {
        const group = document.createElement('ul');
        group.className = 'cfg-tree-group is-nested';
        group.setAttribute('role', 'group');
        children.forEach((child) => {
          const childPath = cleanPath ? (cleanPath + '/' + child) : child;
          group.appendChild(buildFlowCfgTreeItem(source, childPath));
        });
        item.appendChild(group);
      }

      return item;
    }

    function buildCfgTreeRootItem(source, label, expanded, children) {
      const item = document.createElement('li');
      item.className = 'cfg-tree-item cfg-tree-item-root';
      item.setAttribute('role', 'treeitem');
      item.setAttribute('aria-expanded', children.length > 0 ? String(expanded) : 'false');

      const row = document.createElement('div');
      row.className = 'cfg-tree-row cfg-tree-root-row';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'cfg-tree-toggle' + (expanded ? ' is-expanded' : '') + (children.length > 0 ? '' : ' is-leaf');
      if (children.length > 0) {
        const glyph = document.createElement('span');
        glyph.className = 'cfg-tree-toggle-glyph' + (expanded ? ' is-minus' : ' is-plus');
        glyph.textContent = expanded ? '-' : '+';
        toggle.appendChild(glyph);
      }
      toggle.disabled = children.length === 0;
      toggle.setAttribute('aria-label', expanded ? ('Replier ' + label) : ('Afficher ' + label));
      toggle.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (source === 'flow') flowCfgRootExpanded = !flowCfgRootExpanded;
        else supCfgRootExpanded = !supCfgRootExpanded;
        renderFlowCfgTree();
      });
      row.appendChild(toggle);

      const labelBtn = document.createElement('button');
      labelBtn.type = 'button';
      labelBtn.className = 'cfg-tree-root-label' + ((cfgTreeSelectedSource === source && !currentCfgTreePath(source)) ? ' is-selected' : '');
      labelBtn.textContent = label;
      labelBtn.addEventListener('click', async () => {
        await selectFlowCfgPath(source, '', false);
      });
      row.appendChild(labelBtn);
      item.appendChild(row);

      if (expanded && children.length > 0) {
        const group = document.createElement('ul');
        group.className = 'cfg-tree-group cfg-tree-group-root';
        group.setAttribute('role', 'group');
        children.forEach((child) => {
          group.appendChild(buildFlowCfgTreeItem(source, child));
        });
        item.appendChild(group);
      }

      return item;
    }

    function renderFlowCfgTree() {
      const savedScrollTop = flowCfgTree.scrollTop;
      flowCfgTree.innerHTML = '';
      const flowChildren = cfgFilteredChildren('flow', '');
      const supervisorChildren = cfgFilteredChildren('supervisor', '');

      const roots = document.createElement('ul');
      roots.className = 'cfg-tree-group';
      roots.setAttribute('role', 'tree');
      if (deps.getWebRemoteConfigEnabled() && flowChildren.length > 0) {
        roots.appendChild(buildCfgTreeRootItem('flow', tr('cfg.remote.flow', 'Config Store flow.io'), flowCfgRootExpanded, flowChildren));
      }
      roots.appendChild(buildCfgTreeRootItem('supervisor', cfgSourceLabel('supervisor'), supCfgRootExpanded, supervisorChildren));
      flowCfgTree.appendChild(roots);
      flowCfgTree.scrollTop = savedScrollTop;
    }

    function renderFlowCfgTreeSkeleton() {
      const savedScrollTop = flowCfgTree.scrollTop;
      flowCfgTree.innerHTML = '';
      const skeleton = document.createElement('div');
      skeleton.className = 'cfg-tree-skeleton';
      [100, 88, 92, 78, 84].forEach((width, index) => {
        const line = document.createElement('div');
        line.className = 'skeleton-line cfg-tree-skeleton-line' + (index > 1 ? ' is-indented' : '');
        line.style.width = width + '%';
        skeleton.appendChild(line);
      });
      flowCfgTree.appendChild(skeleton);
      flowCfgTree.scrollTop = savedScrollTop;
    }

    function restoreFlowCfgTreeScroll(scrollTop) {
      if (!flowCfgTree || !Number.isFinite(scrollTop)) return;
      flowCfgTree.scrollTop = scrollTop;
      requestAnimationFrame(() => {
        if (!flowCfgTree) return;
        flowCfgTree.scrollTop = scrollTop;
      });
    }

    async function toggleFlowCfgBranch(source, pathValue) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      const expandedSet = source === 'supervisor' ? supCfgExpandedNodes : flowCfgExpandedNodes;
      if (!cleanPath) return;
      if (expandedSet.has(cleanPath)) {
        expandedSet.delete(cleanPath);
        renderFlowCfgTree();
        return;
      }
      try {
        flowCfgStatus.textContent = 'Chargement des sous-branches...';
        await chargerCfgChildren(source, cleanPath, false);
        expandedSet.add(cleanPath);
        renderFlowCfgTree();
        flowCfgStatus.textContent = 'Sous-branches chargees.';
      } catch (err) {
        flowCfgStatus.textContent = 'Chargement des sous-branches echoue: ' + err;
      }
    }

    async function selectFlowCfgPath(source, pathValue, forceReload) {
      const preservedTreeScrollTop = flowCfgTree ? flowCfgTree.scrollTop : 0;
      beginFlowCfgLoading('Chargement de la configuration distante...', { tree: false, detail: true });
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      try {
        let node = null;
        const storePath = cfgStorePathFromDisplayPath(cleanPath);
        cfgTreeSelectedSource = source === 'supervisor' ? 'supervisor' : 'flow';
        if (cfgTreeSelectedSource === 'supervisor') {
          node = await ensureCfgPathLoaded('supervisor', cleanPath, !!forceReload);
          supCfgTreePath = cleanPath;
          supCfgRootExpanded = true;
          cfgExpandAncestors('supervisor', cleanPath);
          if (cleanPath && cfgFilteredChildren('supervisor', cleanPath).length > 0) {
            supCfgExpandedNodes.add(cleanPath);
          }
        } else {
          node = await ensureCfgPathLoaded('flow', cleanPath, !!forceReload);
          flowCfgPath = cleanPath ? cleanPath.split('/') : [];
          flowCfgRootExpanded = true;
          cfgExpandAncestors('flow', cleanPath);
          if (cleanPath && cfgFilteredChildren('flow', cleanPath).length > 0) {
            flowCfgExpandedNodes.add(cleanPath);
          }
        }

        renderFlowCfgCurrentPath(cfgTreeSelectedSource, cleanPath, node);
        renderFlowCfgTree();
        restoreFlowCfgTreeScroll(preservedTreeScrollTop);

        if (!cleanPath) {
          resetPrimaryCfgEditor(cfgFilteredChildren(cfgTreeSelectedSource, '').length > 0
            ? 'Sélectionnez une branche dans l\'arborescence.'
            : 'Aucune branche disponible.');
          return;
        }

        if (node && node.hasExact) {
          if (cfgTreeSelectedSource === 'supervisor') {
            await chargerPrimarySupervisorCfgModule(storePath || cleanPath);
          } else {
            await chargerFlowCfgModule(storePath || cleanPath);
          }
          return;
        }

        const childCount = cfgFilteredChildren(cfgTreeSelectedSource, cleanPath).length;
        if (childCount > 0) {
          resetPrimaryCfgEditor('Branche ouverte. Sélectionnez une sous-branche ou un noeud configurable.');
        } else {
          resetPrimaryCfgEditor('Aucune variable configurable dans cette branche.');
        }
      } catch (err) {
        renderFlowCfgCurrentPath(cfgTreeSelectedSource, cleanPath, null);
        renderFlowCfgTree();
        restoreFlowCfgTreeScroll(preservedTreeScrollTop);
        resetPrimaryCfgEditor('Chargement branche échoué: ' + err);
      } finally {
        endFlowCfgLoading({ tree: false, detail: true });
      }
    }

    function renderFlowCfgFieldsSkeleton() {
      flowCfgFields.innerHTML = '';
      for (let i = 0; i < 5; ++i) {
        const row = document.createElement('div');
        row.className = 'control-row control-row-skeleton';

        const labelWrap = document.createElement('div');
        labelWrap.className = 'control-label-wrap';
        labelWrap.appendChild(createSkeletonLine('', i % 2 === 0 ? 38 : 44));
        if (i % 2 === 0) {
          labelWrap.appendChild(createSkeletonLine('', 62));
        }
        row.appendChild(labelWrap);

        const inputSkel = document.createElement('div');
        if (i === 1) {
          inputSkel.className = 'control-switch-skeleton';
        } else {
          inputSkel.className = 'control-input-skeleton';
        }
        row.appendChild(inputSkel);
        flowCfgFields.appendChild(row);
      }
    }

    function beginFlowCfgLoading(statusText, options) {
      const opts = options || {};
      const loadTree = opts.tree !== false;
      const loadDetail = opts.detail !== false;

      if (loadTree) {
        flowCfgTreeLoadingDepth += 1;
        if (flowCfgTreeLoadingDepth === 1) {
          if (flowCfgTreePane) flowCfgTreePane.classList.add('is-loading');
          renderFlowCfgTreeSkeleton();
        }
      }
      if (loadDetail) {
        flowCfgDetailLoadingDepth += 1;
        if (flowCfgDetailLoadingDepth === 1) {
          if (flowCfgDetailPane) flowCfgDetailPane.classList.add('is-loading');
          renderFlowCfgFieldsSkeleton();
          flowCfgApplyBtn.disabled = true;
        }
      }
      if (loadTree || loadDetail) {
        flowCfgRefreshBtn.disabled = true;
      }
      if (statusText) {
        flowCfgStatus.textContent = statusText;
      }
    }

    function endFlowCfgLoading(options) {
      const opts = options || {};
      const loadTree = opts.tree !== false;
      const loadDetail = opts.detail !== false;

      if (loadTree && flowCfgTreeLoadingDepth > 0) {
        flowCfgTreeLoadingDepth -= 1;
        if (flowCfgTreeLoadingDepth === 0) {
          if (flowCfgTreePane) flowCfgTreePane.classList.remove('is-loading');
        }
      }
      if (loadDetail && flowCfgDetailLoadingDepth > 0) {
        flowCfgDetailLoadingDepth -= 1;
        if (flowCfgDetailLoadingDepth === 0) {
          if (flowCfgDetailPane) flowCfgDetailPane.classList.remove('is-loading');
        }
      }
      if (flowCfgTreeLoadingDepth === 0 && flowCfgDetailLoadingDepth === 0) {
        flowCfgRefreshBtn.disabled = false;
      }
    }

    function stopFlowCfgRetry() {
      if (!flowCfgRetryTimer) return;
      clearTimeout(flowCfgRetryTimer);
      flowCfgRetryTimer = null;
    }

    function scheduleFlowCfgRetry(delayMs) {
      stopFlowCfgRetry();
      flowCfgRetryTimer = setTimeout(() => {
        flowCfgRetryTimer = null;
        if (!isPageActive('page-control')) return;
        ensureFlowCfgLoaded(true).catch(() => {});
      }, delayMs);
    }

    function cfgDocKeyFromModuleName(moduleName) {
      const clean = nettoyerNomFlowCfg(moduleName);
      if (!clean) return '';
      return clean.toLowerCase().replace(/[^a-z0-9/_-]+/g, '').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    }

    function cfgDocLocaleAssetUrl(locale) {
      const cleanLocale = normalizeWebUiLocale(locale);
      const base = '/api/cfgdoc/i18n?locale=' + encodeURIComponent(cleanLocale);
      return assetUrl(base);
    }

    async function loadCfgDocI18nBundle(locale, forceReload) {
      const cleanLocale = normalizeWebUiLocale(locale);
      if (!forceReload && flowCfgDocI18nLocale === cleanLocale && flowCfgDocI18nMap && Object.keys(flowCfgDocI18nMap).length > 0) {
        cfgI18nDebugLog('cfgdoc i18n cache hit', { locale: cleanLocale, entries: Object.keys(flowCfgDocI18nMap).length });
        return true;
      }
      if (!forceReload && flowCfgDocI18nPromise) {
        return flowCfgDocI18nPromise;
      }

      flowCfgDocI18nPromise = (async () => {
        try {
          const payload = await fetchOkJson(
            cfgDocLocaleAssetUrl(cleanLocale),
            { cache: 'no-store' },
            'traductions cfgdoc indisponibles'
          );
          const source = payload && payload.translations && typeof payload.translations === 'object'
            ? payload.translations
            : payload;
          if (!source || typeof source !== 'object') return false;
          const mapped = {};
          Object.keys(source).forEach((rawKey) => {
            if (typeof source[rawKey] !== 'string') return;
            const key = String(rawKey || '').trim();
            if (!key) return;
            mapped[key] = source[rawKey];
          });
          flowCfgDocI18nLocale = cleanLocale;
          flowCfgDocI18nMap = mapped;
          cfgI18nDebugLog('cfgdoc i18n loaded', {
            locale: cleanLocale,
            entries: Object.keys(mapped).length,
            sampleWifiLabel: mapped['cfgdocs.wifi.enabled.label'] || null,
            sampleCfgmodLabel: mapped['cfgmods.network.wifi.label'] || null
          });
          return true;
        } catch (err) {
          cfgI18nDebugLog('cfgdoc i18n load failed', { locale: cleanLocale, error: String(err) });
          return false;
        } finally {
          flowCfgDocI18nPromise = null;
        }
      })();

      return flowCfgDocI18nPromise;
    }

    function cfgDocResolveLocalizedText(docLike, field) {
      if (!docLike || typeof docLike !== 'object') return '';
      const tokenField = field === 'label' ? 'label_i18n' : 'help_i18n';
      const legacyTokenField = field === 'label' ? 'label_t' : 'help_t';
      const fallback = typeof docLike[field] === 'string' ? docLike[field] : '';
      const token = typeof docLike[tokenField] === 'string' && docLike[tokenField].trim()
        ? docLike[tokenField]
        : (typeof docLike[legacyTokenField] === 'string' && docLike[legacyTokenField].trim()
          ? docLike[legacyTokenField]
          : '');
      if (!token) return fallback;
      return cfgDocTr(token, fallback);
    }

    function cfgDocApplyLocalizedText(docLike) {
      if (!docLike || typeof docLike !== 'object') return docLike;
      const out = Object.assign({}, docLike);
      const nextLabel = cfgDocResolveLocalizedText(out, 'label');
      const nextHelp = cfgDocResolveLocalizedText(out, 'help');
      if (nextLabel) out.label = nextLabel;
      if (nextHelp) out.help = nextHelp;
      return out;
    }

    function cfgDocApplyLocalizedEnumOptions(options) {
      if (!Array.isArray(options)) return options;
      return options.map((entry) => cfgDocApplyLocalizedText(entry));
    }

    async function refreshCfgDocLocaleRuntime(forceReload) {
      if (!flowCfgDocsLoaded) return;
      cfgI18nDebugLog('refreshCfgDocLocaleRuntime start', {
        locale: webUiLocale,
        forceReload: !!forceReload,
        activePage: getActivePageId()
      });
      const loaded = await loadCfgDocI18nBundle(webUiLocale, !!forceReload);
      if (!loaded) return;
      if (!isPageActive('page-control')) return;
      try {
        await ensureCfgDocsForModule(cfgTreeSelectedSource === 'supervisor' ? supCfgCurrentModule : flowCfgCurrentModule);
        if (cfgTreeSelectedSource === 'supervisor' && supCfgCurrentPdmExtension && supCfgCurrentPdmExtension.module) {
          await ensureCfgDocsForModule(supCfgCurrentPdmExtension.module);
        } else if (cfgTreeSelectedSource !== 'supervisor' && flowCfgCurrentPdmExtension && flowCfgCurrentPdmExtension.module) {
          await ensureCfgDocsForModule(flowCfgCurrentPdmExtension.module);
        }
      } catch (err) {
      }
      renderFlowCfgTree();
      renderFlowCfgCurrentPath(cfgTreeSelectedSource, currentCfgTreePath(cfgTreeSelectedSource), cfgNodeForPath(cfgTreeSelectedSource, currentCfgTreePath(cfgTreeSelectedSource)));
      if (cfgTreeSelectedSource === 'supervisor') {
        if (supCfgCurrentModule && supCfgCurrentData && typeof supCfgCurrentData === 'object') {
          renderPrimarySupervisorCfgFieldsWithExtensions(supCfgCurrentData);
        }
      } else if (flowCfgCurrentModule && flowCfgCurrentData && typeof flowCfgCurrentData === 'object') {
        renderFlowCfgFieldsWithExtensions(flowCfgCurrentData);
      }
      cfgI18nDebugLog('refreshCfgDocLocaleRuntime done', {
        locale: webUiLocale,
        source: cfgTreeSelectedSource,
        supervisorModule: supCfgCurrentModule,
        flowModule: flowCfgCurrentModule
      });
    }

    async function loadCfgDocIndex() {
      if (flowCfgDocIndex) return flowCfgDocIndex;
      if (flowCfgDocIndexUnavailable) throw new Error('cfgdoc_index_unavailable');
      if (flowCfgDocIndexPromise) return flowCfgDocIndexPromise;

      flowCfgDocIndexPromise = (async () => {
        try {
          const data = await fetchOkJson(
            '/api/cfgdoc/index',
            { cache: 'no-store' },
            'index de documentation indisponible'
          );
          const docs = (data && data.docs && typeof data.docs === 'object') ? data.docs : {};
          const meta = (data && data.meta && typeof data.meta === 'object')
            ? data.meta
            : ((data && data._meta && typeof data._meta === 'object') ? data._meta : {});
          const modules = (data && data.modules && typeof data.modules === 'object') ? data.modules : {};
          flowCfgDocIndex = { docs: docs, meta: meta, modules: modules };
          flowCfgDocIndexUnavailable = false;
          return flowCfgDocIndex;
        } catch (err) {
          flowCfgDocIndexUnavailable = true;
          throw err;
        }
      })().finally(() => {
        flowCfgDocIndexPromise = null;
      });

      return flowCfgDocIndexPromise;
    }

    async function getCfgDocForModule(moduleName) {
      const moduleKey = cfgDocKeyFromModuleName(moduleName);
      const cacheKey = moduleKey || '__root';
      if (flowCfgDocModuleCache.has(cacheKey)) {
        return flowCfgDocModuleCache.get(cacheKey);
      }
      if (flowCfgDocModuleLoadPromises.has(cacheKey)) {
        return flowCfgDocModuleLoadPromises.get(cacheKey);
      }

      const loadPromise = (async () => {
        try {
          const index = await loadCfgDocIndex();
          const relativePath = (index && index.modules && typeof index.modules[cacheKey] === 'string')
            ? String(index.modules[cacheKey]).trim()
            : '';
          if (!relativePath) return null;
          const payload = await fetchOkJson(
            '/api/cfgdoc/module?name=' + encodeURIComponent(cacheKey),
            { cache: 'no-store' },
            'documentation indisponible pour ' + cacheKey
          );
          const docs = (payload && payload.docs && typeof payload.docs === 'object') ? payload.docs : {};
          const meta = (payload && payload.meta && typeof payload.meta === 'object')
            ? payload.meta
            : ((payload && payload._meta && typeof payload._meta === 'object') ? payload._meta : {});
          const normalized = normalizeDocSource({ docs: docs, meta: meta });
          flowCfgDocModuleCache.set(cacheKey, normalized);
          return normalized;
        } catch (err) {
          return null;
        }
      })().finally(() => {
        flowCfgDocModuleLoadPromises.delete(cacheKey);
      });

      flowCfgDocModuleLoadPromises.set(cacheKey, loadPromise);
      return loadPromise;
    }

    async function ensureCfgDocsForModule(moduleName) {
      await loadCfgDocI18nBundle(webUiLocale, false);
      await getCfgDocForModule(moduleName);
      const baseSources = [];
      if (flowCfgDocIndex) {
        const idxSource = normalizeDocSource({ docs: flowCfgDocIndex.docs || {}, meta: flowCfgDocIndex.meta || {} });
        if (idxSource) baseSources.push(idxSource);
      }
      for (const source of flowCfgDocModuleCache.values()) {
        const normalized = normalizeDocSource(source);
        if (normalized) baseSources.push(normalized);
      }
      cfgDocSources = baseSources;
      chargerCfgTreeMetaDepuisDocs();
    }

    async function chargerFlowCfgDocs() {
      flowCfgDocsLoaded = true;
      try {
        await ensureCfgDocsForModule('');
      } catch (err) {
        cfgDocSources = [];
        cfgTreeAliases = [];
        cfgTreeVirtualBranches = [];
        cfgTreeHiddenPaths = [];
      }
    }

    function normalizeDocSource(source) {
      if (!source || typeof source !== 'object') return null;
      const docs = (source.docs && typeof source.docs === 'object') ? source.docs : {};
      const meta = (source.meta && typeof source.meta === 'object')
        ? source.meta
        : ((source._meta && typeof source._meta === 'object') ? source._meta : {});
      return { docs: docs, meta: meta };
    }

    function chargerCfgTreeMetaDepuisDocs() {
      const aliases = [];
      const virtualBranches = [];
      const hiddenPaths = [];
      const seenAliasKeys = new Set();
      const seenBranchKeys = new Set();
      const seenHiddenPaths = new Set();

      for (const src of cfgDocSources) {
        const normalized = normalizeDocSource(src);
        if (!normalized || !normalized.meta) continue;

        const aliasEntries = Array.isArray(normalized.meta.cfg_tree_aliases)
          ? normalized.meta.cfg_tree_aliases
          : [];
        aliasEntries.forEach((entry) => {
          const display = nettoyerNomFlowCfg(entry && entry.display);
          const store = nettoyerNomFlowCfg(entry && entry.store);
          if (!display || !store) return;
          const key = display + '->' + store;
          if (seenAliasKeys.has(key)) return;
          seenAliasKeys.add(key);
          aliases.push({ display: display, store: store });
        });

        const branchEntries = Array.isArray(normalized.meta.cfg_tree_virtual_branches)
          ? normalized.meta.cfg_tree_virtual_branches
          : [];
        branchEntries.forEach((entry) => {
          const display = nettoyerNomFlowCfg(entry && entry.display);
          if (!display || seenBranchKeys.has(display)) return;
          const children = Array.isArray(entry && entry.children)
            ? entry.children.map((child) => nettoyerNomFlowCfg(child)).filter((child) => child.length > 0)
            : [];
          seenBranchKeys.add(display);
          virtualBranches.push({ display: display, children: children });
        });

        const hiddenEntries = Array.isArray(normalized.meta.cfg_tree_hidden_paths)
          ? normalized.meta.cfg_tree_hidden_paths
          : [];
        hiddenEntries.forEach((entry) => {
          const path = nettoyerNomFlowCfg(entry);
          if (!path || seenHiddenPaths.has(path)) return;
          seenHiddenPaths.add(path);
          hiddenPaths.push(path);
        });
      }

      cfgTreeAliases = aliases;
      cfgTreeVirtualBranches = virtualBranches;
      cfgTreeHiddenPaths = hiddenPaths;
    }

    function resolveEnumOptions(enumSetName, sources) {
      const setName = String(enumSetName || '').trim();
      if (!setName) return null;
      for (const src of sources) {
        const normalized = normalizeDocSource(src);
        if (!normalized) continue;
        const enumSets = (normalized.meta && normalized.meta.enum_sets &&
          typeof normalized.meta.enum_sets === 'object')
          ? normalized.meta.enum_sets
          : null;
        if (enumSets && Array.isArray(enumSets[setName])) {
          return enumSets[setName];
        }
      }
      return null;
    }

    function enrichResolvedDoc(doc, sources) {
      if (!doc || typeof doc !== 'object') return null;
      const resolved = cfgDocApplyLocalizedText(doc);
      const enumSetName = (typeof resolved.enum_set === 'string') ? resolved.enum_set.trim() : '';
      const enumOptions = resolveEnumOptions(enumSetName, sources);
      if (enumSetName && Array.isArray(enumOptions)) {
        resolved._enumOptions = cfgDocApplyLocalizedEnumOptions(enumOptions);
      }
      return resolved;
    }

    function poolLogicDeviceSlotSource(source) {
      return source === 'supervisor' ? 'supervisor' : 'flow';
    }

    function poolLogicDeviceSlotRef(slot) {
      const n = Number.parseInt(slot, 10);
      if (!Number.isFinite(n) || n < 0 || n > 15) return '';
      return 'd' + String(n).padStart(2, '0');
    }

    function poolLogicDeviceIoOutputModule(slot) {
      const ref = poolLogicDeviceSlotRef(slot);
      return ref ? ('io/output/' + ref) : '';
    }

    function poolLogicDeviceIoOutputNameKey(slot) {
      const ref = poolLogicDeviceSlotRef(slot);
      return ref ? (ref + '_name') : '';
    }

    function isPoolLogicDeviceSlotField(moduleName, key, doc) {
      const cleanModule = nettoyerNomFlowCfg(moduleName).toLowerCase();
      const cleanKey = String(key || '').trim().toLowerCase();
      if (cleanModule !== 'poollogic/devices') return false;
      if (!cleanKey.endsWith('_slot')) return false;
      return !doc || String(doc.enum_set || '').trim() === 'poollogic_device_slot';
    }

    function poolLogicDeviceSlotLabel(source, slot, fallback) {
      const n = Number.parseInt(slot, 10);
      const ref = poolLogicDeviceSlotRef(n);
      if (!ref) return String(fallback || slot);
      const src = poolLogicDeviceSlotSource(source);
      const cache = poolLogicDeviceIoOutputNames[src] || {};
      const ioName = typeof cache[n] === 'string' ? cache[n].trim() : '';
      const baseName = ioName || String(ioOutputPdmLabels[n] || '').trim();
      const suffix = baseName ? (' [' + baseName + ']') : '';
      return 'pd' + String(n) + ' - ' + ref + suffix;
    }

    function dynamicPoolLogicDeviceSlotOptions(source, enumOptions) {
      const byValue = {};
      if (Array.isArray(enumOptions)) {
        enumOptions.forEach((opt) => {
          if (!opt || typeof opt !== 'object') return;
          const value = Number.parseInt(opt.value, 10);
          if (Number.isFinite(value)) byValue[value] = opt;
        });
      }
      const out = [];
      for (let slot = 0; slot <= 15; slot += 1) {
        const base = byValue[slot] ? Object.assign({}, byValue[slot]) : { value: slot };
        base.value = slot;
        base.label = poolLogicDeviceSlotLabel(source, slot, base.label);
        out.push(base);
      }
      return out;
    }

    function poolLogicFeedbackConfigFieldKind(moduleName, key) {
      const cleanModule = nettoyerNomFlowCfg(moduleName).toLowerCase();
      const cleanKey = String(key || '').trim().toLowerCase();
      if (cleanModule !== 'poollogic/sensors') return '';
      if (cleanKey === 'filtr_fb_io_id' || cleanKey === 'swg_fb_io_id') return 'input';
      if (cleanKey === 'filtr_fb_active_high' || cleanKey === 'swg_fb_active_high') return 'polarity';
      return '';
    }

    function configEnumOptionsForField(source, moduleName, key, doc) {
      const feedbackFieldKind = poolLogicFeedbackConfigFieldKind(moduleName, key);
      if (feedbackFieldKind === 'input') {
        return [
          { value: 65535, label: tr('config.feedback.disabled', 'Désactivé / non câblé') },
          ...poolDigitalIoOptions
        ];
      }
      if (feedbackFieldKind === 'polarity') {
        return [
          { value: true, label: tr('config.feedback.normallyOpen', 'Normalement ouvert (NO) — fermé en marche') },
          { value: false, label: tr('config.feedback.normallyClosed', 'Normalement fermé (NF) — ouvert en marche') }
        ];
      }
      const options = (doc && Array.isArray(doc._enumOptions)) ? doc._enumOptions : null;
      if (!options) return null;
      if (isWaveshareProfile() && isPoolLogicDeviceSlotField(moduleName, key, doc)) {
        return dynamicPoolLogicDeviceSlotOptions(source, options);
      }
      return options;
    }

    async function loadPoolLogicDeviceSlotLabels(source, forceReload) {
      const src = poolLogicDeviceSlotSource(source);
      if (!poolLogicDeviceIoOutputNames[src]) poolLogicDeviceIoOutputNames[src] = {};
      const cache = poolLogicDeviceIoOutputNames[src];
      const fetchOne = async (slot) => {
        if (!forceReload && Object.prototype.hasOwnProperty.call(cache, slot)) return;
        const moduleName = poolLogicDeviceIoOutputModule(slot);
        const nameKey = poolLogicDeviceIoOutputNameKey(slot);
        if (!moduleName || !nameKey) return;
        try {
          const url = src === 'supervisor'
            ? ('/api/supervisorcfg/module?name=' + encodeURIComponent(moduleName))
            : ('/api/flowcfg/module?name=' + encodeURIComponent(moduleName));
          const res = src === 'supervisor'
            ? await fetchWithBusyRetry(url, { cache: 'no-store' })
            : await fetchFlowRemoteQueued(url, { cache: 'no-store' });
          const payload = await res.json().catch(() => null);
          if (!res.ok || !payload || payload.ok !== true || !payload.data || typeof payload.data !== 'object') {
            cache[slot] = '';
            return;
          }
          const raw = payload.data[nameKey];
          cache[slot] = (typeof raw === 'string') ? raw.trim() : '';
        } catch (err) {
          cache[slot] = '';
        }
      };
      const jobs = [];
      for (let slot = 0; slot <= 15; slot += 1) {
        jobs.push(fetchOne(slot));
      }
      await Promise.all(jobs);
    }

    function closeColorPickerPopover() {
      if (!activeColorPickerPopover) return;
      const state = activeColorPickerPopover;
      activeColorPickerPopover = null;
      if (state.outsideHandler) {
        document.removeEventListener('mousedown', state.outsideHandler, true);
      }
      if (state.keyHandler) {
        document.removeEventListener('keydown', state.keyHandler, true);
      }
      if (state.repositionHandler) {
        window.removeEventListener('resize', state.repositionHandler, true);
        window.removeEventListener('scroll', state.repositionHandler, true);
      }
      if (state.popover && state.popover.parentNode) {
        state.popover.parentNode.removeChild(state.popover);
      }
    }

    function enumOptionColor(enumOptions, value) {
      if (!Array.isArray(enumOptions)) return '';
      const currentValue = String(value ?? '');
      for (const opt of enumOptions) {
        if (!opt || typeof opt !== 'object') continue;
        if (String(opt.value) !== currentValue) continue;
        return (typeof opt.color === 'string') ? opt.color.trim() : '';
      }
      return '';
    }

    function positionColorPickerPopover(popover, anchorEl) {
      if (!popover || !anchorEl) return;
      const anchorRect = anchorEl.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();
      const margin = 12;
      let left = anchorRect.left + (anchorRect.width / 2) - (popRect.width / 2);
      let top = anchorRect.bottom + 10;
      left = Math.max(margin, Math.min(left, window.innerWidth - popRect.width - margin));
      if (top + popRect.height > window.innerHeight - margin) {
        top = Math.max(margin, anchorRect.top - popRect.height - 10);
      }
      popover.style.left = Math.round(left) + 'px';
      popover.style.top = Math.round(top) + 'px';
    }

    function updateColorTriggerVisual(trigger, enumOptions, value) {
      if (!trigger) return;
      const color = enumOptionColor(enumOptions, value) || '#FFFFFF';
      trigger.style.background = color;
      trigger.dataset.color = color;
      trigger.setAttribute('aria-label', 'Couleur ' + color);
      trigger.title = color;
    }

    function openColorPickerPopover(trigger, inputEl, enumOptions) {
      if (!trigger || !inputEl || !Array.isArray(enumOptions) || !enumOptions.length) return;
      closeColorPickerPopover();

      const popover = document.createElement('div');
      popover.className = 'color-picker-popover';
      popover.setAttribute('role', 'dialog');
      popover.setAttribute('aria-modal', 'false');

      const grid = document.createElement('div');
      grid.className = 'color-picker-grid';
      const currentValue = String(inputEl.value ?? '');
      enumOptions.forEach((opt) => {
        if (!opt || typeof opt !== 'object') return;
        const color = (typeof opt.color === 'string') ? opt.color.trim() : '';
        if (!color) return;
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'color-picker-swatch';
        swatch.style.background = color;
        swatch.dataset.color = color;
        swatch.setAttribute('aria-label', color);
        swatch.title = color;
        if (String(opt.value) === currentValue) {
          swatch.classList.add('is-selected');
        }
        swatch.addEventListener('click', () => {
          inputEl.value = String(opt.value);
          updateColorTriggerVisual(trigger, enumOptions, inputEl.value);
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
          closeColorPickerPopover();
        });
        grid.appendChild(swatch);
      });
      popover.appendChild(grid);
      document.body.appendChild(popover);
      positionColorPickerPopover(popover, trigger);

      const outsideHandler = (event) => {
        const target = event && event.target;
        if (popover.contains(target) || trigger.contains(target)) return;
        closeColorPickerPopover();
      };
      const keyHandler = (event) => {
        if (event && event.key === 'Escape') {
          closeColorPickerPopover();
        }
      };
      const repositionHandler = () => {
        if (!activeColorPickerPopover || activeColorPickerPopover.popover !== popover) return;
        positionColorPickerPopover(popover, trigger);
      };

      document.addEventListener('mousedown', outsideHandler, true);
      document.addEventListener('keydown', keyHandler, true);
      window.addEventListener('resize', repositionHandler, true);
      window.addEventListener('scroll', repositionHandler, true);
      activeColorPickerPopover = { popover, trigger, outsideHandler, keyHandler, repositionHandler };
    }

    function createColorPickerControl(doc, key, value, enumOptions) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.className = 'control-color-input';
      input.dataset.key = key;
      input.dataset.kind = configNumericKind(doc, value);
      input.dataset.label = (doc && typeof doc.label === 'string' && doc.label.length > 0) ? doc.label : key;
      input.value = String(value ?? '');
      storeConfigFieldInitialValue(input, value);

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'control-color-trigger';
      trigger.setAttribute('aria-haspopup', 'dialog');
      updateColorTriggerVisual(trigger, enumOptions, input.value);
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (activeColorPickerPopover && activeColorPickerPopover.trigger === trigger) {
          closeColorPickerPopover();
          return;
        }
        openColorPickerPopover(trigger, input, enumOptions);
      });

      return { input, trigger };
    }

    function formatConfigValueForDisplay(value, displayFormat) {
      if (displayFormat === 'hex' && typeof value === 'number' && Number.isFinite(value)) {
        const raw = Math.max(0, Math.trunc(value));
        const width = raw <= 0xFF ? 2 : 0;
        const hex = raw.toString(16).toUpperCase();
        return '0x' + (width > 0 ? hex.padStart(width, '0') : hex);
      }
      return String(value ?? '');
    }

    function parseConfigNumericValueDetailed(rawValue, kind, displayFormat) {
      if (displayFormat === 'hex') {
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
          return { ok: true, value: Math.max(0, Math.trunc(rawValue)) };
        }
        const raw = String(rawValue ?? '').trim();
        const normalized = raw.length > 0 ? raw : '0';
        if (!/^(?:0[xX])?[0-9A-Fa-f]+$/.test(normalized)) {
          return {
            ok: false,
            value: 0,
            error: 'utilisez une valeur hexadécimale valide, par exemple 0x77'
          };
        }
        const parsed = Number.parseInt(normalized, 16);
        if (!Number.isFinite(parsed)) {
          return {
            ok: false,
            value: 0,
            error: 'utilisez une valeur hexadécimale valide, par exemple 0x77'
          };
        }
        return { ok: true, value: parsed };
      }
      if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
        return { ok: true, value: kind === 'float' ? rawValue : Math.trunc(rawValue) };
      }
      const raw = String(rawValue ?? '').trim();
      if (kind === 'float') {
        const parsed = Number.parseFloat(raw);
        return { ok: true, value: Number.isFinite(parsed) ? parsed : 0 };
      }
      const parsed = Number.parseInt(raw, 10);
      return { ok: true, value: Number.isFinite(parsed) ? parsed : 0 };
    }

    function parseConfigNumericValue(rawValue, kind, displayFormat) {
      const parsed = parseConfigNumericValueDetailed(rawValue, kind, displayFormat);
      return parsed.value;
    }

    function setConfigFieldValidationState(inputEl, ok, message) {
      if (!inputEl) return ok;
      const row = inputEl.closest('.control-row');
      const validationMessage = ok ? '' : String(message || 'Valeur invalide');
      if (typeof inputEl.setCustomValidity === 'function') {
        inputEl.setCustomValidity(validationMessage);
      }
      if (ok) {
        inputEl.removeAttribute('aria-invalid');
        inputEl.removeAttribute('title');
      } else {
        inputEl.setAttribute('aria-invalid', 'true');
        inputEl.setAttribute('title', validationMessage);
      }
      if (row) {
        row.classList.toggle('is-invalid', !ok);
      }
      return ok;
    }

    function validateConfigFieldValue(inputEl, options) {
      const opts = options || {};
      if (!inputEl) return true;
      const kind = String(inputEl.dataset.kind || '').trim();
      const displayFormat = String(inputEl.dataset.format || '').trim();
      if ((kind !== 'int' && kind !== 'float') || displayFormat !== 'hex') {
        return setConfigFieldValidationState(inputEl, true, '');
      }
      const parsed = parseConfigNumericValueDetailed(inputEl.value, kind, displayFormat);
      const ok = setConfigFieldValidationState(inputEl, !!parsed.ok, parsed.error || '');
      if (!ok && !opts.silent && typeof inputEl.reportValidity === 'function') {
        inputEl.reportValidity();
      }
      return ok;
    }

    function readConfigFieldValueStrict(inputEl) {
      if (!inputEl) return null;
      const kind = String(inputEl.dataset.kind || '').trim();
      const displayFormat = String(inputEl.dataset.format || '').trim();
      if ((kind === 'int' || kind === 'float') && displayFormat === 'hex') {
        const parsed = parseConfigNumericValueDetailed(inputEl.value, kind, displayFormat);
        if (!parsed.ok) {
          validateConfigFieldValue(inputEl);
          const label = String(inputEl.dataset.label || inputEl.dataset.key || 'champ').trim();
          throw new Error(label + ' : ' + parsed.error);
        }
        return parsed.value;
      }
      return readConfigFieldValue(inputEl);
    }

    function updatePrimaryCfgApplyState() {
      if (!flowCfgApplyBtn) return;
      if (flowCfgApplyBtn.hidden) {
        flowCfgApplyBtn.disabled = true;
        flowCfgApplyBtn.removeAttribute('title');
        return;
      }
      const fields = flowCfgFields ? Array.from(flowCfgFields.querySelectorAll('[data-key]')) : [];
      let hasDirty = false;
      let hasInvalid = false;
      fields.forEach((el) => {
        if (!el || typeof el !== 'object') return;
        if (el.dataset.runtimeHidden === '1') return;
        if (!validateConfigFieldValue(el, { silent: true })) {
          hasInvalid = true;
        }
        if (configFieldIsDirty(el)) {
          hasDirty = true;
        }
      });
      flowCfgApplyBtn.disabled = !hasDirty || hasInvalid;
      if (hasInvalid) {
        flowCfgApplyBtn.title = 'Corrigez les champs invalides avant application';
      } else if (!hasDirty) {
        flowCfgApplyBtn.title = 'Aucun changement a appliquer';
      } else {
        flowCfgApplyBtn.title = 'Appliquer les changements';
      }
    }

    function configNumericKind(doc, value) {
      const typeName = String((doc && doc.type) || '').trim().toLowerCase();
      if (typeName === 'float' || typeName === 'double') {
        return 'float';
      }
      if (typeName === 'int32' || typeName === 'uint16' || typeName === 'uint8') {
        return 'int';
      }
      if (typeName === 'bool' || typeName === 'boolean') {
        return 'bool';
      }
      if (typeof value === 'number') {
        return Number.isInteger(value) ? 'int' : 'float';
      }
      if (typeof value === 'boolean') {
        return 'bool';
      }
      return 'string';
    }

    function configFieldNormalizedInitialValue(doc, value) {
      const numericKind = configNumericKind(doc, value);
      if (numericKind === 'int' || numericKind === 'float') {
        const displayFormat = (doc && typeof doc.display_format === 'string') ? doc.display_format : '';
        return parseConfigNumericValue(value, numericKind, displayFormat);
      }
      return value;
    }

    function configIsBindingPortField(moduleName, key) {
      if (String(key || '').trim() !== 'binding_port') return false;
      const modulePath = String(moduleName || '').trim().toLowerCase();
      return /^io\/(?:input\/(?:a\d{2}|i\d{2})|output\/d\d{2})$/.test(modulePath);
    }

    function configNormalizeBindingPortSelectValue(value) {
      const current = String(value ?? '').trim();
      return (current.length === 0 || current === '65535') ? '0' : current;
    }

    function configDocFor(moduleName, key, extraSources) {
      const k = String(key || '').trim();
      const candidates = cfgDocPathCandidates(moduleName);
      if (candidates.length === 0 || !k) return null;

      const sources = [];
      if (Array.isArray(extraSources)) {
        extraSources.forEach((src) => {
          const normalized = normalizeDocSource(src);
          if (normalized) sources.push(normalized);
        });
      }
      cfgDocSources.forEach((src) => {
        const normalized = normalizeDocSource(src);
        if (normalized) sources.push(normalized);
      });

      let merged = null;
      for (const source of sources) {
        const docs = source.docs;
        const wildcard = docs['*/' + k];
        if (wildcard && typeof wildcard === 'object') {
          merged = Object.assign(merged || {}, wildcard);
        }
        candidates.forEach((candidate) => {
          const exact = docs[candidate + '/' + k];
          if (exact && typeof exact === 'object') {
            merged = Object.assign(merged || {}, exact);
          }
        });
      }
      return enrichResolvedDoc(merged, sources);
    }

    function configPathMeta(pathValue) {
      const candidates = cfgDocPathCandidates(pathValue);
      if (candidates.length === 0) return null;
      const sources = [];
      for (const src of cfgDocSources) {
        const normalized = normalizeDocSource(src);
        if (!normalized) continue;
        sources.push(normalized);
      }
      let merged = null;
      for (const normalized of sources) {
        candidates.forEach((candidate) => {
          const exact = normalized.docs[candidate];
          if (exact && typeof exact === 'object') {
            merged = Object.assign(merged || {}, exact);
          }
        });
      }
      return enrichResolvedDoc(merged, sources);
    }

    function isConfigPathHidden(pathValue, source) {
      const cleanPath = nettoyerNomFlowCfg(pathValue);
      if (cfgTreeHiddenPaths.some((hiddenPath) => cfgPathHasPrefix(cleanPath, hiddenPath))) {
        return true;
      }
      const meta = configPathMeta(pathValue);
      return !!(meta && meta.hidden === true);
    }

    function flowCfgApplyPerFieldEnabled(moduleName) {
      const meta = configPathMeta(moduleName);
      return !!(meta && meta.apply_per_field === true);
    }

    function isDigitalInputConfigModule(moduleName) {
      const modulePath = String(moduleName || '').trim().toLowerCase().replace(/\/+$/, '');
      return /^io\/input\/i\d{2}$/.test(modulePath);
    }

    function normalizeDigitalInputConfigKey(moduleName, key) {
      const rawKey = String(key || '').trim().toLowerCase();
      if (!rawKey) return '';
      const modulePath = String(moduleName || '').trim().toLowerCase().replace(/\/+$/, '');
      if (modulePath && rawKey.startsWith(modulePath + '/')) {
        return rawKey.slice(modulePath.length + 1);
      }
      const slashIdx = rawKey.lastIndexOf('/');
      return slashIdx >= 0 ? rawKey.slice(slashIdx + 1) : rawKey;
    }

    function parseDigitalInputModeValue(rawValue) {
      if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return rawValue;
      const txt = String(rawValue ?? '').trim().toLowerCase();
      if (!txt) return NaN;
      if (txt === '0') return 0;
      if (txt === '1') return 1;
      if (txt.includes('etat')) return 0;
      if (txt.includes('compteur')) return 1;
      return NaN;
    }

    function isCounterModeOnlyConfigField(moduleName, key, doc) {
      if (!isDigitalInputConfigModule(moduleName)) return false;
      const cleanKey = normalizeDigitalInputConfigKey(moduleName, key);
      if (!cleanKey || cleanKey === 'mode') return false;
      if (cleanKey === 'counter_total' || cleanKey === 'edge_mode') return true;
      if (/^i\d{2}_(?:c0|prec)$/.test(cleanKey)) return true;
      const helpTxt = String((doc && doc.help) || '').toLowerCase();
      if (!helpTxt) return false;
      return helpTxt.includes('mode compteur') || helpTxt.includes('compteur d\'impulsion');
    }

    function resetPrimaryCfgEditor(message) {
      supCfgCurrentPdmExtension = null;
      flowCfgFields.innerHTML = '';
      flowCfgApplyBtn.hidden = false;
      flowCfgApplyBtn.disabled = true;
      updateFiltrationRecalcActionVisibility();
      if (message) {
        flowCfgStatus.textContent = message;
      }
    }

    function resetFlowCfgEditor(message) {
      flowCfgCurrentModule = '';
      flowCfgCurrentData = {};
      flowCfgCurrentPdmExtension = null;
      resetPrimaryCfgEditor(message);
    }

    function storeConfigFieldInitialValue(el, value) {
      if (!el) return;
      el.dataset.initialValue = JSON.stringify(value);
    }

    function readConfigFieldValue(el) {
      if (!el) return null;
      const kind = String(el.dataset.kind || '').trim();
      const displayFormat = String(el.dataset.format || '').trim();
      if (kind === 'bool') {
        if (el.tagName === 'SELECT') {
          const raw = String(el.value ?? '').trim().toLowerCase();
          return raw === 'true' || raw === '1' || raw === 'on';
        }
        return !!el.checked;
      }
      if (kind === 'int' || kind === 'float') {
        return parseConfigNumericValue(el.value, kind, displayFormat);
      }
      const masked = el.dataset.masked === '1';
      const raw = String(el.value ?? '');
      if (masked && raw.length === 0) {
        try {
          return JSON.parse(el.dataset.initialValue || 'null');
        } catch (err) {
          return '';
        }
      }
      return raw;
    }

    function configFieldIsDirty(el) {
      if (!el) return false;
      let initialValue = null;
      try {
        initialValue = JSON.parse(el.dataset.initialValue || 'null');
      } catch (err) {
        initialValue = null;
      }
      return JSON.stringify(readConfigFieldValue(el)) !== JSON.stringify(initialValue);
    }

    function flowCfgLocalApplyMessage(message) {
      return String(message || '').trim() || tr('cfg.apply.busy', 'Application de la configuration en cours...');
    }

    function flowCfgSetControlsLocked(locked) {
      const page = document.getElementById('page-control');
      if (!page) return;
      const nodes = page.querySelectorAll('.cfg-tree button,.control-fields input,.control-fields select,.control-fields textarea,.control-field-apply,#flowCfgApply,#flowCfgRefresh');
      nodes.forEach((node) => {
        if (!node) return;
        if (locked) {
          if (!Object.prototype.hasOwnProperty.call(node.dataset, 'cfgApplyPrevDisabled')) {
            node.dataset.cfgApplyPrevDisabled = node.disabled ? '1' : '0';
          }
          node.disabled = true;
          return;
        }
        if (!Object.prototype.hasOwnProperty.call(node.dataset, 'cfgApplyPrevDisabled')) return;
        node.disabled = node.dataset.cfgApplyPrevDisabled === '1';
        delete node.dataset.cfgApplyPrevDisabled;
      });
    }

    function setFlowCfgLocalApplyBusy(active, message) {
      flowCfgLocalApplyBusyDepth = Math.max(0, flowCfgLocalApplyBusyDepth + (active ? 1 : -1));
      const busy = flowCfgLocalApplyBusyDepth > 0;
      const text = flowCfgLocalApplyMessage(message);
      const page = document.getElementById('page-control');
      if (page) {
        page.classList.toggle('is-config-applying', busy);
        page.setAttribute('aria-busy', busy ? 'true' : 'false');
      }
      if (flowCfgApplyBusy) {
        flowCfgApplyBusy.hidden = !busy;
        const label = flowCfgApplyBusy.querySelector('span:last-child');
        if (label) label.textContent = text;
      }
      if (flowCfgStatus && busy) {
        flowCfgStatus.textContent = text;
      }
      if (flowCfgApplyBtn) {
        if (busy) {
          if (!flowCfgApplyBtnSavedText) flowCfgApplyBtnSavedText = flowCfgApplyBtn.textContent || '';
          flowCfgApplyBtn.classList.add('is-pending');
          flowCfgApplyBtn.textContent = tr('cfg.apply.busyShort', 'Application...');
        } else {
          flowCfgApplyBtn.classList.remove('is-pending');
          if (flowCfgApplyBtnSavedText) {
            flowCfgApplyBtn.textContent = flowCfgApplyBtnSavedText;
            flowCfgApplyBtnSavedText = '';
          }
        }
      }
      flowCfgSetControlsLocked(busy);
      if (!busy) {
        updatePrimaryCfgApplyState();
        document.querySelectorAll('.control-field-apply').forEach((button) => {
          const row = button && button.closest('.control-row');
          const input = row && row.querySelector('input.control-input,select.control-input,textarea.control-input');
          if (input) updateControlFieldApplyState(input, button);
        });
      }
    }

    function updateControlFieldApplyState(inputEl, applyBtn) {
      if (!inputEl || !applyBtn) return;
      const valid = validateConfigFieldValue(inputEl, { silent: true });
      const dirty = configFieldIsDirty(inputEl);
      const busy = flowCfgLocalApplyBusyDepth > 0;
      applyBtn.disabled = busy || !dirty || !valid;
      applyBtn.classList.toggle('is-dirty', dirty && valid);
      if (!busy) applyBtn.classList.remove('is-pending');
      applyBtn.title = !valid
        ? 'Corrigez ce champ avant application'
        : (busy ? tr('cfg.apply.busy', 'Application de la configuration en cours...') : (dirty ? 'Appliquer ce changement' : 'Aucun changement a appliquer'));
      applyBtn.setAttribute('aria-label', applyBtn.title);
      const row = inputEl.closest('.control-row');
      if (row) row.classList.toggle('is-dirty', dirty);
    }

    function buildFlowCfgSingleFieldPatchJson(moduleName, inputEl) {
      if (!moduleName || !inputEl) throw new Error('champ non disponible');
      const key = String(inputEl.dataset.key || '').trim();
      if (!key) throw new Error('cle de configuration absente');
      const targetModule = nettoyerNomFlowCfg(inputEl.dataset.module || moduleName);
      if (!targetModule) throw new Error('branche de configuration absente');
      const patch = {};
      patch[targetModule] = {
        [key]: readConfigFieldValueStrict(inputEl)
      };
      return JSON.stringify(patch);
    }

    function renderConfigFields(containerEl, moduleName, dataObj, options) {
      const opts = options || {};
      const appendMode = !!opts.append;
      if (!appendMode) {
        closeColorPickerPopover();
        containerEl.innerHTML = '';
      }
      const data = (dataObj && typeof dataObj === 'object') ? dataObj : {};
      const perFieldApply = !!opts.perFieldApply;
      const controlsPrimaryPane = !!opts.controlsPrimaryPane;
      const onApplyField = typeof opts.onApplyField === 'function' ? opts.onApplyField : null;
      const sectionTitle = String(opts.sectionTitle || '').trim();
      let modeFieldInputEl = null;
      const visibilityEntries = [];
      if (controlsPrimaryPane) {
        flowCfgApplyBtn.hidden = perFieldApply;
      }
      const mqttFieldOrder = [
        'deviceName',
        'baseTopic',
        'enabled',
        'host',
        'port',
        'user',
        'pass',
        'topicDeviceId'
      ];
      const poolSensorFieldOrder = [
        'ph_io_id',
        'dis_io_id',
        'psi_io_id',
        'wat_temp_io_id',
        'air_temp_io_id',
        'pool_lvl_io_id',
        'ph_lvl_io_id',
        'chl_lvl_io_id',
        'filtr_fb_io_id',
        'filtr_fb_active_high',
        'swg_fb_io_id',
        'swg_fb_active_high',
        'psi_monitoring'
      ];
      const cleanModuleName = nettoyerNomFlowCfg(moduleName).toLowerCase();
      const preferredFieldOrder = cleanModuleName === 'mqtt'
        ? mqttFieldOrder
        : (cleanModuleName === 'poollogic/sensors' ? poolSensorFieldOrder : null);
      const keys = Object.keys(data).sort((left, right) => {
        if (!preferredFieldOrder) return left.localeCompare(right);
        const leftIndex = preferredFieldOrder.indexOf(left);
        const rightIndex = preferredFieldOrder.indexOf(right);
        if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
        if (leftIndex >= 0) return -1;
        if (rightIndex >= 0) return 1;
        return left.localeCompare(right);
      });
      if (sectionTitle && keys.length > 0) {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'control-section-title';
        sectionEl.textContent = sectionTitle;
        containerEl.appendChild(sectionEl);

        const dividerEl = document.createElement('div');
        dividerEl.className = 'control-divider';
        containerEl.appendChild(dividerEl);
      }
      if (keys.length === 0) {
        if (appendMode) return;
        const row = document.createElement('div');
        row.className = 'control-row';
        const label = document.createElement('span');
        label.className = 'control-label';
        label.textContent = 'Aucun champ configurable dans cette branche.';
        row.appendChild(label);
        containerEl.appendChild(row);
        if (controlsPrimaryPane && !perFieldApply) {
          updatePrimaryCfgApplyState();
        }
        return;
      }

      for (const key of keys) {
        const value = data[key];
        const row = document.createElement('div');
        row.className = 'control-row';

        const doc = configDocFor(moduleName, key, []);
        const labelWrap = document.createElement('div');
        labelWrap.className = 'control-label-wrap';
        const label = document.createElement('span');
        label.className = 'control-label';
        label.textContent = (doc && typeof doc.label === 'string' && doc.label.length > 0) ? doc.label : key;
        labelWrap.appendChild(label);

        const helpTxt = (doc && typeof doc.help === 'string') ? doc.help : '';
        if (helpTxt.length > 0) {
          const help = document.createElement('span');
          help.className = 'control-help';
          help.textContent = helpTxt;
          labelWrap.appendChild(help);
        }
        row.appendChild(labelWrap);

        const enumOptions = configEnumOptionsForField(opts.source || cfgTreeSelectedSource, moduleName, key, doc);
        let inputEl = null;
        const valueWrap = document.createElement('div');
        valueWrap.className = 'control-value-wrap';

        if (enumOptions && enumOptions.length > 0 && enumOptions.some((opt) => opt && typeof opt.color === 'string' && opt.color.trim().length > 0)) {
          const colorControl = createColorPickerControl(doc, key, value, enumOptions);
          inputEl = colorControl.input;
          inputEl.dataset.module = moduleName;
          valueWrap.classList.add('control-value-wrap-color');
          valueWrap.appendChild(colorControl.input);
          valueWrap.appendChild(colorControl.trigger);
        } else if (enumOptions && enumOptions.length > 0) {
          const select = document.createElement('select');
          select.className = 'control-input';
          select.dataset.key = key;
          select.dataset.kind = configNumericKind(doc, value);
          if (doc && typeof doc.display_format === 'string') {
            select.dataset.format = doc.display_format;
          }
          const isBindingPortField = configIsBindingPortField(moduleName, key);
          const currentValue = isBindingPortField ? configNormalizeBindingPortSelectValue(value) : String(value);
          let hasSelectedOption = false;
          enumOptions.forEach((opt) => {
            if (!opt || typeof opt !== 'object') return;
            const optionEl = document.createElement('option');
            optionEl.value = String(opt.value);
            optionEl.textContent = (typeof opt.label === 'string' && opt.label.length > 0)
              ? opt.label
              : String(opt.value);
            if (typeof opt.color === 'string' && opt.color.trim().length > 0) {
              optionEl.dataset.color = opt.color.trim();
            }
            if (optionEl.value === currentValue) {
              optionEl.selected = true;
              hasSelectedOption = true;
            }
            select.appendChild(optionEl);
          });
          if (!hasSelectedOption && currentValue.length > 0) {
            const placeholder = document.createElement('option');
            placeholder.value = currentValue;
            placeholder.textContent = isBindingPortField
              ? ('Port inconnu (' + currentValue + ')')
              : 'Valeur inconnue';
            placeholder.selected = true;
            select.insertBefore(placeholder, select.firstChild);
          }
          storeConfigFieldInitialValue(select, isBindingPortField ? parseConfigNumericValue(currentValue, 'int', '') : value);
          inputEl = select;
          inputEl.dataset.module = moduleName;
          valueWrap.appendChild(select);
        } else if (typeof value === 'boolean') {
          row.classList.add('control-row-bool');
          const sw = document.createElement('label');
          sw.className = 'md3-switch';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = value;
          input.dataset.key = key;
          input.dataset.kind = 'bool';
          input.setAttribute('aria-label', label.textContent || key);
          const track = document.createElement('span');
          track.className = 'md3-track';
          const thumb = document.createElement('span');
          thumb.className = 'md3-thumb';
          storeConfigFieldInitialValue(input, value);
          sw.appendChild(input);
          sw.appendChild(track);
          sw.appendChild(thumb);
          inputEl = input;
          inputEl.dataset.module = moduleName;
          valueWrap.classList.add('control-value-wrap-bool');
          valueWrap.appendChild(sw);
        } else if (configNumericKind(doc, value) !== 'string') {
          const input = document.createElement('input');
          input.className = 'control-input';
          const displayFormat = (doc && typeof doc.display_format === 'string') ? doc.display_format : '';
          const numericKind = configNumericKind(doc, value);
          input.type = displayFormat === 'hex' ? 'text' : 'number';
          input.value = formatConfigValueForDisplay(
            configFieldNormalizedInitialValue(doc, value),
            displayFormat
          );
          if (displayFormat !== 'hex') {
            input.step = (numericKind === 'float') ? '0.001' : '1';
          }
          input.dataset.key = key;
          input.dataset.kind = numericKind;
          input.dataset.label = label.textContent || key;
          if (displayFormat) {
            input.dataset.format = displayFormat;
          }
          storeConfigFieldInitialValue(input, configFieldNormalizedInitialValue(doc, value));
          inputEl = input;
          inputEl.dataset.module = moduleName;
          valueWrap.appendChild(input);
        } else {
          const isSecret = /pass|token|secret/i.test(key);
          const textValue = String(value ?? '');
          const input = document.createElement('input');
          input.className = 'control-input';
          input.type = isSecret ? 'password' : 'text';
          if (isSecret && textValue === '***') {
            input.value = '';
            input.placeholder = 'Conserver (masqué)';
            input.dataset.masked = '1';
          } else {
            input.value = textValue;
            input.dataset.masked = '0';
          }
          input.dataset.key = key;
          input.dataset.kind = 'string';
          input.dataset.label = label.textContent || key;
          if (isSecret) {
            input.autocomplete = 'new-password';
            input.addEventListener('input', () => {
              input.dataset.masked = '0';
            });
          }
          if (isSecret && String(moduleName).toLowerCase() === 'mqtt' && /(^|\/)pass$/i.test(key)) {
            input.maxLength = 63;
          }
          storeConfigFieldInitialValue(input, value);
          inputEl = input;
          inputEl.dataset.module = moduleName;
          if (isSecret) {
            const secretWrap = document.createElement('span');
            secretWrap.className = 'control-secret-input-wrap';
            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'password-toggle control-secret-toggle';
            mettreAJourEtatVisibiliteMotDePasse(
              input,
              toggleBtn,
              'Afficher le mot de passe saisi',
              'Masquer le mot de passe saisi'
            );
            toggleBtn.addEventListener('click', () => {
              basculerVisibiliteMotDePasse(
                input,
                toggleBtn,
                'Afficher le mot de passe saisi',
                'Masquer le mot de passe saisi'
              );
              input.focus();
            });
            secretWrap.appendChild(input);
            secretWrap.appendChild(toggleBtn);
            valueWrap.appendChild(secretWrap);
          } else {
            valueWrap.appendChild(input);
          }
        }

        if (normalizeDigitalInputConfigKey(moduleName, key) === 'mode') {
          modeFieldInputEl = inputEl;
        }

        if (perFieldApply && inputEl) {
          const applyBtn = document.createElement('button');
          applyBtn.type = 'button';
          applyBtn.className = 'control-field-apply';
          applyBtn.innerHTML = deps.iconCheckText();
          applyBtn.disabled = true;
          applyBtn.title = 'Aucun changement a appliquer';
          applyBtn.setAttribute('aria-label', applyBtn.title);
          applyBtn.addEventListener('click', async () => {
            if (onApplyField) {
              await onApplyField(inputEl, applyBtn);
            }
          });

          const syncApplyState = () => updateControlFieldApplyState(inputEl, applyBtn);
          inputEl.addEventListener('input', syncApplyState);
          inputEl.addEventListener('change', syncApplyState);
          updateControlFieldApplyState(inputEl, applyBtn);
          valueWrap.appendChild(applyBtn);
        } else if (controlsPrimaryPane && inputEl) {
          const syncPrimaryState = () => {
            validateConfigFieldValue(inputEl, { silent: true });
            updatePrimaryCfgApplyState();
          };
          inputEl.addEventListener('input', syncPrimaryState);
          inputEl.addEventListener('change', syncPrimaryState);
          validateConfigFieldValue(inputEl, { silent: true });
        }

        row.appendChild(valueWrap);
        containerEl.appendChild(row);
        visibilityEntries.push({ row, inputEl, key, doc });
      }

      if (isDigitalInputConfigModule(moduleName) && visibilityEntries.length > 0) {
        const readModeValue = () => {
          if (modeFieldInputEl) {
            const parsedInputMode = parseDigitalInputModeValue(readConfigFieldValue(modeFieldInputEl));
            if (Number.isFinite(parsedInputMode)) return parsedInputMode;
            if (modeFieldInputEl.tagName === 'SELECT' && modeFieldInputEl.selectedIndex >= 0) {
              const selectedOption = modeFieldInputEl.options[modeFieldInputEl.selectedIndex];
              const parsedLabelMode = parseDigitalInputModeValue(selectedOption ? selectedOption.textContent : '');
              if (Number.isFinite(parsedLabelMode)) return parsedLabelMode;
            }
          }
          const directMode = parseDigitalInputModeValue(data.mode);
          if (Number.isFinite(directMode)) return directMode;
          const modeCandidateKey = Object.keys(data).find((candidateKey) =>
            normalizeDigitalInputConfigKey(moduleName, candidateKey) === 'mode'
          );
          if (modeCandidateKey) {
            return parseDigitalInputModeValue(data[modeCandidateKey]);
          }
          return NaN;
        };
        const applyConditionalVisibility = () => {
          const modeValue = readModeValue();
          const hideCounterOnly = Number.isFinite(modeValue) && modeValue === 0;
          visibilityEntries.forEach((entry) => {
            const shouldHide = hideCounterOnly && isCounterModeOnlyConfigField(moduleName, entry.key, entry.doc);
            entry.row.hidden = shouldHide;
            if (entry.inputEl) {
              entry.inputEl.dataset.runtimeHidden = shouldHide ? '1' : '0';
              entry.inputEl.disabled = !!shouldHide;
            }
          });
          if (controlsPrimaryPane && !perFieldApply) {
            updatePrimaryCfgApplyState();
          }
        };
        applyConditionalVisibility();
        if (modeFieldInputEl) {
          modeFieldInputEl.addEventListener('input', applyConditionalVisibility);
          modeFieldInputEl.addEventListener('change', applyConditionalVisibility);
        }
      }

      if (nettoyerNomFlowCfg(moduleName).toLowerCase() === 'poollogic/sensors' && visibilityEntries.length > 0) {
        ['filtr', 'swg'].forEach((prefix) => {
          const inputEntry = visibilityEntries.find((entry) => entry.key === prefix + '_fb_io_id');
          const polarityEntry = visibilityEntries.find((entry) => entry.key === prefix + '_fb_active_high');
          if (!inputEntry || !inputEntry.inputEl || !polarityEntry || !polarityEntry.inputEl) return;
          const applyFeedbackVisibility = () => {
            const disabled = Number(readConfigFieldValue(inputEntry.inputEl)) === 65535;
            polarityEntry.row.hidden = disabled;
            polarityEntry.inputEl.dataset.runtimeHidden = disabled ? '1' : '0';
            polarityEntry.inputEl.disabled = disabled;
            if (controlsPrimaryPane && !perFieldApply) updatePrimaryCfgApplyState();
          };
          inputEntry.inputEl.addEventListener('input', applyFeedbackVisibility);
          inputEntry.inputEl.addEventListener('change', applyFeedbackVisibility);
          applyFeedbackVisibility();
        });
      }

      if (controlsPrimaryPane && !perFieldApply) {
        updatePrimaryCfgApplyState();
      }
    }

    function renderFlowCfgFields(dataObj) {
      renderConfigFields(flowCfgFields, flowCfgCurrentModule, dataObj, {
        source: 'flow',
        controlsPrimaryPane: true,
        perFieldApply: flowCfgApplyPerFieldEnabled(flowCfgCurrentModule),
        onApplyField: appliquerFlowCfgField
      });
    }

    function renderFlowCfgFieldsWithExtensions(dataObj) {
      renderFlowCfgFields(dataObj);
      if (flowCfgCurrentPdmExtension &&
          flowCfgCurrentPdmExtension.data &&
          Object.keys(flowCfgCurrentPdmExtension.data).length > 0) {
        renderConfigFields(flowCfgFields, flowCfgCurrentPdmExtension.module, flowCfgCurrentPdmExtension.data, {
          append: true,
          source: 'flow',
          sectionTitle: flowCfgPdmSectionTitle(flowCfgCurrentModule, dataObj),
          controlsPrimaryPane: true,
          perFieldApply: flowCfgApplyPerFieldEnabled(flowCfgCurrentModule),
          onApplyField: appliquerFlowCfgField
        });
      }
      updatePrimaryCfgApplyState();
    }

    function flowCfgIoOutputSlotIndex(moduleName, dataObj) {
      const cleanModule = nettoyerNomFlowCfg(moduleName).toLowerCase();
      const match = cleanModule.match(/^(?:io\/output\/)?d(\d{1,2})$/);
      if (match) {
        const slot = Number.parseInt(match[1], 10);
        if (Number.isFinite(slot) && slot >= 0 && slot <= 15) return slot;
      }
      const data = (dataObj && typeof dataObj === 'object') ? dataObj : null;
      if (data) {
        const key = Object.keys(data).find((candidate) => /^d\d{2}_name$/i.test(String(candidate || '').trim()));
        if (key) {
          const keyMatch = String(key).match(/^d(\d{2})_name$/i);
          const slot = keyMatch ? Number.parseInt(keyMatch[1], 10) : -1;
          if (Number.isFinite(slot) && slot >= 0 && slot <= 15) return slot;
        }
      }
      return -1;
    }

    function flowCfgPdmModuleForIoOutput(moduleName, dataObj) {
      const slot = flowCfgIoOutputSlotIndex(moduleName, dataObj);
      if (slot < 0) return '';
      return 'pdm/pd' + String(slot);
    }

    function flowCfgPdmSectionTitle(moduleName, dataObj) {
      const slot = flowCfgIoOutputSlotIndex(moduleName, dataObj);
      if (slot < 0) return 'Extension PoolDevice';
      const label = String(ioOutputPdmLabels[slot] || '').trim();
      if (!label) return 'Extension PoolDevice (pd' + String(slot) + ')';
      return 'Extension PoolDevice - ' + label + ' (pd' + String(slot) + ')';
    }

    async function loadFlowCfgPdmExtensionData(moduleName, dataObj) {
      const pdmModule = flowCfgPdmModuleForIoOutput(moduleName, dataObj);
      if (!pdmModule) return null;
      try {
        const res = await fetchFlowRemoteQueued(
          '/api/flowcfg/module?name=' + encodeURIComponent(pdmModule),
          { cache: 'no-store' }
        );
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.ok !== true || typeof data.data !== 'object') {
          return null;
        }
        return {
          module: pdmModule,
          data: data.data
        };
      } catch (err) {
        return null;
      }
    }

    async function loadPrimarySupervisorPdmExtensionData(moduleName, dataObj) {
      if (!isWaveshareProfile()) return null;
      const pdmModule = flowCfgPdmModuleForIoOutput(moduleName, dataObj);
      if (!pdmModule) return null;
      try {
        const res = await fetchWithBusyRetry(
          '/api/supervisorcfg/module?name=' + encodeURIComponent(pdmModule),
          { cache: 'no-store' }
        );
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.ok !== true || typeof data.data !== 'object') {
          return null;
        }
        return {
          module: pdmModule,
          data: data.data
        };
      } catch (err) {
        return null;
      }
    }

    function renderPrimarySupervisorCfgFields(dataObj) {
      renderConfigFields(flowCfgFields, supCfgCurrentModule, dataObj, {
        source: 'supervisor',
        controlsPrimaryPane: true,
        perFieldApply: flowCfgApplyPerFieldEnabled(supCfgCurrentModule),
        onApplyField: appliquerPrimaryCfgField
      });
    }

    function renderPrimarySupervisorCfgFieldsWithExtensions(dataObj) {
      renderPrimarySupervisorCfgFields(dataObj);
      if (supCfgCurrentPdmExtension &&
          supCfgCurrentPdmExtension.data &&
          Object.keys(supCfgCurrentPdmExtension.data).length > 0) {
        renderConfigFields(flowCfgFields, supCfgCurrentPdmExtension.module, supCfgCurrentPdmExtension.data, {
          append: true,
          source: 'supervisor',
          sectionTitle: flowCfgPdmSectionTitle(supCfgCurrentModule, dataObj),
          controlsPrimaryPane: true,
          perFieldApply: flowCfgApplyPerFieldEnabled(supCfgCurrentModule),
          onApplyField: appliquerPrimaryCfgField
        });
      }
      updatePrimaryCfgApplyState();
    }

    function buildPatchJsonFromFields(fieldsContainer, moduleName) {
      if (!moduleName) throw new Error('branche non sélectionnée');
      const patch = {};
      const fields = fieldsContainer.querySelectorAll('[data-key]');
      fields.forEach((el) => {
        if (el.dataset.runtimeHidden === '1') return;
        const targetModule = nettoyerNomFlowCfg(el.dataset.module || moduleName);
        if (!targetModule) return;
        const key = el.dataset.key;
        const kind = el.dataset.kind;
        if (!key || !kind) return;
        if (!patch[targetModule]) patch[targetModule] = {};
        const modulePatch = patch[targetModule];
        if (kind === 'bool') {
          modulePatch[key] = readConfigFieldValueStrict(el);
          return;
        }
        if (kind === 'int') {
          modulePatch[key] = readConfigFieldValueStrict(el);
          return;
        }
        if (kind === 'float') {
          modulePatch[key] = readConfigFieldValueStrict(el);
          return;
        }
        const masked = el.dataset.masked === '1';
        const raw = String(el.value ?? '');
        if (masked && raw.length === 0) return;
        modulePatch[key] = raw;
      });
      return JSON.stringify(patch);
    }

    function buildFlowCfgPatchJson() {
      return buildPatchJsonFromFields(flowCfgFields, flowCfgCurrentModule);
    }

    function buildPrimaryCfgPatchJson() {
      if (cfgTreeSelectedSource === 'supervisor') {
        return buildPatchJsonFromFields(flowCfgFields, supCfgCurrentModule);
      }
      return buildPatchJsonFromFields(flowCfgFields, flowCfgCurrentModule);
    }

    function updateFiltrationRecalcActionVisibility() {
      if (!flowCfgFiltrationRecalcBtn) return;
      const visible =
        cfgTreeSelectedSource === 'flow'
        && nettoyerNomFlowCfg(flowCfgCurrentModule) === 'poollogic/filtration';
      flowCfgFiltrationRecalcBtn.hidden = !visible;
      flowCfgFiltrationRecalcBtn.disabled = !visible;
    }

    async function chargerFlowCfgModule(moduleName) {
      beginFlowCfgLoading('Chargement de la branche distante...', { tree: false, detail: true });
      const m = nettoyerNomFlowCfg(moduleName);
      try {
        if (!m) {
          resetFlowCfgEditor('Aucune branche sélectionnée.');
          return;
        }
        const res = await fetchFlowRemoteQueued(
          '/api/flowcfg/module?name=' + encodeURIComponent(m),
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (!res.ok || !data || data.ok !== true || typeof data.data !== 'object') {
          throw new Error('lecture module impossible');
        }
        await ensureCfgDocsForModule(m);
        const pdmModule = flowCfgPdmModuleForIoOutput(m, data.data);
        if (pdmModule) {
          await ensureCfgDocsForModule(pdmModule);
        }
        if (isWaveshareProfile() && m === 'poollogic/devices') {
          await loadPoolLogicDeviceSlotLabels('flow', true);
        }
        flowCfgCurrentModule = m;
        flowCfgCurrentData = data.data;
        flowCfgCurrentPdmExtension = await loadFlowCfgPdmExtensionData(m, flowCfgCurrentData);
        renderFlowCfgFieldsWithExtensions(flowCfgCurrentData);
        flowCfgStatus.textContent = data.truncated
          ? tr('config.branchLoadedTruncated', 'Branche chargée (tronquée, buffer distant atteint).')
          : tr('config.branchLoaded', 'Branche chargée.');
      } catch (err) {
        flowCfgCurrentPdmExtension = null;
        resetFlowCfgEditor('Chargement branche échoué: ' + err);
      } finally {
        endFlowCfgLoading({ tree: false, detail: true });
      }
    }

    async function chargerPrimarySupervisorCfgModule(moduleName) {
      beginFlowCfgLoading('Chargement de la branche locale...', { tree: false, detail: true });
      const m = nettoyerNomFlowCfg(moduleName);
      try {
        if (!m) {
          supCfgCurrentModule = '';
          supCfgCurrentData = {};
          supCfgCurrentPdmExtension = null;
          resetPrimaryCfgEditor('Aucune branche locale sélectionnée.');
          return;
        }
        const res = await fetchWithBusyRetry('/api/supervisorcfg/module?name=' + encodeURIComponent(m), { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data || data.ok !== true || typeof data.data !== 'object') {
          throw new Error('lecture module supervisor impossible');
        }
        await ensureCfgDocsForModule(m);
        const pdmModule = isWaveshareProfile() ? flowCfgPdmModuleForIoOutput(m, data.data) : '';
        if (pdmModule) {
          await ensureCfgDocsForModule(pdmModule);
        }
        if (isWaveshareProfile() && m === 'poollogic/devices') {
          await loadPoolLogicDeviceSlotLabels('supervisor', true);
        }
        supCfgCurrentModule = m;
        supCfgCurrentData = data.data;
        supCfgCurrentPdmExtension = await loadPrimarySupervisorPdmExtensionData(m, supCfgCurrentData);
        renderPrimarySupervisorCfgFieldsWithExtensions(supCfgCurrentData);
        flowCfgStatus.textContent = data.truncated
          ? 'Branche locale chargée (tronquée, buffer atteint).'
          : 'Branche locale chargée.';
      } catch (err) {
        supCfgCurrentModule = '';
        supCfgCurrentData = {};
        supCfgCurrentPdmExtension = null;
        resetPrimaryCfgEditor('Chargement branche locale échoué: ' + err);
      } finally {
        endFlowCfgLoading({ tree: false, detail: true });
      }
    }

    function markCfgSourceUnavailable(source) {
      const emptyRootNode = {
        prefix: '',
        hasExact: false,
        children: []
      };
      if (source === 'supervisor') {
        supCfgChildrenCache = { [cfgCacheKey('')]: emptyRootNode };
        supCfgExpandedNodes = new Set();
        supCfgTreePath = '';
        supCfgCurrentModule = '';
        supCfgCurrentData = {};
        return;
      }
      flowCfgChildrenCache = { [cfgCacheKey('')]: emptyRootNode };
      flowCfgExpandedNodes = new Set();
      flowCfgPath = [];
      flowCfgCurrentModule = '';
      flowCfgCurrentData = {};
    }

    function formatCfgLoadStatus(result, finalMessage) {
      if (result && !result.flowLoaded && result.supervisorLoaded) {
        return finalMessage
          ? 'flow.io indisponible pour le moment. Configuration Supervisor disponible. Nouvelle tentative automatique...'
          : 'Configuration Supervisor disponible. Nouvelle tentative pour flow.io.';
      }
      if (result && result.flowLoaded && !result.supervisorLoaded) {
        return finalMessage
          ? 'Configuration flow.io disponible. Configuration Supervisor indisponible. Nouvelle tentative automatique...'
          : 'Configuration flow.io disponible. Nouvelle tentative pour Supervisor.';
      }
      return finalMessage
        ? 'flow.io indisponible pour le moment. Nouvelle tentative automatique...'
        : 'flow.io se prépare... nouvelle tentative.';
    }

    async function chargerFlowCfgModules(forceReload) {
      const force = !!forceReload;
      if (force) {
        flowCfgChildrenCache = {};
        flowCfgExpandedNodes = new Set();
        supCfgChildrenCache = {};
        supCfgExpandedNodes = new Set();
      }

      if (!deps.getWebRemoteConfigEnabled()) {
        if (force) {
          flowCfgChildrenCache = {};
          flowCfgExpandedNodes = new Set();
        }
        markCfgSourceUnavailable('flow');
        let supervisorLoaded = false;
        try {
          await ensureCfgPathLoaded('supervisor', '', force);
          supervisorLoaded = true;
        } catch (err) {
          markCfgSourceUnavailable('supervisor');
        }
        if (supervisorLoaded) {
          await selectFlowCfgPath('supervisor', currentCfgTreePath('supervisor'), force);
        } else {
          cfgTreeSelectedSource = 'supervisor';
          renderFlowCfgCurrentPath('supervisor', '', null);
          renderFlowCfgTree();
          resetPrimaryCfgEditor('Aucune branche disponible.');
        }
        return {
          ok: supervisorLoaded,
          flowLoaded: false,
          supervisorLoaded
        };
      }

      const rootLoads = await Promise.allSettled([
        ensureCfgPathLoaded('flow', '', force),
        ensureCfgPathLoaded('supervisor', '', force)
      ]);
      const flowLoaded = rootLoads[0].status === 'fulfilled';
      const supervisorLoaded = rootLoads[1].status === 'fulfilled';

      if (!flowLoaded) {
        markCfgSourceUnavailable('flow');
      }
      if (!supervisorLoaded) {
        markCfgSourceUnavailable('supervisor');
      }

      const currentSource = cfgTreeSelectedSource === 'supervisor' ? 'supervisor' : 'flow';
      let nextSource = currentSource;
      if (currentSource === 'flow' && !flowLoaded && supervisorLoaded) {
        nextSource = 'supervisor';
      } else if (currentSource === 'supervisor' && !supervisorLoaded && flowLoaded) {
        nextSource = 'flow';
      }

      const nextPath = nextSource === currentSource
        ? nettoyerNomFlowCfg(currentCfgTreePath(currentSource))
        : '';
      const selectableSource = nextSource === 'flow'
        ? (flowLoaded ? 'flow' : (supervisorLoaded ? 'supervisor' : ''))
        : (supervisorLoaded ? 'supervisor' : (flowLoaded ? 'flow' : ''));

      if (selectableSource) {
        await selectFlowCfgPath(selectableSource, selectableSource === nextSource ? nextPath : '', force);
      } else {
        cfgTreeSelectedSource = 'flow';
        renderFlowCfgCurrentPath('flow', '', null);
        renderFlowCfgTree();
        resetPrimaryCfgEditor('Aucune branche disponible.');
      }

      return {
        ok: flowLoaded && supervisorLoaded,
        flowLoaded,
        supervisorLoaded
      };
    }

    async function ensureFlowCfgLoaded(forceReload) {
      const force = !!forceReload;
      if (force) {
        flowCfgFlowOnlyFailureStreak = 0;
      }
      if (flowCfgLoadPromise) {
        await flowCfgLoadPromise;
        if (!force) {
          return;
        }
      }

      flowCfgLoadPromise = (async () => {
        if (!flowCfgDocsLoaded) {
          await chargerFlowCfgDocs();
        }

        const wasLoaded = flowCfgLoadedOnce;
        const retryDelaysMs = (wasLoaded && !force) ? [0] : [0, 900, 2200, 3600];
        let loadResult = { ok: false, flowLoaded: false, supervisorLoaded: false };
        for (let attempt = 0; attempt < retryDelaysMs.length; ++attempt) {
          if (retryDelaysMs[attempt] > 0) {
            await waitMs(retryDelaysMs[attempt]);
          }
          loadResult = await chargerFlowCfgModules(force || attempt > 0);
          if (loadResult.ok) {
            flowCfgLoadedOnce = true;
            flowCfgFlowOnlyFailureStreak = 0;
            stopFlowCfgRetry();
            return;
          }
          if (loadResult.supervisorLoaded && !loadResult.flowLoaded) {
            break;
          }
          if (attempt + 1 < retryDelaysMs.length) {
            flowCfgStatus.textContent = formatCfgLoadStatus(loadResult, false);
          }
        }

        if (isPageActive('page-control')) {
          if (loadResult.supervisorLoaded && !loadResult.flowLoaded) {
            flowCfgFlowOnlyFailureStreak += 1;
            const retryDelayMs = Math.min(60000, 7000 + ((flowCfgFlowOnlyFailureStreak - 1) * 5000));
            if (flowCfgFlowOnlyFailureStreak >= 6) {
              stopFlowCfgRetry();
              flowCfgStatus.textContent =
                'flow.io indisponible (lien I2C). Configuration Supervisor disponible. ' +
                'Auto-retry en pause, utilisez Rafraîchir.';
            } else {
              flowCfgStatus.textContent =
                'flow.io indisponible pour le moment. Configuration Supervisor disponible. ' +
                'Nouvelle tentative dans ' + Math.max(1, Math.round(retryDelayMs / 1000)) + ' s.';
              scheduleFlowCfgRetry(retryDelayMs);
            }
            return;
          }
          flowCfgFlowOnlyFailureStreak = 0;
          flowCfgStatus.textContent = formatCfgLoadStatus(loadResult, true);
          scheduleFlowCfgRetry(2500);
        }
      })();

      try {
        await flowCfgLoadPromise;
      } finally {
        flowCfgLoadPromise = null;
      }
    }

    function formatFlowCfgApplyError(data) {
      const err = (data && typeof data === 'object' && data.err && typeof data.err === 'object') ? data.err : {};
      const code = typeof err.code === 'string' ? err.code : '';
      const where = typeof err.where === 'string' ? err.where : '';

      if (code === 'ArgsTooLarge' || code === 'CfgTruncated') {
        return 'Trop de changements en une seule fois pour le lien I2C (' + (where || 'flowcfg') + ').';
      }
      if (code === 'NotReady') {
        return 'Lien I2C temporairement indisponible (' + (where || 'flowcfg') + ').';
      }
      if (code === 'IoError') {
        return 'Erreur de communication I2C (' + (where || 'flowcfg') + ').';
      }
      if (code === 'BadCfgJson') {
        return 'Patch de configuration invalide (' + (where || 'flowcfg') + ').';
      }
      if (code === 'CfgApplyFailed') {
        return 'flow.io a refusé la configuration (' + (where || 'flowcfg') + ').';
      }
      if (code) {
        return code + (where ? ' (' + where + ')' : '');
      }
      return 'apply refusé';
    }

    async function appliquerFlowCfgField(inputEl, applyBtn) {
      if (!inputEl || !applyBtn || !flowCfgCurrentModule) return;
      const key = String(inputEl.dataset.key || '').trim();
      if (!key) return;
      if (!configFieldIsDirty(inputEl)) {
        updateControlFieldApplyState(inputEl, applyBtn);
        return;
      }

      try {
        applyBtn.disabled = true;
        applyBtn.classList.add('is-pending');
        flowCfgStatus.textContent = 'Application du champ "' + key + '"...';

        const patch = buildFlowCfgSingleFieldPatchJson(flowCfgCurrentModule, inputEl);
        const body = new URLSearchParams();
        body.set('patch', patch);
        const res = await fetchFlowRemoteQueued('/api/flowcfg/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: body.toString()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data || data.ok !== true) {
          throw new Error(formatFlowCfgApplyError(data));
        }

        await chargerFlowCfgModule(flowCfgCurrentModule);
        await refreshWebUiLocale(true);
        flowCfgStatus.textContent = 'Champ "' + key + '" applique.';
      } catch (err) {
        flowCfgStatus.textContent = 'Application du champ echouee: ' + err;
        updateControlFieldApplyState(inputEl, applyBtn);
      }
    }

    async function appliquerPrimaryCfgField(inputEl, applyBtn) {
      if (!inputEl || !applyBtn || !supCfgCurrentModule) return;
      const key = String(inputEl.dataset.key || '').trim();
      if (!key) return;
      if (!configFieldIsDirty(inputEl)) {
        updateControlFieldApplyState(inputEl, applyBtn);
        return;
      }

      setFlowCfgLocalApplyBusy(true, tr('cfg.apply.busyField', 'Application locale du champ « {field} »...').replace('{field}', key));
      try {
        applyBtn.disabled = true;
        applyBtn.classList.add('is-pending');
        flowCfgStatus.textContent = 'Application locale du champ "' + key + '"...';

        const patch = buildFlowCfgSingleFieldPatchJson(supCfgCurrentModule, inputEl);
        const body = new URLSearchParams();
        body.set('patch', patch);
        const res = await fetchWithBusyRetry('/api/supervisorcfg/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: body.toString()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data || data.ok !== true) {
          throw new Error(extractApiErrorMessage(data, 'apply refusé'));
        }

        clearCfgTreeNodeTextNameCache('supervisor');
        await chargerPrimarySupervisorCfgModule(supCfgCurrentModule);
        renderFlowCfgTree();
        await refreshWebUiLocale(true);
        flowCfgStatus.textContent = 'Champ local "' + key + '" applique.';
      } catch (err) {
        flowCfgStatus.textContent = 'Application locale du champ echouee: ' + err;
        updateControlFieldApplyState(inputEl, applyBtn);
      } finally {
        applyBtn.classList.remove('is-pending');
        setFlowCfgLocalApplyBusy(false);
      }
    }

    async function appliquerFlowCfg() {
      try {
        const patch = buildFlowCfgPatchJson();
        const body = new URLSearchParams();
        body.set('patch', patch);
        const res = await fetchFlowRemoteQueued('/api/flowcfg/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: body.toString()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data || data.ok !== true) {
          throw new Error(formatFlowCfgApplyError(data));
        }
        flowCfgStatus.textContent = 'Configuration appliquée sur flow.io.';
        await chargerFlowCfgModule(flowCfgCurrentModule);
        await refreshWebUiLocale(true);
      } catch (err) {
        flowCfgStatus.textContent = 'Application cfg échouée: ' + err;
      }
    }

    async function appliquerPrimaryCfg() {
      if (cfgTreeSelectedSource === 'supervisor') {
        setFlowCfgLocalApplyBusy(true, tr('cfg.apply.busy', 'Application de la configuration en cours...'));
        try {
          const patch = buildPrimaryCfgPatchJson();
          const body = new URLSearchParams();
          body.set('patch', patch);
          const res = await fetchWithBusyRetry('/api/supervisorcfg/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: body.toString()
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data || data.ok !== true) {
            throw new Error('apply refusé');
          }
          flowCfgStatus.textContent = 'Configuration locale appliquée.';
          clearCfgTreeNodeTextNameCache('supervisor');
          await chargerPrimarySupervisorCfgModule(supCfgCurrentModule);
          renderFlowCfgTree();
          await refreshWebUiLocale(true);
        } catch (err) {
          flowCfgStatus.textContent = 'Application cfg locale échouée: ' + err;
        } finally {
          setFlowCfgLocalApplyBusy(false);
        }
        return;
      }
      await appliquerFlowCfg();
    }

    async function recalculerDureeFiltration() {
      if (!flowCfgFiltrationRecalcBtn || flowCfgFiltrationRecalcBtn.hidden) return;
      flowCfgFiltrationRecalcBtn.disabled = true;
      flowCfgStatus.textContent = tr(
        'config.filtrationRecalculatePending',
        'Demande de recalcul de la filtration...'
      );
      try {
        await fetchOkJson(
          '/api/poollogic/filtration/recalculate',
          { method: 'POST' },
          tr('config.filtrationRecalculateFailed', 'Recalcul de la filtration impossible'),
          fetch
        );
        // The PoolLogic task consumes the queued command on its next 200 ms loop.
        await new Promise((resolve) => setTimeout(resolve, 350));
        await chargerFlowCfgModule('poollogic/filtration');
        flowCfgStatus.textContent = tr(
          'config.filtrationRecalculateQueued',
          'Recalcul demandé. La durée et la plage seront actualisées avec la température d’eau courante.'
        );
      } catch (err) {
        flowCfgStatus.textContent =
          tr('config.filtrationRecalculateFailed', 'Recalcul de la filtration impossible') + ': ' + err;
      } finally {
        updateFiltrationRecalcActionVisibility();
      }
    }

    function setFlowCfgBackupStatus(message, tone) {
      if (!flowCfgBackupStatus) return;
      flowCfgBackupStatus.textContent = String(message || '').trim() || 'Sauvegarde configuration prête.';
      flowCfgBackupStatus.classList.remove('is-ok', 'is-error', 'is-busy');
      if (tone === 'ok') flowCfgBackupStatus.classList.add('is-ok');
      if (tone === 'error') flowCfgBackupStatus.classList.add('is-error');
      if (tone === 'busy') flowCfgBackupStatus.classList.add('is-busy');
    }

    function setFlowCfgBackupProgress(percent, visible, label) {
      const show = !!visible;
      if (flowCfgBackupProgress) flowCfgBackupProgress.hidden = !show;
      if (flowCfgBackupProgressLabel && typeof label === 'string' && label.trim().length > 0) {
        flowCfgBackupProgressLabel.textContent = label.trim();
      }

      if (!show) {
        if (flowCfgBackupPct) flowCfgBackupPct.textContent = '0%';
        if (flowCfgBackupProgressBar) {
          flowCfgBackupProgressBar.style.width = '0%';
          flowCfgBackupProgressBar.classList.remove('is-complete');
        }
        if (flowCfgBackupProgressDot) flowCfgBackupProgressDot.hidden = false;
        return;
      }

      const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
      if (flowCfgBackupPct) flowCfgBackupPct.textContent = safePercent + '%';
      if (flowCfgBackupProgressBar) {
        flowCfgBackupProgressBar.style.width = safePercent + '%';
        flowCfgBackupProgressBar.classList.toggle('is-complete', safePercent >= 100);
      }
      if (flowCfgBackupProgressDot) flowCfgBackupProgressDot.hidden = safePercent >= 100;
    }

    function setFlowCfgBackupBusy(busy) {
      flowCfgBackupBusy = !!busy;
      if (flowCfgExportBtn) flowCfgExportBtn.disabled = flowCfgBackupBusy;
      if (flowCfgImportBtn) flowCfgImportBtn.disabled = flowCfgBackupBusy;
      if (flowCfgImportFileInput) flowCfgImportFileInput.disabled = flowCfgBackupBusy;
    }

    function flowCfgBackupStoreLabel(storeName) {
      if (isWaveshareProfile()) return deps.getWebProfileName() || 'Waveshare';
      return storeName === 'supervisor' ? deps.getWebProfileName() : 'flow.io';
    }

    function flowCfgBackupStoreFetchImpl(storeName) {
      return storeName === 'supervisor' ? fetch : fetchFlowCfgEndpoint;
    }

    function flowCfgBackupStoreBasePath(storeName) {
      return storeName === 'supervisor' ? '/api/supervisorcfg' : '/api/flowcfg';
    }

    function flowCfgBackupStoreNames() {
      return isWaveshareProfile() ? ['flow'] : ['supervisor', 'flow'];
    }

    function flowCfgBackupIsoDateForFile(dateLike) {
      const d = dateLike instanceof Date ? dateLike : new Date();
      const pad = (value) => String(value).padStart(2, '0');
      return d.getUTCFullYear()
        + pad(d.getUTCMonth() + 1)
        + pad(d.getUTCDate())
        + '-'
        + pad(d.getUTCHours())
        + pad(d.getUTCMinutes())
        + pad(d.getUTCSeconds());
    }

    function flowCfgBackupDownloadText(filename, textContent) {
      const blob = new Blob([textContent], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }, 0);
    }

    function flowCfgBackupShouldRedactField(key, value) {
      const normalizedKey = String(key || '').trim().toLowerCase();
      if (!normalizedKey) return false;
      if (/pass|token|secret|api[_-]?key/.test(normalizedKey)) return true;
      if (typeof value === 'string' && value.trim() === '***') return true;
      return false;
    }

    function flowCfgBackupRedactModuleData(storeName, moduleName, moduleData) {
      const result = {};
      const redactedFields = [];
      const source = (moduleData && typeof moduleData === 'object' && !Array.isArray(moduleData)) ? moduleData : {};
      Object.keys(source).sort().forEach((key) => {
        const value = source[key];
        if (flowCfgBackupShouldRedactField(key, value)) {
          result[key] = flowCfgBackupRedactedToken;
          redactedFields.push({
            module: moduleName,
            key: key,
            reason: 'secret',
            store: storeName
          });
          return;
        }
        result[key] = value;
      });
      return { data: result, redactedFields };
    }

    async function flowCfgBackupFetchModules(storeName) {
      const basePath = flowCfgBackupStoreBasePath(storeName);
      const fetchImpl = flowCfgBackupStoreFetchImpl(storeName);
      const normalizeModules = (data) => {
        if (!Array.isArray(data && data.modules)) {
          throw new Error('liste modules ' + flowCfgBackupStoreLabel(storeName) + ' invalide');
        }
        return data.modules
          .filter((moduleName) => typeof moduleName === 'string' && moduleName.trim().length > 0)
          .map((moduleName) => moduleName.trim())
          .sort((left, right) => left.localeCompare(right));
      };
      const sameModuleList = (left, right) => {
        if (!Array.isArray(left) || !Array.isArray(right)) return false;
        if (left.length !== right.length) return false;
        for (let i = 0; i < left.length; i += 1) {
          if (left[i] !== right[i]) return false;
        }
        return true;
      };

      if (storeName !== 'flow') {
        const data = await fetchOkJson(
          basePath + '/modules',
          { cache: 'no-store' },
          'liste modules ' + flowCfgBackupStoreLabel(storeName) + ' indisponible',
          fetchImpl
        );
        return normalizeModules(data);
      }

      let previous = null;
      let stableCount = 0;
      let attempt = 0;
      while (stableCount < 1) {
        attempt += 1;
        const data = await fetchOkJson(
          basePath + '/modules',
          { cache: 'no-store' },
          'liste modules ' + flowCfgBackupStoreLabel(storeName) + ' indisponible',
          fetchImpl
        );
        const modules = normalizeModules(data);
        if (previous && sameModuleList(previous, modules)) {
          stableCount += 1;
          return modules;
        }
        previous = modules;
        stableCount = 0;
        const retryDelayMs = attempt <= 3
          ? (100 * attempt)
          : Math.min(1200, 300 + ((attempt - 3) * 120));
        await waitMs(retryDelayMs);
      }
      return previous || [];
    }

    async function flowCfgBackupFetchModule(storeName, moduleName) {
      const basePath = flowCfgBackupStoreBasePath(storeName);
      const fetchImpl = flowCfgBackupStoreFetchImpl(storeName);
      const maxAttempts = storeName === 'flow' ? Number.POSITIVE_INFINITY : 1;
      let lastError = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const data = await fetchOkJson(
            basePath + '/module?name=' + encodeURIComponent(moduleName),
            { cache: 'no-store' },
            'lecture module ' + moduleName + ' (' + flowCfgBackupStoreLabel(storeName) + ') impossible',
            fetchImpl
          );
          if (!data || typeof data.data !== 'object' || Array.isArray(data.data)) {
            throw new Error('module ' + moduleName + ' invalide (' + flowCfgBackupStoreLabel(storeName) + ')');
          }
          return {
            data: data.data,
            truncated: !!data.truncated
          };
        } catch (err) {
          lastError = err;
          if (attempt >= maxAttempts) break;
          const retryDelayMs = attempt <= 3
            ? (120 * attempt)
            : Math.min(5000, 500 + ((attempt - 3) * 250));
          await waitMs(retryDelayMs);
        }
      }
      throw (lastError || new Error('lecture module ' + moduleName + ' impossible'));
    }

    function flowCfgBackupValidatePrimitiveValue(value, moduleName, key) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return;
      throw new Error('Valeur invalide pour ' + moduleName + '.' + key + ' (type non supporté).');
    }

    function flowCfgBackupNormalizeStoreSection(rawStore, storeName) {
      const store = rawStore && typeof rawStore === 'object' ? rawStore : {};
      const rawModules = (store.modules && typeof store.modules === 'object' && !Array.isArray(store.modules))
        ? store.modules
        : {};
      const modules = {};
      Object.keys(rawModules).forEach((moduleName) => {
        const cleanModuleName = String(moduleName || '').trim();
        if (!cleanModuleName) return;
        const rawModuleData = rawModules[moduleName];
        if (!rawModuleData || typeof rawModuleData !== 'object' || Array.isArray(rawModuleData)) {
          throw new Error('Module invalide dans backup: ' + cleanModuleName + ' (' + flowCfgBackupStoreLabel(storeName) + ').');
        }
        const normalizedData = {};
        Object.keys(rawModuleData).forEach((key) => {
          const cleanKey = String(key || '').trim();
          if (!cleanKey) return;
          const value = rawModuleData[key];
          flowCfgBackupValidatePrimitiveValue(value, cleanModuleName, cleanKey);
          normalizedData[cleanKey] = value;
        });
        modules[cleanModuleName] = normalizedData;
      });

      const truncatedModules = Array.isArray(store.truncated_modules)
        ? store.truncated_modules
            .filter((moduleName) => typeof moduleName === 'string' && moduleName.trim().length > 0)
            .map((moduleName) => moduleName.trim())
        : [];

      const redactedFields = Array.isArray(store.redacted_fields)
        ? store.redacted_fields
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry) => ({
              module: String(entry.module || '').trim(),
              key: String(entry.key || '').trim()
            }))
            .filter((entry) => entry.module.length > 0 && entry.key.length > 0)
        : [];

      const failedModules = Array.isArray(store.failed_modules)
        ? store.failed_modules
            .filter((entry) => entry && typeof entry === 'object')
            .map((entry) => ({
              module: String(entry.module || '').trim(),
              reason: String(entry.reason || '').trim()
            }))
            .filter((entry) => entry.module.length > 0)
        : [];

      return {
        modules,
        truncated_modules: truncatedModules,
        redacted_fields: redactedFields,
        failed_modules: failedModules
      };
    }

    function flowCfgBackupValidateDocument(parsedDoc) {
      if (!parsedDoc || typeof parsedDoc !== 'object') {
        throw new Error('Backup invalide (objet JSON attendu).');
      }
      if (String(parsedDoc.format || '').trim() !== flowCfgBackupFormat) {
        throw new Error('Backup invalide (format non reconnu).');
      }
      if (Number(parsedDoc.version) !== flowCfgBackupVersion) {
        throw new Error('Backup invalide (version non supportée).');
      }
      const stores = (parsedDoc.stores && typeof parsedDoc.stores === 'object') ? parsedDoc.stores : null;
      if (!stores) {
        throw new Error('Backup invalide (stores absent).');
      }
      return {
        format: flowCfgBackupFormat,
        version: flowCfgBackupVersion,
        stores: {
          supervisor: flowCfgBackupNormalizeStoreSection(stores.supervisor, 'supervisor'),
          flow: flowCfgBackupNormalizeStoreSection(stores.flow, 'flow')
        }
      };
    }

    function flowCfgBackupBuildRedactedFieldSet(redactedFields) {
      const set = new Set();
      (Array.isArray(redactedFields) ? redactedFields : []).forEach((entry) => {
        const moduleName = String(entry && entry.module ? entry.module : '').trim();
        const key = String(entry && entry.key ? entry.key : '').trim();
        if (!moduleName || !key) return;
        set.add(moduleName + '\u0000' + key);
      });
      return set;
    }

    function flowCfgBackupBuildModulePatch(moduleName, moduleData, redactedFieldSet) {
      const patch = {};
      const source = (moduleData && typeof moduleData === 'object' && !Array.isArray(moduleData)) ? moduleData : {};
      Object.keys(source).sort().forEach((key) => {
        const value = source[key];
        if (value === flowCfgBackupRedactedToken) return;
        if (redactedFieldSet && redactedFieldSet.has(moduleName + '\u0000' + key)) return;
        patch[key] = value;
      });
      return patch;
    }

    function flowCfgBackupSplitModulePatch(moduleName, modulePatch, maxBytes) {
      const keys = Object.keys(modulePatch || {}).sort();
      if (!keys.length) return [];

      const chunks = [];
      let current = {};
      keys.forEach((key) => {
        const next = Object.assign({}, current, { [key]: modulePatch[key] });
        const nextPatch = { [moduleName]: next };
        if (utf8ByteLength(JSON.stringify(nextPatch)) <= maxBytes) {
          current = next;
          return;
        }

        if (Object.keys(current).length === 0) {
          throw new Error('Champ trop volumineux pour import: ' + moduleName + '.' + key);
        }

        chunks.push({ [moduleName]: current });
        current = { [key]: modulePatch[key] };
        const singlePatch = { [moduleName]: current };
        if (utf8ByteLength(JSON.stringify(singlePatch)) > maxBytes) {
          throw new Error('Champ trop volumineux pour import: ' + moduleName + '.' + key);
        }
      });

      if (Object.keys(current).length > 0) {
        chunks.push({ [moduleName]: current });
      }
      return chunks;
    }

    async function flowCfgBackupApplyPatch(storeName, patchJson) {
      const basePath = flowCfgBackupStoreBasePath(storeName);
      const fetchImpl = flowCfgBackupStoreFetchImpl(storeName);
      const response = await fetchJsonResponse(
        basePath + '/apply',
        createFormPostOptions({ patch: patchJson }),
        fetchImpl
      );
      if (!response.res.ok || !response.data || response.data.ok !== true) {
        if (storeName === 'flow') {
          throw new Error(formatFlowCfgApplyError(response.data));
        }
        throw new Error(extractApiErrorMessage(response.data, 'apply refusé'));
      }
    }

    async function exportFlowCfgBackup() {
      if (flowCfgBackupBusy) return;
      setFlowCfgBackupBusy(true);
      const startedAt = Date.now();
      try {
        setFlowCfgBackupStatus('Préparation de l\'export ConfigStore...', 'busy');
        setFlowCfgBackupProgress(0, true, 'Export ConfigStore');
        const createdAt = new Date();
        const backupDoc = {
          format: flowCfgBackupFormat,
          version: flowCfgBackupVersion,
          created_at_utc: createdAt.toISOString(),
          meta: {
            supervisor_fw: deps.getSupervisorFirmwareVersion() || '-',
            flow_reachable: false
          },
          stores: {
            supervisor: {
              modules: {},
              truncated_modules: [],
              redacted_fields: [],
              failed_modules: []
            },
            flow: {
              modules: {},
              truncated_modules: [],
              redacted_fields: [],
              failed_modules: []
            }
          }
        };

        const stores = flowCfgBackupStoreNames();
        const modulesByStore = {};
        let totalModuleCount = 0;
        for (const storeName of stores) {
          const storeLabel = flowCfgBackupStoreLabel(storeName);
          setFlowCfgBackupStatus('Lecture des modules ' + storeLabel + '...', 'busy');
          const modules = await flowCfgBackupFetchModules(storeName);
          modulesByStore[storeName] = modules;
          totalModuleCount += modules.length;
          backupDoc.stores[storeName].module_count = modules.length;
        }

        let exportedModuleCount = 0;
        if (totalModuleCount === 0) {
          setFlowCfgBackupProgress(100, true, 'Export ConfigStore');
        }

        for (const storeName of stores) {
          const storeLabel = flowCfgBackupStoreLabel(storeName);
          const modules = modulesByStore[storeName] || [];
          for (let i = 0; i < modules.length; i += 1) {
            const moduleName = modules[i];
            const moduleOrder = exportedModuleCount + 1;
            setFlowCfgBackupStatus(
              'Export ' + storeLabel + ' : ' + moduleOrder + '/' + totalModuleCount + ' ' + moduleName + '...',
              'busy'
            );
            let modulePayload = null;
            try {
              modulePayload = await flowCfgBackupFetchModule(storeName, moduleName);
            } catch (err) {
              backupDoc.stores[storeName].failed_modules.push({
                module: moduleName,
                reason: String(err || '').trim() || 'lecture module impossible'
              });
              exportedModuleCount += 1;
              setFlowCfgBackupProgress((exportedModuleCount / totalModuleCount) * 100, true, 'Export ConfigStore');
              continue;
            }
            if (modulePayload.truncated) {
              backupDoc.stores[storeName].truncated_modules.push(moduleName);
            }
            const redacted = flowCfgBackupRedactModuleData(storeName, moduleName, modulePayload.data);
            backupDoc.stores[storeName].modules[moduleName] = redacted.data;
            redacted.redactedFields.forEach((entry) => {
              backupDoc.stores[storeName].redacted_fields.push({
                module: entry.module,
                key: entry.key
              });
            });
            exportedModuleCount += 1;
            setFlowCfgBackupProgress((exportedModuleCount / totalModuleCount) * 100, true, 'Export ConfigStore');
          }
          if (storeName === 'flow') {
            backupDoc.meta.flow_reachable = true;
          }
        }

        const truncatedErrors = []
          .concat((backupDoc.stores.supervisor.truncated_modules || []).map((moduleName) => 'Supervisor/' + moduleName))
          .concat((backupDoc.stores.flow.truncated_modules || []).map((moduleName) => 'flow.io/' + moduleName));
        if (truncatedErrors.length > 0) {
          throw new Error(
            'export interrompu: modules tronqués (' + truncatedErrors.join(', ') + ').'
          );
        }

        const failedModuleErrors = []
          .concat((backupDoc.stores.supervisor.failed_modules || []).map((entry) => 'Supervisor/' + entry.module))
          .concat((backupDoc.stores.flow.failed_modules || []).map((entry) => 'flow.io/' + entry.module));

        const serialized = JSON.stringify(backupDoc, null, 2);
        const fileName = 'flowio-configstore-backup-' + flowCfgBackupIsoDateForFile(createdAt) + '.json';
        flowCfgBackupDownloadText(fileName, serialized);
        const durationMs = Date.now() - startedAt;
        setFlowCfgBackupProgress(100, true, 'Export ConfigStore');
        const failedSummary = failedModuleErrors.length > 0
          ? ' Modules ignorés: ' + failedModuleErrors.length + ' (' + failedModuleErrors.join(', ') + ').'
          : '';
        setFlowCfgBackupStatus(
          'Export terminé (' + fileName + ', ' + Math.max(1, Math.round(durationMs / 1000)) + ' s).' + failedSummary,
          'ok'
        );
      } catch (err) {
        setFlowCfgBackupStatus('Export échoué: ' + err, 'error');
      } finally {
        setFlowCfgBackupBusy(false);
      }
    }

    async function importFlowCfgBackupFromText(rawText, fileName) {
      if (flowCfgBackupBusy) return;
      setFlowCfgBackupBusy(true);
      const startedAt = Date.now();
      try {
        setFlowCfgBackupProgress(0, true, 'Import ConfigStore');
        let parsedDoc = null;
        try {
          parsedDoc = JSON.parse(String(rawText || ''));
        } catch (err) {
          throw new Error('JSON invalide.');
        }
        const backupDoc = flowCfgBackupValidateDocument(parsedDoc);
        if (!confirm('Confirmer l\'import du backup "' + (fileName || 'inconnu') + '" ?')) {
          setFlowCfgBackupStatus('Import annulé.', '');
          return;
        }

        const report = {
          supervisor: { modules_applied: 0, modules_skipped: 0, patches_applied: 0 },
          flow: { modules_applied: 0, modules_skipped: 0, patches_applied: 0 }
        };

        const stores = flowCfgBackupStoreNames();
        const importPlan = {};
        let totalPatchCount = 0;
        stores.forEach((storeName) => {
          const storeData = backupDoc.stores[storeName];
          const moduleNames = Object.keys(storeData.modules || {}).sort((left, right) => left.localeCompare(right));
          const truncatedSet = new Set(storeData.truncated_modules || []);
          const redactedSet = flowCfgBackupBuildRedactedFieldSet(storeData.redacted_fields);
          importPlan[storeName] = {};
          moduleNames.forEach((moduleName) => {
            if (truncatedSet.has(moduleName)) return;
            const modulePatch = flowCfgBackupBuildModulePatch(
              moduleName,
              storeData.modules[moduleName],
              redactedSet
            );
            if (Object.keys(modulePatch).length === 0) return;
            const chunkPatches = flowCfgBackupSplitModulePatch(
              moduleName,
              modulePatch,
              flowCfgBackupPatchTargetBytes
            );
            importPlan[storeName][moduleName] = chunkPatches;
            totalPatchCount += chunkPatches.length;
          });
        });
        let appliedPatchCount = 0;
        if (totalPatchCount === 0) {
          setFlowCfgBackupProgress(100, true, 'Import ConfigStore');
        }
        for (const storeName of stores) {
          const storeData = backupDoc.stores[storeName];
          const storeLabel = flowCfgBackupStoreLabel(storeName);
          const moduleNames = Object.keys(storeData.modules || {}).sort((left, right) => left.localeCompare(right));
          const truncatedSet = new Set(storeData.truncated_modules || []);

          for (let moduleIndex = 0; moduleIndex < moduleNames.length; moduleIndex += 1) {
            const moduleName = moduleNames[moduleIndex];
            if (truncatedSet.has(moduleName)) {
              report[storeName].modules_skipped += 1;
              continue;
            }

            const chunkPatches = (importPlan[storeName] && importPlan[storeName][moduleName])
              ? importPlan[storeName][moduleName]
              : [];
            if (chunkPatches.length === 0) {
              report[storeName].modules_skipped += 1;
              continue;
            }

            for (let chunkIndex = 0; chunkIndex < chunkPatches.length; chunkIndex += 1) {
              setFlowCfgBackupStatus(
                'Import ' + storeLabel + ' : ' + moduleName
                + ' (' + (moduleIndex + 1) + '/' + moduleNames.length + ', patch ' + (chunkIndex + 1)
                + '/' + chunkPatches.length + ')...',
                'busy'
              );
              await flowCfgBackupApplyPatch(storeName, JSON.stringify(chunkPatches[chunkIndex]));
              report[storeName].patches_applied += 1;
              appliedPatchCount += 1;
              if (totalPatchCount > 0) {
                setFlowCfgBackupProgress((appliedPatchCount / totalPatchCount) * 100, true, 'Import ConfigStore');
              }
            }

            report[storeName].modules_applied += 1;
          }
        }

        await ensureFlowCfgLoaded(true).catch(() => {});
        const durationMs = Date.now() - startedAt;
        setFlowCfgBackupStatus(
          'Import terminé (' + Math.max(1, Math.round(durationMs / 1000)) + ' s). '
            + 'Supervisor: ' + report.supervisor.modules_applied + ' module(s), '
            + report.supervisor.patches_applied + ' patch(s). '
            + 'flow.io: ' + report.flow.modules_applied + ' module(s), '
            + report.flow.patches_applied + ' patch(s).',
          'ok'
        );
        setFlowCfgBackupProgress(100, true, 'Import ConfigStore');
      } catch (err) {
        setFlowCfgBackupStatus('Import échoué: ' + err, 'error');
      } finally {
        setFlowCfgBackupBusy(false);
        if (flowCfgImportFileInput) {
          flowCfgImportFileInput.value = '';
        }
      }
    }

    async function importFlowCfgBackupFromFile(file) {
      if (!file) return;
      const text = await file.text();
      await importFlowCfgBackupFromText(text, file.name || 'backup.json');
    }



      deps.bindClickAction(flowCfgRefreshBtn, () => ensureFlowCfgLoaded(true));
      deps.bindClickAction(flowCfgApplyBtn, () => appliquerPrimaryCfg());
      deps.bindClickAction(flowCfgFiltrationRecalcBtn, () => recalculerDureeFiltration());
      deps.bindClickAction(flowCfgExportBtn, () => exportFlowCfgBackup());
      deps.bindClickAction(flowCfgImportBtn, () => {
        if (!flowCfgImportFileInput || flowCfgBackupBusy) return;
        flowCfgImportFileInput.value = '';
        flowCfgImportFileInput.click();
      });
      if (flowCfgImportFileInput) {
        flowCfgImportFileInput.addEventListener('change', () => {
          const file = flowCfgImportFileInput.files && flowCfgImportFileInput.files[0]
            ? flowCfgImportFileInput.files[0]
            : null;
          if (!file) return;
          Promise.resolve(importFlowCfgBackupFromFile(file)).catch(() => {});
        });
      }
      if (flowCfgApplyBtn) flowCfgApplyBtn.disabled = true;

      return {
        show: onControlPageShown,
        hide: stopFlowCfgRetry,
        isBusy: function isBusy() { return flowCfgLocalApplyBusyDepth > 0; },
        setLeaveWarning: function setLeaveWarning() {
          if (flowCfgStatus) {
            flowCfgStatus.textContent = tr('cfg.apply.waitBeforeLeaving', 'Application en cours : attendez la confirmation avant de quitter la configuration.');
          }
        },
        refreshLocale: refreshCfgDocLocaleRuntime,
        nettoyerNomFlowCfg,
        chargerFlowCfgDocs,
        ensureCfgDocsForModule,
        getCfgDocSources: function getCfgDocSources() { return cfgDocSources; },
        isFlowCfgDocsLoaded: function isFlowCfgDocsLoaded() { return flowCfgDocsLoaded; },
        formatFlowCfgApplyError,
        configDocFor
      };
    }
  };
})();
