# Documentation technique — Waveshare 3.4.x

Cette branche produit un seul firmware : `Waveshare-ESP32-S3`, pour la carte
Waveshare ESP32-S3-POE-ETH-8DI-8RO N16R8. Les autres profils historiques ne sont
pas des cibles de compilation de cette branche.

Le guide utilisateur et l’état de la branche sont dans le
[README principal](../README.md). La version firmware déclarée est 3.4.1 ;
cette branche ajoute les affectations configurables des relais.

## Installation et mise en service

- [Première connexion](integration/premiere-connexion.md) : récupération réseau
  et création du premier administrateur.
- [Mise en service](integration/mise-en-service.md) : flash, contrôles des E/S
  et activation progressive des automatismes.
- [Raccordement Waveshare](integration/schema-raccordement-waveshare.md) :
  câblage des capteurs, entrées, relais et bus.
- [Schéma Fritzing](fritzing/README.md).
- Plans de test : [fonctionnel](integration/plan_tests_poollogic_pdm_io.csv) et
  [séquentiel](integration/plan_tests_sequentiel_poollogic_pdm_io.csv).

## Réseau, interface et affichages

- [Référence MQTT](core/mqtt-topics.md) et [intégration Home Assistant](modules/HAModule.md).
- Exemples Home Assistant 3.4.1 : [carte Lovelace](integration/home_assistant_dashboard_3_4_1.yaml)
  et [package optionnel](integration/home_assistant_package_3_4_1.yaml).
- [Interface Web modulaire](core/webinterface-assets-modular.md).
- [Valeurs runtime exposées à l’interface](core/runtime-ui-exposure.md).
- [Interface Nextion](integration/nextion-esp-protocol.md) et
  [description du module HMI](modules/HMIModule.md).
- [Kiosque d’affichage Raspberry Pi](../rpi-kiosk/README.md).

Les exemples Home Assistant suffixés `3_1_0` et les captures d’interface
`3.1.5` sont conservés comme archives historiques. Pour le firmware 3.4.1,
utiliser les exemples suffixés `3_4_1` ci-dessus.

## Modules actifs

- Piscine : [PoolLogic](modules/PoolLogicModule.md),
  [équipements](modules/PoolDeviceModule.md),
  [historique](modules/PoolHistoryModule.md) et [alarmes](modules/AlarmModule.md).
- E/S : [IOModule](modules/IOModule.md).
- Réseau : [Wi-Fi](modules/WifiModule.md),
  [MQTT](modules/MQTTModule.md), [heure](modules/TimeModule.md) et
  [Home Assistant](modules/HAModule.md).
- Infrastructure : [configuration](modules/ConfigStoreModule.md),
  [données runtime](modules/DataStoreModule.md),
  [événements](modules/EventBusModule.md), [commandes](modules/CommandModule.md),
  [journalisation](modules/LogHubModule.md),
  [distribution des logs](modules/LogDispatcherModule.md),
  [sortie série](modules/LogSerialSinkModule.md),
  [système](modules/SystemModule.md) et
  [surveillance](modules/SystemMonitorModule.md).

Le profil et les modules effectivement démarrés sont définis dans
`platformio.ini` et `src/Profiles/Waveshare/`.

## Architecture et sécurité

- [Architecture actuelle](core/architecture.md).
- [Structure du programme](program_structure.md).
- [Services entre modules](core/services.md).
- [Modèle données et événements](core/data-event-model.md).
- [Sécurité Web et réseau](security-hardening.md).
- [Signature OTA](ota-signing.md).
- [Travaux restants](../RESTANT_A_FAIRE.md).
- [Historique des corrections de sécurité](../HISTORIQUE_CORRECTIFS_SECURITE.md).

Les documents de versions 3.1.x à 3.4.0 restent disponibles comme historique
dans `docs/release-*.md`. Ils décrivent leur version respective, pas toujours
l’état courant de la branche.
