# Flow.io Waveshare 3.1.0 — état de la reprise

La version 3.1.0 est une branche de développement construite à partir de la
base expérimentale 3.0.0 validée sur le Waveshare ESP32-S3-ETH-8DI-8RO. Elle
réintègre, en les adaptant à l’architecture 3.x, les évolutions réalisées dans
notre version 2.5.1.

## Déjà repris

- Ethernet Waveshare activé par défaut et profil N16R8 avec 16 Mo de flash et
  8 Mo de PSRAM ;
- sondes DS18B20 raccordées au pont Qwiic DS2484 à l’adresse I²C `0x18`, avec
  cache NVS distinct pour les ROM eau et air ;
- migration ArduinoJson 7.4.3 et allocation PSRAM des gros documents JSON ;
- mise en service prudente : automatique, robot automatique et surveillance de
  pression désactivés par défaut ;
- alarmes et entités Home Assistant ajoutées en 2.5.1 ;
- recalcul manuel de la filtration à la minute, filtration nocturne à partir de
  22 h pour l’eau froide ou tempérée et fonctionnement continu à 30 °C ;
- sécurisation des GPIO RF433 et des broches inutilisées du pont série Web ;
- jeton CSRF aléatoire par démarrage, validation d’origine et protection de
  toutes les requêtes Web d’écriture, y compris les interfaces de
  configuration réseau et de secours ;
- primitives d’authentification, en-têtes HTTP et vérificateur ECDSA OTA ;
- éléments de tableau de bord Home Assistant, arrêt sûr du kiosque Raspberry Pi
  et fichiers du boîtier compact.

## Écarts encore ouverts

- Le lot authentification/CSRF est partiellement raccordé : la protection CSRF
  est active de bout en bout, mais l’authentification attend encore une
  procédure de récupération physique compatible avec le bouton BOOT.
- La mise à jour distante du firmware vérifie désormais un fichier `.sig`
  ECDSA P-256 avant d’activer la partition. Elle reste indisponible tant que la
  clé publique de production n’est pas provisionnée ; les mises à jour
  distantes SPIFFS et Nextion restent volontairement bloquées en mode signé.
- MQTT utilise encore `mqtt://` sans TLS dans cette base expérimentale.
- Les deux alarmes de discordance de contacteur sont cataloguées, mais leurs
  conditions matérielles restent à raccorder dans le PoolLogic 3.x.

Cette construction est une base 3.1.0 compilable destinée à poursuivre le
portage. Elle ne doit pas encore être flashée sur le Waveshare de production
avant la validation matérielle du DS2484 et des flux de sécurité.
