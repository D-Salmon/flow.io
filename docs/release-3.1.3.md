# Flow.io Waveshare 3.1.3

La version 3.1.3 conserve les fonctions et le câblage de la 3.1.2. Elle réduit
principalement la pression sur la mémoire interne de l'ESP32-S3.

## Amélioration principale

- Les descripteurs de configuration de toutes les voies analogiques, entrées
  numériques et sorties numériques sont regroupés dans une zone allouée en
  PSRAM.
- Sur la cible Waveshare équipée de PSRAM, l'initialisation échoue explicitement
  si cette allocation n'est pas possible, au lieu de consommer silencieusement
  la mémoire interne.
- Un journal au démarrage indique la taille du bloc, son emplacement et les
  variations de mémoire interne et de PSRAM.

## Compatibilité

- Les clés de configuration persistantes et les chemins JSON restent identiques.
- Le choix du transport DS18B20 **Qwiic / DS2484** ou GPIO introduit en 3.1.2
  est conservé, notamment le raccordement direct sur **GPIO20**.
- Les affectations matérielles existantes restent inchangées, notamment
  **GPIO19** et le bus I2C **GPIO42/GPIO41**.
- Aucun changement de câblage ni de configuration utilisateur n'est requis.
