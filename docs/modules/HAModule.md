# HAModule (`moduleId: ha`)

## Rôle

Publication Home Assistant MQTT Discovery:
- registre d'entités (sensor, binary_sensor, switch, number, select, button)
- publication discovery retainée
- publication initiale des entités au démarrage, en mode one-shot sur la cible Waveshare
- support du champ discovery `has_entity_name` sur les sensors (piloté par l'entité appelante)

Type: module actif (event-driven par notification task).

## Dépendances

- `eventbus`
- `config`
- `datastore`
- `mqtt`

## Affinité / cadence

- core: 0
- task: `ha`
- loop bloquant sur notification (`ulTaskNotifyTake`)

## Services exposés

- `ha` -> `HAService`
  - `addSensor`, `addBinarySensor`, `addSwitch`, `addNumber`, `addSelect`, `addButton`
  - `requestRefresh`

## Services consommés

- `eventbus`
- `datastore`
- `mqtt`

## Capacités statiques

Capacités compile-time actuelles dans `src/Modules/Network/HAModule/HAModule.h`:

| Type d'entité | Capacité |
|---|---:|
| sensors | 48 |
| binary sensors | 6 |
| switches | 16 |
| numbers | 30 |
| selects | 6 |
| buttons | 24 |

## Config / NVS

Module config: `ha` (`moduleId = ConfigModuleId::Ha`, branche locale `1`):
- `enabled`
- `vendor`
- `device_id` (Identifiant appareil HA)
- `entity_prefix`
- `disc_prefix`
- `model`

Détail `device_id`:
- persistance NVS: `ha_devid`
- si vide: fallback auto basé MAC (hex)
- alimente `unique_id` des entités Discovery
- alimente aussi le segment `<nodeTopicId>` des topics Discovery (`.../<component>/<nodeTopicId>/<objectId>/config`)
- `dev.ids[0]` dans les payloads Discovery suit prioritairement le `deviceId` MQTT effectif (ex: `mq_tid`), puis retombe sur `device_id` si indisponible

## DataStore

Écritures via `HARuntime.h`:
- `HaPublished`
- `HaVendor`
- `HaDeviceId`

## EventBus

Abonnement:
- `DataChanged`

Réactions:
- sur `WifiReady`/`MqttReady` -> tentative/pending de publication auto-discovery

## MQTT

- producteur MQTT enregistré (`producerId` dédié HA) sur le cœur TX unifié
- jobs HA en mode IDs (`producerId + messageId`), sans publication directe module -> broker
- build topic/payload discovery à la demande via `MqttBuildContext` (buffer central MQTT)
- construit topics discovery:
  - `<discoveryPrefix>/<component>/<nodeTopicId>/<objectId>/config`
- préfixe `object_id` configurable par profil:
  - défaut `fio_*` (via `entity_prefix=fio`)
  - si `entity_prefix` est non vide: `object_id = <prefix>_<entity>`
  - si `entity_prefix` est vide: `object_id = <entity>` (sans préfixe)
- payloads incluent:
  - device metadata
  - `device.name` prioritairement depuis `mqtt.deviceName` (fallback: nom d'origine du profil)
  - `device.identifiers[0] = <vendor>-<mqttDeviceIdEffectif>` (priorité à `mqtt.topicDeviceId` / `mq_tid`; fallback sur `ha/device_id`)
  - `unique_id` construit avec `ha/device_id` (ou fallback MAC hex si vide)
  - le segment `<nodeTopicId>` du topic Discovery est dérivé de `ha/device_id` (ou fallback MAC hex si vide)
  - `availability` basée sur topic `status`
- entités d’alarme natives publiées :
  - `alm_pack` (`rt/alarms/p`)
  - `alm_any` (`rt/alarms/m`)
  - un `binary_sensor` `alm_*` par `AlarmId` enregistré
- capteurs diagnostic système publiés :
  - `sys_upt_mn` (`rt/system/state`, conversion en minutes depuis `upt_ms`)
  - `sys_hp_free` (`rt/system/state`, conversion en `ko`)
  - `sys_hp_min_free` (`rt/system/state`, conversion en `ko`)
  - `sys_hp_frag` (`rt/system/state`, valeur `%`)

Les automatismes de désinfection sont exposés séparément selon leur rôle :
- `pl_dis_auto` commande la régulation ORP du mode chlore/brome ;
- `pl_treatment_auto` commande l'automatisme du traitement choisi lorsqu'il s'agit d'électrolyse ou d'oxygène actif.

Le sélecteur `pl_modes_dis` définit le traitement actif. PoolLogic maintient les automatismes cohérents avec le mode général : en mode automatique, il active la régulation ORP pour le chlore/brome, ou l'automatisme du traitement pour l'électrolyse/oxygène actif ; en mode manuel, ces automatismes sont désactivés. Le commutateur ORP reste distinct, car il correspond à une régulation spécifique.

Avec le préfixe par défaut, les entités deviennent par exemple
`binary_sensor.fio_alm_psi_low`, `sensor.fio_sys_upt_mn` et
`sensor.fio_sys_hp_free`.

## Publication et rafraîchissement

- `add*` enregistre une entité et marque sa configuration Discovery comme à publier
- `requestRefresh` relance la publication lorsque le mode continu est utilisé
- publication effective seulement si MQTT connecté et `mqttReady(DataStore)==true`
- sur la cible Waveshare 3.4.1, le build active `FLOW_HA_ONESHOT_DISCOVERY=1` : les configurations Discovery sont publiées une fois au démarrage, puis les tables sont libérées
- les changements d'état et de configuration continuent d'être publiés sur leurs topics MQTT habituels ; le mode one-shot concerne uniquement la découverte des entités

## Mode one-shot

Le build peut définir `FLOW_HA_ONESHOT_DISCOVERY=1` pour publier l'auto-discovery une seule fois au démarrage.
Ce mode est activé pour le profil Waveshare 3.4.1:
- les tables d'entités HA sont allouées dynamiquement au lieu d'être conservées en `.bss`
- le producteur MQTT de configuration HA n'est pas instancié
- après publication retained de toutes les entités discovery, les tables sont libérées et la tâche `ha` appelle `vTaskDelete(nullptr)`
- le service HA reste présent mais refuse les nouveaux enregistrements après teardown, afin d'éviter des pointeurs pendants dans les services/callbacks existants
- pour diagnostiquer la séquence de boot one-shot, le build Waveshare peut activer `FLOW_HA_BOOT_TRACE=1` (logs de jalons alloc/enqueue/publish/release)
