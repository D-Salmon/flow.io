# Travail restant avant production

> **Mise à jour 3.1.1 (2026-08-04)** : le firmware Waveshare est maintenant en
> version `3.1.1`. La CI compile le firmware et le SPIFFS, vérifie la livraison,
> calcule les sommes SHA-256 et conserve les fichiers comme artefacts
> téléchargeables. Le Wi-Fi dispose d'une voie ESP-IDF de secours lorsque
> `WiFi.begin()` échoue immédiatement. Les validations matérielles ci-dessous
> restent nécessaires avant production.

> **Note de re-verification (2026-08-02)** : ce document decrit l'etat
> `2.5.1`. Verifie point par point sur le depot livre
> `flow.io-agent-waveshare-3.1.0` (`waveshare_firmware_version = 3.1.0`),
> une version ulterieure. Les ecarts constates sont marques
> « Correction 3.1.0 » ci-dessous.

## Etat actuel

La version `2.5.1` est une edition durcie et allegee consacree au controleur
Waveshare ESP32-S3 N16R8 avec bus Qwiic. **Correction 3.1.0** : le depot
fourni est en version `3.1.0` (`waveshare_firmware_version` dans
`platformio.ini`), pas `2.5.1` ; le reste de cette section (ArduinoJson 7,
profil PlatformIO unique, firmware ESP32-S3/SPIFFS/Nextion) reste exact sur
3.1.0. Elle utilise ArduinoJson 7, contient un
seul profil PlatformIO, ainsi que le firmware ESP32-S3, le SPIFFS et le firmware
compatible de l'ecran Nextion.

La base 2.5.0 ajoute le scan de secrets et l'analyse C++ en CI, des tests natifs des
regles d'authentification/CSRF/CSP/OTA, une CSP stricte pour l'application Web,
une CSP compatible avec les pages de secours, et l'alarme native
`OtaSignatureFailures` (`AlarmId 1200`). Le serveur Web a commence a etre
scinde : politiques, en-tetes et verification ECDSA sont maintenant des
composants separes ; la page de secours reste embarquee.

La 2.5.1 retire du profil Waveshare les declarations GPIO heritees des cartes
DIN et d'un second ESP32. Elle neutralise egalement les commandes materielles
qui ne disposent pas de broches explicitement declarees, securise la sortie
RF433 Venice et ajoute dans la branche Web `PoolLogic > Filtration` un bouton
de recalcul immediat de la duree et de la plage de filtration. Le paquet
Raspberry Pi ajoute aussi un bouton d'arret propre visible uniquement en mode
kiosque. La confirmation est servie sur `127.0.0.1`, exige un maintien de trois
secondes et n'expose aucune commande sur le reseau.

Sur une NVS vierge, le profil Waveshare active maintenant Ethernet avec DHCP et
laisse `poollogic/mode/auto_mode` desactive. Une configuration persistante
existante reste prioritaire. La surveillance de pression est également
désactivée par défaut et peut être activée depuis la configuration ou Home
Assistant une fois le capteur installé et étalonné. Le cycle automatique du
robot est lui aussi désactivé par défaut.

Cette version convient aux essais sur banc et a un pilote controle, administre
par USB sur un reseau local isole. Elle ne doit pas etre exposee directement a
Internet.

L'acces nomade doit passer par Home Assistant ou un VPN. Le serveur embarque
reste en HTTP sans TLS et ne doit pas faire l'objet d'une redirection de port
depuis Internet.

Les alarmes enregistrees sont exposees individuellement par MQTT Discovery avec
un identifiant stable. Le package Home Assistant ne decode plus leur position
dans `alm_pack`; ce dernier reste publie pour compatibilite et diagnostic.

## Priorite immediate

1. Valider la version sur le materiel reel:
   - demarrage et recuperation des identifiants sur la console serie;
   - cavalier `GPIO21`-`GND`, AP `FlowIO-RECOVERY`, remplacement des acces,
     extinction effective des huit relais et fermeture apres dix minutes;
     **Correction 3.1.0** : dans le code source livre, le mecanisme de
     recuperation physique repose sur un appui long du bouton `BOOT`
     (`GPIO0`, `kBootRecoveryPin = 0`, lecture `digitalRead` avec
     `INPUT_PULLUP`) et non un cavalier `GPIO21`-`GND`. Le SSID du point
     d'acces genere par `buildProvisioningApSsid_()` suit le format
     `flow.io-<profil>-XXXXXX` (derive de l'adresse MAC), et non
     `FlowIO-RECOVERY` (source :
     `src/Modules/Network/WebInterfaceModule/WebInterfaceServer.cpp`). A
     verifier avec l'equipe si la doc ou le code a change en dernier — dans
     le doute, se fier au code source livre et mettre a jour cette
     procedure avant tout essai materiel ;
   - Wi-Fi, Ethernet et MQTT TLS;
   - premier demarrage vierge avec Ethernet DHCP actif et automatisme piscine
     inactif, surveillance de pression inactive, puis conservation de ces choix
     apres redemarrage;
   - interface Web et SPIFFS;
   - bouton kiosk `Arreter l'ecran`, confirmation locale pendant trois
     secondes, arret propre du Raspberry Pi et absence d'acces au service
     depuis une autre machine;
   - bouton Web `Recalculer la duree`, avec mise a jour du plan lorsque la
     temperature d'eau est disponible et conservation du plan sinon;
   - depart de la plage a 22 h jusqu'a 20 degres d'eau inclus, notamment
     `22:00-00:00` a 12 degres et `22:00-06:28` a 20 degres;
   - absence d'initialisation parasite des anciens GPIO DIN, interlink et
     mise a jour du second ESP32;
   - decouverte Home Assistant de `binary_sensor.fio_alm_any`, des dix
     alarmes PoolLogic et de l'alarme OTA `id1200`, puis restitution immediate
     de leur etat apres un
     redemarrage de Home Assistant;
   - ecran Nextion et liaison HMI;
   - bus Qwiic, DS2484, ADS1115 et sondes;
   - fonctionnement automatique avec la seule température d'eau, puis arrêt
     sur pression basse/haute uniquement après activation de la surveillance;
   - alarme `id1009` après cinq minutes sans température d'eau en automatique,
     maintien du dernier plan valide et effacement au retour de la mesure;
   - relais robot maintenu à l'arrêt tant que son cycle automatique n'est pas
     explicitement activé;
   - huit relais, retours de contacteurs et securites filtration/electrolyseur;
   - redemarrage et persistance de la configuration.
2. Documenter la procedure de mise en service, de sauvegarde et de restauration
   pour les installateurs.

## Securite avant production

1. Creer sur le broker un compte propre a chaque appareil, interdire les
   connexions anonymes et appliquer les ACL de `docs/mqtt-hardening.md`.
   Le firmware refuse deja les identifiants vides, limite les rafales et
   interdit par MQTT les mises a jour et imports de configuration.
2. Completer la signature locale deja verifiee par une OTA reseau HTTPS signee,
   avec rollback et protection anti-downgrade.
3. Preparer Secure Boot v2, le chiffrement flash/NVS et une procedure de
   programmation controlee des eFuses pour la fabrication.
4. Signer le manifeste de livraison: les sommes SHA-256 actuelles assurent
   l'integrite, mais pas l'authenticite.

## Industrialisation et maintenance

1. Surveiller et ajuster les nouveaux controles CI `cppcheck` et `gitleaks`.
2. Completer les tests natifs existants par des tests d'integration materiels
   pour la rotation des identifiants, MQTT TLS et les coupures pendant une mise
   a jour.
3. Continuer le decoupage progressif de `WebInterfaceServer.cpp`, sans sortir
   de la flash la page de secours critique.
4. Verrouiller les dependances transitives et produire un SBOM CycloneDX ou
   SPDX avec les licences tierces.
5. Rendre les builds reproductibles avec `SOURCE_DATE_EPOCH`, l'identifiant du
   commit et la version exacte de la chaine d'outils. En particulier,
   `env:Waveshare-ESP32-S3` pointe vers le canal `stable` du fork pioarduino
   (Arduino-ESP32 3.3.11 / ESP-IDF 5.5.x au 2026-08-02) au lieu d'un tag de
   release figé : a epingler pour garantir la reproductibilite.
6. Definir et ajouter la licence du projet.

## Ordre recommande

1. Essais materiels complets.
2. Compte et ACL MQTT sur le broker, puis essai de la limitation firmware.
3. OTA signee.
4. Secure Boot, chiffrement et procedure de fabrication.
