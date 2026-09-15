# Flow.io Waveshare 3.3.1

Cette version part de la branche publiée `flow.io-waveshare-3.30`, dont le
numéro devait représenter 3.3.0. Elle conserve ses trois apports et ajoute deux
ensembles de changements évalués dans l’archive amont récente.

## PSRAM

- ajout d’un allocateur ArduinoJson strictement placé en PSRAM ;
- déplacement des documents de parsing persistants ou volumineux de
  ConfigStore, MQTT, Time, Alarm, PoolLogic et PoolDevice ;
- déplacement des documents temporaires HMI et du journal d’activité ;
- déplacement du registre de métadonnées LogHub dans un bloc PSRAM stable ;
- conservation de l’allocateur « PSRAM préférée avec repli » pour les chemins
  Web où la disponibilité de la réponse reste prioritaire.

## Tableau de bord temps réel et gestion

- flux SSE `GET /api/runtime/events`, limité à quatre clients ;
- regroupement des événements sur 100 ms et heartbeat toutes les 15 secondes ;
- invalidations séparées pour modes, équipements, alarmes et sondes ;
- reconnexion automatique, polling de secours et resynchronisation périodique ;
- fenêtre de gestion des équipements avec état, compteurs jour/semaine/mois/
  total, volumes injectés, commande et remise à zéro ;
- fenêtre de gestion des alarmes avec condition, mémorisation, date du dernier
  déclenchement et réarmement individuel/global.

## Routage métier unifié

Les commandes Home Assistant et celles de la fenêtre de gestion utilisent
`poollogic.device.write`. PoolLogic résout le rôle configuré du slot et applique
les mêmes règles métier que les commandes spécialisées. Un équipement sans rôle
PoolLogic conserve un repli direct sur `pooldevice.write`.

## Compatibilité et validation

- aucun changement de format de configuration persistante ;
- la date du dernier déclenchement d’une alarme est volatile et repart à zéro
  après redémarrage ;
- le firmware et SPIFFS doivent être mis à jour ensemble ;
- un essai matériel reste requis après la compilation automatisée.
