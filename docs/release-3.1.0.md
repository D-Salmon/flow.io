# Flow.io Waveshare 3.1.0 — état de la reprise

La version 3.1.0 est une branche de développement construite à partir de la
base expérimentale 3.0.0 validée sur le Waveshare ESP32-S3-ETH-8DI-8RO. Elle
réintègre, en les adaptant à l’architecture 3.x, les évolutions réalisées dans
notre version 2.5.1.

## Déjà repris

- Ethernet Waveshare activé par défaut et profil N16R8 avec 16 Mo de flash et
  8 Mo de PSRAM ;
- migration ArduinoJson 7.4.3 et allocation PSRAM des gros documents JSON ;
- mise en service prudente : automatique, robot automatique et surveillance de
  pression désactivés par défaut ;
- alarmes et entités Home Assistant ajoutées en 2.5.1 ;
- recalcul manuel de la filtration et filtration nocturne à partir de 22 h pour
  l’eau froide ou tempérée ;
- sécurisation des GPIO RF433 et des broches inutilisées du pont série Web ;
- primitives de sécurité Web, en-têtes HTTP et vérificateur ECDSA OTA ;
- éléments de tableau de bord Home Assistant, arrêt sûr du kiosque Raspberry Pi
  et fichiers du boîtier compact.

## Écarts encore ouverts

- Les sondes DS18B20 utilisent encore les bus 1-Wire directs des GPIO 20 et 19
  de la base 3.x. Le pont Qwiic DS2484 de notre 2.5.1 n’est pas encore porté.
- Le planificateur 3.x travaille avec une précision à l’heure. La fenêtre
  nocturne est donc 22:00–05:00 à 20 °C, et non le calcul à la minute de la
  2.5.1.
- Les primitives d’authentification/CSRF et de signature OTA sont présentes,
  mais le flux de mise à jour distant propre à la 3.x ne les appelle pas encore
  de bout en bout.
- MQTT utilise encore `mqtt://` sans TLS dans cette base expérimentale.
- Les deux alarmes de discordance de contacteur sont cataloguées, mais leurs
  conditions matérielles restent à raccorder dans le PoolLogic 3.x.

Cette construction est une base 3.1.0 compilable destinée à poursuivre le
portage. Elle ne doit pas encore être flashée sur le Waveshare de production
avant la reprise du DS2484 et la validation fonctionnelle des flux de sécurité.
