# Flow.io Waveshare 3.1.5 — améliorations restantes

Ce document présente uniquement les travaux encore ouverts pour la cible
autonome `Waveshare-ESP32-S3`. L’historique de la livraison se trouve dans les
[notes de version 3.1.5](docs/release-3.1.5.md).

## État au 26 août 2026

La branche `flow.io-waveshare-3.1.5` est publiée et définie comme branche par
défaut du dépôt. Le firmware a été compilé, flashé et démarré sur la carte
réelle. Wi-Fi, MQTT TLS, mDNS, serveur Web, authentification administrateur et
commandes d’équipements ont été essayés sur cette carte.

Les images courantes sont présentes dans `binary` et référencées par le
manifeste :

- `flowios3-3.1.5.bin` ;
- `flowios3-spiffs-3.1.5.bin`.

La version est utilisable sur banc, mais elle n’est pas encore qualifiée pour
une installation autonome sans surveillance.

## Priorité 1 — qualification du coffret réel

### Entrées, relais et états sûrs

- tester séparément les huit entrées numériques et leurs polarités ;
- tester les huit relais sans charge, puis avec les bobines des contacteurs ;
- contrôler les retours auxiliaires de filtration et d’électrolyse ;
- vérifier l’arrêt sûr au démarrage, au redémarrage, après coupure secteur et
  après défaut logiciel ;
- confirmer le câblage, les protections et les contacteurs avec un électricien
  qualifié.

Critère de fin : chaque entrée, sortie et défaut réel possède une procédure et
un résultat reproductible.

### Capteurs et bus

- valider les sondes eau et air avec le pont Qwiic DS2484 ;
- valider les mêmes sondes en GPIO direct sur GPIO20 et GPIO19 ;
- tester absence, court-circuit, valeur aberrante et reconnexion des sondes ;
- confirmer la coexistence RTC, ADS1115 et capteurs I²C optionnels ;
- ajouter une indication fiable de l’état de la pile RTC.

Critère de fin : une mesure absente ou périmée ne peut pas provoquer
l’activation dangereuse d’un équipement.

### Automatismes piscine

Construire et exécuter une matrice couvrant :

- maintenance, manuel sécurisé et automatique ;
- filtration calculée, passage à minuit, mode continu, hiver et antigel ;
- régulation pH, chlore/brome, oxygène actif et bidons vides ;
- électrolyseur en manuel sans limite quotidienne et en automatique avec une
  limite au moins égale à la filtration calculée plus 60 minutes ;
- perte de filtration, retours de contacteurs et limites des pompes doseuses ;
- robot, remplissage, éclairage et chauffage ;
- déclenchement, retour à la normale, acquittement et persistance des alarmes.

Critère de fin : chaque scénario critique est testé avec ses préconditions,
actions, résultats et journaux attendus.

## Priorité 1 — endurance réseau et mémoire

- réaliser un essai prolongé en Ethernet puis en Wi-Fi avec MQTT TLS, Web et
  Home Assistant actifs ;
- provoquer des coupures de câble, point d’accès, DNS, Internet et broker ;
- vérifier les bascules Ethernet/Wi-Fi et les reconnexions MQTT ;
- contrôler les deux démarrages Web : immédiat après un échec MQTT précédent,
  ou différé au maximum de 30 secondes après une connexion antérieure valide ;
- suivre la mémoire interne minimale, le plus grand bloc, la PSRAM, les files
  MQTT et les redémarrages du watchdog ;
- tester les coupures pendant une écriture de configuration.

Critère de fin : aucun épuisement progressif, blocage ou défaut durable de
reconnexion ne survient pendant la durée d’essai retenue.

## Priorité 1 — livraison reproductible

- remplacer l’URL de plateforme `stable` par une version ou une empreinte
  immuable ;
- figer chaque dépendance Git sur un tag ou un commit testé ;
- documenter les versions de PlatformIO, Python, esptool et Arduino ;
- produire automatiquement `SHA256SUMS` et une archive d’installation contenant
  firmware, SPIFFS, manifeste et procédure ;
- faire vérifier par la CI la concordance version, taille et empreinte de tous
  les artefacts publiés ;
- générer un SBOM et ajouter une licence explicite au projet.

Critère de fin : la même révision peut être reconstruite et installée sans
dépendre d’un contenu externe changeant.

## Priorité 2 — tests automatiques

- tester les machines d’état de filtration, chauffage, oxygène actif, robot et
  remplissage ;
- tester les PID temporels et leurs limites ;
- tester la politique de durée de l’électrolyseur selon le mode ;
- tester alarmes, acquittements, journal d’activité et publications MQTT ;
- tester le basculement réseau et la mémoire de validité MQTT au démarrage ;
- contrôler Home Assistant Discovery et la longueur des topics ;
- tester les migrations NVS et la conservation des secrets ;
- ajouter des tests Web pour les commandes, les formulaires et CSRF ;
- mettre en place un banc HIL pour les capteurs, entrées et relais.

Critère de fin : une modification d’un automatisme critique ne peut plus être
fusionnée sans vérifier ses cas nominaux et ses principaux défauts.

## Priorité 2 — sécurité de production et mises à jour

- créer et protéger hors dépôt la clé privée de signature OTA ;
- intégrer la clé publique officielle à la construction de production ;
- tester signatures valides, absentes, corrompues et transferts interrompus ;
- définir une mise à jour signée pour SPIFFS et, si conservé, Nextion ;
- ajouter une stratégie anti-retour vers une version vulnérable ;
- évaluer Secure Boot v2, le chiffrement flash/NVS et la programmation eFuse ;
- formaliser sauvegarde, restauration et récupération physique ;
- documenter le cloisonnement réseau, les ACL MQTT et l’accès distant par VPN ou
  Home Assistant sans exposer le serveur HTTP.

Critère de fin : clés, mises à jour, récupération et modèle de menace sont
documentés et vérifiés sur le matériel de production.

## Priorité 2 — Home Assistant et notifications

- contrôler toutes les entités après redémarrage du broker ;
- vérifier l’absence de doublons après changement de nom ou d’identifiant MQTT ;
- fournir des exemples d’automatisations pour notification mobile, courriel et
  SMS via un service externe ;
- distinguer déclenchement, rappel d’alarme persistante et retour à la normale ;
- aligner les tableaux de bord fournis sur les entités réellement générées.

Critère de fin : une alarme réelle déclenche une notification compréhensible,
sans doublon, puis un message correct de retour à la normale.

## Priorité 3 — documentation et dossier technique

- mettre à jour le dessin Fritzing, dont le fichier porte encore le numéro
  3.1.2, après validation du câblage final ;
- produire une procédure unique d’effacement, flash, configuration, validation
  et retour arrière ;
- documenter l’export des réglages et les données à conserver dans le dossier
  du coffret ;
- maintenir les captures d’interface sans SSID, mot de passe, adresse privée ni
  autre donnée propre à l’installation ;
- automatiser le contrôle des liens, versions et caractères mal encodés.

## Conditions de qualification production

La cible pourra être qualifiée pour une installation autonome lorsque les
conditions suivantes seront réunies :

- artefacts reproductibles et signés, publiés ensemble ;
- campagne fonctionnelle et électrique terminée sur le coffret réel ;
- endurance réseau, MQTT et Web sans fuite mémoire ni blocage ;
- états sûrs et protections électriques validés ;
- tests automatiques des automatismes critiques ;
- stratégie de clés, Secure Boot, chiffrement et récupération décidée ;
- documentation et schémas alignés avec le matériel livré.
