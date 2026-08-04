# Flow.io Waveshare 3.1.2 — choix du raccordement des températures

La version 3.1.2 ajoute dans l'interface Web un sélecteur pour le raccordement
des sondes DS18B20 d'eau et d'air.

## Modes disponibles

- **Qwiic / DS2484**, sélectionné par défaut et compatible avec les installations
  3.1.0/3.1.1 ;
- **GPIO direct**, avec l'eau sur GPIO20 et l'air sur GPIO19.

Le réglage se trouve dans `io/drivers/ds18b20`, est conservé en mémoire et prend
effet après redémarrage. Il ne désactive jamais le bus Qwiic/I²C : tous les autres
composants Qwiic continuent de fonctionner dans les deux modes.

Ethernet, Wi-Fi de secours, portail de configuration et OTA restent inchangés.
