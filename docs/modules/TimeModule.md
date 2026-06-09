# TimeModule (`moduleId: time`)

## Rôle

Synchronisation temps + moteur scheduler interne:
- sync NTP (TZ configurable)
- selection de source horaire valide (`NTP` > `RTC interne PCF85063` > `RTC Nextion manuel`)
- exposition `TimeService`
- exposition `TimeSchedulerService` (16 slots)
- publication d'événements scheduler sur EventBus

Type: module actif.

## Dépendances

- `loghub`
- `datastore`
- `cmd`
- `eventbus`

## Affinité / cadence

- core: 1
- task: `time`
- loop: toutes les 250ms

## Services exposés

- `time` -> `TimeService`
- `time.scheduler` -> `TimeSchedulerService`

## Services consommés

- `eventbus`
- `datastore`
- `cmd`

## Config / NVS

Branches:
- `moduleId = ConfigModuleId::Time`, branche locale `1` (`module: time`)
  - `server1`, `server2`, `tz`, `enabled`, `manual_time`, `week_start_mon`
- `moduleId = ConfigModuleId::Time`, branche locale `2` (`module: time/scheduler`)
  - `slots_blob` (`tm_sched`)

`enabled` active/desactive la synchronisation NTP. Le module Time reste actif
quand NTP est desactive afin de pouvoir utiliser les RTC disponibles.

`manual_time` force une ecriture dans le RTC Nextion au format
`YYYY-MM-DD HH:MM:SS`. Cette source est consideree comme une heure manuelle:
elle est utilisee seulement si NTP et la RTC interne ne fournissent pas
d'heure valide.

## Guide d'utilisation

### Objectif operationnel

Le systeme Flow.io a besoin d'une heure fiable pour executer les actions
planifiees, notamment les dosages et les fenetres de filtration. Le module
`Time` est le point central qui choisit la meilleure source disponible et qui
indique au reste du logiciel si une heure exploitable est presente.

Le module peut fonctionner avec 0, 1, 2 ou 3 sources de temps:
- client NTP, via le reseau
- RTC interne Waveshare PCF85063
- RTC de l'ecran Nextion

Toutes ces sources sont optionnelles. Si aucune source valide n'est disponible,
le systeme demarre quand meme, mais les declenchements horaires ne sont pas
emis.

### Priorite des sources

La selection est automatique et suit toujours cet ordre:

1. `NTP`
2. `RTC interne PCF85063`
3. `RTC Nextion manuel`
4. aucune source valide

NTP est toujours prioritaire lorsqu'il est synchronise. Si NTP echoue, si le
reseau n'est pas disponible, ou si `time/enabled=false`, le module tente
d'utiliser le RTC interne. Le RTC Nextion est utilise en dernier recours et est
considere comme une heure manuelle.

### Source NTP

Quand NTP est disponible:
- l'horloge systeme ESP32 est reglee par NTP
- la source active devient `ntp`
- `time.ready` devient vrai
- le scheduler peut emettre ses evenements horaires
- le RTC interne PCF85063 est mis a jour
- le RTC Nextion est mis a jour

Les RTC sont synchronises lors de la synchronisation NTP, puis a nouveau une
fois par jour. Cela permet de conserver une reference locale correcte pour les
redemarrages sans reseau.

Le champ `time/enabled` active ou desactive uniquement le client NTP. Il ne
desactive pas le module `Time`: meme avec `enabled=false`, le module continue
d'utiliser les RTC disponibles et de piloter le scheduler si une heure valide
est trouvee.

### RTC interne PCF85063

Si NTP n'est pas disponible, le module lit le RTC interne Waveshare PCF85063.
Cette source n'est acceptee que si l'horloge du composant est consideree
valide.

La validation utilise le bit 7 du registre secondes du PCF85063. Si ce bit est
positionne, l'horloge RTC est rejetee comme invalide. Si le bit n'est pas
positionne et que la date est coherent, la source active devient
`internal_rtc`.

Quand le RTC interne devient la reference:
- l'horloge systeme ESP32 est reglee depuis le PCF85063
- `time.ready` devient vrai
- la source active devient `internal_rtc`
- le RTC Nextion est synchronise avec cette heure
- le scheduler peut fonctionner

### RTC Nextion et heure manuelle

Le RTC Nextion ne permet pas de savoir de facon fiable si son heure est valide
ou si sa pile est presente. Pour cette raison, Flow.io le traite comme une
source manuelle.

Le champ de configuration `time/manual_time` permet de forcer une heure
manuelle. Le format attendu est:

```text
YYYY-MM-DD HH:MM:SS
```

Le format avec `T` est aussi accepte:

```text
YYYY-MM-DDTHH:MM:SS
```

Exemple:

```text
2026-06-09 18:30:00
```

Quand `manual_time` est modifie:
- le module parse la date
- le RTC Nextion est mis a jour avec cette heure
- si aucune source prioritaire n'est active, l'horloge systeme ESP32 est reglee
  avec cette valeur
- la source active devient `manual`
- `time.ready` devient vrai

Si NTP ou le RTC interne est deja actif, `manual_time` met a jour le RTC
Nextion mais ne remplace pas la source active, car NTP et le RTC interne sont
plus prioritaires.

Si l'ecran Nextion n'est pas disponible ou si l'ecriture RTC echoue, l'heure
manuelle n'est pas appliquee.

### Etat visible dans l'interface web

L'interface web affiche l'etat de l'heure dans le badge d'en-tete:
- `Heure (NTP)` lorsque la source active est NTP
- `Heure (RTC interne)` lorsque la source active est le PCF85063
- `Heure (manuel)` lorsque la source active est le Nextion en mode manuel
- `Heure (Non synchronisee)` lorsqu'aucune source valide n'est disponible

La page `Informations systeme` affiche aussi une ligne `Heure`, alimentee par
le meme chemin runtime que les autres champs de la page Info:
- `1301` -> `time.ready`
- `1302` -> `time.source`

Cette page affiche:
- `Synchronisee (NTP)`
- `Synchronisee (RTC interne)`
- `Synchronisee (manuel)`
- `Non synchronisee`

### Effet sur la logique metier

Les modules metier demarrent meme si l'heure n'est pas synchronisee. Les
services, les lectures capteurs, les etats physiques et les securites peuvent
donc fonctionner au boot sans attendre NTP.

En revanche, le `time.scheduler` n'emet pas d'evenements tant que le module
`Time` n'a pas une heure exploitable. Cela evite de declencher des dosages ou
des fenetres horaires sur une date inconnue ou fausse.

Comportements importants:
- une filtration deja active au boot peut etre conservee temporairement si
  l'heure n'est pas encore fiable
- les declenchements horaires attendent `time.ready=true`
- le protocole O2 bloque explicitement si l'heure est absente
- les regulateurs bases sur `millis()` peuvent continuer une fois les
  conditions metier reunies, mais les decisions planifiees restent dependantes
  du scheduler

### Diagnostic rapide

Pour diagnostiquer l'etat du temps:
- verifier le badge `Heure (...)` dans l'interface web
- verifier la ligne `Heure` dans la page `Informations systeme`
- utiliser `time.scheduler.info`, qui expose aussi la source active
- controler `time/sourceText` dans le runtime si besoin

Interpretation:
- `ntp`: le reseau et NTP ont fourni l'heure
- `internal_rtc`: le PCF85063 a fourni une heure valide
- `manual`: l'heure vient du Nextion en mode manuel
- `none`: aucune source valide n'est disponible

## Commandes

- `time.resync` (alias: `ntp.resync`)
- `time.scheduler.info`
- `time.scheduler.get`
- `time.scheduler.set`
- `time.scheduler.clear`
- `time.scheduler.clear_all`

## EventBus

Abonnements:
- `DataChanged` (clé `WifiReady`)
- `ConfigChanged` (branches locales `1` et `2` du module `Time`)

Publications:
- `SchedulerEventTriggered` avec payload `SchedulerEventTriggeredPayload`

Slots système réservés (0..2):
- `TIME_SLOT_SYS_DAY_START` -> `TIME_EVENT_SYS_DAY_START`
- `TIME_SLOT_SYS_WEEK_START` -> `TIME_EVENT_SYS_WEEK_START`
- `TIME_SLOT_SYS_MONTH_START` -> `TIME_EVENT_SYS_MONTH_START`

## DataStore

Écriture:
- `setTimeReady(...)` -> `DataKeys::TimeReady`
- `TimeRuntimeData.source` / `sourceText` indiquent la source horaire active
  (`none`, `ntp`, `internal_rtc`, `manual`)

## Persistance scheduler

- serialisation compacte dans `slots_blob`
- recharge en `onConfigLoaded()`
- validation stricte des slots (mode, bornes horaires/epoch)
- slots système toujours ré-appliqués et protégés

## Intégration actuelle

- Les modules métier (ex: `PoolLogicModule`) doivent utiliser `time.scheduler` pour programmer leurs fenêtres.
- Les modules consommateurs doivent écouter `EventId::SchedulerEventTriggered`.
- `TimeService.source()` et `sourceName()` exposent la source active.
- Le `HMIModule` expose les lectures/ecritures RTC Nextion au `TimeModule`;
  l'arbitrage et le `settimeofday()` restent centralises dans `TimeModule`.
- Quand NTP est synchronise, le module met a jour la RTC interne et le RTC
  Nextion a la synchronisation, puis une fois par jour.
- La RTC interne PCF85063 n'est acceptee que si son registre secondes n'a pas
  le bit d'oscillator stop/invalid clock leve.
