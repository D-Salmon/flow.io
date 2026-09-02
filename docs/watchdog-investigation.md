# Surveillance web et latence MQTT — 2 septembre 2026

La capture série de trois minutes pendant la consultation de l’interface a
montré deux alertes web avec `loop_age=4294967294` et `4294967295`, suivies
de retours à la normale. Ces valeurs correspondent à -2 et -1 ms converties
en entiers non signés : l’heure du moniteur était prise avant la copie du
heartbeat, actualisé entre-temps sur l’autre cœur.

Correction : prendre l’heure après la copie de l’état et calculer un âge borné
pour un échantillon légèrement futur. Les comparaisons d’activité HTTP/WS sont
également faites par âge, pour supporter le débordement de `millis()`.
Une absence de heartbeat et un vrai dépassement restent considérés anormaux.
Les seuils, le nombre d’échecs requis et les protections watchdog sont inchangés.

La même capture montrait un traitement `DataChanged` MQTT d’environ 1,5 s,
alors que ses cinq mises en file totalisaient 173 µs. Le parcours de sélection
des routes PoolDevice pouvait attendre 200 ms par acquisition de verrou,
y compris pour des clés sans rapport. Il filtre maintenant les clés d’abord
et tente le verrou sans attente. En cas de contention pour une clé pertinente,
il programme prudemment les routes concernées ; le worker MQTT construira les
données plus tard, sans perdre la notification à cause d’un verrou occupé.

Ces corrections traitent des défauts identifiés, mais ne démontrent pas la
résolution des redémarrages `reset=task_wdt` observés précédemment. Aucun
redémarrage n’a été capturé dans cette session. Une validation matérielle
prolongée après déploiement reste nécessaire.

## Vérifications

- `test/test_heartbeat_age/test_main.cpp` : tests Unity pour l’environnement natif.
- `test/test_heartbeat_age/compile_checks.cpp` : 11 assertions évaluées à la
  compilation avec le compilateur ESP32, couvrant valeurs futures, absence,
  seuil réel, débordement et ordre des activités clients. Cette voie fonctionne
  même lorsque le compilateur GCC natif n’est pas installé sur le PC.
- Compilation complète `Waveshare-ESP32-S3` et tests JS du journal.

Ne pas supprimer les traces `task_wdt` ni désactiver le watchdog pour valider
ce correctif. La nouvelle capture doit permettre de distinguer les alertes
web applicatives des watchdogs de tâches ESP-IDF.
