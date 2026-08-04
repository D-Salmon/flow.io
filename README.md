# flow.io Waveshare

Flow.io pilote une piscine depuis **une seule carte Waveshare
ESP32-S3-ETH-8DI-8RO**. Aucun second ESP32 et aucun Supervisor ne sont requis
pour cette version.

## Version 3.1.2

La 3.1.2 conserve :

- Ethernet prioritaire et Wi-Fi de secours ;
- portail Wi-Fi, interface Web et mises à jour OTA ;
- MQTT et découverte Home Assistant ;
- 8 entrées, 8 relais, RTC, alarmes et journalisation ;
- régulation et planification de la filtration selon la température.

Elle ajoute dans l'interface Web le choix du raccordement des deux sondes
DS18B20 :

- `Qwiic / DS2484` — mode par défaut ;
- `GPIO direct` — eau sur GPIO20 et air sur GPIO19.

Ce choix concerne uniquement les températures. Le bus Qwiic/I²C reste actif
dans les deux modes pour la RTC, les ADS1115 et les autres capteurs.

## Documentation

- [Installer et utiliser la version 3.1.2](docs/README.md)
- [Notes de version 3.1.2](docs/release-3.1.2.md)
- [Schéma et tableau de raccordement](docs/integration/schema-raccordement-waveshare.md)
- [Schéma éditable Fritzing 3.1.2](docs/fritzing/FlowIO-Waveshare-3.1.2.fzz)
- [Validations restantes avant production](RESTANT_A_FAIRE.md)

## Compilation

Dans Visual Studio Code avec PlatformIO, sélectionner l'environnement
`Waveshare-ESP32-S3`, puis lancer `Build`. Les fichiers produits sont le
firmware ESP32-S3 et l'image SPIFFS de l'interface Web.

## Sécurité

L'interface embarquée utilise HTTP sur le réseau local. Ne pas ouvrir de port
Internet vers la carte. Pour un accès distant, utiliser Home Assistant ou un
VPN. Les sorties de la Waveshare doivent commander des contacteurs adaptés ;
elles ne remplacent pas les protections électriques du coffret piscine.

## Historique

Le dépôt conserve du code et des documents techniques relatifs aux anciens
profils FlowIO/Supervisor à deux cartes. Ils servent uniquement à la maintenance
d'installations historiques et ne décrivent pas la cible Waveshare 3.1.2.
