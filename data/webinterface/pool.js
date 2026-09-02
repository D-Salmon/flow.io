(function () {
  'use strict';

  window.FlowWebPages = window.FlowWebPages || {};
  window.FlowWebPages.pool = {
    create: function createPoolPage(deps) {
      const tr = deps.tr;
      const getActivePageId = deps.getActivePageId;
      const fetchOkJson = deps.fetchOkJson;
      const createFormPostOptions = deps.createFormPostOptions;
      const waitMs = deps.waitMs;
      const fetchRuntimeValues = deps.fetchRuntimeValues;
      const fetchFlowStatusDomain = deps.fetchFlowStatusDomain;
      const runtimeMeasureEntriesForDomain = deps.runtimeMeasureEntriesForDomain;
      const normalizeRuntimeMeasureDomainKey = deps.normalizeRuntimeMeasureDomainKey;
      const formatRuntimeDomainLabel = deps.formatRuntimeDomainLabel;
      const formatRuntimeGroupCardTitle = deps.formatRuntimeGroupCardTitle;
      const runtimeMeasureCssSlug = deps.runtimeMeasureCssSlug;
      const formatRuntimeDurationMs = deps.formatRuntimeDurationMs;
      const appendFlowStatusRow = deps.appendFlowStatusRow;
      const buildFlowReadonlyStateGrid = deps.buildFlowReadonlyStateGrid;
      const buildFlowReadonlyStateTile = deps.buildFlowReadonlyStateTile;
      const buildFlowRssiGauge = deps.buildFlowRssiGauge;
      const buildFlowThresholdValueNode = deps.buildFlowThresholdValueNode;
      const createFlowFiveZoneBands = deps.createFlowFiveZoneBands;
      const createSkeletonLine = deps.createSkeletonLine;
      const configDocFor = deps.configDocFor;
      const ensureCfgDocsForModule = deps.ensureCfgDocsForModule;
      const iconCheckText = deps.iconCheckText;
      const isWaveshareProfile = deps.isWaveshareProfile;
      const isMicronovaProfile = deps.isMicronovaProfile;
      const nettoyerNomFlowCfg = deps.nettoyerNomFlowCfg;
      const currentWebLocaleTag = deps.currentWebLocaleTag;
      const showPage = deps.showPage;
      const createIntervalRunner = deps.createIntervalRunner;
      const createRuntimeDomainState = deps.createRuntimeDomainState;
      const isAdminAuthenticated = deps.isAdminAuthenticated;
      const isPhysicalRecoveryActive = deps.isPhysicalRecoveryActive;
      const getPhysicalRecoveryRemainingSeconds = deps.getPhysicalRecoveryRemainingSeconds;

      function toBool(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
        }
        return false;
      }

      let dashboardOverviewReqSeq = 0;
      let dashboardOverviewLoadedOnce = false;

    const poolMeasuresRefreshBtn = document.getElementById('poolMeasuresRefresh');
    const poolMeasuresDomains = document.getElementById('poolMeasuresDomains');
    const poolMeasuresStatus = document.getElementById('poolMeasuresStatus');
    const poolMeasuresGrid = document.getElementById('poolMeasuresGrid');
    const dashboardModeTitle = document.getElementById('dashboardModeTitle');
    const dashboardOperatingMode = document.getElementById('dashboardOperatingMode');
    const dashboardModeApply = document.getElementById('dashboardModeApply');
    const dashboardModeStatus = document.getElementById('dashboardModeStatus');
    const dashboardSummary = document.getElementById('dashboardSummary');
    const dashboardConnectionBadges = document.getElementById('dashboardConnectionBadges');
    const dashboardOverallState = document.getElementById('dashboardOverallState');
    const dashboardKpiGrid = document.getElementById('dashboardKpiGrid');
    const dashboardEquipmentCount = document.getElementById('dashboardEquipmentCount');
    const dashboardEquipmentGrid = document.getElementById('dashboardEquipmentGrid');
    const dashboardFiltrationState = document.getElementById('dashboardFiltrationState');
    const dashboardFiltrationStart = document.getElementById('dashboardFiltrationStart');
    const dashboardFiltrationStop = document.getElementById('dashboardFiltrationStop');
    const dashboardFiltrationProgress = document.getElementById('dashboardFiltrationProgress');
    const dashboardFiltrationHint = document.getElementById('dashboardFiltrationHint');
    const dashboardAlarmCount = document.getElementById('dashboardAlarmCount');
    const dashboardAlarmList = document.getElementById('dashboardAlarmList');
    const dashboardLightsShortcut = document.getElementById('dashboardLightsShortcut');
    const dashboardShortcutButtons = Array.from(document.querySelectorAll('[data-dashboard-page]'));
    const poolConfigRefreshBtn = document.getElementById('poolConfigRefresh');
    const poolConfigTitle = document.getElementById('poolConfigTitle');
    const poolConfigSummary = document.getElementById('poolConfigSummary');
    const poolHeroState = document.getElementById('poolHeroState');
    const poolFiltrationStart = document.getElementById('poolFiltrationStart');
    const poolFiltrationStop = document.getElementById('poolFiltrationStop');
    const poolFiltrationFill = document.getElementById('poolFiltrationFill');
    const poolOperatingMode = document.getElementById('poolOperatingMode');
    const poolOperatingModeApply = document.getElementById('poolOperatingModeApply');
    const poolOperatingModeStatus = document.getElementById('poolOperatingModeStatus');
    const poolEquipmentControl = document.getElementById('poolEquipmentControl');
    const poolGeneralControl = document.getElementById('poolGeneralControl');
    const poolChemistryPanel = document.getElementById('poolChemistryPanel');
    const poolDisinfectionModes = document.getElementById('poolDisinfectionModes');
    const poolAlarmCard = document.getElementById('poolAlarmCard');
    const poolConfigGrid = document.getElementById('poolConfigGrid');


    const poolMeasureDomainState = {
      mode: createRuntimeDomainState(),
      sondes: createRuntimeDomainState(),
      micronova: createRuntimeDomainState(),
      alarm: createRuntimeDomainState()
    };
    let poolConfigLoadedOnce = false;
    let poolConfigModeApplyBusy = false;
    let poolConfigFieldApplyBusy = false;
    let poolConfigReqSeq = 0;
    let poolConfigModulesCache = {};
    let poolConfigAlarmSlotsCache = [];
    let poolConfigLiveState = {};
    let poolConfigDocsReady = false;
    let poolConfigDocsPromise = null;
    let poolChemistryHasPendingChanges = false;
    let poolEquipmentCommandBusy = '';
    let poolEquipmentStatusMessage = '';
    let poolEquipmentStatusTone = '';
    let poolOperatingModeApplyBusy = false;
    let poolOperatingModeCurrent = '';
    let poolOperatingModeStatusMessage = '';
    let poolOperatingModeStatusTone = '';
    let dashboardLightsOn = null;
    const poolEquipmentDefs = Object.freeze([
      Object.freeze({ key: 'filtration', stateKey: 'fil', labelKey: 'pool.control.filtration', label: 'Pompe de filtration', icon: 'water', noteKey: 'pool.control.filtration.note', note: 'Fait circuler et filtre l’eau du bassin.', automatic: true }),
      Object.freeze({ key: 'electrolysis', stateKey: 'swg', labelKey: 'pool.control.electrolysis', label: 'Électrolyseur', icon: 'bolt', noteKey: 'pool.control.electrolysis.note', note: 'Produit le désinfectant au sel.', automatic: true }),
      Object.freeze({ key: 'chlorine', stateKey: 'clp', labelKey: 'pool.control.chlorine', label: 'Pompe chlore', icon: 'water_drop', noteKey: 'pool.control.chlorine.note', note: 'Injecte le désinfectant liquide.', automatic: true }),
      Object.freeze({ key: 'ph', stateKey: 'php', labelKey: 'pool.control.ph', label: 'Pompe pH', icon: 'science', noteKey: 'pool.control.ph.note', note: 'Injecte le correcteur pH.', automatic: true }),
      Object.freeze({ key: 'lights', stateKey: 'lgt', labelKey: 'pool.control.lights', label: 'Éclairage piscine', icon: 'lightbulb', noteKey: 'pool.control.lights.note', note: 'Allume ou éteint immédiatement l’éclairage.', automatic: false, featured: true }),
      Object.freeze({ key: 'robot', stateKey: 'rbt', labelKey: 'pool.control.robot', label: 'Robot', icon: 'smart_toy', noteKey: 'pool.control.robot.note', note: 'Lance le cycle du robot de nettoyage.', automatic: true }),
      Object.freeze({ key: 'heater', stateKey: 'htr', labelKey: 'pool.control.heater', label: 'Chauffage', icon: 'local_fire_department', noteKey: 'pool.control.heater.note', note: 'Commande la pompe à chaleur.', automatic: true }),
      Object.freeze({ key: 'filling', stateKey: 'fill', labelKey: 'pool.control.filling', label: 'Remplissage', icon: 'faucet', noteKey: 'pool.control.filling.note', note: 'Commande l’appoint d’eau du bassin.', automatic: true })
    ]);
    const poolConfigModuleDefs = Object.freeze([
      Object.freeze({ module: 'poollogic/modes', hidden: true }),
      Object.freeze({ module: 'hmi/buzzer', titleKey: 'pool.card.alarmSound.title', title: 'Signal sonore', icon: 'notifications_active', noteKey: 'pool.card.alarmSound.note', note: 'Le son des alarmes peut être coupé sans masquer les alarmes affichées.' }),
      Object.freeze({ module: 'poollogic/filtration', titleKey: 'pool.card.filtration.title', title: 'Filtration', icon: 'waves', noteKey: 'pool.card.filtration.note', note: 'La plage de filtration combine contraintes horaires et température d’eau pour protéger le bassin.' }),
      Object.freeze({ module: 'poollogic/ph', titleKey: 'pool.card.ph.title', title: 'Régulation pH', icon: 'science', noteKey: 'pool.card.ph.note', note: 'Consigne, sens de dosage et fenêtre de régulation de la pompe pH.' }),
      Object.freeze({ module: 'poollogic/heater', titleKey: 'pool.card.heater.title', title: 'Chauffage', icon: 'thermostat', noteKey: 'pool.card.heater.note', note: 'Le chauffage suit sa consigne seulement quand le mode automatique le permet.' }),
      Object.freeze({ module: 'poollogic/refill', titleKey: 'pool.card.refill.title', title: 'Maintien du niveau du bassin', icon: 'water_drop', noteKey: 'pool.card.refill.note', note: 'Commande uniquement le remplissage du bassin lorsque son niveau est bas, sans rapport avec les bidons pH ou chlore.' }),
      Object.freeze({ module: 'poollogic/safety', titleKey: 'pool.card.safety.title', title: 'Protections', icon: 'health_and_safety', noteKey: 'pool.card.safety.note', note: 'Seuils de pression, hors gel et bascule hiver utilisés par les automatismes.' }),
      Object.freeze({ module: 'poollogic/regulation', titleKey: 'pool.card.regulation.title', title: 'Régulation', icon: 'speed', noteKey: 'pool.card.regulation.note', note: 'Temporisations communes aux régulateurs pH et désinfection.' }),
      Object.freeze({ module: 'poollogic/robot', titleKey: 'pool.card.robot.title', title: 'Robot', icon: 'smart_toy', noteKey: 'pool.card.robot.note', note: 'Fenêtre de lancement et durée du nettoyage automatique.' }),
      Object.freeze({ module: 'poollogic/sensors', titleKey: 'pool.card.sensors.title', title: 'Affectation des sondes', icon: 'sensors', noteKey: 'pool.card.sensors.note', note: 'Entrées logiques utilisées pour les mesures et détecteurs de niveau.' }),
      Object.freeze({ module: 'poollogic/devices', titleKey: 'pool.card.devices.title', title: 'Affectation des relais', icon: 'electrical_services', noteKey: 'pool.card.devices.note', note: 'Relais affectés aux pompes, à la filtration, au robot et au chauffage.' })
    ]);
    const poolDisinfectionModeDefs = Object.freeze([
      Object.freeze({
        key: 'chlorine',
        typeValue: 0,
        module: 'poollogic/chlorine',
        titleKey: 'pool.disinfection.chlorine.title',
        title: 'Chlore / Brome',
        icon: 'science',
        accent: 'blue',
        noteKey: 'pool.disinfection.chlorine.note',
        note: 'Régulation liquide pilotée par la mesure ORP et une pompe doseuse.'
      }),
      Object.freeze({
        key: 'swg',
        typeValue: 1,
        module: 'poollogic/swg',
        titleKey: 'pool.disinfection.swg.title',
        title: 'Électrolyse',
        icon: 'bolt',
        accent: 'cyan',
        noteKey: 'pool.disinfection.swg.note',
        note: 'Production au sel, soit sur consigne ORP, soit en continu pendant la filtration.'
      }),
      Object.freeze({
        key: 'o2',
        typeValue: 2,
        module: 'poollogic/o2',
        titleKey: 'pool.disinfection.o2.title',
        title: 'Oxygène actif',
        icon: 'bubble_chart',
        accent: 'green',
        noteKey: 'pool.disinfection.o2.note',
        note: 'Dosage hebdomadaire calculé depuis le volume du bassin, la charge et la température.'
      })
    ]);
    const poolDeviceSlotOptions = Object.freeze(Array.from({ length: 8 }, (_, index) => (
      Object.freeze({ value: index, label: 'Relais ' + String(index + 1) })
    )));
    const poolAnalogIoOptions = Object.freeze(Array.from({ length: 16 }, (_, index) => (
      Object.freeze({ value: 192 + index, label: 'Entrée analogique A' + String(index + 1).padStart(2, '0') })
    )));
    const poolDigitalIoOptions = Object.freeze(Array.from({ length: 16 }, (_, index) => (
      Object.freeze({ value: 64 + index, label: 'Entrée numérique D' + String(index + 1).padStart(2, '0') })
    )));
    const poolOptionalDigitalIoOptions = Object.freeze([
      Object.freeze({ value: 65535, label: 'Désactivé / non câblé' }),
      ...poolDigitalIoOptions
    ]);
    const poolEditableFieldSpecs = Object.freeze({
      'poollogic/modes': Object.freeze([
        Object.freeze({
          key: 'operating_mode',
          type: 'pool_mode',
          enabledKey: 'enabled',
          autoModeKey: 'auto_mode',
          label: 'Mode de fonctionnement'
        }),
        Object.freeze({ key: 'winter_mode', type: 'bool', label: 'Mode hiver' }),
        Object.freeze({ key: 'robot_auto_mode', type: 'bool', label: 'Robot automatique' })
      ]),
      'poollogic/ph': Object.freeze([
        Object.freeze({ key: 'ph_auto_mode', type: 'bool', label: 'Régulation pH automatique' }),
        Object.freeze({
          key: 'ph_dose_plus',
          type: 'enum',
          label: 'Produit de correction',
          options: Object.freeze([
            Object.freeze({ value: false, label: 'pH− (réducteur)' }),
            Object.freeze({ value: true, label: 'pH+ (correcteur)' })
          ])
        }),
        Object.freeze({ key: 'ph_setpoint', type: 'number', label: 'Consigne pH', min: 6, max: 8, step: 0.01 }),
        Object.freeze({ key: 'ph_window_ms', type: 'number', label: 'Fenêtre de dosage', min: 1, max: 180, step: 1, scale: 60000, unit: 'min' }),
        Object.freeze({ key: 'ph_kp', type: 'number', label: 'Gain proportionnel Kp', min: 0, step: 0.001 }),
        Object.freeze({ key: 'ph_ki', type: 'number', label: 'Gain intégral Ki', min: 0, step: 0.001 }),
        Object.freeze({ key: 'ph_kd', type: 'number', label: 'Gain dérivé Kd', min: 0, step: 0.001 })
      ]),
      'poollogic/chlorine': Object.freeze([
        Object.freeze({ key: 'dis_auto_mode', type: 'bool', label: 'Régulation ORP automatique' }),
        Object.freeze({ key: 'dis_setpoint', type: 'number', label: 'Consigne ORP', min: 300, max: 900, step: 1, unit: 'mV' }),
        Object.freeze({ key: 'dis_window_ms', type: 'number', label: 'Fenêtre de dosage', min: 1, max: 180, step: 1, scale: 60000, unit: 'min' }),
        Object.freeze({ key: 'dis_kp', type: 'number', label: 'Gain proportionnel Kp', min: 0, step: 0.001 }),
        Object.freeze({ key: 'dis_ki', type: 'number', label: 'Gain intégral Ki', min: 0, step: 0.001 }),
        Object.freeze({ key: 'dis_kd', type: 'number', label: 'Gain dérivé Kd', min: 0, step: 0.001 })
      ]),
      'poollogic/swg': Object.freeze([
        Object.freeze({
          key: 'swg_control_mode',
          type: 'enum',
          label: 'Mode de contrôle',
          options: Object.freeze([
            Object.freeze({ value: 0, label: 'Suivi de la consigne ORP' }),
            Object.freeze({ value: 1, label: 'Continu pendant la filtration' })
          ])
        }),
        Object.freeze({ key: 'dly_electro_min', type: 'number', label: 'Délai avant départ électrolyse', min: 0, max: 120, step: 1, unit: 'min' }),
        Object.freeze({ key: 'secure_elec_t', type: 'number', label: 'Température minimale de sécurité', min: 5, max: 35, step: 0.1, unit: '°C' })
      ]),
      'poollogic/o2': Object.freeze([
        Object.freeze({ key: 'pool_volume_m3', type: 'number', label: 'Volume du bassin', min: 1, max: 200, step: 0.1, unit: 'm³' }),
        Object.freeze({ key: 'dose_ml_10m3_week', type: 'number', label: 'Dose hebdomadaire pour 10 m³', min: 0, max: 5000, step: 10, unit: 'ml' }),
        Object.freeze({ key: 'main_hour', type: 'number', label: 'Heure principale', min: 0, max: 23, step: 1, unit: 'h' }),
        Object.freeze({ key: 'split_count', type: 'number', label: 'Nombre d’injections par semaine', min: 1, max: 3, step: 1 }),
        Object.freeze({ key: 'temp_comp', type: 'bool', label: 'Compensation par température' }),
        Object.freeze({ key: 'load_factor', type: 'number', label: 'Facteur de charge', min: 0.1, max: 3, step: 0.1 }),
        Object.freeze({ key: 'min_filter_run_min', type: 'number', label: 'Filtration minimale avant injection', min: 0, max: 255, step: 1, unit: 'min' })
      ]),
      'poollogic/filtration': Object.freeze([
        Object.freeze({ key: 'filtr_start_minute', type: 'time', label: 'Début prévu' }),
        Object.freeze({ key: 'filtr_stop_minute', type: 'time', label: 'Fin prévue' }),
        Object.freeze({ key: 'filtr_duration_minute', type: 'number', label: 'Durée prévue', min: 0, max: 1440, step: 1, unit: 'min' })
      ]),
      'poollogic/refill': Object.freeze([
        Object.freeze({ key: 'fill_enabled', type: 'bool', label: 'Maintien du niveau du bassin' }),
        Object.freeze({ key: 'fill_min_on_s', type: 'number', label: 'Durée minimale d’activation', min: 0, max: 255, step: 1, unit: 's' })
      ]),
      'poollogic/heater': Object.freeze([
        Object.freeze({ key: 'heater_auto_mode', type: 'bool', label: 'Chauffage automatique' }),
        Object.freeze({ key: 'heater_setpoint', type: 'number', label: 'Consigne de température', min: 10, max: 35, step: 0.1, unit: '°C' })
      ]),
      'poollogic/regulation': Object.freeze([
        Object.freeze({ key: 'dly_pid_min', type: 'number', label: 'Délai avant régulation après filtration', min: 0, max: 30, step: 1, unit: 'min' }),
        Object.freeze({ key: 'pid_min_on_ms', type: 'number', label: 'Marche minimale des pompes', min: 1, max: 300, step: 1, scale: 1000, unit: 's' }),
        Object.freeze({ key: 'pid_sample_ms', type: 'number', label: 'Période de calcul', min: 1, max: 300, step: 1, scale: 1000, unit: 's' })
      ]),
      'poollogic/safety': Object.freeze([
        Object.freeze({ key: 'psi_low_th', type: 'number', label: 'Seuil de pression basse', min: 0, max: 5, step: 0.01, unit: 'bar' }),
        Object.freeze({ key: 'psi_high_th', type: 'number', label: 'Seuil de pression haute', min: 0, max: 5, step: 0.01, unit: 'bar' }),
        Object.freeze({ key: 'psi_start_dly_s', type: 'number', label: 'Délai de contrôle pression', min: 0, max: 600, step: 1, unit: 's' }),
        Object.freeze({ key: 'winter_start_t', type: 'number', label: 'Seuil de démarrage hors gel', min: -20, max: 10, step: 0.1, unit: '°C' }),
        Object.freeze({ key: 'freeze_hold_t', type: 'number', label: 'Température de maintien hors gel', min: -10, max: 15, step: 0.1, unit: '°C' })
      ]),
      'poollogic/robot': Object.freeze([
        Object.freeze({ key: 'robot_delay_min', type: 'number', label: 'Délai avant départ du robot', min: 0, max: 255, step: 1, unit: 'min' }),
        Object.freeze({ key: 'robot_dur_min', type: 'number', label: 'Durée de nettoyage', min: 1, max: 255, step: 1, unit: 'min' })
      ]),
      'poollogic/sensors': Object.freeze([
        Object.freeze({ key: 'ph_io_id', type: 'enum', label: 'Sonde pH', options: poolAnalogIoOptions }),
        Object.freeze({ key: 'dis_io_id', type: 'enum', label: 'Sonde ORP', options: poolAnalogIoOptions }),
        Object.freeze({ key: 'psi_io_id', type: 'enum', label: 'Sonde de pression', options: poolAnalogIoOptions }),
        Object.freeze({ key: 'wat_temp_io_id', type: 'enum', label: 'Température eau', options: poolAnalogIoOptions }),
        Object.freeze({ key: 'air_temp_io_id', type: 'enum', label: 'Température air', options: poolAnalogIoOptions }),
        Object.freeze({ key: 'pool_lvl_io_id', type: 'enum', label: 'Niveau du bassin', options: poolOptionalDigitalIoOptions }),
        Object.freeze({ key: 'ph_lvl_io_id', type: 'enum', label: 'Niveau produit pH', options: poolOptionalDigitalIoOptions }),
        Object.freeze({ key: 'chl_lvl_io_id', type: 'enum', label: 'Niveau désinfectant', options: poolOptionalDigitalIoOptions }),
        Object.freeze({
          key: 'filtr_fb_io_id',
          activeHighKey: 'filtr_fb_active_high',
          type: 'feedback',
          label: 'Retour contacteur filtration',
          options: poolDigitalIoOptions
        }),
        Object.freeze({
          key: 'swg_fb_io_id',
          activeHighKey: 'swg_fb_active_high',
          type: 'feedback',
          label: 'Retour contacteur électrolyseur',
          options: poolDigitalIoOptions
        }),
        Object.freeze({ key: 'psi_monitoring', type: 'bool', label: 'Surveillance de pression' })
      ]),
      'poollogic/devices': Object.freeze([
        Object.freeze({ key: 'filtr_slot', type: 'enum', label: 'Pompe de filtration', options: poolDeviceSlotOptions }),
        Object.freeze({ key: 'robot_slot', type: 'enum', label: 'Robot', options: poolDeviceSlotOptions }),
        Object.freeze({ key: 'fill_slot', type: 'enum', label: 'Pompe de remplissage', options: poolDeviceSlotOptions }),
        Object.freeze({ key: 'ph_pump_slot', type: 'enum', label: 'Pompe pH', options: poolDeviceSlotOptions }),
        Object.freeze({ key: 'dis_pump_slot', type: 'enum', label: 'Désinfection (relais unique)', options: poolDeviceSlotOptions }),
        Object.freeze({ key: 'heater_slot', type: 'enum', label: 'Chauffage', options: poolDeviceSlotOptions })
      ]),
      'hmi/buzzer': Object.freeze([
        Object.freeze({ key: 'alarm_sound', type: 'bool', label: 'Son des alarmes' })
      ])
    });
    const poolMeasureDomainAnimations = {};



      function runtimeValueAvailable(item) {
        if (!item || typeof item !== 'object') return false;
        if (item.status === 'unavailable' || item.status === 'not_found') return false;
        return Object.prototype.hasOwnProperty.call(item, 'value');
      }

      function activePoolMeasureDomainKeys() {
        return deps.getRuntimeMeasureDomainKeys().filter((domainKey) => (
          poolMeasureDomainState[domainKey] && poolMeasureDomainState[domainKey].active
        ));
      }

      function syncRuntimeDomains(micronovaProfile) {
        deps.getRuntimeMeasureDomainKeys().forEach((domainKey) => {
          if (!poolMeasureDomainState[domainKey]) {
            poolMeasureDomainState[domainKey] = createRuntimeDomainState();
          }
        });
        if (micronovaProfile && poolMeasureDomainState.micronova) {
          poolMeasureDomainState.micronova.active = true;
        }
      }
      syncRuntimeDomains(isMicronovaProfile());

      let poolMeasuresPoller = null;
      let poolConfigPoller = null;

    function stopPoolMeasuresTimer() {
      poolMeasuresPoller.stop();
    }

    function showPoolMeasuresError(err) {
      if (poolMeasuresStatus) poolMeasuresStatus.textContent = 'Chargement mesures échoué : ' + err;
      if (!dashboardOverviewLoadedOnce) {
        dashboardSetOverallState('unavailable', tr('dashboard.state.unavailable', 'État piscine indisponible'), 'cloud_off');
      }
    }

    function startPoolMeasuresTimer() {
      poolMeasuresPoller.start();
    }



    async function fetchPoolDashboardSlots() {
      const data = await fetchOkJson(
        '/api/runtime/dashboard_slots',
        { cache: 'no-store' },
        'lecture slots tableau de bord indisponible'
      );
      return data && typeof data === 'object' ? data : {};
    }

    async function fetchPoolSondeSlots() {
      const data = await fetchPoolDashboardSlots();
      const slots = Array.isArray(data && data.slots) ? data.slots : [];
      return slots
        .map((slot) => {
          const idx = Number(slot && slot.slot);
          return {
            slot: Number.isFinite(idx) ? idx : 999,
            label: String(slot && slot.label ? slot.label : '').trim(),
            value: String(slot && slot.value ? slot.value : '').trim(),
            unit: String(slot && slot.unit ? slot.unit : '').trim(),
            bgColor: String(slot && slot.bg_color ? slot.bg_color : '').trim(),
            enabled: slot && slot.enabled !== false,
            available: !!(slot && slot.available)
          };
        })
        .sort((a, b) => a.slot - b.slot)
        .slice(0, 8);
    }

    async function fetchPoolAlarmSlots() {
      const data = await fetchPoolDashboardSlots();
      const slots = Array.isArray(data && data.alarm_slots) ? data.alarm_slots : [];
      return slots
        .map((slot) => {
          const idx = Number(slot && slot.slot);
          return {
            slot: Number.isFinite(idx) ? idx : 999,
            label: String(slot && slot.label ? slot.label : '').trim(),
            bgColor: String(slot && slot.bg_color ? slot.bg_color : '').trim(),
            enabled: !!(slot && slot.enabled),
            available: !!(slot && slot.available),
            latched: !!(slot && slot.latched),
            conditionKnown: !!(slot && slot.condition_known),
            conditionTrue: !!(slot && slot.condition_true)
          };
        })
        .sort((a, b) => a.slot - b.slot)
        .slice(0, 8);
    }

    function runtimeMeasureDisplayLabel(entry) {
      return entry.label || entry.key || String(entry.id);
    }

    function isPoolDashboardGroupEntry(entry) {
      if (!entry || String(entry.domain || '').trim().toLowerCase() !== 'sondes') return false;
      return String(entry.group || '').trim().localeCompare('Dashboard', 'fr', { sensitivity: 'base' }) === 0;
    }

    function isPoolSondesGroupKey(domainKey, groupKey) {
      return String(domainKey || '').trim().toLowerCase() === 'sondes'
        && String(groupKey || '').trim().localeCompare('Sondes', 'fr', { sensitivity: 'base' }) === 0;
    }

    function isValidHexColor(color) {
      return /^#[0-9A-Fa-f]{6}$/.test(String(color || '').trim());
    }

    function splitPoolSondeValue(slot) {
      const unit = String(slot && slot.unit ? slot.unit : '').trim();
      const valueRaw = String(slot && slot.value ? slot.value : '').trim();
      const available = !!(slot && slot.available);
      if (!available) return { value: '--', unit: '' };
      if (!valueRaw) return { value: '-', unit: '' };
      if (!unit) return { value: valueRaw, unit: '' };

      const suffix = ' ' + unit;
      if (valueRaw.length > suffix.length && valueRaw.endsWith(suffix)) {
        return {
          value: valueRaw.slice(0, valueRaw.length - suffix.length).trim(),
          unit: unit
        };
      }
      return { value: valueRaw, unit: unit };
    }

    function buildPoolSondeSlotsGrid(slots) {
      const cleanSlots = Array(8).fill(null);
      if (Array.isArray(slots)) {
        slots.forEach((slot) => {
          const idx = Number(slot && slot.slot);
          if (Number.isInteger(idx) && idx >= 0 && idx < 8) cleanSlots[idx] = slot;
        });
      }
      const grid = document.createElement('div');
      grid.className = 'status-sonde-slot-grid';

      for (let i = 0; i < 8; i += 1) {
        const slot = cleanSlots[i] || null;
        const tile = document.createElement('div');
        tile.className = 'status-sonde-slot';
        const available = !!(slot && slot.enabled !== false && slot.available);
        if (!available) tile.classList.add('is-empty');

        const bgColor = slot && isValidHexColor(slot.bgColor) ? slot.bgColor : '';
        if (bgColor) tile.style.background = bgColor;

        const title = document.createElement('div');
        title.className = 'status-sonde-slot-title';
        title.textContent = slot && slot.label ? slot.label : 'Mesure';
        tile.appendChild(title);

        const metric = document.createElement('div');
        metric.className = 'status-sonde-slot-metric';
        const display = splitPoolSondeValue(slot);

        const value = document.createElement('span');
        value.className = 'status-sonde-slot-value';
        value.textContent = display.value || '-';
        metric.appendChild(value);

        if (display.unit) {
          const unit = document.createElement('span');
          unit.className = 'status-sonde-slot-unit';
          unit.textContent = display.unit;
          metric.appendChild(unit);
        }

        tile.appendChild(metric);
        grid.appendChild(tile);
      }

      return grid;
    }

    function runtimeMeasureResolvedLabel(entry, options) {
      const opts = options && typeof options === 'object' ? options : {};
      if (typeof opts.displayLabelResolver === 'function') {
        const resolved = String(opts.displayLabelResolver(entry) || '').trim();
        if (resolved) return resolved;
      }
      return runtimeMeasureDisplayLabel(entry);
    }

    function formatRuntimeFloatValue(value, decimals) {
      const n = Number(value);
      if (!Number.isFinite(n)) return '-';
      if (decimals !== null) {
        return n.toFixed(decimals);
      }
      const rounded = Math.round(n * 1000) / 1000;
      const text = rounded.toFixed(3).replace(/(?:\.0+|(\.\d*?)0+)$/, '$1');
      return text === '-0' ? '0' : text;
    }

    function formatRuntimeMeasureValue(entry, runtimeValue) {
      if (!runtimeValue || runtimeValue.status === 'not_found' || runtimeValue.status === 'unavailable') {
        return 'Indisponible';
      }

      const display = runtimeMeasureDisplayKind(entry);
      const type = String(entry.type || runtimeValue.type || '');
      const unit = entry.unit ? String(entry.unit) : '';
      const decimals = Number.isFinite(Number(entry.decimals)) ? Number(entry.decimals) : null;
      const rawValue = runtimeValue.value;

      if (display === 'time' && Number.isFinite(Number(rawValue))) {
        return formatRuntimeDurationMs(Number(rawValue));
      }
      if (type === 'bool') {
        return rawValue ? 'Actif' : 'Arret';
      }
      if (type === 'float' && Number.isFinite(Number(rawValue))) {
        const value = Number(rawValue);
        const text = formatRuntimeFloatValue(value, decimals);
        return unit ? (text + ' ' + unit) : text;
      }
      if ((type === 'int32' || type === 'uint32' || type === 'enum') && Number.isFinite(Number(rawValue))) {
        if (type === 'enum' && entry.enum && typeof entry.enum === 'object') {
          const enumKey = String(Number(rawValue));
          if (Object.prototype.hasOwnProperty.call(entry.enum, enumKey)) {
            return String(entry.enum[enumKey]);
          }
        }
        const text = String(Number(rawValue));
        return unit ? (text + ' ' + unit) : text;
      }
      if (type === 'string') {
        const text = (rawValue === null || rawValue === undefined || rawValue === '') ? '-' : String(rawValue);
        return unit ? (text + ' ' + unit) : text;
      }
      if (rawValue === null || rawValue === undefined || rawValue === '') return '-';
      return unit ? (String(rawValue) + ' ' + unit) : String(rawValue);
    }

    function runtimeMeasureDisplayKind(entry) {
      const explicit = String(entry && entry.display ? entry.display : '').trim();
      if (explicit === 'gauge' || explicit === 'circ-gauge') return 'threshold';
      if (explicit === 'threshold' || explicit === 'horiz-gauge' || explicit === 'badge' || explicit === 'boolean' || explicit === 'time' || explicit === 'value' || explicit === 'flags') {
        return explicit;
      }
      return String(entry && entry.type ? entry.type : '') === 'bool' ? 'boolean' : 'value';
    }

    function runtimeMeasureDisplayConfig(entry) {
      return (entry && entry.displayConfig && typeof entry.displayConfig === 'object' && !Array.isArray(entry.displayConfig))
        ? entry.displayConfig
        : {};
    }

    function buildRuntimeMeasureThresholdNode(entry, runtimeValue) {
      const displayConfig = runtimeMeasureDisplayConfig(entry);
      let bands = [];
      let min = Number(displayConfig.min);
      let max = Number(displayConfig.max);
      if (displayConfig.bands && typeof displayConfig.bands === 'object' && !Array.isArray(displayConfig.bands)) {
        bands = createFlowFiveZoneBands(displayConfig.bands);
        if (!Number.isFinite(min)) min = Number(displayConfig.bands.min);
        if (!Number.isFinite(max)) max = Number(displayConfig.bands.max);
      } else if (Array.isArray(displayConfig.bands)) {
        bands = displayConfig.bands;
      }
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        return null;
      }

      const value = (!runtimeValue || runtimeValue.status === 'not_found' || runtimeValue.status === 'unavailable')
        ? null
        : runtimeValue.value;

      return buildFlowThresholdValueNode({
        value: value,
        min: min,
        max: max,
        unit: entry.unit ? String(entry.unit) : '',
        decimals: Number.isFinite(Number(entry.decimals)) ? Number(entry.decimals) : 0,
        bands: bands
      });
    }

    function buildRuntimeMeasureHorizGaugeNode(entry, runtimeValue) {
      const hasValue = !!runtimeValue && runtimeValue.status !== 'not_found' && runtimeValue.status !== 'unavailable' &&
        Number.isFinite(Number(runtimeValue.value));
      return buildFlowRssiGauge(hasValue ? Number(runtimeValue.value) : null, hasValue);
    }

    function buildRuntimeMeasureBooleanNode(entry, runtimeValue, options) {
      const displayConfig = runtimeMeasureDisplayConfig(entry);
      const opts = options && typeof options === 'object' ? options : {};
      const value = (!runtimeValue || runtimeValue.status === 'not_found' || runtimeValue.status === 'unavailable')
        ? null
        : (typeof runtimeValue.value === 'boolean' ? runtimeValue.value : null);
      const booleanTexts = (opts.booleanTexts && typeof opts.booleanTexts === 'object') ? opts.booleanTexts : {};

      return buildFlowReadonlyStateTile(
        String(runtimeMeasureResolvedLabel(entry, opts) || 'Etat'),
        value,
        {
          activeText: booleanTexts.activeText || displayConfig.activeText,
          inactiveText: booleanTexts.inactiveText || displayConfig.inactiveText,
          unknownText: booleanTexts.unknownText || displayConfig.unknownText
        }
      );
    }

    function buildRuntimeMeasureBadgeNode(entry, runtimeValue) {
      const displayConfig = runtimeMeasureDisplayConfig(entry);
      let text = formatRuntimeMeasureValue(entry, runtimeValue);
      if (String(entry.type || '') === 'bool') {
        if (!runtimeValue || runtimeValue.status === 'not_found' || runtimeValue.status === 'unavailable') {
          text = String(displayConfig.unknownText || 'Indisponible');
        } else {
          text = runtimeValue.value
            ? String(displayConfig.activeText || 'Actif')
            : String(displayConfig.inactiveText || 'Arret');
        }
      }
      const badge = document.createElement('span');
      badge.className = 'status-chip';
      const badgeLabel = String(displayConfig.badgeLabel || '').trim();
      badge.textContent = badgeLabel ? (badgeLabel + ' : ' + text) : text;
      return badge;
    }

    function runtimeMeasureFlagRole(entry) {
      const displayConfig = runtimeMeasureDisplayConfig(entry);
      const role = String(displayConfig.flagRole || '').trim().toLowerCase();
      if (role === 'active' || role === 'resettable' || role === 'condition') return role;
      return '';
    }

    function runtimeMeasureFlagColumnLabel(entry) {
      const displayConfig = runtimeMeasureDisplayConfig(entry);
      const explicit = String(displayConfig.columnLabel || '').trim();
      if (explicit) return explicit;
      const role = runtimeMeasureFlagRole(entry);
      if (role === 'active') return 'Act.';
      if (role === 'resettable') return 'Reset';
      if (role === 'condition') return 'Cond.';
      return runtimeMeasureDisplayLabel(entry);
    }

    function normalizeRuntimeMeasureFlags(entry) {
      const rawFlags = Array.isArray(entry && entry.flags) ? entry.flags : [];
      return rawFlags
        .map((flag, index) => {
          const mask = Number(flag && flag.mask);
          const label = String(flag && flag.label ? flag.label : '').trim();
          if (!Number.isFinite(mask) || mask <= 0 || !label) return null;
          return {
            mask: Math.trunc(mask),
            label,
            order: Number.isFinite(Number(flag && flag.order)) ? Number(flag.order) : index
          };
        })
        .filter((flag) => !!flag)
        .sort((left, right) => left.order - right.order);
    }

    function runtimeMeasureMaskValue(runtimeValue) {
      if (!runtimeValue || runtimeValue.status === 'not_found' || runtimeValue.status === 'unavailable') {
        return null;
      }
      const value = Number(runtimeValue.value);
      if (!Number.isFinite(value)) return null;
      return Math.trunc(value);
    }

    function mergeRuntimeAlarmFlags(entries) {
      const byMask = new Map();

      (entries || []).forEach((entry) => {
        normalizeRuntimeMeasureFlags(entry).forEach((flag) => {
          if (!flag || !Number.isFinite(Number(flag.mask))) return;
          const mask = Math.trunc(Number(flag.mask));
          if (mask <= 0) return;
          const existing = byMask.get(mask);
          if (!existing) {
            byMask.set(mask, flag);
            return;
          }
          if ((!existing.label || !existing.label.trim()) && flag.label && flag.label.trim()) {
            byMask.set(mask, flag);
          }
        });
      });

      return Array.from(byMask.values())
        .sort((left, right) => {
          const leftOrder = Number.isFinite(Number(left && left.order)) ? Number(left.order) : 9999;
          const rightOrder = Number.isFinite(Number(right && right.order)) ? Number(right.order) : 9999;
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
          return Number(left.mask) - Number(right.mask);
        });
    }

    function buildRuntimeMeasureFlagCell(value, label, columnLabel) {
      const known = typeof value === 'boolean';
      const state = known ? (value ? 'is-true' : 'is-false') : 'is-empty';
      const marker = document.createElement('span');
      marker.className = 'status-flag-check ' + state;
      marker.textContent = known ? (value ? iconCheckText() : '') : '?';
      marker.setAttribute(
        'aria-label',
        label + ' / ' + columnLabel + ' : ' + (known ? (value ? 'oui' : 'non') : 'indisponible')
      );
      return marker;
    }

    function isRuntimeAlarmGroup(group) {
      if (!group) return false;
      if (String(group.domainKey || '').trim().toLowerCase() !== 'alarm') return false;
      return String(group.groupKey || '').trim().localeCompare('Alarmes', 'fr', { sensitivity: 'base' }) === 0;
    }

    function buildRuntimeAlarmStateNode(value) {
      const known = typeof value === 'boolean';
      const node = document.createElement('div');
      node.className = 'status-alarm-slot-state ' + (known ? (value ? 'is-true' : 'is-false') : 'is-empty');

      const dot = document.createElement('span');
      dot.className = 'status-state-dot';
      node.appendChild(dot);

      const text = document.createElement('span');
      text.className = 'status-alarm-slot-state-text';
      text.textContent = known ? (value ? 'Déclenchée' : 'OK') : 'Indispo';
      node.appendChild(text);
      return node;
    }

    function buildRuntimeAlarmConditionNode(value) {
      const known = typeof value === 'boolean';
      const node = document.createElement('div');
      node.className = 'status-alarm-slot-condition ' + (known ? (value ? 'is-true' : 'is-false') : 'is-empty');
      node.textContent = known ? ('Statut: ' + (value ? 'KO' : 'OK')) : 'Statut: ?';
      return node;
    }

    function buildRuntimeAlarmGrid(entries, valueById) {
      const columnsByRole = new Map();
      const flagDefs = mergeRuntimeAlarmFlags(entries);

      (entries || []).forEach((entry) => {
        const role = runtimeMeasureFlagRole(entry);
        if (!role || columnsByRole.has(role)) return;
        columnsByRole.set(role, entry);
      });

      const activeEntry = columnsByRole.get('active') || null;
      const conditionEntry = columnsByRole.get('condition') || null;
      if (!flagDefs.length || (!activeEntry && !conditionEntry)) return null;

      const activeMaskValue = activeEntry ? runtimeMeasureMaskValue(valueById.get(Number(activeEntry.id))) : null;
      const conditionMaskValue = conditionEntry ? runtimeMeasureMaskValue(valueById.get(Number(conditionEntry.id))) : null;
      const maxSlots = 8;

      const grid = document.createElement('div');
      grid.className = 'status-alarm-slot-grid';

      for (let index = 0; index < maxSlots; index += 1) {
        const flag = flagDefs[index] || null;
        const tile = document.createElement('div');
        tile.className = 'status-alarm-slot';

        if (!flag) {
          tile.classList.add('is-empty');
          grid.appendChild(tile);
          continue;
        }

        const title = document.createElement('div');
        title.className = 'status-alarm-slot-title';
        title.textContent = flag.label;
        tile.appendChild(title);

        const footer = document.createElement('div');
        footer.className = 'status-alarm-slot-row';

        const activeValue = activeMaskValue === null ? null : ((activeMaskValue & flag.mask) !== 0);
        const conditionValue = conditionMaskValue === null ? null : ((conditionMaskValue & flag.mask) !== 0);
        footer.appendChild(buildRuntimeAlarmStateNode(activeValue));
        footer.appendChild(buildRuntimeAlarmConditionNode(conditionValue));

        tile.appendChild(footer);
        grid.appendChild(tile);
      }

      return grid;
    }

    function buildPoolAlarmSlotsGrid(slots) {
      const cleanSlots = Array(8).fill(null);
      if (Array.isArray(slots)) {
        slots.forEach((slot) => {
          const idx = Number(slot && slot.slot);
          if (Number.isInteger(idx) && idx >= 0 && idx < 8) cleanSlots[idx] = slot;
        });
      }

      const grid = document.createElement('div');
      grid.className = 'status-alarm-slot-grid';

      for (let i = 0; i < 8; i += 1) {
        const slot = cleanSlots[i] || null;
        const tile = document.createElement('div');
        tile.className = 'status-alarm-slot';
        const enabled = !!(slot && slot.enabled);
        if (!enabled) {
          tile.classList.add('is-empty');
          grid.appendChild(tile);
          continue;
        }

        const bgColor = slot && isValidHexColor(slot.bgColor) ? slot.bgColor : '';
        if (bgColor) tile.style.background = bgColor;

        const title = document.createElement('div');
        title.className = 'status-alarm-slot-title';
        title.textContent = slot && slot.label ? slot.label : 'Alarme';
        tile.appendChild(title);

        const footer = document.createElement('div');
        footer.className = 'status-alarm-slot-row';
        footer.appendChild(buildRuntimeAlarmStateNode(slot && slot.available ? !!slot.latched : null));
        footer.appendChild(buildRuntimeAlarmConditionNode(slot && slot.available && slot.conditionKnown ? !!slot.conditionTrue : null));
        tile.appendChild(footer);
        grid.appendChild(tile);
      }

      return grid;
    }

    function buildRuntimeMeasureFlagsTable(entries, valueById) {
      const columnsByRole = new Map();
      let flagDefs = [];

      (entries || []).forEach((entry) => {
        const role = runtimeMeasureFlagRole(entry);
        if (!role || columnsByRole.has(role)) return;
        columnsByRole.set(role, entry);
        if (!flagDefs.length) {
          flagDefs = normalizeRuntimeMeasureFlags(entry);
        }
      });

      if (!flagDefs.length || columnsByRole.size === 0) return null;

      const orderedColumns = ['active', 'condition']
        .map((role) => ({ role, entry: columnsByRole.get(role) || null }))
        .filter((column) => !!column.entry);
      if (!orderedColumns.length) return null;

      const table = document.createElement('table');
      table.className = 'status-flag-table';

      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      const nameHead = document.createElement('th');
      nameHead.scope = 'col';
      nameHead.textContent = 'Alarme';
      headRow.appendChild(nameHead);
      orderedColumns.forEach((column) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = runtimeMeasureFlagColumnLabel(column.entry);
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      flagDefs.forEach((flag) => {
        const row = document.createElement('tr');
        const labelCell = document.createElement('th');
        labelCell.scope = 'row';
        labelCell.textContent = flag.label;
        row.appendChild(labelCell);

        orderedColumns.forEach((column) => {
          const runtimeValue = valueById.get(Number(column.entry.id));
          const maskValue = runtimeMeasureMaskValue(runtimeValue);
          const cell = document.createElement('td');
          const enabled = maskValue === null ? null : ((maskValue & flag.mask) !== 0);
          cell.appendChild(buildRuntimeMeasureFlagCell(enabled, flag.label, runtimeMeasureFlagColumnLabel(column.entry)));
          row.appendChild(cell);
        });

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      return table;
    }

    function buildPoolMeasureCards(entries, values, options) {
      const fragment = document.createDocumentFragment();
      const opts = options && typeof options === 'object' ? options : {};
      const sondeSlots = Array.isArray(opts.sondeSlots) ? opts.sondeSlots : [];
      const alarmSlots = Array.isArray(opts.alarmSlots) ? opts.alarmSlots : [];
      const valueById = new Map();
      (values || []).forEach((item) => {
        const id = Number(item && item.id);
        if (Number.isFinite(id)) valueById.set(id, item);
      });

      const groups = [];
      const groupsByName = new Map();
      (entries || []).forEach((entry) => {
        const domainKey = String(entry.domain || 'runtime');
        const groupKey = String(entry.group || '').trim();
        const cardKey = domainKey + '::' + groupKey;
        const cardTitle = formatRuntimeGroupCardTitle(domainKey, groupKey);
        let group = groupsByName.get(cardKey);
        if (!group) {
          group = { name: cardTitle, domainKey, groupKey, entries: [] };
          groupsByName.set(cardKey, group);
          groups.push(group);
        }
        group.entries.push(entry);
      });

      groups.forEach((group) => {
        const card = document.createElement('div');
        card.className =
          'status-card status-card-runtime'
          + ' status-card-runtime-domain-' + runtimeMeasureCssSlug(group.domainKey)
          + ' status-card-runtime-group-' + runtimeMeasureCssSlug(group.groupKey);
        const isPoolModeGroup =
          String(group.domainKey || '').trim().toLowerCase() === 'mode' &&
          String(group.groupKey || '').trim().localeCompare('Mode', 'fr', { sensitivity: 'base' }) === 0;
        const isPoolSondesGroup = isPoolSondesGroupKey(group.domainKey, group.groupKey);
        const groupDisplayOptions = {
          displayLabelResolver: (entry) => runtimeMeasureDisplayLabel(entry),
          booleanTexts: isPoolModeGroup
            ? {
              activeText: 'Marche',
              inactiveText: 'Arrêt'
            }
            : null
        };

        const heading = document.createElement('h3');
        heading.textContent = group.name;
        card.appendChild(heading);

        if (isPoolSondesGroup) {
          card.appendChild(buildPoolSondeSlotsGrid(sondeSlots));
          fragment.appendChild(card);
          return;
        }

        const badgeNodes = [];
        const horizGaugeRows = [];
        const booleanNodes = [];
        const flagEntries = [];
        const valueRows = [];

        group.entries.forEach((entry) => {
          const runtimeValue = valueById.get(Number(entry.id));
          const display = runtimeMeasureDisplayKind(entry);
          if (display === 'badge') {
            badgeNodes.push(buildRuntimeMeasureBadgeNode(entry, runtimeValue));
            return;
          }
          if (display === 'threshold') {
            const thresholdNode = buildRuntimeMeasureThresholdNode(entry, runtimeValue);
            if (thresholdNode) {
              valueRows.push([
                runtimeMeasureResolvedLabel(entry, groupDisplayOptions),
                thresholdNode
              ]);
              return;
            }
          }
          if (display === 'horiz-gauge') {
            horizGaugeRows.push([
              runtimeMeasureResolvedLabel(entry, groupDisplayOptions),
              buildRuntimeMeasureHorizGaugeNode(entry, runtimeValue)
            ]);
            return;
          }
          if (display === 'boolean') {
            booleanNodes.push(buildRuntimeMeasureBooleanNode(entry, runtimeValue, groupDisplayOptions));
            return;
          }
          if (display === 'flags') {
            flagEntries.push(entry);
            return;
          }
          const thresholdNode = buildRuntimeMeasureThresholdNode(entry, runtimeValue);
          valueRows.push([
            runtimeMeasureResolvedLabel(entry, groupDisplayOptions),
            thresholdNode || formatRuntimeMeasureValue(entry, runtimeValue)
          ]);
        });

        if (badgeNodes.length) {
          const badgeRow = document.createElement('div');
          badgeRow.className = 'status-chip-row';
          badgeNodes.forEach((node) => badgeRow.appendChild(node));
          card.appendChild(badgeRow);
        }

        if (booleanNodes.length) {
          const stateGrid = buildFlowReadonlyStateGrid(booleanNodes);
          if (stateGrid) card.appendChild(stateGrid);
        }

        if (flagEntries.length) {
          if (isRuntimeAlarmGroup(group)) {
            const alarmGrid = alarmSlots.length
              ? buildPoolAlarmSlotsGrid(alarmSlots)
              : buildRuntimeAlarmGrid(flagEntries, valueById);
            if (alarmGrid) {
              card.appendChild(alarmGrid);
            } else {
              const flagTable = buildRuntimeMeasureFlagsTable(flagEntries, valueById);
              if (flagTable) card.appendChild(flagTable);
            }
          } else {
            const flagTable = buildRuntimeMeasureFlagsTable(flagEntries, valueById);
            if (flagTable) card.appendChild(flagTable);
          }
        }

        if (horizGaugeRows.length || valueRows.length) {
          const kv = document.createElement('div');
          kv.className = 'status-kv';
          horizGaugeRows.forEach((row) => appendFlowStatusRow(kv, row[0], row[1]));
          valueRows.forEach((row) => appendFlowStatusRow(kv, row[0], row[1]));
          card.appendChild(kv);
        }

        fragment.appendChild(card);
      });
      return fragment;
    }

    function renderPoolMeasureDomainButtons() {
      if (!poolMeasuresDomains) return;
      poolMeasuresDomains.innerHTML = '';
      deps.getRuntimeMeasureDomainKeys().forEach((domainKey) => {
        const state = poolMeasureDomainState[domainKey];
        const animation = takePoolMeasureDomainAnimation(domainKey);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'measure-domain-chip'
          + (state.active ? ' active' : '')
          + (state.loading ? ' is-loading' : '')
          + (animation ? ' is-pulsing' : '')
          + (animation && animation.activating ? ' is-activating' : '');
        button.setAttribute('aria-pressed', state.active ? 'true' : 'false');
        button.setAttribute('aria-label', (state.active ? 'Masquer ' : 'Afficher ') + formatRuntimeDomainLabel(domainKey));
        if (animation) {
          button.style.setProperty('--measure-ripple-x', animation.x);
          button.style.setProperty('--measure-ripple-y', animation.y);
        }

        const check = document.createElement('span');
        check.className = 'measure-domain-chip-check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = iconCheckText();
        button.appendChild(check);

        const label = document.createElement('span');
        label.className = 'measure-domain-chip-label';
        label.textContent = formatRuntimeDomainLabel(domainKey);
        button.appendChild(label);

        button.addEventListener('pointerdown', () => {
          button.classList.add('is-pressing');
        });
        ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((eventName) => {
          button.addEventListener(eventName, () => {
            button.classList.remove('is-pressing');
          });
        });
        button.addEventListener('click', async (event) => {
          primePoolMeasureDomainAnimation(domainKey, event, !state.active);
          await togglePoolMeasureDomain(domainKey);
        });
        poolMeasuresDomains.appendChild(button);
      });
    }

    function primePoolMeasureDomainAnimation(domainKey, event, activating) {
      const cleanDomain = normalizeRuntimeMeasureDomainKey(domainKey);
      if (!cleanDomain) return;
      let x = '50%';
      let y = '50%';
      const target = event && event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
      if (target) {
        const rect = target.getBoundingClientRect();
        const clientX = typeof event.clientX === 'number' ? event.clientX : rect.left + (rect.width / 2);
        const clientY = typeof event.clientY === 'number' ? event.clientY : rect.top + (rect.height / 2);
        const ratioX = Math.max(0, Math.min(100, ((clientX - rect.left) / Math.max(rect.width, 1)) * 100));
        const ratioY = Math.max(0, Math.min(100, ((clientY - rect.top) / Math.max(rect.height, 1)) * 100));
        x = ratioX.toFixed(1) + '%';
        y = ratioY.toFixed(1) + '%';
      }
      poolMeasureDomainAnimations[cleanDomain] = {
        until: Date.now() + 720,
        activating: !!activating,
        rendered: false,
        x,
        y
      };
    }

    function takePoolMeasureDomainAnimation(domainKey) {
      const cleanDomain = normalizeRuntimeMeasureDomainKey(domainKey);
      if (!cleanDomain) return null;
      const animation = poolMeasureDomainAnimations[cleanDomain];
      if (!animation) return null;
      if (animation.until <= Date.now()) {
        delete poolMeasureDomainAnimations[cleanDomain];
        return null;
      }
      if (animation.rendered) return null;
      animation.rendered = true;
      return animation;
    }

    function poolMeasureDomainHasRenderableData(domainKey, state) {
      const cleanDomain = normalizeRuntimeMeasureDomainKey(domainKey);
      const domainState = state && typeof state === 'object' ? state : null;
      if (!cleanDomain || !domainState) return false;
      if (cleanDomain === 'sondes' && Array.isArray(domainState.sondeSlots) && domainState.sondeSlots.length > 0) return true;
      if (cleanDomain === 'alarm' && Array.isArray(domainState.alarmSlots) && domainState.alarmSlots.length > 0) return true;
      return Array.isArray(domainState.entries) && domainState.entries.length > 0;
    }

    function renderPoolMeasuresGrid() {
      if (!poolMeasuresGrid) return;
      poolMeasuresGrid.innerHTML = '';

      const activeDomains = activePoolMeasureDomainKeys();
      if (!activeDomains.length) {
        const empty = document.createElement('div');
        empty.className = 'measure-domain-empty';
        empty.textContent = tr('dashboard.empty.activateBadge', 'Activez un badge pour charger un domaine.');
        poolMeasuresGrid.appendChild(empty);
        return;
      }

      let renderedCardCount = 0;
      activeDomains.forEach((domainKey) => {
        const state = poolMeasureDomainState[domainKey];
        const hasRenderableData = poolMeasureDomainHasRenderableData(domainKey, state);
        if (state.loading && !hasRenderableData) {
          const card = document.createElement('div');
          card.className = 'status-card';
          const heading = document.createElement('h3');
          heading.textContent = formatRuntimeDomainLabel(domainKey);
          const summary = document.createElement('p');
          summary.className = 'status-card-summary';
          summary.textContent = tr('dashboard.loading', 'Chargement en cours...');
          card.appendChild(heading);
          card.appendChild(summary);
          poolMeasuresGrid.appendChild(card);
          renderedCardCount += 1;
          return;
        }
        if (state.error && !hasRenderableData) {
          const card = document.createElement('div');
          card.className = 'status-card';
          const heading = document.createElement('h3');
          heading.textContent = formatRuntimeDomainLabel(domainKey);
          const summary = document.createElement('p');
          summary.className = 'status-card-summary';
          summary.textContent = state.error;
          card.appendChild(heading);
          card.appendChild(summary);
          poolMeasuresGrid.appendChild(card);
          renderedCardCount += 1;
          return;
        }
        if (!state.entries.length) {
          const card = document.createElement('div');
          card.className = 'status-card';
          const heading = document.createElement('h3');
          heading.textContent = formatRuntimeDomainLabel(domainKey);
          const summary = document.createElement('p');
          summary.className = 'status-card-summary';
          summary.textContent = tr('dashboard.empty.domainNoRuntime', 'Aucune valeur runtime exposee pour ce domaine.');
          card.appendChild(heading);
          card.appendChild(summary);
          poolMeasuresGrid.appendChild(card);
          renderedCardCount += 1;
          return;
        }
        const cards = buildPoolMeasureCards(state.entries, state.values, {
          sondeSlots: state.sondeSlots,
          alarmSlots: state.alarmSlots
        });
        renderedCardCount += cards.childNodes.length;
        poolMeasuresGrid.appendChild(cards);
      });

      if (renderedCardCount === 0) {
        const empty = document.createElement('div');
        empty.className = 'measure-domain-empty';
        empty.textContent = tr('dashboard.empty.activeDomainsNoRuntime', 'Aucune valeur runtime disponible pour les domaines actifs.');
        poolMeasuresGrid.appendChild(empty);
      }
    }

    function refreshPoolMeasuresStatus() {
      if (!poolMeasuresStatus) return;
      const activeDomains = activePoolMeasureDomainKeys();
      const domainLabel = (count) => count > 1
        ? tr('dashboard.status.domains.plural', 'Domaines')
        : tr('dashboard.status.domains.singular', 'Domaine');
      const valueLabel = (count) => count > 1
        ? tr('dashboard.status.values.plural', 'Valeurs')
        : tr('dashboard.status.values.singular', 'Valeur');
      if (!activeDomains.length) {
        poolMeasuresStatus.textContent =
          tr('dashboard.status.domains.singular', 'Domaine') + ': 0 | ' +
          tr('dashboard.status.values.singular', 'Valeur') + ': 0';
        return;
      }

      let loadingCount = 0;
      let errorCount = 0;
      let valueCount = 0;
      activeDomains.forEach((domainKey) => {
        const state = poolMeasureDomainState[domainKey];
        if (state.loading) loadingCount += 1;
        if (state.error) errorCount += 1;
        valueCount += state.entries.length;
        if (domainKey === 'sondes') {
          valueCount += Array.isArray(state.sondeSlots) ? state.sondeSlots.length : 0;
          valueCount += Array.isArray(state.alarmSlots) ? state.alarmSlots.length : 0;
        }
      });

      if (loadingCount > 0) {
        poolMeasuresStatus.textContent =
          tr('dashboard.status.loading', 'Chargement') + ': ' +
          loadingCount + ' ' +
          tr(loadingCount > 1 ? 'dashboard.status.domainWord.plural' : 'dashboard.status.domainWord.singular', loadingCount > 1 ? 'domaines' : 'domaine');
        return;
      }
      if (errorCount > 0) {
        poolMeasuresStatus.textContent =
          tr('dashboard.status.errors', 'Erreur(s)') + ': ' +
          errorCount + ' ' +
          tr(errorCount > 1 ? 'dashboard.status.domainWord.plural' : 'dashboard.status.domainWord.singular', errorCount > 1 ? 'domaines' : 'domaine');
        return;
      }
      poolMeasuresStatus.textContent =
        domainLabel(activeDomains.length) + ': ' + activeDomains.length + ' | ' +
        valueLabel(valueCount) + ': ' + valueCount;
    }

    function refreshPoolMeasuresView() {
      renderPoolMeasureDomainButtons();
      renderPoolMeasuresGrid();
      refreshPoolMeasuresStatus();
    }

    async function loadPoolMeasureDomain(domainKey, forceRefresh) {
      const cleanDomain = normalizeRuntimeMeasureDomainKey(domainKey);
      if (!cleanDomain) return;
      const state = poolMeasureDomainState[cleanDomain];
      if (!state.active) return;
      const hadRenderableData = poolMeasureDomainHasRenderableData(cleanDomain, state);
      const requestSeq = state.requestSeq + 1;
      state.requestSeq = requestSeq;
      state.loading = true;
      state.error = '';
      if (hadRenderableData) {
        renderPoolMeasureDomainButtons();
        refreshPoolMeasuresStatus();
      } else {
        refreshPoolMeasuresView();
      }

      try {
        const allEntries = await runtimeMeasureEntriesForDomain(cleanDomain, !!forceRefresh);
        const entries = cleanDomain === 'sondes'
          ? allEntries.filter((entry) => !isPoolDashboardGroupEntry(entry))
          : allEntries;
        const ids = entries.map((entry) => Number(entry.id)).filter((id) => Number.isFinite(id));
        const values = ids.length ? await fetchRuntimeValues(ids) : [];
        const sondeSlots = cleanDomain === 'sondes'
          ? await fetchPoolSondeSlots().catch(() => [])
          : [];
        const alarmSlots = cleanDomain === 'alarm'
          ? await fetchPoolAlarmSlots().catch(() => [])
          : [];
        if (state.requestSeq !== requestSeq) return;
        state.entries = entries;
        state.values = values;
        state.sondeSlots = sondeSlots;
        state.alarmSlots = alarmSlots;
        state.error = '';
      } catch (err) {
        if (state.requestSeq !== requestSeq) return;
        if (!hadRenderableData) {
          state.entries = [];
          state.values = [];
          state.sondeSlots = [];
          state.alarmSlots = [];
        }
        state.error = 'Chargement ' + formatRuntimeDomainLabel(cleanDomain) + ' echoue: ' + err;
      } finally {
        if (state.requestSeq === requestSeq) {
          state.loading = false;
        }
        refreshPoolMeasuresView();
      }
    }

    async function refreshActivePoolMeasureDomains(forceRefresh) {
      const activeDomains = activePoolMeasureDomainKeys();
      if (!activeDomains.length) {
        refreshPoolMeasuresView();
        return;
      }
      for (const domainKey of activeDomains) {
        if (!poolMeasureDomainState[domainKey].active) continue;
        await loadPoolMeasureDomain(domainKey, !!forceRefresh);
      }
    }

    async function togglePoolMeasureDomain(domainKey) {
      const cleanDomain = normalizeRuntimeMeasureDomainKey(domainKey);
      if (!cleanDomain) return;
      const state = poolMeasureDomainState[cleanDomain];
      if (state.active) {
        state.active = false;
        state.loading = false;
        state.error = '';
        state.sondeSlots = [];
        state.requestSeq += 1;
        refreshPoolMeasuresView();
        return;
      }
      state.active = true;
      await loadPoolMeasureDomain(cleanDomain, false);
    }

    function dashboardSetOverallState(kind, text, iconName) {
      if (!dashboardOverallState) return;
      const cleanKind = ['ok', 'alert', 'unavailable', 'loading'].includes(kind) ? kind : 'loading';
      dashboardOverallState.className = 'dashboard-overall-state is-' + cleanKind;
      dashboardOverallState.innerHTML = '';
      const icon = document.createElement('span');
      icon.className = 'ui-msr';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = iconName || (cleanKind === 'ok' ? 'check_circle' : (cleanKind === 'alert' ? 'warning' : 'progress_activity'));
      icon.dataset.fallback = cleanKind === 'ok' ? '✓' : (cleanKind === 'alert' ? '!' : '…');
      const label = document.createElement('span');
      label.textContent = text;
      dashboardOverallState.appendChild(icon);
      dashboardOverallState.appendChild(label);
    }

    function dashboardAppendConnectionBadge(label, ready, detail) {
      if (!dashboardConnectionBadges) return;
      const badge = document.createElement('span');
      badge.className = 'dashboard-connection-badge ' + (ready ? 'is-ok' : 'is-alert');
      badge.textContent = label;
      if (detail) badge.title = detail;
      dashboardConnectionBadges.appendChild(badge);
    }

    function dashboardCreateKpiCard(config) {
      const card = document.createElement('article');
      card.className = 'dashboard-kpi-card ' + (config.className || '');
      const icon = document.createElement('span');
      icon.className = 'ui-msr dashboard-kpi-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = config.icon;
      icon.dataset.fallback = ({ water: '💧', thermostat: '℃', science: 'pH', electric_bolt: 'mV', speed: 'bar' })[config.icon] || '•';
      const copy = document.createElement('div');
      copy.className = 'dashboard-kpi-copy';
      const label = document.createElement('span');
      label.className = 'dashboard-kpi-label';
      label.textContent = config.label;
      const valueWrap = document.createElement('span');
      valueWrap.className = 'dashboard-kpi-value';
      const value = document.createElement('span');
      value.textContent = config.value;
      valueWrap.appendChild(value);
      if (config.unit) {
        const unit = document.createElement('small');
        unit.textContent = config.unit;
        valueWrap.appendChild(unit);
      }
      copy.appendChild(label);
      copy.appendChild(valueWrap);
      card.appendChild(icon);
      card.appendChild(copy);
      return card;
    }

    function dashboardFormatNumber(value, decimals) {
      const n = Number(value);
      if (!Number.isFinite(n)) return '—';
      return n.toLocaleString(currentWebLocaleTag(), {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function dashboardSlotByRuntimeId(slotPayload, runtimeUiId) {
      const slots = Array.isArray(slotPayload && slotPayload.slots) ? slotPayload.slots : [];
      return slots.find((slot) => Number(slot && slot.runtime_ui_id) === Number(runtimeUiId)) || null;
    }

    function dashboardMetric(pool, slotPayload, config) {
      const direct = pool && pool[config.poolKey];
      if (direct !== null && typeof direct !== 'undefined' && Number.isFinite(Number(direct))) {
        return {
          value: dashboardFormatNumber(direct, config.decimals),
          unit: config.unit
        };
      }
      const slot = dashboardSlotByRuntimeId(slotPayload, config.runtimeUiId);
      const split = splitPoolSondeValue(slot);
      return {
        value: split.value === '--' ? '—' : split.value,
        unit: split.unit || (split.value !== '--' && split.value !== '-' ? config.unit : '')
      };
    }

    function poolOperatingModeValue(modes) {
      const source = modes && typeof modes === 'object' ? modes : {};
      if (!Object.prototype.hasOwnProperty.call(source, 'enabled')) return '';
      if (!toBool(source.enabled)) return 'maintenance';
      return toBool(source.auto_mode) ? 'automatic' : 'safe_manual';
    }

    function poolOperatingModePatch(value) {
      if (value === 'maintenance') return { enabled: false, auto_mode: false };
      if (value === 'safe_manual') return { enabled: true, auto_mode: false };
      if (value === 'automatic') return { enabled: true, auto_mode: true };
      return null;
    }

    function poolOperatingModeLabel(value) {
      if (value === 'maintenance') return tr('pool.mode.maintenance', 'Manuel / maintenance');
      if (value === 'safe_manual') return tr('pool.mode.safeManual', 'Manuel sécurisé');
      if (value === 'automatic') return tr('pool.mode.automatic', 'Automatique');
      return tr('pool.state.unknown', 'Inconnu');
    }

    function poolOperatingModeSyncControl(select, applyButton, status) {
      if (!select || !applyButton) return;
      const available = !!poolOperatingModeCurrent;
      if (available && select.dataset.modeDirty !== 'true') select.value = poolOperatingModeCurrent;
      select.disabled = !available || poolOperatingModeApplyBusy;
      applyButton.disabled = !available || poolOperatingModeApplyBusy || select.value === poolOperatingModeCurrent;
      if (status) {
        status.className = 'pool-operating-mode-status' + (poolOperatingModeStatusTone ? ' is-' + poolOperatingModeStatusTone : '');
        status.textContent = poolOperatingModeStatusMessage;
      }
    }

    function poolOperatingModeSyncAll(modes) {
      const nextMode = poolOperatingModeValue(modes);
      if (nextMode) poolOperatingModeCurrent = nextMode;
      poolOperatingModeSyncControl(dashboardOperatingMode, dashboardModeApply, dashboardModeStatus);
      poolOperatingModeSyncControl(poolOperatingMode, poolOperatingModeApply, poolOperatingModeStatus);
    }

    function poolOperatingModeSetStatus(message, tone) {
      poolOperatingModeStatusMessage = String(message || '');
      poolOperatingModeStatusTone = String(tone || '');
      poolOperatingModeSyncControl(dashboardOperatingMode, dashboardModeApply, dashboardModeStatus);
      poolOperatingModeSyncControl(poolOperatingMode, poolOperatingModeApply, poolOperatingModeStatus);
    }

    async function applyPoolOperatingMode(value) {
      const patchValues = poolOperatingModePatch(value);
      if (!patchValues || poolOperatingModeApplyBusy || value === poolOperatingModeCurrent) return false;
      poolOperatingModeApplyBusy = true;
      poolOperatingModeSetStatus(tr('pool.mode.applying', 'Application du mode…'), 'pending');
      try {
        await fetchOkJson(
          '/api/flowcfg/apply',
          createFormPostOptions({ patch: JSON.stringify({ 'poollogic/modes': patchValues }) }),
          tr('pool.mode.applyFailed', 'Changement de mode refusé'),
          fetchFlowRemoteQueued
        );
        poolOperatingModeCurrent = value;
        [dashboardOperatingMode, poolOperatingMode].forEach((select) => {
          if (!select) return;
          select.dataset.modeDirty = 'false';
          select.value = value;
        });
        if (!poolConfigModulesCache['poollogic/modes']) poolConfigModulesCache['poollogic/modes'] = {};
        Object.assign(poolConfigModulesCache['poollogic/modes'], patchValues);
        poolOperatingModeSetStatus(
          tr('pool.mode.applied', 'Mode appliqué : {mode}.').replace('{mode}', poolOperatingModeLabel(value)),
          'ok'
        );
        poolConfigLoadedOnce = false;
        if (getActivePageId() === 'page-pool') await loadPoolConfig(true);
        else await refreshDashboardOverview(true);
        return true;
      } catch (err) {
        poolOperatingModeSetStatus(tr('pool.mode.applyFailed', 'Changement de mode refusé') + ' : ' + String(err), 'error');
        return false;
      } finally {
        poolOperatingModeApplyBusy = false;
        poolOperatingModeSyncAll(poolConfigModulesCache['poollogic/modes'] || {});
      }
    }

    function renderDashboardOverviewSkeleton() {
      if (dashboardModeTitle) dashboardModeTitle.textContent = tr('dashboard.loading', 'Chargement en cours...');
      if (dashboardOperatingMode) dashboardOperatingMode.disabled = true;
      if (dashboardModeApply) dashboardModeApply.disabled = true;
      if (dashboardSummary) dashboardSummary.textContent = tr('dashboard.overview.loading', 'Lecture de l’état de la piscine et des équipements…');
      if (dashboardConnectionBadges) dashboardConnectionBadges.innerHTML = '';
      dashboardSetOverallState('loading', tr('dashboard.loading', 'Chargement en cours...'), 'progress_activity');
      if (dashboardKpiGrid) {
        dashboardKpiGrid.innerHTML = '';
        [
          ['Température eau', 'water', 'is-water'],
          ['Température air', 'thermostat', 'is-air'],
          ['pH', 'science', 'is-ph'],
          ['ORP', 'electric_bolt', 'is-orp'],
          ['Pression', 'speed', 'is-pressure']
        ].forEach((item) => dashboardKpiGrid.appendChild(dashboardCreateKpiCard({
          label: item[0], value: '—', unit: '', icon: item[1], className: item[2]
        })));
      }
      if (dashboardEquipmentCount) dashboardEquipmentCount.textContent = '—';
      if (dashboardEquipmentGrid) dashboardEquipmentGrid.innerHTML = '';
      if (dashboardFiltrationState) {
        dashboardFiltrationState.className = 'dashboard-state-pill is-unknown';
        dashboardFiltrationState.textContent = '—';
      }
      if (dashboardFiltrationStart) dashboardFiltrationStart.textContent = '—';
      if (dashboardFiltrationStop) dashboardFiltrationStop.textContent = '—';
      if (dashboardFiltrationProgress) dashboardFiltrationProgress.style.width = '0%';
      if (dashboardFiltrationHint) dashboardFiltrationHint.textContent = tr('dashboard.filtration.loading', 'Chargement de la plage calculée…');
      if (dashboardAlarmCount) dashboardAlarmCount.textContent = '—';
      if (dashboardAlarmList) dashboardAlarmList.innerHTML = '';
    }

    function dashboardNormalizeAlarmSlots(slotPayload) {
      const slots = Array.isArray(slotPayload && slotPayload.alarm_slots) ? slotPayload.alarm_slots : [];
      return slots.map((slot) => ({
        label: String(slot && slot.label ? slot.label : '').trim(),
        enabled: !!(slot && slot.enabled),
        available: !!(slot && slot.available),
        latched: !!(slot && slot.latched),
        conditionKnown: !!(slot && slot.condition_known),
        conditionTrue: !!(slot && slot.condition_true)
      }));
    }

    function dashboardSchedule(filtration) {
      const data = filtration && typeof filtration === 'object' ? filtration : {};
      if (Number.isFinite(Number(data.filtr_start_minute)) && Number.isFinite(Number(data.filtr_stop_minute))) {
        return {
          startValue: Number(data.filtr_start_minute),
          stopValue: Number(data.filtr_stop_minute),
          start: dashboardFormatMinuteOfDay(data.filtr_start_minute),
          stop: dashboardFormatMinuteOfDay(data.filtr_stop_minute),
          progress: dashboardDayProgressMinutes(data.filtr_start_minute, data.filtr_stop_minute)
        };
      }
      const startLegacy = data.filtr_start_clc ?? data.filtr_start_min;
      const stopLegacy = data.filtr_stop_clc ?? data.filtr_stop_max;
      if (!Number.isFinite(Number(startLegacy)) || !Number.isFinite(Number(stopLegacy))) return null;
      return {
        startValue: Number(startLegacy),
        stopValue: Number(stopLegacy),
        start: poolConfigFormatHour(startLegacy),
        stop: poolConfigFormatHour(stopLegacy),
        progress: poolConfigDayProgress(startLegacy, stopLegacy)
      };
    }

    function dashboardFormatMinuteOfDay(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return '—';
      const minute = Math.max(0, Math.min(1439, Math.trunc(n)));
      return String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
    }

    function dashboardDayProgressMinutes(startValue, stopValue) {
      const start = Number(startValue);
      const stopRaw = Number(stopValue);
      if (!Number.isFinite(start) || !Number.isFinite(stopRaw)) return 0;
      let stop = stopRaw;
      const now = new Date();
      let current = now.getHours() * 60 + now.getMinutes();
      if (stop <= start) {
        stop += 1440;
        if (current < start) current += 1440;
      }
      if (current <= start) return 0;
      if (current >= stop) return 100;
      return Math.max(0, Math.min(100, ((current - start) / (stop - start)) * 100));
    }

    function renderDashboardOverview(payload) {
      const pool = payload.poolDomain && payload.poolDomain.ok === true && payload.poolDomain.pool
        ? payload.poolDomain.pool
        : null;
      const wifi = payload.wifiDomain && payload.wifiDomain.ok === true && payload.wifiDomain.wifi
        ? payload.wifiDomain.wifi
        : null;
      const mqtt = payload.mqttDomain && payload.mqttDomain.ok === true && payload.mqttDomain.mqtt
        ? payload.mqttDomain.mqtt
        : null;
      const alarmDomain = payload.alarmDomain && payload.alarmDomain.ok === true && payload.alarmDomain.alm
        ? payload.alarmDomain.alm
        : {};
      const modes = payload.modes || {};
      const filtration = payload.filtration || {};
      const sensors = payload.sensors || {};
      const electrolysisFeedbackMonitored = Number(sensors.swg_fb_io_id) !== 65535;
      const poolLogicEnabled = Object.prototype.hasOwnProperty.call(modes, 'enabled') ? toBool(modes.enabled) : !!(pool && pool.has);
      const automatic = poolLogicEnabled && (Object.prototype.hasOwnProperty.call(modes, 'auto_mode') ? toBool(modes.auto_mode) : !!(pool && pool.auto));
      const winter = poolLogicEnabled && (Object.prototype.hasOwnProperty.call(modes, 'winter_mode') ? toBool(modes.winter_mode) : !!(pool && pool.wint));
      const modeTitle = !poolLogicEnabled
        ? tr('pool.mode.maintenance', 'Manuel / maintenance')
        : (automatic ? tr('pool.mode.automatic', 'Automatique') + (winter ? ' · ' + tr('dashboard.mode.winter', 'Hiver') : '') : tr('pool.mode.safeManual', 'Manuel sécurisé'));
      const schedule = dashboardSchedule(filtration);
      const treatment = Object.prototype.hasOwnProperty.call(modes, 'disinfection_type')
        ? poolConfigDisinfectionLabel(modes.disinfection_type)
        : '';

      poolOperatingModeSyncAll(modes);

      if (dashboardModeTitle) dashboardModeTitle.textContent = modeTitle;
      if (dashboardSummary) {
        const details = [];
        if (schedule) details.push(tr('dashboard.summary.filtration', 'Filtration {start}–{stop}').replace('{start}', schedule.start).replace('{stop}', schedule.stop));
        if (treatment) details.push(tr('dashboard.summary.treatment', 'Traitement : {treatment}').replace('{treatment}', treatment));
        dashboardSummary.textContent = details.length ? details.join(' · ') : tr('dashboard.summary.ready', 'État instantané de la piscine et des équipements.');
      }

      if (dashboardConnectionBadges) {
        dashboardConnectionBadges.innerHTML = '';
        const networkReady = !!(wifi && wifi.rdy);
        const networkType = wifi && String(wifi.typ || '').toLowerCase() === 'ethernet' ? 'Ethernet' : 'Wi-Fi';
        const networkLabel = networkReady
          ? networkType + (wifi.ip ? ' · ' + wifi.ip : '')
          : tr('dashboard.network.offline', 'Réseau indisponible');
        dashboardAppendConnectionBadge(networkLabel, networkReady, networkLabel);
        dashboardAppendConnectionBadge(mqtt && mqtt.rdy ? tr('dashboard.mqtt.connected', 'MQTT connecté') : tr('dashboard.mqtt.disconnected', 'MQTT déconnecté'), !!(mqtt && mqtt.rdy), mqtt && mqtt.srv ? String(mqtt.srv) : '');
        const adminAuthenticated = typeof isAdminAuthenticated === 'function' && isAdminAuthenticated();
        const recoveryActive = typeof isPhysicalRecoveryActive === 'function' && isPhysicalRecoveryActive();
        const recoveryMinutes = Math.max(1, Math.ceil((typeof getPhysicalRecoveryRemainingSeconds === 'function' ? getPhysicalRecoveryRemainingSeconds() : 0) / 60));
        dashboardAppendConnectionBadge(
          adminAuthenticated
            ? tr('header.security.admin', 'Administrateur connecté')
            : (recoveryActive ? ('Mode récupération · ' + recoveryMinutes + ' min') : tr('header.security.unauthenticated', 'Accès non authentifié')),
          adminAuthenticated || recoveryActive,
          recoveryActive ? 'Accès physique temporaire par bouton BOOT' : ''
        );
      }

      if (dashboardKpiGrid) {
        dashboardKpiGrid.innerHTML = '';
        [
          { poolKey: 'wat', runtimeUiId: 2201, decimals: 1, unit: '°C', label: tr('dashboard.kpi.water', 'Température eau'), icon: 'water', className: 'is-water' },
          { poolKey: 'air', runtimeUiId: 2202, decimals: 1, unit: '°C', label: tr('dashboard.kpi.air', 'Température air'), icon: 'thermostat', className: 'is-air' },
          { poolKey: 'ph', runtimeUiId: 2203, decimals: 2, unit: '', label: 'pH', icon: 'science', className: 'is-ph' },
          { poolKey: 'orp', runtimeUiId: 2204, decimals: 0, unit: 'mV', label: 'ORP', icon: 'electric_bolt', className: 'is-orp' },
          { poolKey: 'psi', runtimeUiId: 2206, decimals: 2, unit: 'bar', label: tr('dashboard.kpi.pressure', 'Pression'), icon: 'speed', className: 'is-pressure' }
        ].forEach((config) => {
          const metric = dashboardMetric(pool, payload.slotPayload, config);
          dashboardKpiGrid.appendChild(dashboardCreateKpiCard({ ...config, ...metric }));
        });
      }

      const disinfectionType = Number.parseInt(modes.disinfection_type, 10);
      const hasDisinfectionType = Number.isFinite(disinfectionType);
      const equipmentDefs = [
        { key: 'fil', label: tr('dashboard.equipment.filtration', 'Filtration'), icon: 'waves' },
        { key: 'php', label: tr('dashboard.equipment.phPump', 'Pompe pH'), icon: 'science' },
        {
          key: 'clp',
          label: disinfectionType === 2
            ? tr('dashboard.equipment.activeOxygenPump', 'Pompe oxygène actif')
            : tr('dashboard.equipment.chlorinePump', 'Pompe chlore'),
          icon: disinfectionType === 2 ? 'bubble_chart' : 'water_drop'
        },
        { key: 'swg', label: tr('dashboard.equipment.swg', 'Électrolyse'), icon: 'bolt' },
        { key: 'rbt', label: tr('dashboard.equipment.robot', 'Robot'), icon: 'smart_toy' },
        { key: 'fill', label: tr('dashboard.equipment.filling', 'Remplissage'), icon: 'faucet' },
        { key: 'htr', label: tr('dashboard.equipment.heater', 'Chauffage'), icon: 'local_fire_department' },
        { key: 'lgt', label: tr('dashboard.equipment.lights', 'Éclairage'), icon: 'lightbulb', equipmentKey: 'lights' }
      ];
      const visibleEquipmentDefs = equipmentDefs.filter((def) => {
        if (def.key === 'swg') return !hasDisinfectionType || disinfectionType === 1;
        if (def.key === 'clp') return !hasDisinfectionType || disinfectionType === 0 || disinfectionType === 2;
        return true;
      });
      let equipmentOnCount = 0;
      let equipmentAvailableCount = 0;
      if (dashboardEquipmentGrid) {
        dashboardEquipmentGrid.innerHTML = '';
        visibleEquipmentDefs.forEach((def) => {
          const available = !!pool && typeof pool[def.key] === 'boolean';
          const on = available && pool[def.key] === true;
          if (available) equipmentAvailableCount += 1;
          if (on) equipmentOnCount += 1;
          const actionable = def.equipmentKey === 'lights';
          const card = document.createElement(actionable ? 'button' : 'article');
          if (actionable) {
            card.type = 'button';
            card.disabled = !available || !!poolEquipmentCommandBusy;
            card.setAttribute('aria-label', on
              ? tr('dashboard.lights.turnOff', 'Éteindre l’éclairage')
              : tr('dashboard.lights.turnOn', 'Allumer l’éclairage'));
            card.addEventListener('click', () => {
              const equipmentDef = poolEquipmentDefs.find((entry) => entry.key === def.equipmentKey);
              if (equipmentDef) commandPoolEquipment(equipmentDef, !on).catch(() => {});
            });
          }
          card.className = 'dashboard-equipment-card '
            + ' is-equipment-' + def.key + ' '
            + (actionable ? ' is-actionable ' : '')
            + (def.key === 'lgt' ? ' is-lighting ' : '')
            + (available ? (on ? 'is-on' : 'is-off') : 'is-unavailable');
          const icon = document.createElement('span');
          icon.className = 'ui-msr';
          icon.setAttribute('aria-hidden', 'true');
          icon.textContent = def.icon;
          icon.dataset.fallback = ({ waves: '≈', science: 'pH', bubble_chart: 'O₂', water_drop: 'Cl', bolt: '⚡', smart_toy: 'R', faucet: '↧', local_fire_department: '♨', lightbulb: '☀' })[def.icon] || '•';
          const label = document.createElement('strong');
          label.textContent = def.label;
          const state = document.createElement('span');
          const commandOnly = def.key === 'swg' && !electrolysisFeedbackMonitored;
          state.textContent = !available
            ? tr('dashboard.equipment.unavailable', 'Indisponible')
            : (on
              ? (commandOnly ? tr('dashboard.equipment.commanded', 'Commandé') : tr('dashboard.equipment.on', 'En marche'))
              : tr('dashboard.equipment.off', 'À l’arrêt'));
          card.appendChild(icon);
          card.appendChild(label);
          card.appendChild(state);
          dashboardEquipmentGrid.appendChild(card);
        });
      }
      if (dashboardEquipmentCount) {
        dashboardEquipmentCount.textContent = equipmentAvailableCount ? equipmentOnCount + '/' + equipmentAvailableCount : '—';
        dashboardEquipmentCount.className = 'dashboard-count-badge' + (equipmentOnCount > 0 ? ' is-ok' : '');
      }

      const lightsAvailable = !!pool && typeof pool.lgt === 'boolean';
      dashboardLightsOn = lightsAvailable ? pool.lgt === true : null;
      if (dashboardLightsShortcut) {
        dashboardLightsShortcut.disabled = !lightsAvailable || !!poolEquipmentCommandBusy;
        dashboardLightsShortcut.classList.toggle('is-on', dashboardLightsOn === true);
        dashboardLightsShortcut.classList.toggle('is-unavailable', !lightsAvailable);
        dashboardLightsShortcut.setAttribute('aria-label', dashboardLightsOn === true
          ? tr('dashboard.lights.turnOff', 'Éteindre l’éclairage')
          : tr('dashboard.lights.turnOn', 'Allumer l’éclairage'));
        dashboardLightsShortcut.title = !lightsAvailable
          ? tr('dashboard.equipment.unavailable', 'Indisponible')
          : (dashboardLightsOn === true
            ? tr('dashboard.lights.turnOff', 'Éteindre l’éclairage')
            : tr('dashboard.lights.turnOn', 'Allumer l’éclairage'));
      }

      const filtrationAvailable = !!pool && typeof pool.fil === 'boolean';
      const filtrationOn = filtrationAvailable && pool.fil === true;
      if (dashboardFiltrationState) {
        dashboardFiltrationState.className = 'dashboard-state-pill ' + (filtrationAvailable ? (filtrationOn ? 'is-on' : 'is-off') : 'is-unknown');
        dashboardFiltrationState.textContent = !filtrationAvailable ? tr('dashboard.equipment.unavailable', 'Indisponible') : (filtrationOn ? tr('dashboard.filtration.running', 'En cours') : tr('dashboard.filtration.stopped', 'Arrêtée'));
      }
      if (dashboardFiltrationStart) dashboardFiltrationStart.textContent = schedule ? schedule.start : '—';
      if (dashboardFiltrationStop) dashboardFiltrationStop.textContent = schedule ? schedule.stop : '—';
      if (dashboardFiltrationProgress) dashboardFiltrationProgress.style.width = (schedule ? schedule.progress : 0).toFixed(1) + '%';
      if (dashboardFiltrationHint) {
        dashboardFiltrationHint.textContent = schedule
          ? (filtrationOn ? tr('dashboard.filtration.hint.running', 'Cycle actif dans la plage calculée.') : tr('dashboard.filtration.hint.next', 'Plage calculée pour le cycle de filtration.'))
          : tr('dashboard.filtration.hint.unavailable', 'Plage calculée indisponible.');
      }

      const slotAlarms = poolConfigActiveAlarms(dashboardNormalizeAlarmSlots(payload.slotPayload));
      const alarmCodes = Array.isArray(alarmDomain.codes) ? alarmDomain.codes.map((code) => String(code || '').trim()).filter(Boolean) : [];
      const alarmCount = Math.max(Number(alarmDomain.cnt) || 0, slotAlarms.length, alarmCodes.length);
      const alarmRows = slotAlarms.length
        ? slotAlarms
        : alarmCodes.map((code) => ({ label: code.replace(/^alarm_/, tr('dashboard.alarm.generic', 'Alarme').trim() + ' '), state: tr('pool.alarm.state.activeCondition', 'condition active') }));
      if (dashboardAlarmCount) {
        dashboardAlarmCount.textContent = String(alarmCount);
        dashboardAlarmCount.className = 'dashboard-count-badge ' + (alarmCount ? 'is-alert' : 'is-ok');
      }
      if (dashboardAlarmList) {
        dashboardAlarmList.innerHTML = '';
        if (!alarmCount) {
          const empty = document.createElement('div');
          empty.className = 'dashboard-alarm-empty';
          empty.innerHTML = '<span class="ui-msr" aria-hidden="true">verified</span>';
          const text = document.createElement('span');
          text.textContent = tr('dashboard.alarm.none', 'Aucune alarme active');
          empty.appendChild(text);
          dashboardAlarmList.appendChild(empty);
        } else {
          const rows = alarmRows.length ? alarmRows : [{ label: tr('pool.alarm.defaultLabel', 'Alarme piscine'), state: tr('pool.alarm.state.activeCondition', 'condition active') }];
          rows.forEach((alarm) => {
            const row = document.createElement('div');
            row.className = 'dashboard-alarm-row';
            const icon = document.createElement('span');
            icon.className = 'ui-msr';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = 'warning';
            const copy = document.createElement('div');
            const label = document.createElement('strong');
            label.textContent = alarm.label;
            const state = document.createElement('span');
            state.textContent = alarm.state;
            copy.appendChild(label);
            copy.appendChild(state);
            row.appendChild(icon);
            row.appendChild(copy);
            dashboardAlarmList.appendChild(row);
          });
        }
      }
      if (alarmCount > 0) {
        dashboardSetOverallState('alert', alarmCount > 1 ? tr('dashboard.state.alarms', '{count} alarmes actives').replace('{count}', String(alarmCount)) : tr('dashboard.state.alarm', '1 alarme active'), 'warning');
      } else if (pool) {
        dashboardSetOverallState('ok', tr('dashboard.state.normal', 'État disponible — aucune alarme active'), 'check_circle');
      } else {
        dashboardSetOverallState('unavailable', tr('dashboard.state.unavailable', 'État piscine indisponible'), 'cloud_off');
      }
    }

    async function refreshDashboardOverview(forceRefresh) {
      const reqSeq = ++dashboardOverviewReqSeq;
      if (forceRefresh || !dashboardOverviewLoadedOnce) renderDashboardOverviewSkeleton();
      const safe = (promise) => promise.catch(() => null);
      const results = await Promise.all([
        safe(fetchFlowStatusDomain('pool', !!forceRefresh, 'dashboard')),
        safe(fetchFlowStatusDomain('wifi', !!forceRefresh, 'dashboard')),
        safe(fetchFlowStatusDomain('mqtt', !!forceRefresh, 'dashboard')),
        safe(fetchFlowStatusDomain('alarm', !!forceRefresh, 'dashboard')),
        safe(fetchPoolDashboardSlots()),
        safe(poolConfigFetchModule('poollogic/modes')),
        safe(poolConfigFetchModule('poollogic/filtration')),
        safe(poolConfigFetchModule('poollogic/sensors'))
      ]);
      if (reqSeq !== dashboardOverviewReqSeq) return;
      const payload = {
        poolDomain: results[0],
        wifiDomain: results[1],
        mqttDomain: results[2],
        alarmDomain: results[3],
        slotPayload: results[4] || {},
        modes: results[5] && results[5].data ? results[5].data : {},
        filtration: results[6] && results[6].data ? results[6].data : {},
        sensors: results[7] && results[7].data ? results[7].data : {}
      };
      dashboardOverviewLoadedOnce = true;
      renderDashboardOverview(payload);
    }

    async function refreshPoolMeasures(forceRefresh) {
      await Promise.all([
        refreshDashboardOverview(!!forceRefresh),
        refreshActivePoolMeasureDomains(!!forceRefresh)
      ]);
    }

    async function onPoolMeasuresPageShown() {
      refreshPoolMeasuresView();
      startPoolMeasuresTimer();
      try {
        await refreshPoolMeasures(!dashboardOverviewLoadedOnce);
      } catch (err) {
        showPoolMeasuresError(err);
      }
    }

    function poolConfigDisinfectionLabel(value) {
      const n = Number(value);
      if (n === 0) return tr('pool.disinfection.chlorine.title', 'Chlore / Brome');
      if (n === 1) return tr('pool.disinfection.swg.title', 'Électrolyse');
      if (n === 2) return tr('pool.disinfection.o2.title', 'Oxygène actif');
      if (n === 3) return tr('pool.disinfection.disabled', 'Désactivé');
      return tr('pool.state.unknown', 'Inconnu');
    }

    function poolConfigBoolLabel(value, activeText, inactiveText) {
      return toBool(value) ? (activeText || tr('pool.state.active', 'Actif')) : (inactiveText || tr('pool.state.stopped', 'Arrêt'));
    }

    function poolEquipmentAutomaticMode(modules) {
      const modes = modules && modules['poollogic/modes'];
      if (!modes || typeof modes !== 'object') return false;
      return toBool(modes.enabled) && toBool(modes.auto_mode);
    }

    function poolEquipmentSetStatus(message, tone) {
      poolEquipmentStatusMessage = String(message || '').trim();
      poolEquipmentStatusTone = String(tone || '').trim();
    }

    function poolEquipmentErrorText(err) {
      const raw = String(err || '');
      if (raw.includes('InterlockBlocked')) {
        return tr('pool.control.error.interlock', 'Commande bloquée par une sécurité ou une condition de fonctionnement.');
      }
      if (raw.includes('MaxUptimeReached')) {
        return tr('pool.control.error.maxUptime', 'Commande bloquée : durée maximale de fonctionnement atteinte.');
      }
      if (raw.includes('Disabled')) {
        return tr('pool.control.error.disabled', 'Cet équipement est désactivé dans la configuration.');
      }
      if (raw.includes('NotReady')) {
        return tr('pool.control.error.notReady', 'Équipement momentanément indisponible.');
      }
      return tr('pool.control.error.generic', 'Commande refusée.') + ' ' + raw;
    }

    function poolEquipmentBuildSwitch(def, on, disabled) {
      const wrap = document.createElement('label');
      wrap.className = 'md3-switch pool-equipment-switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!on;
      input.disabled = !!disabled;
      input.setAttribute('aria-label', tr(def.labelKey, def.label));
      const track = document.createElement('span');
      track.className = 'md3-track';
      const thumb = document.createElement('span');
      thumb.className = 'md3-thumb';
      wrap.appendChild(input);
      wrap.appendChild(track);
      wrap.appendChild(thumb);
      return { wrap, input };
    }

    async function commandPoolEquipment(def, desired) {
      if (!def || poolEquipmentCommandBusy) return false;
      poolEquipmentCommandBusy = def.key;
      poolEquipmentSetStatus(
        (desired ? tr('pool.control.starting', 'Mise en marche') : tr('pool.control.stopping', 'Arrêt'))
          + ' · ' + tr(def.labelKey, def.label) + '…',
        'pending'
      );
      if (getActivePageId() === 'page-pool') {
        renderPoolEquipmentControl(poolConfigModulesCache, poolConfigLiveState);
      }
      try {
        await fetchOkJson(
          '/api/poollogic/equipment',
          createFormPostOptions({ equipment: def.key, value: desired ? 'true' : 'false' }),
          tr('pool.control.error.generic', 'Commande refusée.'),
          fetchFlowRemoteQueued
        );
        await waitMs(350);
        const poolResult = await fetchFlowStatusDomain('pool', true, 'equipment-command').catch(() => null);
        if (poolResult && poolResult.pool && typeof poolResult.pool === 'object') {
          poolConfigLiveState = { ...poolResult.pool };
          if (typeof poolConfigLiveState.lgt === 'boolean') dashboardLightsOn = poolConfigLiveState.lgt;
        }
        poolEquipmentSetStatus(
          tr('pool.control.applied', 'Commande appliquée') + ' · ' + tr(def.labelKey, def.label) + '.',
          'ok'
        );
        return true;
      } catch (err) {
        poolEquipmentSetStatus(poolEquipmentErrorText(err), 'error');
        return false;
      } finally {
        poolEquipmentCommandBusy = '';
        if (getActivePageId() === 'page-pool') {
          renderPoolEquipmentControl(poolConfigModulesCache, poolConfigLiveState);
        }
        if (getActivePageId() === 'page-pool-measures') {
          refreshDashboardOverview(true).catch(() => {});
        }
      }
    }

    async function applyPoolEquipmentModeSetting(key, desired, label, moduleName) {
      if (!key || poolEquipmentCommandBusy || poolConfigFieldApplyBusy) return false;
      const targetModule = moduleName || 'poollogic/modes';
      poolEquipmentCommandBusy = 'mode:' + key;
      poolEquipmentSetStatus(tr('pool.control.settingPending', 'Application du réglage…'), 'pending');
      renderPoolEquipmentControl(poolConfigModulesCache, poolConfigLiveState);
      try {
        const patch = { [targetModule]: {} };
        patch[targetModule][key] = !!desired;
        await fetchOkJson(
          '/api/flowcfg/apply',
          createFormPostOptions({ patch: JSON.stringify(patch) }),
          tr('pool.control.settingFailed', 'Modification du réglage refusée'),
          fetchFlowRemoteQueued
        );
        if (!poolConfigModulesCache[targetModule]) poolConfigModulesCache[targetModule] = {};
        poolConfigModulesCache[targetModule][key] = !!desired;
        poolEquipmentSetStatus(
          tr('pool.control.settingApplied', 'Réglage appliqué : {label}.').replace('{label}', String(label || key)),
          'ok'
        );
        poolConfigLoadedOnce = false;
        await loadPoolConfig(true);
        return true;
      } catch (err) {
        poolEquipmentSetStatus(tr('pool.control.settingFailed', 'Modification du réglage refusée') + ' : ' + String(err), 'error');
        return false;
      } finally {
        poolEquipmentCommandBusy = '';
        if (getActivePageId() === 'page-pool') renderPoolEquipmentControl(poolConfigModulesCache, poolConfigLiveState);
      }
    }

    function renderPoolEquipmentControl(modules, liveState) {
      if (!poolEquipmentControl) return;
      const state = liveState && typeof liveState === 'object' ? liveState : {};
      const modes = modules && modules['poollogic/modes'] && typeof modules['poollogic/modes'] === 'object'
        ? modules['poollogic/modes']
        : {};
      const heaterConfig = modules && modules['poollogic/heater'] && typeof modules['poollogic/heater'] === 'object'
        ? modules['poollogic/heater']
        : {};
      const sensors = modules && modules['poollogic/sensors'] && typeof modules['poollogic/sensors'] === 'object'
        ? modules['poollogic/sensors']
        : {};
      const electrolysisFeedbackMonitored = Number(sensors.swg_fb_io_id) !== 65535;
      const automatic = poolEquipmentAutomaticMode(modules);
      poolEquipmentControl.innerHTML = '';

      const heading = document.createElement('div');
      heading.className = 'pool-section-heading pool-equipment-heading';
      const headingIcon = document.createElement('span');
      headingIcon.className = 'ui-msr';
      headingIcon.setAttribute('aria-hidden', 'true');
      headingIcon.textContent = 'toggle_on';
      const headingCopy = document.createElement('div');
      const title = document.createElement('h2');
      title.textContent = tr('pool.control.title', 'Contrôle des équipements');
      const intro = document.createElement('p');
      intro.textContent = automatic
        ? tr('pool.control.autoNote', 'Mode automatique actif : les commandes automatisées sont verrouillées ici. L’éclairage reste directement accessible.')
        : tr('pool.control.manualNote', 'Commandes directes avec retour de l’état réellement constaté. Les sécurités matérielles restent prioritaires.');
      headingCopy.appendChild(title);
      headingCopy.appendChild(intro);
      heading.appendChild(headingIcon);
      heading.appendChild(headingCopy);
      poolEquipmentControl.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'pool-equipment-grid';

      const winterAvailable = Object.prototype.hasOwnProperty.call(modes, 'winter_mode');
      const winterOn = winterAvailable && toBool(modes.winter_mode);
      const winterPending = poolEquipmentCommandBusy === 'mode:winter_mode';
      const winterCard = document.createElement('article');
      winterCard.className = 'pool-equipment-card is-mode is-equipment-winter'
        + (winterAvailable ? (winterOn ? ' is-on' : ' is-off') : ' is-unavailable')
        + (winterPending ? ' is-pending' : '');
      const winterTop = document.createElement('div');
      winterTop.className = 'pool-equipment-card-top';
      const winterIcon = document.createElement('span');
      winterIcon.className = 'ui-msr pool-equipment-icon';
      winterIcon.setAttribute('aria-hidden', 'true');
      winterIcon.textContent = 'ac_unit';
      const winterState = document.createElement('span');
      winterState.className = 'pool-equipment-state';
      winterState.textContent = winterPending
        ? tr('pool.control.pending', 'Commande…')
        : (!winterAvailable
          ? tr('dashboard.equipment.unavailable', 'Indisponible')
          : (winterOn ? tr('pool.state.forced', 'Forcé') : tr('pool.state.normal', 'Normal')));
      winterTop.appendChild(winterIcon);
      winterTop.appendChild(winterState);
      const winterName = document.createElement('h3');
      winterName.textContent = tr('pool.control.winterMode', 'Mode hiver');
      const winterNote = document.createElement('p');
      winterNote.textContent = tr('pool.control.winterMode.note', 'Force le fonctionnement en mode hiver pour la protection anti-gel.');
      const winterFooter = document.createElement('div');
      winterFooter.className = 'pool-equipment-card-footer';
      const winterAction = document.createElement('span');
      winterAction.textContent = winterOn ? tr('pool.control.disable', 'Désactiver') : tr('pool.control.enable', 'Activer');
      const winterToggle = poolEquipmentBuildSwitch(
        { labelKey: 'pool.control.winterMode', label: 'Mode hiver' },
        winterOn,
        !winterAvailable || !!poolEquipmentCommandBusy || poolConfigFieldApplyBusy
      );
      winterToggle.input.addEventListener('change', () => {
        const desired = winterToggle.input.checked;
        applyPoolEquipmentModeSetting('winter_mode', desired, tr('pool.control.winterMode', 'Mode hiver')).then((ok) => {
          if (!ok) winterToggle.input.checked = !desired;
        });
      });
      winterFooter.appendChild(winterAction);
      winterFooter.appendChild(winterToggle.wrap);
      winterCard.appendChild(winterTop);
      winterCard.appendChild(winterName);
      winterCard.appendChild(winterNote);
      winterCard.appendChild(winterFooter);
      const disinfectionType = Number.parseInt(modes.disinfection_type, 10);
      const hasDisinfectionType = Number.isFinite(disinfectionType);
      const visibleEquipmentDefs = poolEquipmentDefs
        .filter((def) => {
          if (typeof state[def.stateKey] !== 'boolean') return false;
          if (def.key === 'electrolysis') return !hasDisinfectionType || disinfectionType === 1;
          if (def.key === 'chlorine') return !hasDisinfectionType || disinfectionType === 0 || disinfectionType === 2;
          return true;
        })
        .map((def) => {
          if (def.key !== 'chlorine' || disinfectionType !== 2) return def;
          return {
            ...def,
            labelKey: 'pool.control.activeOxygen',
            label: 'Pompe oxygène actif',
            icon: 'bubble_chart',
            noteKey: 'pool.control.activeOxygen.note',
            note: 'Injecte l’oxygène actif dans le bassin.'
          };
        });

      let winterInserted = false;
      visibleEquipmentDefs.forEach((def) => {
        if (!winterInserted && (def.key === 'robot' || def.key === 'heater' || def.key === 'filling')) {
          grid.appendChild(winterCard);
          winterInserted = true;
        }
        const available = typeof state[def.stateKey] === 'boolean';
        const on = available && state[def.stateKey] === true;
        const blockedByAutomatic = automatic && def.automatic;
        const pending = poolEquipmentCommandBusy === def.key;
        const disabled = !available || blockedByAutomatic || !!poolEquipmentCommandBusy;
        const isLights = def.key === 'lights';
        const commandOnly = def.key === 'electrolysis' && !electrolysisFeedbackMonitored;
        const card = document.createElement('article');
        card.className = 'pool-equipment-card'
          + ' is-equipment-' + def.key
          + (def.featured ? ' is-featured' : '')
          + (isLights ? ' is-lighting' : '')
          + (available ? (on ? ' is-on' : ' is-off') : ' is-unavailable')
          + (blockedByAutomatic ? ' is-automatic' : '')
          + (pending ? ' is-pending' : '');

        const top = document.createElement('div');
        top.className = 'pool-equipment-card-top';
        const icon = document.createElement('span');
        icon.className = 'ui-msr pool-equipment-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = def.icon;
        const stateLabel = document.createElement('span');
        stateLabel.className = 'pool-equipment-state';
        stateLabel.textContent = pending
          ? tr('pool.control.pending', 'Commande…')
          : (!available
            ? tr('dashboard.equipment.unavailable', 'Indisponible')
            : (on
              ? (isLights
                ? tr('pool.control.on', 'Allumé')
                : (commandOnly ? tr('pool.control.commanded', 'Commandé') : tr('pool.control.running', 'En marche')))
              : (isLights ? tr('pool.control.off', 'Éteint') : tr('pool.control.stopped', 'À l’arrêt'))));
        top.appendChild(icon);
        top.appendChild(stateLabel);

        const name = document.createElement('h3');
        name.textContent = tr(def.labelKey, def.label);
        const note = document.createElement('p');
        note.textContent = commandOnly
          ? tr('pool.control.commandOnlyNote', 'Ordre envoyé au relais ; aucun retour matériel n’est configuré.')
          : (blockedByAutomatic
            ? tr('pool.control.automatic', 'Piloté automatiquement')
            : tr(def.noteKey, def.note));
        const footer = document.createElement('div');
        footer.className = 'pool-equipment-card-footer';
        const actionText = document.createElement('span');
        actionText.textContent = on
          ? (isLights ? tr('pool.control.action.stop', 'Éteindre') : tr('pool.control.action.stopEquipment', 'Arrêter'))
          : (isLights ? tr('pool.control.action.start', 'Allumer') : tr('pool.control.action.startEquipment', 'Démarrer'));
        const toggle = poolEquipmentBuildSwitch(def, on, disabled);
        toggle.input.addEventListener('change', () => {
          const desired = toggle.input.checked;
          commandPoolEquipment(def, desired).then((ok) => {
            if (!ok) toggle.input.checked = !desired;
          });
        });
        footer.appendChild(actionText);
        footer.appendChild(toggle.wrap);
        card.appendChild(top);
        card.appendChild(name);
        card.appendChild(note);
        if (def.key === 'robot' || def.key === 'heater') {
          const isHeaterAuto = def.key === 'heater';
          const autoKey = isHeaterAuto ? 'heater_auto_mode' : 'robot_auto_mode';
          const autoModule = isHeaterAuto ? 'poollogic/heater' : 'poollogic/modes';
          const autoSource = isHeaterAuto ? heaterConfig : modes;
          const autoLabelKey = isHeaterAuto ? 'pool.control.heaterAutomatic' : 'pool.control.robotAutomatic';
          const autoLabelFallback = isHeaterAuto ? 'Chauffage automatique' : 'Robot automatique';
          const autoNoteKey = isHeaterAuto ? 'pool.control.heaterAutomatic.note' : 'pool.control.robotAutomatic.note';
          const autoNoteFallback = isHeaterAuto
            ? 'Régule automatiquement la température selon la consigne.'
            : 'Autorise le lancement selon la programmation.';
          const autoAvailable = Object.prototype.hasOwnProperty.call(autoSource, autoKey);
          const autoOn = autoAvailable && toBool(autoSource[autoKey]);
          const autoPending = poolEquipmentCommandBusy === 'mode:' + autoKey;
          const autoOption = document.createElement('div');
          autoOption.className = 'pool-equipment-option';
          const autoCopy = document.createElement('div');
          const autoLabel = document.createElement('strong');
          autoLabel.textContent = tr(autoLabelKey, autoLabelFallback);
          const autoHint = document.createElement('span');
          autoHint.textContent = autoPending
            ? tr('pool.control.pending', 'Commande…')
            : tr(autoNoteKey, autoNoteFallback);
          autoCopy.appendChild(autoLabel);
          autoCopy.appendChild(autoHint);
          const autoToggle = poolEquipmentBuildSwitch(
            { labelKey: autoLabelKey, label: autoLabelFallback },
            autoOn,
            !autoAvailable || !!poolEquipmentCommandBusy || poolConfigFieldApplyBusy
          );
          autoToggle.input.addEventListener('change', () => {
            const desired = autoToggle.input.checked;
            applyPoolEquipmentModeSetting(autoKey, desired, tr(autoLabelKey, autoLabelFallback), autoModule).then((ok) => {
              if (!ok) autoToggle.input.checked = !desired;
            });
          });
          autoOption.appendChild(autoCopy);
          autoOption.appendChild(autoToggle.wrap);
          card.appendChild(autoOption);
        }
        card.appendChild(footer);
        grid.appendChild(card);
        if (!winterInserted && def.key === 'lights') {
          grid.appendChild(winterCard);
          winterInserted = true;
        }
      });
      if (!winterInserted) grid.appendChild(winterCard);
      poolEquipmentControl.appendChild(grid);

      const status = document.createElement('div');
      status.className = 'pool-equipment-feedback' + (poolEquipmentStatusTone ? ' is-' + poolEquipmentStatusTone : '');
      status.textContent = poolEquipmentStatusMessage || (automatic
        ? tr('pool.control.autoHint', 'Pour commander les autres équipements, passez en Manuel sécurisé ou Manuel / maintenance.')
        : tr('pool.control.ready', 'Commandes prêtes.'));
      poolEquipmentControl.appendChild(status);
    }

    function poolConfigFormatHour(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value ?? '-');
      return String(Math.max(0, Math.min(23, Math.trunc(n)))).padStart(2, '0') + ':00';
    }

    function poolConfigFormatDurationMinutes(value) {
      const minutes = Number(value);
      if (!Number.isFinite(minutes) || minutes < 0) return '—';
      const rounded = Math.round(minutes);
      const hours = Math.floor(rounded / 60);
      const remainder = rounded % 60;
      if (!hours) return remainder + ' min';
      if (!remainder) return hours + ' h';
      return hours + ' h ' + String(remainder).padStart(2, '0') + ' min';
    }

    function poolConfigHourToMinutes(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.min(23, Math.trunc(n))) * 60;
    }

    function poolConfigDayProgress(startValue, stopValue) {
      const start = poolConfigHourToMinutes(startValue);
      const stopRaw = poolConfigHourToMinutes(stopValue);
      if (start === null || stopRaw === null) return 0;
      let stop = stopRaw;
      const now = new Date();
      let current = now.getHours() * 60 + now.getMinutes();
      if (stop <= start) {
        stop += 24 * 60;
        if (current < start) current += 24 * 60;
      }
      if (current <= start) return 0;
      if (current >= stop) return 100;
      return Math.max(0, Math.min(100, ((current - start) / (stop - start)) * 100));
    }

    function poolConfigFormatDurationMs(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value ?? '-');
      if (Math.abs(n) >= 3600000 && n % 3600000 === 0) return String(Math.round(n / 3600000)) + ' h';
      if (Math.abs(n) >= 60000 && n % 60000 === 0) return String(Math.round(n / 60000)) + ' min';
      if (Math.abs(n) >= 1000 && n % 1000 === 0) return String(Math.round(n / 1000)) + ' s';
      return String(Math.round(n)) + ' ms';
    }

    function poolConfigFormatNumber(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value ?? '-');
      const rounded = Math.round(n * 1000) / 1000;
      const normalized = rounded.toFixed(3).replace(/(?:\.0+|(\.\d*?)0+)$/, '$1');
      return webUiLocale === 'en' ? normalized : normalized.replace('.', ',');
    }

    function poolConfigDoc(moduleName, key) {
      try {
        return configDocFor(moduleName, key, []);
      } catch (err) {
        return null;
      }
    }

    function poolConfigFieldLabel(moduleName, key) {
      const doc = poolConfigDoc(moduleName, key);
      return doc && typeof doc.label === 'string' && doc.label.trim()
        ? doc.label.trim()
        : String(key || '');
    }

    function poolConfigEnumLabel(doc, value) {
      const options = doc && Array.isArray(doc._enumOptions) ? doc._enumOptions : [];
      const current = String(value ?? '');
      for (const opt of options) {
        if (!opt || typeof opt !== 'object') continue;
        if (String(opt.value) === current) {
          return typeof opt.label === 'string' && opt.label.trim() ? opt.label.trim() : current;
        }
      }
      return '';
    }

    function poolConfigFormatValue(moduleName, key, value) {
      if (value === null || typeof value === 'undefined' || value === '') return '-';
      const doc = poolConfigDoc(moduleName, key);
      const enumLabel = poolConfigEnumLabel(doc, value);
      if (enumLabel) return enumLabel;
      if (typeof value === 'boolean') return poolConfigBoolLabel(value);
      const cleanKey = String(key || '').toLowerCase();
      const unit = String(doc && doc.unit ? doc.unit : '').trim();
      if (cleanKey.endsWith('_ms') || unit === 'ms') return poolConfigFormatDurationMs(value);
      if (cleanKey.includes('hour') || /^filtr_(?:start|stop)_/.test(cleanKey)) return poolConfigFormatHour(value);
      if (Number.isFinite(Number(value))) {
        const base = poolConfigFormatNumber(value);
        if (unit === 'C') return base + ' °C';
        if (unit === 'm3') return base + ' m³';
        return unit ? (base + ' ' + unit) : base;
      }
      return String(value);
    }

    function poolConfigAppendMetric(parent, label, value, options) {
      if (!parent) return null;
      const opts = options || {};
      const item = document.createElement('div');
      item.className = 'pool-metric' + (opts.featured ? ' is-featured' : '');
      if (opts.module) item.dataset.poolModule = String(opts.module);
      if (opts.key) item.dataset.poolKey = String(opts.key);
      const labelEl = document.createElement('span');
      labelEl.className = 'pool-metric-label';
      labelEl.textContent = String(label || '');
      if (opts.editable) {
        const edit = opts.editable;
        const wrap = document.createElement('div');
        wrap.className = 'pool-metric-control-wrap';
        const control = document.createElement(edit.type === 'bool' ? 'select' : 'input');
        control.className = 'pool-metric-control';
        control.setAttribute('aria-label', String(label || ''));
        if (edit.type === 'bool') {
          [
            { value: 'true', label: 'Activée' },
            { value: 'false', label: 'Désactivée' }
          ].forEach((entry) => {
            const option = document.createElement('option');
            option.value = entry.value;
            option.textContent = entry.label;
            control.appendChild(option);
          });
          control.value = toBool(edit.value) ? 'true' : 'false';
        } else {
          control.type = 'number';
          control.value = String(poolConfigEditorDisplayValue(edit, edit.value));
          if (Number.isFinite(Number(edit.min))) control.min = String(edit.min);
          if (Number.isFinite(Number(edit.max))) control.max = String(edit.max);
          control.step = Number.isFinite(Number(edit.step)) ? String(edit.step) : 'any';
          control.required = true;
        }
        if (!opts.deferApply) {
          control.addEventListener('change', () => {
            let nextValue;
            try {
              nextValue = poolConfigEditorStoredValue(edit, control);
            } catch (err) {
              return;
            }
            poolConfigApplyQuickSetting(edit.module, edit.key, nextValue, control, item).catch(() => {});
          });
        }
        wrap.appendChild(control);
        if (edit.unit) {
          const unit = document.createElement('span');
          unit.className = 'pool-setting-unit';
          unit.textContent = edit.unit;
          wrap.appendChild(unit);
        }
        item.appendChild(labelEl);
        item.appendChild(wrap);
        parent.appendChild(item);
        return {
          edit,
          control,
          item,
          initialValue: edit.value
        };
      }
      const valueEl = document.createElement('b');
      valueEl.className = 'pool-metric-value';
      valueEl.textContent = String(value ?? '-');
      item.appendChild(labelEl);
      item.appendChild(valueEl);
      parent.appendChild(item);
      return null;
    }

    async function poolConfigApplyQuickSetting(moduleName, key, value, control, item) {
      if (poolConfigFieldApplyBusy) return;
      poolConfigFieldApplyBusy = true;
      if (control) control.disabled = true;
      if (item) item.setAttribute('aria-busy', 'true');
      try {
        const patch = {};
        patch[moduleName] = {};
        patch[moduleName][key] = value;
        await fetchOkJson(
          '/api/flowcfg/apply',
          createFormPostOptions({ patch: JSON.stringify(patch) }),
          'Modification refusée',
          fetchFlowRemoteQueued
        );
        poolConfigLoadedOnce = false;
        await loadPoolConfig(true);
      } catch (err) {
        window.alert('Échec de la modification : ' + String(err));
        throw err;
      } finally {
        poolConfigFieldApplyBusy = false;
        if (control) control.disabled = false;
        if (item) item.removeAttribute('aria-busy');
      }
    }

    function poolConfigChemistryEntryValue(entry) {
      return poolConfigEditorStoredValue(entry.edit, entry.control);
    }

    function poolConfigRestoreChemistryEntry(entry) {
      if (!entry || !entry.control || !entry.edit) return;
      if (entry.edit.type === 'bool') {
        entry.control.value = toBool(entry.initialValue) ? 'true' : 'false';
        return;
      }
      entry.control.value = String(poolConfigEditorDisplayValue(entry.edit, entry.initialValue));
    }

    function poolConfigRefreshChemistryPendingFlag() {
      poolChemistryHasPendingChanges = !!(
        poolChemistryPanel && poolChemistryPanel.querySelector('.pool-chemistry-card.is-dirty')
      );
    }

    function poolConfigRefreshChemistryMirrors(changesByModule) {
      const changes = changesByModule && typeof changesByModule === 'object'
        ? changesByModule
        : {};
      Object.entries(changes).forEach(([moduleName, moduleChanges]) => {
        const values = moduleChanges && typeof moduleChanges === 'object' ? moduleChanges : {};
        const specs = poolEditableFieldSpecs[moduleName] || [];
        document.querySelectorAll('form.pool-settings-form').forEach((form) => {
          if (String(form.dataset.poolModule || '') !== moduleName) return;
          Object.entries(values).forEach(([key, value]) => {
            const spec = specs.find((entry) => entry && entry.key === key);
            if (!spec) return;
            Array.from(form.elements).forEach((control) => {
              if (!control || String(control.name || '') !== key) return;
              if (spec.type === 'bool') {
                control.value = toBool(value) ? 'true' : 'false';
              } else if (spec.type === 'enum') {
                control.value = String(value);
              } else {
                control.value = String(poolConfigEditorDisplayValue(spec, value));
              }
            });
          });
        });
        document.querySelectorAll('.pool-metric[data-pool-module][data-pool-key]').forEach((metric) => {
          if (String(metric.dataset.poolModule || '') !== moduleName) return;
          const key = String(metric.dataset.poolKey || '');
          if (!Object.prototype.hasOwnProperty.call(values, key)) return;
          const valueEl = metric.querySelector('.pool-metric-value');
          if (valueEl) valueEl.textContent = poolConfigFormatValue(moduleName, key, values[key]);
        });
      });
    }

    async function poolConfigApplyChemistryCard(entries, card, syncState) {
      if (poolConfigFieldApplyBusy || !Array.isArray(entries) || !entries.length) return;
      const changesByModule = {};
      try {
        entries.forEach((entry) => {
          if (!entry.control.reportValidity()) throw new Error(tr('pool.chemistry.invalid', 'Valeur invalide.'));
          const nextValue = poolConfigChemistryEntryValue(entry);
          if (poolConfigValuesEqual(nextValue, entry.initialValue)) return;
          if (!changesByModule[entry.edit.module]) changesByModule[entry.edit.module] = {};
          changesByModule[entry.edit.module][entry.edit.key] = nextValue;
        });
      } catch (err) {
        syncState('error', String(err));
        return;
      }
      if (!Object.keys(changesByModule).length) {
        syncState();
        return;
      }

      poolConfigFieldApplyBusy = true;
      card.setAttribute('aria-busy', 'true');
      entries.forEach((entry) => { entry.control.disabled = true; });
      syncState('saving', tr('pool.chemistry.saving', 'Enregistrement en cours…'));
      let saved = false;
      try {
        await fetchOkJson(
          '/api/flowcfg/apply',
          createFormPostOptions({ patch: JSON.stringify(changesByModule) }),
          tr('pool.chemistry.saveFailed', 'Enregistrement refusé'),
          fetchFlowRemoteQueued
        );
        entries.forEach((entry) => {
          const moduleChanges = changesByModule[entry.edit.module];
          if (!moduleChanges || !Object.prototype.hasOwnProperty.call(moduleChanges, entry.edit.key)) return;
          const nextValue = moduleChanges[entry.edit.key];
          entry.initialValue = nextValue;
          if (poolConfigModulesCache[entry.edit.module]) {
            poolConfigModulesCache[entry.edit.module][entry.edit.key] = nextValue;
          }
        });
        poolConfigRefreshChemistryMirrors(changesByModule);
        saved = true;
      } catch (err) {
        syncState('error', tr('pool.chemistry.saveFailed', 'Échec de l’enregistrement') + ' : ' + String(err));
      } finally {
        poolConfigFieldApplyBusy = false;
        card.removeAttribute('aria-busy');
        entries.forEach((entry) => { entry.control.disabled = false; });
        if (saved) {
          syncState('saved', tr('pool.chemistry.saved', 'Modifications enregistrées.'));
        } else {
          syncState('keep');
        }
      }
    }

    function poolConfigFields(moduleName, data, options) {
      const opts = options || {};
      const keys = Object.keys((data && typeof data === 'object') ? data : {})
        .filter((key) => !opts.exclude || opts.exclude.indexOf(key) < 0)
        .sort();
      const picked = Number.isFinite(Number(opts.limit)) ? keys.slice(0, Number(opts.limit)) : keys;
      return picked.map((key) => ({
        key,
        label: poolConfigFieldLabel(moduleName, key),
        value: poolConfigFormatValue(moduleName, key, data[key])
      }));
    }

    function poolConfigBuildFieldList(moduleName, data, options) {
      const list = document.createElement('div');
      list.className = 'pool-field-list';
      poolConfigFields(moduleName, data, options).forEach((field) => {
        const row = document.createElement('div');
        row.className = 'pool-field-row';
        const label = document.createElement('span');
        label.className = 'pool-field-label';
        label.textContent = field.label;
        const value = document.createElement('b');
        const activeText = tr('pool.state.active', 'Actif').trim().toLowerCase();
        const cleanValue = String(field.value || '').trim().toLowerCase();
        const isActiveValue = cleanValue === activeText || cleanValue === 'active' || cleanValue === 'actif';
        value.className = 'pool-field-value' + (isActiveValue ? ' has-active-dot' : '');
        const valueText = document.createElement('span');
        valueText.textContent = field.value;
        value.appendChild(valueText);
        if (isActiveValue) {
          const dot = document.createElement('span');
          dot.className = 'pool-field-active-dot';
          dot.setAttribute('aria-hidden', 'true');
          value.appendChild(dot);
        }
        row.appendChild(label);
        row.appendChild(value);
        list.appendChild(row);
      });
      if (!list.childNodes.length) {
        const empty = document.createElement('div');
        empty.className = 'pool-field-empty';
        empty.textContent = tr('pool.empty.settings', 'Aucun réglage disponible.');
        list.appendChild(empty);
      }
      return list;
    }

    function poolConfigEditorDisplayValue(spec, rawValue) {
      if (spec && spec.type === 'time') {
        const minutes = Number(rawValue);
        if (!Number.isFinite(minutes)) return '';
        const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
        return String(Math.floor(normalized / 60)).padStart(2, '0') + ':' + String(normalized % 60).padStart(2, '0');
      }
      if (!spec || spec.type !== 'number') return rawValue;
      const scale = Number(spec.scale) || 1;
      const value = Number(rawValue);
      if (!Number.isFinite(value)) return '';
      return Math.round((value / scale) * 1000) / 1000;
    }

    function poolConfigEditorStoredValue(spec, input) {
      if (spec.type === 'bool') return String(input.value) === 'true';
      if (spec.type === 'enum') {
        const option = (spec.options || []).find((entry) => String(entry.value) === String(input.value));
        return option ? option.value : input.value;
      }
      if (spec.type === 'time') {
        const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(input.value || '').trim());
        if (!match) throw new Error('Heure invalide');
        return (Number(match[1]) * 60) + Number(match[2]);
      }
      const value = Number(input.value);
      if (!Number.isFinite(value)) throw new Error('Valeur numérique invalide');
      const scale = Number(spec.scale) || 1;
      return Math.round(value * scale * 1000) / 1000;
    }

    function poolConfigValuesEqual(left, right) {
      if (typeof left === 'number' || typeof right === 'number') {
        const a = Number(left);
        const b = Number(right);
        return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.0001;
      }
      return left === right;
    }

    async function poolConfigApplyEditor(moduleName, data, entries, form, status) {
      if (poolConfigFieldApplyBusy || !form.reportValidity()) return;
      const changes = {};
      entries.forEach((entry) => {
        const nextValue = typeof entry.read === 'function'
          ? entry.read()
          : poolConfigEditorStoredValue(entry.spec, entry.input);
        if (!poolConfigValuesEqual(nextValue, data[entry.spec.key])) {
          changes[entry.spec.key] = nextValue;
        }
      });
      const changedKeys = Object.keys(changes);
      if (!changedKeys.length) {
        status.className = 'pool-settings-status is-ok';
        status.textContent = 'Aucune modification à enregistrer.';
        return;
      }
      const changedLabels = Array.from(new Set(entries
        .filter((entry) => Object.prototype.hasOwnProperty.call(changes, entry.spec.key))
        .map((entry) => entry.spec.label || poolConfigFieldLabel(moduleName, entry.spec.key))));
      if (!window.confirm('Enregistrer ces réglages ?\n\n• ' + changedLabels.join('\n• '))) return;

      poolConfigFieldApplyBusy = true;
      form.setAttribute('aria-busy', 'true');
      Array.from(form.elements).forEach((element) => { element.disabled = true; });
      status.className = 'pool-settings-status';
      status.textContent = 'Enregistrement en cours…';
      try {
        const patch = {};
        patch[moduleName] = changes;
        await fetchOkJson(
          '/api/flowcfg/apply',
          createFormPostOptions({ patch: JSON.stringify(patch) }),
          'Enregistrement des réglages refusé',
          fetchFlowRemoteQueued
        );
        status.className = 'pool-settings-status is-ok';
        status.textContent = 'Réglages enregistrés.';
        poolConfigLoadedOnce = false;
        await loadPoolConfig(true);
      } catch (err) {
        status.className = 'pool-settings-status is-error';
        status.textContent = 'Échec : ' + String(err);
      } finally {
        poolConfigFieldApplyBusy = false;
        form.removeAttribute('aria-busy');
        Array.from(form.elements).forEach((element) => { element.disabled = false; });
      }
    }

    function poolConfigBuildEditor(moduleName, data, fieldSpecs) {
      const specs = Array.isArray(fieldSpecs) ? fieldSpecs : [];
      const form = document.createElement('form');
      form.className = 'pool-settings-form';
      form.dataset.poolModule = moduleName;
      form.noValidate = false;
      const robotSettingsEnabled = moduleName !== 'poollogic/robot'
        || toBool((poolConfigModulesCache['poollogic/modes'] || {}).robot_auto_mode);
      const fields = document.createElement('div');
      fields.className = 'pool-settings-fields';
      const entries = [];

      specs.forEach((spec, index) => {
        if (!spec) return;
        if (spec.type === 'pool_mode') {
          if (!spec.enabledKey || !spec.autoModeKey
              || !Object.prototype.hasOwnProperty.call(data, spec.enabledKey)
              || !Object.prototype.hasOwnProperty.call(data, spec.autoModeKey)) return;

          const field = document.createElement('div');
          field.className = 'pool-setting-field';
          const controlId = 'pool-setting-' + runtimeMeasureCssSlug(moduleName + '-' + spec.key) + '-' + index;
          const label = document.createElement('label');
          label.className = 'pool-setting-label';
          label.htmlFor = controlId;
          label.textContent = spec.label;
          const control = document.createElement('select');
          control.id = controlId;
          control.className = 'pool-setting-control';
          control.name = spec.key;
          [
            { value: 'maintenance', label: tr('pool.mode.maintenance', 'Manuel / maintenance') },
            { value: 'safe_manual', label: tr('pool.mode.safeManual', 'Manuel sécurisé') },
            { value: 'automatic', label: tr('pool.mode.automatic', 'Automatique') }
          ].forEach((entry) => {
            const option = document.createElement('option');
            option.value = entry.value;
            option.textContent = entry.label;
            control.appendChild(option);
          });
          control.value = !toBool(data[spec.enabledKey])
            ? 'maintenance'
            : (toBool(data[spec.autoModeKey]) ? 'automatic' : 'safe_manual');

          const controlWrap = document.createElement('div');
          controlWrap.className = 'pool-setting-control-wrap';
          controlWrap.appendChild(control);
          field.appendChild(label);
          field.appendChild(controlWrap);
          const help = document.createElement('p');
          help.className = 'pool-setting-help';
          help.textContent = tr(
            'pool.mode.help',
            'Manuel / maintenance désactive PoolLogic. Manuel sécurisé conserve la surveillance et les sécurités. Automatique ajoute le pilotage selon les horaires, les mesures et les consignes.'
          );
          field.appendChild(help);
          fields.appendChild(field);
          entries.push({
            spec: { key: spec.enabledKey, label: spec.label },
            input: control,
            read: () => control.value !== 'maintenance'
          });
          entries.push({
            spec: { key: spec.autoModeKey, label: spec.label },
            input: control,
            read: () => control.value === 'automatic'
          });
          return;
        }
        if (!Object.prototype.hasOwnProperty.call(data, spec.key)) return;
        if (spec.type === 'feedback') {
          if (!spec.activeHighKey || !Object.prototype.hasOwnProperty.call(data, spec.activeHighKey)) return;

          const field = document.createElement('div');
          field.className = 'pool-setting-field pool-setting-feedback';
          const heading = document.createElement('div');
          heading.className = 'pool-setting-label';
          heading.textContent = spec.label;
          field.appendChild(heading);

          const modeRow = document.createElement('div');
          modeRow.className = 'pool-feedback-row';
          const modeId = 'pool-setting-' + runtimeMeasureCssSlug(moduleName + '-' + spec.activeHighKey) + '-' + index;
          const modeLabel = document.createElement('label');
          modeLabel.className = 'pool-setting-sublabel';
          modeLabel.htmlFor = modeId;
          modeLabel.textContent = 'Fonctionnement du retour';
          const mode = document.createElement('select');
          mode.id = modeId;
          mode.className = 'pool-setting-control';
          mode.name = spec.activeHighKey;
          [
            { value: 'closed', label: 'Normalement ouvert (NO) — fermé en marche' },
            { value: 'open', label: 'Normalement fermé (NF) — ouvert en marche' }
          ].forEach((entry) => {
            const option = document.createElement('option');
            option.value = entry.value;
            option.textContent = entry.label;
            mode.appendChild(option);
          });

          const configuredIoId = Number(data[spec.key]);
          const feedbackEnabled = configuredIoId !== 65535;
          let lastActiveHigh = toBool(data[spec.activeHighKey]);
          mode.value = lastActiveHigh ? 'closed' : 'open';
          modeRow.appendChild(modeLabel);
          modeRow.appendChild(mode);
          const modeDoc = poolConfigDoc(moduleName, spec.activeHighKey);
          if (modeDoc && typeof modeDoc.help === 'string' && modeDoc.help.trim()) {
            const help = document.createElement('p');
            help.className = 'pool-setting-help';
            help.textContent = modeDoc.help.trim();
            modeRow.appendChild(help);
          }
          const inputRow = document.createElement('div');
          inputRow.className = 'pool-feedback-row';
          const inputId = 'pool-setting-' + runtimeMeasureCssSlug(moduleName + '-' + spec.key) + '-' + index;
          const inputLabel = document.createElement('label');
          inputLabel.className = 'pool-setting-sublabel';
          inputLabel.htmlFor = inputId;
          inputLabel.textContent = 'Entrée numérique';
          const input = document.createElement('select');
          input.id = inputId;
          input.className = 'pool-setting-control';
          input.name = spec.key;
          const placeholder = document.createElement('option');
          placeholder.value = '65535';
          placeholder.textContent = 'Désactivé / non câblé';
          input.appendChild(placeholder);
          (spec.options || []).forEach((entry) => {
            const option = document.createElement('option');
            option.value = String(entry.value);
            option.textContent = entry.label;
            input.appendChild(option);
          });
          input.value = feedbackEnabled ? String(data[spec.key]) : '65535';
          inputRow.appendChild(inputLabel);
          inputRow.appendChild(input);
          const inputDoc = poolConfigDoc(moduleName, spec.key);
          if (inputDoc && typeof inputDoc.help === 'string' && inputDoc.help.trim()) {
            const help = document.createElement('p');
            help.className = 'pool-setting-help';
            help.textContent = inputDoc.help.trim();
            inputRow.appendChild(help);
          }
          field.appendChild(inputRow);
          field.appendChild(modeRow);

          const syncFeedback = () => {
            const enabled = Number(input.value) !== 65535;
            if (enabled) lastActiveHigh = mode.value === 'closed';
            modeRow.hidden = !enabled;
            mode.disabled = !enabled;
          };
          input.addEventListener('change', syncFeedback);
          mode.addEventListener('change', syncFeedback);
          syncFeedback();

          fields.appendChild(field);
          entries.push({
            spec: { key: spec.key, label: spec.label },
            input,
            read: () => Number(input.value)
          });
          entries.push({
            spec: { key: spec.activeHighKey, label: spec.label },
            input: mode,
            read: () => Number(input.value) === 65535 ? lastActiveHigh : mode.value === 'closed'
          });
          return;
        }

        const field = document.createElement('div');
        field.className = 'pool-setting-field';
        const controlId = 'pool-setting-' + runtimeMeasureCssSlug(moduleName + '-' + spec.key) + '-' + index;
        const label = document.createElement('label');
        label.className = 'pool-setting-label';
        label.htmlFor = controlId;
        label.textContent = spec.label || poolConfigFieldLabel(moduleName, spec.key);
        const control = document.createElement(spec.type === 'bool' || spec.type === 'enum' ? 'select' : 'input');
        control.id = controlId;
        control.className = 'pool-setting-control';
        control.name = spec.key;

        if (spec.type === 'bool') {
          [
            { value: 'true', label: 'Activé' },
            { value: 'false', label: 'Désactivé' }
          ].forEach((entry) => {
            const option = document.createElement('option');
            option.value = entry.value;
            option.textContent = entry.label;
            control.appendChild(option);
          });
          control.value = toBool(data[spec.key]) ? 'true' : 'false';
        } else if (spec.type === 'enum') {
          (spec.options || []).forEach((entry) => {
            const option = document.createElement('option');
            option.value = String(entry.value);
            option.textContent = entry.label;
            control.appendChild(option);
          });
          control.value = String(data[spec.key]);
        } else if (spec.type === 'time') {
          // Do not use the browser's native time control here: its rendering
          // follows the operating-system locale and may expose an AM/PM UI.
          // PoolLogic schedules must always be displayed as French 24-hour
          // values, independently of the browser running the interface.
          control.type = 'text';
          control.value = String(poolConfigEditorDisplayValue(spec, data[spec.key]));
          control.inputMode = 'numeric';
          control.maxLength = 5;
          control.placeholder = 'HH:mm';
          control.pattern = '(?:[01]\\d|2[0-3]):[0-5]\\d';
          control.title = 'Saisissez une heure au format 24 heures HH:mm (par exemple 08:30).';
          control.setAttribute('aria-label', (spec.label || 'Heure') + ' au format 24 heures HH:mm');
          control.required = true;
        } else {
          control.type = 'number';
          control.value = String(poolConfigEditorDisplayValue(spec, data[spec.key]));
          if (Number.isFinite(Number(spec.min))) control.min = String(spec.min);
          if (Number.isFinite(Number(spec.max))) control.max = String(spec.max);
          control.step = Number.isFinite(Number(spec.step)) ? String(spec.step) : 'any';
          control.required = true;
        }

        const controlWrap = document.createElement('div');
        controlWrap.className = 'pool-setting-control-wrap';
        controlWrap.appendChild(control);
        if (spec.unit) {
          const unit = document.createElement('span');
          unit.className = 'pool-setting-unit';
          unit.textContent = spec.unit;
          controlWrap.appendChild(unit);
        }
        field.appendChild(label);
        field.appendChild(controlWrap);

        const doc = poolConfigDoc(moduleName, spec.key);
        if (doc && typeof doc.help === 'string' && doc.help.trim()) {
          const help = document.createElement('p');
          help.className = 'pool-setting-help';
          help.textContent = doc.help.trim();
          field.appendChild(help);
        }
        fields.appendChild(field);
        entries.push({ spec, input: control });
      });
      if (moduleName === 'poollogic/refill') {
        const enabledEntry = entries.find((entry) => entry.spec && entry.spec.key === 'fill_enabled');
        const dependentEntries = entries.filter((entry) => entry.spec && entry.spec.key === 'fill_min_on_s');
        if (enabledEntry) {
          const syncRefillFields = () => {
            const enabled = String(enabledEntry.input.value) === 'true';
            dependentEntries.forEach((entry) => {
              entry.input.disabled = !enabled;
              entry.input.required = enabled;
              const field = entry.input.closest('.pool-setting-field');
              if (field) field.classList.toggle('is-disabled', !enabled);
            });
          };
          enabledEntry.input.addEventListener('change', syncRefillFields);
          syncRefillFields();
        }
      }
      form.appendChild(fields);

      const footer = document.createElement('div');
      footer.className = 'pool-settings-footer';
      const status = document.createElement('span');
      status.className = 'pool-settings-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn-tonal pool-settings-cancel';
      cancel.textContent = tr('pool.settings.cancel', 'Annuler');
      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'btn-primary pool-settings-save';
      submit.textContent = tr('pool.settings.save', 'Enregistrer');
      footer.appendChild(status);
      footer.appendChild(cancel);
      footer.appendChild(submit);

      const trackedControls = Array.from(fields.querySelectorAll('input, select'));
      const initialControlValues = trackedControls.map((control) => ({
        control,
        value: control.value
      }));
      const editorHasChanges = () => {
        try {
          return entries.some((entry) => {
            const nextValue = typeof entry.read === 'function'
              ? entry.read()
              : poolConfigEditorStoredValue(entry.spec, entry.input);
            return !poolConfigValuesEqual(nextValue, data[entry.spec.key]);
          });
        } catch (err) {
          return true;
        }
      };
      const syncEditorActions = (preserveStatus) => {
        const dirty = editorHasChanges();
        form.classList.toggle('is-dirty', dirty);
        cancel.disabled = !dirty || poolConfigFieldApplyBusy;
        submit.disabled = !dirty || poolConfigFieldApplyBusy;
        if (!preserveStatus) {
          status.className = 'pool-settings-status' + (dirty ? ' is-pending' : '');
          status.textContent = dirty
            ? tr('pool.settings.pending', 'Modifications non enregistrées.')
            : '';
        }
      };

      trackedControls.forEach((control) => {
        control.addEventListener('input', () => syncEditorActions(false));
        control.addEventListener('change', () => syncEditorActions(false));
      });
      cancel.addEventListener('click', () => {
        initialControlValues.forEach((entry) => {
          entry.control.value = entry.value;
        });
        trackedControls.forEach((control) => {
          control.dispatchEvent(new Event('change', { bubbles: true }));
        });
        syncEditorActions(false);
      });
      if (!robotSettingsEnabled) {
        form.classList.add('is-disabled');
        Array.from(fields.querySelectorAll('input, select, button')).forEach((element) => {
          element.disabled = true;
        });
        cancel.disabled = true;
        submit.disabled = true;
        const disabledNote = document.createElement('p');
        disabledNote.className = 'pool-setting-disabled-note';
        disabledNote.textContent = tr(
          'pool.robot.disabledHint',
          'Activez « Robot automatique » dans Contrôle des équipements pour modifier ces réglages.'
        );
        form.appendChild(disabledNote);
      }
      form.appendChild(footer);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        poolConfigApplyEditor(moduleName, data, entries, form, status).catch(() => {});
      });
      syncEditorActions(false);
      return form;
    }

    async function poolConfigFetchModule(moduleName) {
      const cleanModule = nettoyerNomFlowCfg(moduleName);
      const data = await fetchOkJson(
        '/api/flowcfg/module?name=' + encodeURIComponent(cleanModule),
        { cache: 'no-store' },
        tr('pool.error.moduleRead', 'lecture {module} impossible').replace('{module}', cleanModule),
        fetchFlowRemoteQueued
      );
      return {
        module: cleanModule,
        data: (data && data.data && typeof data.data === 'object') ? data.data : {},
        truncated: !!(data && data.truncated)
      };
    }

    async function poolConfigFetchAllModules() {
      if (isWaveshareProfile()) {
        try {
          const payload = await fetchOkJson(
            '/api/pool/config',
            { cache: 'no-store' },
            tr('pool.error.configRead', 'lecture de la configuration piscine impossible'),
            fetchFlowCfgEndpoint
          );
          const modules = payload && payload.modules && typeof payload.modules === 'object'
            ? payload.modules
            : null;
          if (modules && modules['poollogic/modes']) return modules;
        } catch (err) {
          // Compatibility with a controller that still runs an older firmware:
          // fall back to the historical module-by-module API below.
        }
      }

      const modules = {};
      const allDefs = poolConfigModuleDefs.concat(poolDisinfectionModeDefs);
      for (const def of allDefs) {
        const payload = await poolConfigFetchModule(def.module);
        modules[payload.module] = payload.data;
      }
      return modules;
    }

    async function poolConfigEnsureDocs() {
      const modules = poolConfigModuleDefs.map((def) => def.module)
        .concat(poolDisinfectionModeDefs.map((def) => def.module));
      await ensureCfgDocsForModule('');
      for (const moduleName of modules) {
        await ensureCfgDocsForModule(moduleName).catch(() => {});
      }
    }

    function poolConfigWarmDocsInBackground() {
      if (poolConfigDocsReady || poolConfigDocsPromise) return;
      poolConfigDocsPromise = poolConfigEnsureDocs()
        .then(() => {
          poolConfigDocsReady = true;
          const dirtyEditor = !!(poolConfigGrid && poolConfigGrid.querySelector('.pool-settings-form.is-dirty'));
          if (poolConfigLoadedOnce
              && getActivePageId() === 'page-pool'
              && !poolConfigFieldApplyBusy
              && !poolConfigModeApplyBusy
              && !poolChemistryHasPendingChanges
              && !dirtyEditor) {
            poolConfigRender(poolConfigModulesCache, poolConfigAlarmSlotsCache);
          }
        })
        .catch(() => {})
        .finally(() => {
          poolConfigDocsPromise = null;
        });
    }

    function poolConfigRenderModeBadges(modules) {
      const modes = modules && modules['poollogic/modes'] ? modules['poollogic/modes'] : {};
      poolOperatingModeSyncAll(modes);
    }

    function poolConfigHeroSummary(modules, start, stop) {
      const source = modules && typeof modules === 'object' ? modules : {};
      const modes = source['poollogic/modes'] || {};
      const heater = source['poollogic/heater'] || {};
      const poolLogicEnabled = toBool(modes.enabled);
      const autoMode = toBool(modes.auto_mode);
      const winterMode = toBool(modes.winter_mode);
      const treatment = poolConfigDisinfectionLabel(modes.disinfection_type);
      const heaterState = poolConfigBoolLabel(heater.heater_auto_mode, tr('pool.state.autoShort', 'auto'), tr('pool.state.off', 'arrêt'));

      if (!poolLogicEnabled) {
        return tr('pool.summary.poollogicOff', 'Manuel / maintenance : commandes directes, sans automatismes ni sécurités gérés par PoolLogic.');
      }
      if (!autoMode) {
        return tr('pool.summary.manual', 'Manuel sécurisé : commandes manuelles avec surveillance et sécurités PoolLogic. Traitement configuré : {treatment}.')
          .replace('{treatment}', treatment);
      }
      if (winterMode) {
        return tr('pool.summary.autoWinter', 'Mode automatique hiver : filtration {start}-{stop}, traitement {treatment}, chauffage {heater}.')
          .replace('{start}', start)
          .replace('{stop}', stop)
          .replace('{treatment}', treatment)
          .replace('{heater}', heaterState);
      }
      return tr('pool.summary.auto', 'Mode automatique : filtration {start}-{stop}, traitement {treatment}, chauffage {heater}.')
        .replace('{start}', start)
        .replace('{stop}', stop)
        .replace('{treatment}', treatment)
        .replace('{heater}', heaterState);
    }

    function poolConfigRenderHero(modules, alarmSlots) {
      const modes = modules['poollogic/modes'] || {};
      const filtration = modules['poollogic/filtration'] || {};
      const alarms = poolConfigActiveAlarms(alarmSlots);
      const schedule = dashboardSchedule(filtration);
      const start = schedule ? schedule.start : '—';
      const stop = schedule ? schedule.stop : '—';
      if (poolConfigTitle) {
        poolConfigTitle.textContent = tr('pool.overview.title', 'État Général');
      }
      if (poolHeroState) {
        poolHeroState.className = 'pool-hero-state ' + (alarms.length ? 'is-alert' : 'is-ok');
        poolHeroState.innerHTML = '';
        const icon = document.createElement('span');
        icon.className = 'ui-msr pool-hero-state-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = alarms.length ? 'warning' : 'check_circle';
        const label = document.createElement('span');
        label.textContent = alarms.length
          ? tr('pool.state.alarmNamed', 'Alarme - {alarm}').replace('{alarm}', alarms[0].label)
          : tr('pool.state.normalStatus', 'État normal');
        poolHeroState.appendChild(icon);
        poolHeroState.appendChild(label);
      }
      if (poolConfigSummary) {
        poolConfigSummary.textContent = poolConfigHeroSummary(modules, start, stop);
      }
      if (poolFiltrationStart) poolFiltrationStart.textContent = start;
      if (poolFiltrationStop) poolFiltrationStop.textContent = stop;
      if (poolFiltrationFill) {
        poolFiltrationFill.style.width = (schedule ? schedule.progress : 0).toFixed(1) + '%';
      }
      poolConfigRenderModeBadges(modules);
    }

    async function poolConfigApplyDisinfectionMode(def) {
      if (!def || poolConfigModeApplyBusy) return;
      const label = tr(def.titleKey, def.title);
      const confirmation = tr(
        'pool.disinfection.changeConfirm',
        'Activer le traitement « {mode} » ?'
      ).replace('{mode}', label);
      if (!window.confirm(confirmation)) return;

      poolConfigModeApplyBusy = true;
      if (poolDisinfectionModes) {
        poolDisinfectionModes.setAttribute('aria-busy', 'true');
        Array.from(poolDisinfectionModes.querySelectorAll('.pool-treatment-choice')).forEach((button) => {
          button.disabled = true;
        });
      }
      if (poolConfigSummary) {
        poolConfigSummary.textContent = tr(
          'pool.disinfection.changePending',
          'Application du traitement « {mode} »...'
        ).replace('{mode}', label);
      }

      try {
        const patch = {
          'poollogic/modes': {
            disinfection_type: def.typeValue
          }
        };
        await fetchOkJson(
          '/api/flowcfg/apply',
          createFormPostOptions({ patch: JSON.stringify(patch) }),
          tr('pool.disinfection.changeFailed', 'Changement de traitement refusé'),
          fetchFlowRemoteQueued
        );
        // The configuration endpoint has accepted the new mode. Reflect it at
        // once so the treatment selector, summary and available equipment do
        // not keep displaying the previous mode while every pool module is
        // read back from the controller.
        const currentModules = poolConfigModulesCache && typeof poolConfigModulesCache === 'object'
          ? poolConfigModulesCache
          : {};
        const currentModes = currentModules['poollogic/modes'] || {};
        poolConfigModulesCache = {
          ...currentModules,
          'poollogic/modes': {
            ...currentModes,
            disinfection_type: def.typeValue
          }
        };
        poolConfigRender(poolConfigModulesCache, poolConfigAlarmSlotsCache);

        // Confirm the value from the firmware without replacing the page with
        // a loading skeleton. ConfigChanged consumers are given a short turn
        // to apply the mode before the read-back.
        await waitMs(250);
        await loadPoolConfig(false);
        await refreshPoolConfigLive(true);
      } catch (err) {
        if (poolConfigSummary) {
          poolConfigSummary.textContent =
            tr('pool.disinfection.changeFailed', 'Changement de traitement refusé') +
            ': ' + String(err);
        }
      } finally {
        poolConfigModeApplyBusy = false;
        if (poolDisinfectionModes) {
          poolDisinfectionModes.removeAttribute('aria-busy');
          Array.from(poolDisinfectionModes.querySelectorAll('.pool-treatment-choice')).forEach((button) => {
            button.disabled = button.getAttribute('aria-pressed') === 'true';
          });
        }
      }
    }

    function poolConfigLiveNumber(value, digits, unit) {
      if (value === null || typeof value === 'undefined' || value === '') return 'Sonde indisponible';
      const number = Number(value);
      if (!Number.isFinite(number)) return 'Sonde indisponible';
      const formatted = number.toFixed(digits).replace('.', webUiLocale === 'en' ? '.' : ',');
      return formatted + (unit ? ' ' + unit : '');
    }

    function poolConfigChemistryTargetState(measured, target, tolerance, unit) {
      const current = Number(measured);
      const setpoint = Number(target);
      if (!Number.isFinite(current) || !Number.isFinite(setpoint)) {
        return {
          kind: 'unavailable',
          label: tr('pool.chemistry.sensorUnavailable', 'Sonde indisponible'),
          note: tr('pool.chemistry.comparisonUnavailable', 'Comparaison à la consigne impossible.')
        };
      }
      const delta = current - setpoint;
      const band = Math.max(0, Number(tolerance) || 0);
      const absDelta = Math.abs(delta);
      const deltaText = (delta > 0 ? '+' : (delta < 0 ? '−' : '')) + poolConfigFormatNumber(absDelta) + (unit ? ' ' + unit : '');
      if (absDelta <= band) {
        return {
          kind: 'ok',
          label: tr('pool.chemistry.nearTarget', 'Proche de la cible'),
          note: tr('pool.chemistry.deltaTarget', 'Écart avec la consigne : {delta}').replace('{delta}', deltaText)
        };
      }
      return {
        kind: delta < 0 ? 'low' : 'high',
        label: delta < 0 ? tr('pool.chemistry.belowTarget', 'Sous la consigne') : tr('pool.chemistry.aboveTarget', 'Au-dessus de la consigne'),
        note: tr('pool.chemistry.deltaTarget', 'Écart avec la consigne : {delta}').replace('{delta}', deltaText)
      };
    }

    function poolConfigPressureState(measured, lowValue, highValue, monitoringEnabled) {
      const current = Number(measured);
      const low = Number(lowValue);
      const high = Number(highValue);
      if (!Number.isFinite(current)) {
        return {
          kind: 'unavailable',
          label: tr('pool.chemistry.sensorUnavailable', 'Sonde indisponible'),
          note: tr('pool.chemistry.pressureUnavailable', 'La pression hydraulique ne peut pas être contrôlée.')
        };
      }
      if (!toBool(monitoringEnabled)) {
        return {
          kind: 'neutral',
          label: tr('pool.chemistry.monitoringDisabled', 'Surveillance désactivée'),
          note: tr('pool.chemistry.pressureMonitoringDisabled', 'La mesure reste visible mais ne déclenche pas de sécurité.')
        };
      }
      if (Number.isFinite(low) && current < low) {
        return {
          kind: 'alert',
          label: tr('pool.chemistry.pressureLow', 'Pression basse'),
          note: tr('pool.chemistry.pressureBelowMinimum', 'Valeur inférieure au minimum configuré de {value} bar.').replace('{value}', poolConfigFormatNumber(low))
        };
      }
      if (Number.isFinite(high) && current > high) {
        return {
          kind: 'alert',
          label: tr('pool.chemistry.pressureHigh', 'Pression haute'),
          note: tr('pool.chemistry.pressureAboveMaximum', 'Valeur supérieure au maximum configuré de {value} bar.').replace('{value}', poolConfigFormatNumber(high))
        };
      }
      return {
        kind: 'ok',
        label: tr('pool.chemistry.pressureNormal', 'Pression normale'),
        note: Number.isFinite(low) && Number.isFinite(high)
          ? tr('pool.chemistry.pressureRange', 'Plage configurée : {low} à {high} bar.').replace('{low}', poolConfigFormatNumber(low)).replace('{high}', poolConfigFormatNumber(high))
          : tr('pool.chemistry.pressureRead', 'Mesure hydraulique disponible.')
      };
    }

    function poolConfigAppendChemistryCard(parent, options) {
      const opts = options || {};
      const state = opts.state && typeof opts.state === 'object' ? opts.state : {};
      const stateKind = ['ok', 'low', 'high', 'alert', 'neutral', 'unavailable'].includes(state.kind) ? state.kind : (opts.available ? 'neutral' : 'unavailable');
      const card = document.createElement('article');
      card.className = 'pool-chemistry-card ' + (opts.accent || '') + ' is-state-' + stateKind;
      const head = document.createElement('div');
      head.className = 'pool-chemistry-head';
      const icon = document.createElement('span');
      icon.className = 'ui-msr pool-card-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = opts.icon || 'science';
      const copy = document.createElement('div');
      copy.className = 'pool-card-title-wrap';
      const title = document.createElement('h3');
      title.textContent = opts.title || '';
      const subtitle = document.createElement('p');
      subtitle.textContent = opts.subtitle || '';
      copy.appendChild(title);
      copy.appendChild(subtitle);
      head.appendChild(icon);
      head.appendChild(copy);
      const statePill = document.createElement('span');
      statePill.className = 'pool-chemistry-state is-' + stateKind;
      const stateDot = document.createElement('span');
      stateDot.setAttribute('aria-hidden', 'true');
      const stateLabel = document.createElement('span');
      stateLabel.textContent = state.label || (opts.available ? tr('pool.chemistry.sensorAvailable', 'Sonde active') : tr('pool.chemistry.sensorUnavailable', 'Sonde indisponible'));
      statePill.appendChild(stateDot);
      statePill.appendChild(stateLabel);
      card.appendChild(head);
      card.appendChild(statePill);

      const measurement = document.createElement('div');
      measurement.className = 'pool-chemistry-measure' + (opts.available ? '' : ' is-unavailable');
      const measurementLabel = document.createElement('span');
      measurementLabel.textContent = opts.measurementLabel || 'Valeur mesurée';
      const measurementValue = document.createElement('b');
      measurementValue.textContent = opts.measured || 'Sonde indisponible';
      measurement.appendChild(measurementLabel);
      measurement.appendChild(measurementValue);
      if (state.note) {
        const measurementNote = document.createElement('p');
        measurementNote.className = 'pool-chemistry-measure-note is-' + stateKind;
        measurementNote.textContent = state.note;
        measurement.appendChild(measurementNote);
      }
      card.appendChild(measurement);

      const metrics = document.createElement('div');
      metrics.className = 'pool-chemistry-metrics';
      const editableEntries = [];
      (opts.metrics || []).forEach((metric) => {
        const entry = poolConfigAppendMetric(metrics, metric.label, metric.value, {
          featured: !!metric.featured,
          editable: metric.editable || null,
          deferApply: true
        });
        if (entry) editableEntries.push(entry);
      });
      card.appendChild(metrics);

      if (editableEntries.length) {
        const footer = document.createElement('div');
        footer.className = 'pool-chemistry-footer';
        const status = document.createElement('span');
        status.className = 'pool-chemistry-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        const actions = document.createElement('div');
        actions.className = 'pool-chemistry-actions';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn-tonal pool-chemistry-cancel';
        cancel.textContent = tr('pool.chemistry.cancel', 'Annuler');
        const validate = document.createElement('button');
        validate.type = 'button';
        validate.className = 'btn-primary pool-chemistry-validate';
        validate.textContent = tr('pool.chemistry.validate', 'Valider');
        actions.appendChild(cancel);
        actions.appendChild(validate);
        footer.appendChild(status);
        footer.appendChild(actions);
        card.appendChild(footer);

        const syncState = (state, message) => {
          let dirty = false;
          let valid = true;
          editableEntries.forEach((entry) => {
            valid = entry.control.checkValidity() && valid;
            try {
              dirty = !poolConfigValuesEqual(
                poolConfigChemistryEntryValue(entry),
                entry.initialValue
              ) || dirty;
            } catch (err) {
              dirty = true;
              valid = false;
            }
          });
          card.classList.toggle('is-dirty', dirty);
          const busy = poolConfigFieldApplyBusy || card.getAttribute('aria-busy') === 'true';
          cancel.disabled = !dirty || busy;
          validate.disabled = !dirty || !valid || busy;
          if (state !== 'keep') {
            status.className = 'pool-chemistry-status';
            if (state === 'saved') status.classList.add('is-ok');
            if (state === 'error') status.classList.add('is-error');
            if (state === 'saving') status.classList.add('is-pending');
            if (message) {
              status.textContent = message;
            } else {
              status.textContent = dirty
                ? tr('pool.chemistry.unsaved', 'Modifications non enregistrées.')
                : '';
            }
          }
          poolConfigRefreshChemistryPendingFlag();
        };

        editableEntries.forEach((entry) => {
          entry.control.addEventListener('input', () => syncState());
          entry.control.addEventListener('change', () => syncState());
        });
        cancel.addEventListener('click', () => {
          editableEntries.forEach(poolConfigRestoreChemistryEntry);
          syncState('cancelled', tr('pool.chemistry.cancelled', 'Modifications annulées.'));
        });
        validate.addEventListener('click', () => {
          poolConfigApplyChemistryCard(editableEntries, card, syncState).catch(() => {});
        });
        syncState();
      }
      parent.appendChild(card);
    }

    function poolConfigRenderChemistry(modules, liveState) {
      if (!poolChemistryPanel) return;
      poolChemistryPanel.innerHTML = '';
      const source = modules && typeof modules === 'object' ? modules : {};
      const live = liveState && typeof liveState === 'object' ? liveState : {};
      const ph = source['poollogic/ph'] || {};
      const chlorine = source['poollogic/chlorine'] || {};
      const modes = source['poollogic/modes'] || {};
      const swg = source['poollogic/swg'] || {};
      const safety = source['poollogic/safety'] || {};
      const sensors = source['poollogic/sensors'] || {};
      const swgSelected = Number(modes.disinfection_type) === 1;
      const phAvailable = live.ph !== null && typeof live.ph !== 'undefined' && Number.isFinite(Number(live.ph));
      const orpAvailable = live.orp !== null && typeof live.orp !== 'undefined' && Number.isFinite(Number(live.orp));
      const waterAvailable = live.wat !== null && typeof live.wat !== 'undefined' && Number.isFinite(Number(live.wat));
      const pressureAvailable = live.psi !== null && typeof live.psi !== 'undefined' && Number.isFinite(Number(live.psi));
      const phState = poolConfigChemistryTargetState(live.ph, ph.ph_setpoint, 0.1, '');
      const orpUsesSetpoint = !swgSelected || Number(swg.swg_control_mode) === 0;
      const orpState = orpUsesSetpoint
        ? poolConfigChemistryTargetState(live.orp, chlorine.dis_setpoint, 25, 'mV')
        : {
            kind: orpAvailable ? 'neutral' : 'unavailable',
            label: orpAvailable ? tr('pool.chemistry.sensorAvailable', 'Sonde active') : tr('pool.chemistry.sensorUnavailable', 'Sonde indisponible'),
            note: orpAvailable
              ? tr('pool.chemistry.orpContinuous', 'Mesure informative : l’électrolyse fonctionne en mode continu pendant la filtration.')
              : tr('pool.chemistry.comparisonUnavailable', 'Comparaison à la consigne impossible.')
          };
      const temperatureState = {
        kind: waterAvailable ? 'ok' : 'unavailable',
        label: waterAvailable ? tr('pool.chemistry.sensorAvailable', 'Sonde active') : tr('pool.chemistry.sensorUnavailable', 'Sonde indisponible'),
        note: waterAvailable
          ? tr('pool.chemistry.temperatureUsage', 'Cette mesure sert au calcul du temps de filtration et aux sécurités thermiques.')
          : tr('pool.chemistry.temperatureUnavailable', 'Le calcul thermique conserve sa dernière plage valide.')
      };
      const pressureState = poolConfigPressureState(live.psi, safety.psi_low_th, safety.psi_high_th, sensors.psi_monitoring);

      const heading = document.createElement('div');
      heading.className = 'pool-section-heading';
      const headingIcon = document.createElement('span');
      headingIcon.className = 'ui-msr';
      headingIcon.setAttribute('aria-hidden', 'true');
      headingIcon.textContent = 'monitoring';
      const headingCopy = document.createElement('div');
      const headingTitle = document.createElement('h2');
      headingTitle.textContent = tr('pool.chemistry.title', 'Qualité de l’eau');
      const headingNote = document.createElement('p');
      headingNote.textContent = tr('pool.chemistry.refreshNote', 'Mesures actualisées automatiquement toutes les 10 secondes. Les écarts affichés sont informatifs.');
      headingCopy.appendChild(headingTitle);
      headingCopy.appendChild(headingNote);
      heading.appendChild(headingIcon);
      heading.appendChild(headingCopy);
      poolChemistryPanel.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'pool-chemistry-grid';
      poolConfigAppendChemistryCard(grid, {
        title: 'pH',
        subtitle: 'Acidité et dosage correcteur',
        icon: 'science',
        accent: 'is-ph',
        available: phAvailable,
        state: phState,
        measured: poolConfigLiveNumber(live.ph, 2, ''),
        metrics: [
          {
            label: 'Consigne',
            featured: true,
            editable: { module: 'poollogic/ph', key: 'ph_setpoint', type: 'number', value: ph.ph_setpoint, min: 6, max: 8, step: 0.01 }
          },
          {
            label: 'Régulation',
            editable: { module: 'poollogic/ph', key: 'ph_auto_mode', type: 'bool', value: ph.ph_auto_mode }
          },
          { label: 'Correcteur', value: toBool(ph.ph_dose_plus) ? 'pH+' : 'pH−' },
          { label: 'Pompe', value: poolConfigBoolLabel(live.php, 'En marche', 'Arrêt') }
        ]
      });
      poolConfigAppendChemistryCard(grid, {
        title: 'ORP',
        subtitle: 'Potentiel de désinfection',
        icon: 'water_drop',
        accent: 'is-orp',
        available: orpAvailable,
        state: orpState,
        measured: poolConfigLiveNumber(live.orp, 0, 'mV'),
        metrics: [
          {
            label: 'Consigne',
            featured: true,
            editable: { module: 'poollogic/chlorine', key: 'dis_setpoint', type: 'number', value: chlorine.dis_setpoint, min: 300, max: 900, step: 1, unit: 'mV' }
          },
          {
            label: 'Régulation',
            editable: { module: 'poollogic/chlorine', key: 'dis_auto_mode', type: 'bool', value: chlorine.dis_auto_mode }
          },
          {
            label: swgSelected ? 'Électrolyseur' : 'Pompe',
            value: poolConfigBoolLabel(swgSelected ? live.swg : live.clp, 'En marche', 'Arrêt')
          }
        ]
      });
      poolConfigAppendChemistryCard(grid, {
        title: 'Température',
        subtitle: 'Température utilisée par PoolLogic',
        icon: 'thermostat',
        accent: 'is-temperature',
        available: waterAvailable,
        state: temperatureState,
        measurementLabel: 'Eau',
        measured: poolConfigLiveNumber(live.wat, 1, '°C'),
        metrics: [
          { label: 'Air', value: poolConfigLiveNumber(live.air, 1, '°C') },
          { label: 'Filtration', value: poolConfigBoolLabel(live.fil, 'En marche', 'Arrêt'), featured: true },
          { label: 'Mode piscine', value: poolConfigBoolLabel(live.auto, 'Automatique', 'Manuel') }
        ]
      });
      poolConfigAppendChemistryCard(grid, {
        title: tr('pool.chemistry.pressure', 'Pression'),
        subtitle: tr('pool.chemistry.pressureSubtitle', 'Surveillance du circuit hydraulique'),
        icon: 'speed',
        accent: 'is-pressure',
        available: pressureAvailable,
        state: pressureState,
        measured: poolConfigLiveNumber(live.psi, 2, 'bar'),
        metrics: [
          { label: tr('pool.chemistry.minimum', 'Minimum'), value: Number.isFinite(Number(safety.psi_low_th)) ? poolConfigLiveNumber(safety.psi_low_th, 2, 'bar') : '—' },
          { label: tr('pool.chemistry.maximum', 'Maximum'), value: Number.isFinite(Number(safety.psi_high_th)) ? poolConfigLiveNumber(safety.psi_high_th, 2, 'bar') : '—' },
          { label: tr('pool.chemistry.monitoring', 'Surveillance'), value: poolConfigBoolLabel(sensors.psi_monitoring, tr('pool.state.active', 'Actif'), tr('pool.state.disabled', 'Désactivé')), featured: true },
          { label: tr('pool.chemistry.filtration', 'Filtration'), value: poolConfigBoolLabel(live.fil, tr('dashboard.equipment.on', 'En marche'), tr('pool.state.stopped', 'Arrêt')) }
        ]
      });
      poolChemistryPanel.appendChild(grid);
    }

    function poolConfigRenderDisinfection(modules) {
      if (!poolDisinfectionModes) return;
      poolDisinfectionModes.innerHTML = '';
      const modes = modules['poollogic/modes'] || {};
      const selectedType = Number(modes.disinfection_type);
      const selectedDef = poolDisinfectionModeDefs.find((def) => selectedType === def.typeValue) || poolDisinfectionModeDefs[0];
      const selected = selectedType === selectedDef.typeValue;
      const data = selected ? (modules[selectedDef.module] || {}) : {};

      const selector = document.createElement('div');
      selector.className = 'pool-treatment-selector';
      const selectorHead = document.createElement('div');
      selectorHead.className = 'pool-treatment-title';
      const selectorIcon = document.createElement('span');
      selectorIcon.className = 'ui-msr pool-treatment-title-icon';
      selectorIcon.setAttribute('aria-hidden', 'true');
      selectorIcon.textContent = 'water_drop';
      const selectorTitle = document.createElement('h3');
      selectorTitle.textContent = tr('pool.treatment.title', 'Traitement de l’eau');
      selectorHead.appendChild(selectorIcon);
      selectorHead.appendChild(selectorTitle);
      selector.appendChild(selectorHead);

      const choiceGroup = document.createElement('div');
      choiceGroup.className = 'pool-treatment-choice-group';
      poolDisinfectionModeDefs.forEach((def) => {
        const choice = document.createElement('button');
        choice.type = 'button';
        const isSelected = selectedType === def.typeValue;
        choice.disabled = poolConfigModeApplyBusy || isSelected;
        choice.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        choice.className = 'pool-treatment-choice' + (selectedType === def.typeValue ? ' is-selected' : '');
        const choiceIcon = document.createElement('span');
        choiceIcon.className = 'ui-msr pool-treatment-choice-icon';
        choiceIcon.setAttribute('aria-hidden', 'true');
        choiceIcon.textContent = def.icon;
        const choiceLabel = document.createElement('span');
        choiceLabel.textContent = tr(def.titleKey, def.title);
        choice.appendChild(choiceIcon);
        choice.appendChild(choiceLabel);
        if (!isSelected) {
          choice.addEventListener('click', () => {
            poolConfigApplyDisinfectionMode(def).catch(() => {});
          });
        }
        choiceGroup.appendChild(choice);
      });
      selector.appendChild(choiceGroup);

      const detail = document.createElement('article');
      detail.className = 'pool-treatment-detail is-' + selectedDef.accent;
      const head = document.createElement('div');
      head.className = 'pool-card-head';
      const icon = document.createElement('span');
      icon.className = 'ui-msr pool-card-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = selectedDef.icon;
      const copy = document.createElement('div');
      copy.className = 'pool-card-title-wrap';
      const title = document.createElement('h3');
      title.textContent = selected && selectedDef.key === 'swg'
        ? 'Configuration de l’électrolyseur'
        : (selected ? tr(selectedDef.titleKey, selectedDef.title) : poolConfigDisinfectionLabel(selectedType));
      const note = document.createElement('p');
      note.textContent = selected
        ? tr(selectedDef.noteKey, selectedDef.note)
        : tr('pool.disinfection.disabled.note', 'Aucun traitement de désinfection n’est sélectionné.');
      copy.appendChild(title);
      copy.appendChild(note);
      head.appendChild(icon);
      head.appendChild(copy);
      detail.appendChild(head);

      const metrics = document.createElement('div');
      metrics.className = 'pool-metric-grid';
      if (selected) {
        if (selectedDef.key === 'chlorine') {
          poolConfigAppendMetric(metrics, tr('pool.metric.autoOrp', 'Auto ORP'), poolConfigBoolLabel(data.dis_auto_mode), { module: selectedDef.module, key: 'dis_auto_mode' });
          poolConfigAppendMetric(metrics, tr('pool.metric.setpoint', 'Consigne'), poolConfigFormatValue(selectedDef.module, 'dis_setpoint', data.dis_setpoint), { featured: true, module: selectedDef.module, key: 'dis_setpoint' });
          poolConfigAppendMetric(metrics, tr('pool.metric.window', 'Fenêtre'), poolConfigFormatValue(selectedDef.module, 'dis_window_ms', data.dis_window_ms), { module: selectedDef.module, key: 'dis_window_ms' });
        } else if (selectedDef.key === 'o2') {
          poolConfigAppendMetric(metrics, tr('pool.metric.poolVolume', 'Volume bassin'), poolConfigFormatValue(selectedDef.module, 'pool_volume_m3', data.pool_volume_m3), { featured: true });
          poolConfigAppendMetric(metrics, tr('pool.metric.weeklyDose', 'Dose hebdo'), poolConfigFormatValue(selectedDef.module, 'dose_ml_10m3_week', data.dose_ml_10m3_week));
          poolConfigAppendMetric(metrics, tr('pool.metric.injections', 'Injections'), poolConfigFormatValue(selectedDef.module, 'split_count', data.split_count));
          poolConfigAppendMetric(metrics, tr('pool.metric.pending', 'En attente'), poolConfigFormatValue(selectedDef.module, 'pending_ml', data.pending_ml));
        }
      }
      if (metrics.childNodes.length) detail.appendChild(metrics);
      if (selected) {
        if (selectedDef.key !== 'swg') {
          const editorTitle = document.createElement('h4');
          editorTitle.className = 'pool-settings-title';
          editorTitle.textContent = 'Réglages du traitement';
          detail.appendChild(editorTitle);
        }
        detail.appendChild(poolConfigBuildEditor(
          selectedDef.module,
          data,
          poolEditableFieldSpecs[selectedDef.module] || []
        ));
      }

      poolDisinfectionModes.appendChild(selector);
      poolDisinfectionModes.appendChild(detail);
    }

    function poolConfigActiveAlarms(alarmSlots) {
      return (Array.isArray(alarmSlots) ? alarmSlots : [])
        .filter((slot) => {
          if (!slot || slot.enabled === false) return false;
          return slot.conditionTrue === true || slot.latched === true;
        })
        .map((slot) => {
          const label = String(slot.label || '').trim() || tr('pool.alarm.defaultLabel', 'Alarme piscine');
          const state = slot.conditionTrue === true
            ? tr('pool.alarm.state.activeCondition', 'condition active')
            : tr('pool.alarm.state.latched', 'alarme mémorisée');
          return { label, state };
        });
    }

    function poolConfigRenderAlarms(alarmSlots) {
      if (!poolAlarmCard) return;
      const alarms = poolConfigActiveAlarms(alarmSlots);
      poolAlarmCard.innerHTML = '';
      poolAlarmCard.hidden = alarms.length === 0;
      if (alarms.length === 0) return;

      const head = document.createElement('div');
      head.className = 'pool-alarm-head';
      const icon = document.createElement('span');
      icon.className = 'ui-msr pool-alarm-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'warning';
      const titleWrap = document.createElement('div');
      titleWrap.className = 'pool-alarm-title-wrap';
      const title = document.createElement('h3');
      title.textContent = alarms.length > 1 ? tr('pool.alarm.title.plural', 'Alarmes piscine en cours') : tr('pool.alarm.title.singular', 'Alarme piscine en cours');
      const intro = document.createElement('p');
      intro.textContent = tr('pool.alarm.intro', 'PoolLogic signale une attention requise avant de laisser les automatismes fonctionner sans surveillance.');
      titleWrap.appendChild(title);
      titleWrap.appendChild(intro);
      head.appendChild(icon);
      head.appendChild(titleWrap);
      poolAlarmCard.appendChild(head);

      const list = document.createElement('div');
      list.className = 'pool-alarm-list';
      alarms.forEach((alarm) => {
        const row = document.createElement('div');
        row.className = 'pool-alarm-row';
        const label = document.createElement('b');
        label.textContent = alarm.label;
        const state = document.createElement('span');
        state.textContent = alarm.state;
        row.appendChild(label);
        row.appendChild(state);
        list.appendChild(row);
      });
      poolAlarmCard.appendChild(list);
    }

    function poolConfigRenderFiltrationCard(def, data) {
      const card = document.createElement('article');
      card.className = 'pool-config-card pool-filtration-card';

      const head = document.createElement('div');
      head.className = 'pool-card-head';
      const icon = document.createElement('span');
      icon.className = 'ui-msr pool-card-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = def.icon;
      const copy = document.createElement('div');
      copy.className = 'pool-card-title-wrap';
      const title = document.createElement('h3');
      title.textContent = tr(def.titleKey, def.title);
      copy.appendChild(title);
      head.appendChild(icon);
      head.appendChild(copy);
      card.appendChild(head);

      const schedule = dashboardSchedule(data);
      const start = schedule ? schedule.start : '—';
      const stop = schedule ? schedule.stop : '—';
      const durationMinutes = Number(data && data.filtr_duration_minute);
      const duration = poolConfigFormatDurationMinutes(durationMinutes);
      let scheduledMinutes = null;
      if (schedule) {
        scheduledMinutes = ((schedule.stopValue - schedule.startValue) + 1440) % 1440;
        if (Math.round(durationMinutes) === 1440 && scheduledMinutes === 0) scheduledMinutes = 1440;
      }
      const coherent = schedule
        && Number.isFinite(durationMinutes)
        && Math.round(durationMinutes) === scheduledMinutes;
      const waterTemperature = Number(poolConfigLiveState && poolConfigLiveState.wat);
      const waterTemperatureAvailable = Number.isFinite(waterTemperature);

      const values = document.createElement('div');
      values.className = 'pool-filtration-values';
      [
        { label: tr('pool.filtration.start', 'Début prévu'), value: start },
        { label: tr('pool.filtration.stop', 'Fin prévue'), value: stop },
        { label: tr('pool.filtration.duration', 'Durée prévue'), value: duration }
      ].forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'pool-filtration-value';
        const label = document.createElement('span');
        label.textContent = entry.label;
        const value = document.createElement('strong');
        value.textContent = entry.value;
        item.appendChild(label);
        item.appendChild(value);
        values.appendChild(item);
      });
      card.appendChild(values);

      const explanation = document.createElement('p');
      explanation.className = 'pool-filtration-explanation' + (coherent && waterTemperatureAvailable ? '' : ' is-warning');
      explanation.textContent = !waterTemperatureAvailable
        ? tr('pool.filtration.temperatureUnavailable', 'Sonde de température indisponible : Flow.io applique le programme minimal de sécurité, de 22:00 à 00:00 (2 h).')
        : (coherent
          ? tr('pool.filtration.calculatedHelp', 'Ces horaires sont calculés automatiquement à partir de la température de l’eau.')
          : tr('pool.filtration.inconsistent', 'Le créneau affiché ne correspond pas à la durée prévue. Relancez le calcul.'));
      card.appendChild(explanation);

      const actions = document.createElement('div');
      actions.className = 'pool-filtration-actions';
      const status = document.createElement('span');
      status.className = 'pool-settings-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      const recalculate = document.createElement('button');
      recalculate.type = 'button';
      recalculate.className = 'btn-tonal';
      recalculate.textContent = tr('pool.filtration.recalculate', 'Recalculer');
      recalculate.addEventListener('click', async () => {
        recalculate.disabled = true;
        status.className = 'pool-settings-status is-pending';
        status.textContent = tr('pool.filtration.recalculating', 'Recalcul en cours…');
        try {
          await fetchOkJson(
            '/api/poollogic/filtration/recalculate',
            { method: 'POST' },
            tr('pool.filtration.recalculateFailed', 'Recalcul impossible'),
            fetch
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
          await loadPoolConfig(true);
        } catch (err) {
          status.className = 'pool-settings-status is-error';
          status.textContent = tr('pool.filtration.recalculateFailed', 'Recalcul impossible') + ' : ' + String(err);
          recalculate.disabled = false;
        }
      });
      actions.appendChild(status);
      actions.appendChild(recalculate);
      card.appendChild(actions);
      return card;
    }

    function poolConfigRenderGeneralCards(modules) {
      if (!poolConfigGrid || !poolGeneralControl) return;
      poolGeneralControl.innerHTML = '';
      poolConfigGrid.innerHTML = '';
      const order = [
        'poollogic/modes',
        'hmi/buzzer',
        'poollogic/ph',
        'poollogic/filtration',
        'poollogic/regulation',
        'poollogic/heater',
        'poollogic/safety',
        'poollogic/robot',
        'poollogic/refill',
        'poollogic/sensors',
        'poollogic/devices'
      ];
      const orderedDefs = poolConfigModuleDefs.slice().sort((a, b) => {
        const ai = order.indexOf(a.module);
        const bi = order.indexOf(b.module);
        return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      });
      orderedDefs.forEach((def) => {
        if (def.hidden) return;
        const data = modules[def.module] || {};
        if (def.module === 'poollogic/filtration') {
          poolConfigGrid.appendChild(poolConfigRenderFiltrationCard(def, data));
          return;
        }
        const fieldSpecs = poolEditableFieldSpecs[def.module] || [];
        if (!fieldSpecs.length) return;
        const card = document.createElement('article');
        card.className = 'pool-config-card pool-config-card-' + runtimeMeasureCssSlug(def.module);

        const head = document.createElement('div');
        head.className = 'pool-card-head';
        const icon = document.createElement('span');
        icon.className = 'ui-msr pool-card-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = def.icon;
        const copy = document.createElement('div');
        copy.className = 'pool-card-title-wrap';
        const title = document.createElement('h3');
        title.textContent = tr(def.titleKey, def.title);
        const note = document.createElement('p');
        note.textContent = tr(def.noteKey, def.note);
        copy.appendChild(title);
        copy.appendChild(note);
        head.appendChild(icon);
        head.appendChild(copy);
        card.appendChild(head);
        card.appendChild(poolConfigBuildEditor(def.module, data, fieldSpecs));
        const target = def.module === 'hmi/buzzer'
          ? poolGeneralControl
          : poolConfigGrid;
        target.appendChild(card);
      });
    }

    function poolConfigRender(modules, alarmSlots) {
      const source = modules && typeof modules === 'object' ? modules : {};
      poolConfigModulesCache = source;
      poolConfigAlarmSlotsCache = Array.isArray(alarmSlots) ? alarmSlots : [];
      poolConfigRenderHero(source, alarmSlots);
      renderPoolEquipmentControl(source, poolConfigLiveState);
      poolConfigRenderChemistry(source, poolConfigLiveState);
      poolConfigRenderDisinfection(source);
      poolConfigRenderAlarms(alarmSlots);
      poolConfigRenderGeneralCards(source);
    }

    function poolConfigRenderSkeleton() {
      if (poolOperatingMode) poolOperatingMode.disabled = true;
      if (poolOperatingModeApply) poolOperatingModeApply.disabled = true;
      if (poolEquipmentControl) {
        poolEquipmentControl.innerHTML = '';
        const heading = document.createElement('div');
        heading.className = 'pool-section-heading pool-config-skeleton';
        heading.appendChild(createSkeletonLine('', 34));
        heading.appendChild(createSkeletonLine('', 62));
        poolEquipmentControl.appendChild(heading);
      }
      if (poolGeneralControl) {
        poolGeneralControl.innerHTML = '';
        for (let i = 0; i < 1; i += 1) {
          const card = document.createElement('article');
          card.className = 'pool-config-card pool-config-skeleton';
          card.appendChild(createSkeletonLine('', i === 0 ? 58 : 46));
          card.appendChild(createSkeletonLine('', 84));
          poolGeneralControl.appendChild(card);
        }
      }
      if (poolDisinfectionModes) {
        poolDisinfectionModes.innerHTML = '';
        for (let i = 0; i < 2; i += 1) {
          const card = document.createElement('article');
          card.className = (i === 0 ? 'pool-treatment-selector' : 'pool-treatment-detail') + ' pool-config-skeleton';
          card.appendChild(createSkeletonLine('', 58));
          card.appendChild(createSkeletonLine('', 86));
          card.appendChild(createSkeletonLine('', 42));
          poolDisinfectionModes.appendChild(card);
        }
      }
      if (poolChemistryPanel) {
        poolChemistryPanel.innerHTML = '';
        const card = document.createElement('article');
        card.className = 'pool-config-card pool-config-skeleton';
        card.appendChild(createSkeletonLine('', 42));
        card.appendChild(createSkeletonLine('', 82));
        poolChemistryPanel.appendChild(card);
      }
      if (poolConfigGrid) {
        poolConfigGrid.innerHTML = '';
        for (let i = 0; i < 4; i += 1) {
          const card = document.createElement('article');
          card.className = 'pool-config-card pool-config-skeleton';
          card.appendChild(createSkeletonLine('', i % 2 === 0 ? 52 : 66));
          card.appendChild(createSkeletonLine('', 88));
          card.appendChild(createSkeletonLine('', 74));
          poolConfigGrid.appendChild(card);
        }
      }
      if (poolAlarmCard) {
        poolAlarmCard.hidden = true;
        poolAlarmCard.innerHTML = '';
      }
    }

    function poolConfigRenderError(err) {
      if (poolEquipmentControl) poolEquipmentControl.innerHTML = '';
      if (poolGeneralControl) poolGeneralControl.innerHTML = '';
      if (poolDisinfectionModes) poolDisinfectionModes.innerHTML = '';
      if (poolChemistryPanel) poolChemistryPanel.innerHTML = '';
      if (poolAlarmCard) {
        poolAlarmCard.hidden = true;
        poolAlarmCard.innerHTML = '';
      }
      if (!poolConfigGrid) return;
      poolConfigGrid.innerHTML = '';
      const card = document.createElement('article');
      card.className = 'pool-config-card pool-config-error-card';
      const head = document.createElement('div');
      head.className = 'pool-card-head';
      const icon = document.createElement('span');
      icon.className = 'ui-msr pool-card-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'error';
      const copy = document.createElement('div');
      copy.className = 'pool-card-title-wrap';
      const title = document.createElement('h3');
      title.textContent = tr('pool.error.title', 'Configuration piscine indisponible');
      const detail = document.createElement('p');
      detail.textContent = String(err || tr('pool.error.readFailed', 'Lecture de la configuration impossible.'));
      copy.appendChild(title);
      copy.appendChild(detail);
      head.appendChild(icon);
      head.appendChild(copy);
      card.appendChild(head);
      poolConfigGrid.appendChild(card);
    }

    async function loadPoolConfig(forceRefresh) {
      const reqSeq = ++poolConfigReqSeq;
      // Keep already rendered values visible during a refresh. Only the first
      // visit needs a skeleton.
      if (!poolConfigLoadedOnce) poolConfigRenderSkeleton();
      if (poolConfigRefreshBtn) poolConfigRefreshBtn.disabled = true;
      try {
        const [modules, alarmSlots] = await Promise.all([
          poolConfigFetchAllModules(),
          fetchPoolAlarmSlots().catch(() => [])
        ]);
        if (reqSeq !== poolConfigReqSeq) return;
        poolConfigRender(modules, alarmSlots);
        poolConfigLoadedOnce = true;
        poolConfigWarmDocsInBackground();
      } catch (err) {
        if (reqSeq !== poolConfigReqSeq) return;
        poolConfigRenderError(err);
      } finally {
        if (reqSeq === poolConfigReqSeq && poolConfigRefreshBtn) {
          poolConfigRefreshBtn.disabled = false;
        }
      }
    }

    function stopPoolConfigTimer() {
      poolConfigPoller.stop();
    }

    function startPoolConfigTimer() {
      poolConfigPoller.start();
    }

    async function refreshPoolConfigLive(forceRefresh) {
      const [poolResult, pressureResult] = await Promise.all([
        fetchFlowStatusDomain('pool', !!forceRefresh, 'pool-page').catch(() => null),
        fetchRuntimeValues([2206]).catch(() => [])
      ]);
      poolConfigLiveState = poolResult && poolResult.pool && typeof poolResult.pool === 'object'
        ? { ...poolResult.pool }
        : {};
      const pressureEntry = Array.isArray(pressureResult)
        ? pressureResult.find((entry) => Number(entry && entry.id) === 2206)
        : null;
      if (runtimeValueAvailable(pressureEntry) && Number.isFinite(Number(pressureEntry.value))) {
        poolConfigLiveState.psi = Number(pressureEntry.value);
      }
      if (poolConfigLoadedOnce && getActivePageId() === 'page-pool') {
        renderPoolEquipmentControl(poolConfigModulesCache, poolConfigLiveState);
        if (!poolChemistryHasPendingChanges) {
          poolConfigRenderChemistry(poolConfigModulesCache, poolConfigLiveState);
        }
      }
    }

    async function onPoolConfigPageShown(forceRefresh) {
      startPoolConfigTimer();
      await Promise.all([
        loadPoolConfig(!!forceRefresh || !poolConfigLoadedOnce),
        refreshPoolConfigLive(true)
      ]);
      if (poolConfigLoadedOnce) {
        poolConfigRender(poolConfigModulesCache, poolConfigAlarmSlotsCache);
      }
    }




      poolMeasuresPoller = createIntervalRunner(() => {
        if (getActivePageId() !== 'page-pool-measures' || document.hidden) return;
        return refreshPoolMeasures(false);
      }, 10000);
      poolConfigPoller = createIntervalRunner(() => {
        if (getActivePageId() !== 'page-pool' || document.hidden) return;
        return refreshPoolConfigLive(false);
      }, 10000);

      deps.bindClickAction(poolMeasuresRefreshBtn, async () => {
        try { await refreshPoolMeasures(true); } catch (err) { showPoolMeasuresError(err); }
      });
      deps.bindClickAction(poolConfigRefreshBtn, () => onPoolConfigPageShown(true));
      const bindOperatingModeControl = (select, applyButton) => {
        if (!select || !applyButton) return;
        select.addEventListener('change', () => {
          poolOperatingModeStatusMessage = '';
          poolOperatingModeStatusTone = '';
          select.dataset.modeDirty = select.value === poolOperatingModeCurrent ? 'false' : 'true';
          poolOperatingModeSyncControl(select, applyButton, select === dashboardOperatingMode ? dashboardModeStatus : poolOperatingModeStatus);
        });
        deps.bindClickAction(applyButton, () => applyPoolOperatingMode(select.value));
      };
      bindOperatingModeControl(dashboardOperatingMode, dashboardModeApply);
      bindOperatingModeControl(poolOperatingMode, poolOperatingModeApply);
      deps.bindClickAction(dashboardLightsShortcut, () => {
        const def = poolEquipmentDefs.find((entry) => entry.key === 'lights');
        if (def && typeof dashboardLightsOn === 'boolean') return commandPoolEquipment(def, !dashboardLightsOn);
      });
      dashboardShortcutButtons.forEach((button) => {
        deps.bindClickAction(button, () => {
          const pageId = String(button.dataset.dashboardPage || '').trim();
          if (pageId) showPage(pageId);
        });
      });

      return {
        showDashboard: onPoolMeasuresPageShown,
        showPool: onPoolConfigPageShown,
        hideDashboard: stopPoolMeasuresTimer,
        hidePool: stopPoolConfigTimer,
        refreshLocale: function refreshLocale() {
          refreshPoolMeasuresView();
          if (getActivePageId() === 'page-pool' && poolConfigLoadedOnce) loadPoolConfig(true).catch(() => {});
        },
        visibilityChanged: function visibilityChanged(pageId) {
          if (document.hidden || pageId !== 'page-pool-measures') stopPoolMeasuresTimer();
          else startPoolMeasuresTimer();
          if (document.hidden || pageId !== 'page-pool') stopPoolConfigTimer();
          else {
            startPoolConfigTimer();
            refreshPoolConfigLive(true).catch(() => {});
          }
        },
        isBusy: function isBusy() { return poolConfigFieldApplyBusy || poolConfigModeApplyBusy; },
        syncRuntimeDomains
      };
    }
  };
})();
