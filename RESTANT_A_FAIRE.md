# Validations restantes avant production — 3.1.2

Ce document concerne uniquement le contrôleur autonome Waveshare à un ESP32-S3.

## Essais matériels indispensables

- Vérifier un premier démarrage avec une mémoire vierge.
- Tester Ethernet, puis la reprise automatique en Wi-Fi.
- Tester le portail de configuration lorsque les deux réseaux sont absents.
- Vérifier la persistance des réglages après redémarrage et coupure secteur.
- Tester les 8 entrées et les 8 relais avec les contacteurs réels.
- Vérifier le retour à l'arrêt sûr après défaut de pression ou de température.
- Valider l'écran Nextion et son adaptation de niveaux 5 V / 3,3 V.

## Températures 3.1.2

- En mode `Qwiic / DS2484`, vérifier les deux ROM DS18B20 et leur affectation
  eau/air.
- En mode `GPIO direct`, vérifier eau sur GPIO20 et air sur GPIO19 avec une
  résistance de rappel 4,7 kΩ par ligne.
- Confirmer que le changement Web n'est appliqué qu'après redémarrage.
- Confirmer que Qwiic, la RTC et les ADS1115 restent opérationnels en mode GPIO.
- Tester l'absence, le court-circuit et la reconnexion de chaque sonde.
- Vérifier le maintien du dernier programme sûr si la température d'eau devient
  indisponible.

## Réseau et intégrations

- Tester MQTT avec un compte propre à l'appareil et les ACL recommandées.
- Vérifier toutes les entités Home Assistant après redémarrage du broker.
- Tester la mise à jour OTA signée et une interruption volontaire du transfert.
- Ne pas exposer l'interface HTTP directement sur Internet ; valider l'accès
  distant via VPN ou Home Assistant.

## Industrialisation

- Figer exactement la version de la plateforme ESP32 utilisée par PlatformIO.
- Produire un SBOM et ajouter la licence du projet.
- Préparer Secure Boot, chiffrement flash/NVS et programmation contrôlée des
  eFuses avant toute série.
- Faire relire le schéma électrique final par un professionnel qualifié.

La version peut être utilisée sur banc avant ces essais, mais ne doit pas être
considérée comme validée pour une installation sans surveillance.
