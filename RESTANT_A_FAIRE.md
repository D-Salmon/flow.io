# Travail restant avant production

## Etat actuel

La version `2.5.1` est une edition durcie et allegee consacree au controleur
Waveshare ESP32-S3 N16R8 avec bus Qwiic. Elle utilise ArduinoJson 7, contient un
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
de recalcul immediat de la duree et de la plage de filtration.

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
   - Wi-Fi, Ethernet et MQTT TLS;
   - premier demarrage vierge avec Ethernet DHCP actif et automatisme piscine
     inactif, surveillance de pression inactive, puis conservation de ces choix
     apres redemarrage;
   - interface Web et SPIFFS;
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
   commit et la version exacte de la chaine d'outils.
6. Definir et ajouter la licence du projet.

## Ordre recommande

1. Essais materiels complets.
2. Compte et ACL MQTT sur le broker, puis essai de la limitation firmware.
3. OTA signee.
4. Secure Boot, chiffrement et procedure de fabrication.
