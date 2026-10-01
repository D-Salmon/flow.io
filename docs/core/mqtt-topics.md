# Topologie MQTT détaillée

## Préfixe commun

Tous les topics sont formatés ainsi:
- `<baseTopic>/<deviceId>/<suffix>`
- `baseTopic`: config `mqtt.baseTopic`
- `deviceId`: `mqtt.topicDeviceId` si défini, sinon `ESP32-XXXXXX` (dérivé MAC)

Le helper `MqttService::formatTopic(...)` applique ce préfixe.

## RX (souscriptions)

`MQTTModule` souscrit:
- `<base>/<device>/cmd` (QoS 0)
- `<base>/<device>/cfg/set` (QoS 1)

### `cmd`

Payload attendu:
```json
{"cmd":"pooldevice.write","args":{"slot":1,"value":true}}
```
Réponse:
- `<base>/<device>/ack`

### `cfg/set`

Payload patch config multi-modules:
```json
{"poollogic/modes":{"auto_mode":true},"pdm/pd1":{"flow_l_h":1.4}}
```
Réponse:
- `<base>/<device>/cfg/ack`

## TX (publication unifiée)

Le TX ne publie pas directement depuis les modules métier.
Chaque publication passe par un job logique:
- `(producerId, messageId, priority)`
- build tardif topic/payload via `MqttBuildContext`

### Priorités

- `High`
- `Normal`
- `Low`

Ordonnancement: `High -> Normal -> Low`.

### Capacités TX

- slots jobs: `80`
- queue high: `80`
- queue normal: `80`
- queue low: `60`
- budget traitement boucle MQTT: `8 jobs/tick`

### Retry transport

- build `Ready` + publish KO -> requeue backoff (`250 ms` à `10 s`)
- build `RetryLater` -> requeue différé
- build `NoLongerNeeded`/`PermanentError` -> drop logique

## Topics fonctionnels

### Status / ACK

- `<base>/<device>/status` (retain)
  - online: `{"online":true}`
  - offline (LWT): `{"online":false}`
- `<base>/<device>/ack`
- `<base>/<device>/cfg/ack`

### Runtime (`rt/*`)

Publié par `RuntimeProducer` + publishers périodiques:
- `rt/io/*`
- `rt/pdm/*`
- `rt/poollogic/*`
- `rt/network/state` (périodique)
- `rt/system/state` (périodique)
- `rt/alarms/m` : résumé (`a` = alarmes actives, `h` = sévérité maximale,
  `r` = alarmes acquittables)
- `rt/alarms/p` : représentation compacte historique `alm_pack`
- `rt/alarms/id<AlarmId>` : état individuel stable d’une alarme

Les trois formes d’état d’alarme sont publiées avec `retain=true`. Après une
reconnexion ou un redémarrage de Home Assistant, le broker peut donc restituer
immédiatement le dernier état connu. La disponibilité générale de l’appareil
reste portée par le topic `status`.

### Config (`cfg/*`) module-owned

La publication config est pilotée par producteurs locaux (modules).
`MqttConfigRouteProducer` fournit la mécanique (pending/retry), mais le mapping reste local au module.

Exemples:
- `cfg/poollogic`
- `cfg/poollogic/filtration`
- `cfg/poollogic/chlorine`
- `cfg/pdm`
- `cfg/pdm/pd0`

Règle topic:
- suffixe vide -> base (`cfg/<module>`)
- suffixe non vide -> `cfg/<module>/<suffix>`

## Home Assistant discovery

Publication via `HAModule` (producteur dédié), en conservant le même cœur TX MQTT.
Topics discovery typiques:
- `<discovery_prefix>/<component>/<node>/<object>/config`

## Logs MQTT: signification

### Occupation max depuis boot

`queue occ max/boot jobs=A/<jobs> qh=B/<high> qn=C/<normal> ql=D/<low>`
- niveau log: `DEBUG` (métrologie d'occupation max depuis boot)
- `jobs`: maximum de slots jobs utilisés ; les capacités dépendent du profil
  de carte
- `qh/qn/ql`: max profondeur observée par queue priorité

### Rejets enqueue du cœur

`enqueue reject reason=slot_full|queue_full producer=P msg=M prio=R ...`
- `slot_full`: plus aucun slot job libre
- `queue_full`: queue de priorité cible pleine

### Publications différées dans la file

`enqueue deferred reason=promotion_full producer=P msg=M prio=R ...`
- une publication déjà acceptée reste conservée quand sa promotion échoue ;
  elle est retentée automatiquement
- les reprises préservent le délai de retry et sont réparties par priorité avec
  un curseur circulaire

`queue state jobs=A queued=B processing=C waiting=D`
- occupation instantanée ; `jobs = queued + processing + waiting`
- `waiting` regroupe les jobs acceptés en attente d’une place ou de l’échéance
  de retry

Les jobs acceptés survivent aux déconnexions MQTT et reprennent après
reconnexion. Le dispatch est limité à un message par cycle avec un intervalle
minimal configurable entre publications. Le stockage TX préfère la PSRAM et
retombe sur la RAM interne ; les envois sont suspendus si la réserve RAM interne
descend sous les seuils de sécurité.

Test ciblé sur hôte : `python scripts/tests/test_mqtt_queue.py`.

### Télémétrie cfg route-producer

`cfgq p=.. e=.. rf=.. rt=.. ok=.. to=.. tf=.. tt=.. tk=.. tto=..`
- `p`: routes cfg pending
- `e`: routes en attente de ré-enqueue
- `rf`: refus enqueue (fenêtre 5s)
- `rt`: tentatives retry (fenêtre 5s)
- `ok`: retry acceptés (fenêtre 5s)
- `to`: timeouts (fenêtre 5s)
- `tf/tt/tk/tto`: cumuls boot
- niveau log: `DEBUG` par défaut, `WARN` si `tto>0` (timeout cumulé boot)

## Variables de configuration MQTT (`module: mqtt`)

- `enabled`
- `host`
- `port`
- `user`
- `pass`
- `baseTopic`
- `topicDeviceId` (optionnel, segment `<deviceId>` stable pour les topics)
- `deviceName` (optionnel, nom d'appareil utilisé par Home Assistant Discovery)
