# Flow.io Waveshare — améliorations restantes

Ce document décrit uniquement les travaux encore ouverts pour la cible autonome
`Waveshare-ESP32-S3` en version candidate 3.1.4. Il ne sert pas de journal de versions et
ne recense pas les travaux déjà terminés.

## Situation générale

Le firmware fonctionne sur la carte réelle et les parcours essentiels réseau,
Web et MQTT sont opérationnels. Le projet reste néanmoins au stade de version
fonctionnelle validée sur banc : il manque une campagne matérielle exhaustive,
une chaîne de livraison totalement reproductible et plusieurs protections
nécessaires avant de qualifier une installation autonome sans surveillance.

## Priorité 1 — qualifier et publier la livraison 3.1.4

### Publier un jeu d’artefacts cohérent

Le firmware `flowios3-3.1.4.bin` et l’image
`flowios3-spiffs-3.1.4.bin` sont présents dans `binary` et enregistrés dans le
manifeste. Ils ont été reconstruits localement depuis la même révision, mais la
3.1.4 n’a pas encore été qualifiée sur une carte réelle.

À faire :

- repartir d'une carte effacée et flasher le firmware puis SPIFFS 3.1.4 ;
- valider la création initiale de l'administrateur, le mot de passe de point
  d'accès propre à la carte et la fenêtre BOOT de cinq minutes ;
- valider que les secrets Wi-Fi et MQTT ne sont jamais renvoyés par les API et
  qu'un champ vide conserve bien le mot de passe existant ;
- publier les deux fichiers, le manifeste et un fichier `SHA256SUMS` depuis un
  commit propre ;
- vérifier qu’un flash sur mémoire vierge démarre avec l’interface Web complète ;
- publier un paquet unique clairement identifié pour l’installation initiale ;
- faire échouer la CI si le manifeste versionné ne correspond pas aux artefacts
  de la version déclarée.

Critère de fin : une seule archive permet d’effacer, flasher et mettre en service
une carte vierge sans rechercher un SPIFFS provenant d’une autre compilation.

### Figer la chaîne de compilation

L’environnement Waveshare utilise actuellement l’URL `stable` de pioarduino et
plusieurs dépendances Git sans commit immuable.

À faire :

- remplacer la plateforme `stable` par une version ou une empreinte précise ;
- figer les bibliothèques Git sur des tags ou commits testés ;
- documenter les versions de PlatformIO, Python, esptool et du framework Arduino ;
- vérifier qu’une compilation propre sur Windows et dans GitHub Actions produit
  des artefacts fonctionnellement identiques ;
- générer un SBOM et ajouter une licence explicite au projet.

Critère de fin : la même révision peut être reconstruite ultérieurement sans
dépendre du contenu changeant d’une branche ou d’une URL `stable`.

## Priorité 1 — compléter la validation matérielle et fonctionnelle

### Entrées, sorties et câblage réel

À faire sur le coffret final :

- tester séparément les 8 entrées numériques, leurs polarités et le compteur
  d’impulsions ;
- tester les 8 relais sans charge, puis avec les bobines des contacteurs ;
- contrôler les retours auxiliaires des contacteurs de filtration et
  d’électrolyseur ;
- vérifier l’état sûr des sorties au démarrage, au redémarrage, après coupure
  secteur et après défaut logiciel ;
- confirmer les interlocks et les durées maximales de marche de chaque appareil ;
- faire valider le schéma et les protections du coffret par un professionnel
  qualifié.

Critère de fin : chaque commande et chaque défaut réel possède un résultat
attendu consigné et reproductible.

### Capteurs et bus

À faire :

- valider les deux DS18B20 en mode `Qwiic / DS2484`, avec affectation stable des
  ROM eau et air ;
- valider les deux DS18B20 en mode GPIO direct sur GPIO20 et GPIO19 ;
- tester l’absence, le court-circuit, les valeurs aberrantes et la reconnexion
  de chaque sonde ;
- confirmer que le passage d’un mode DS18B20 à l’autre survit aux redémarrages ;
- valider simultanément RTC, ADS1115 et capteurs I²C optionnels, y compris les
  conflits d’adresses ;
- ajouter une détection matérielle fiable de la présence ou de l’état de la
  pile RTC, actuellement non disponible dans le code.

Critère de fin : aucun défaut de capteur ne peut activer un équipement sur une
mesure inconnue ou périmée.

### Automatismes et sécurités piscine

Construire une matrice de tests couvrant :

- les trois modes : maintenance, manuel sécurisé et automatique ;
- les limites de la courbe de filtration, le passage à minuit, les coupures
  d’heure et le mode continu ;
- l’antigel et le mode hiver ;
- les pressions basse et haute, le délai de démarrage et la perte du capteur ;
- les régulations pH et chlore/brome, les bidons vides, les limites journalières
  et la perte de filtration ;
- l’électrolyse en mode ORP et en mode continu, avec température trop basse ;
- le protocole oxygène actif, ses fractionnements, les reprises après coupure et
  les volumes restants ;
- le robot, le remplissage, l’éclairage et le chauffage assisté ;
- l’apparition, l’acquittement, la disparition et la persistance de chaque
  alarme.

Critère de fin : chaque scénario critique est automatisé ou documenté avec ses
préconditions, actions, résultats et journaux attendus.

## Priorité 1 — fiabiliser le fonctionnement prolongé

À faire :

- mener un essai d’endurance avec Ethernet puis Wi-Fi, MQTT TLS, Web et tous les
  producteurs Home Assistant actifs ;
- provoquer des coupures répétées de câble, point d’accès, DNS, broker et
  Internet ;
- vérifier le retour automatique d’Ethernet vers Wi-Fi et inversement ;
- valider les deux chemins de démarrage Web : libération immédiate lorsque MQTT
  n’était pas valide, et attente maximale de 30 secondes lorsqu’il l’était ;
- suivre le minimum de mémoire interne, le plus grand bloc disponible, la PSRAM,
  les files MQTT et les redémarrages du watchdog ;
- tester des coupures secteur pendant l’écriture de configuration et pendant les
  changements d’état des automatismes.

Critère de fin : aucun épuisement progressif de mémoire, blocage de tâche ou
perte durable du Web/MQTT n’apparaît pendant l’essai retenu.

## Priorité 2 — étendre les tests automatiques

La CI teste actuellement le calcul de la fenêtre de filtration et la politique
de sécurité Web. Cette couverture est trop faible pour l’ensemble du produit.

À ajouter :

- tests unitaires des machines d’état de filtration, chauffage assisté,
  oxygène actif, robot et remplissage ;
- tests des PID temporels et de leurs limites ;
- tests des alarmes, acquittements, persistances et publications MQTT ;
- tests du basculement réseau et de la mémoire de validité MQTT au démarrage ;
- tests de génération Home Assistant et contrôle de la longueur de chaque topic ;
- tests de migration NVS et de compatibilité des configurations existantes ;
- tests d’intégration Web sur les formulaires critiques et les réponses CSRF ;
- banc HIL pour capteurs, entrées et relais ;
- scénarios Wokwi ciblés lorsqu’ils apportent une simulation représentative ;
- contrôle automatique des liens, versions et caractères mal encodés dans la
  documentation et les traductions.

Critère de fin : les modifications des automatismes critiques ne peuvent plus
être fusionnées sans tester leurs cas nominaux et leurs principaux défauts.

## Priorité 2 — achever le durcissement de production

### Mises à jour

Le code exige une signature ECDSA P-256, mais la clé publique de production est
volontairement vide dans le dépôt. Les mises à jour SPIFFS et Nextion distantes
sont refusées dans le mode signé actuel, car elles ne peuvent pas encore être
validées entièrement avant écriture.

À faire :

- créer et protéger la clé privée de signature hors du dépôt ;
- injecter la clé publique de production dans la construction officielle ;
- automatiser signature, manifeste, empreintes et publication GitHub ;
- tester les signatures valides, absentes, corrompues et les transferts
  interrompus ;
- ajouter un mécanisme sûr de mise à jour signée pour SPIFFS et, si conservé,
  pour Nextion ;
- définir une stratégie anti-retour vers une version vulnérable.

### Plateforme ESP32-S3

À faire avant une série :

- évaluer puis activer Secure Boot v2 ;
- évaluer le chiffrement de la flash et des données NVS ;
- définir et documenter la programmation des eFuses ;
- prévoir une procédure de secours compatible avec ces protections ;
- vérifier la validation TLS des téléchargements OTA et limiter les serveurs
  autorisés.

### Réseau et accès distant

À faire :

- isoler la carte sur un réseau ou VLAN d’administration ;
- ne publier aucun port HTTP vers Internet ;
- utiliser un compte MQTT unique, désactiver l’accès anonyme et appliquer des
  ACL minimales ;
- décider si l’interface Web doit rester HTTP local ou recevoir une terminaison
  HTTPS adaptée aux ressources de l’ESP32-S3 ;
- tester la récupération physique BOOT et les limites d’authentification ;
- ajouter une sauvegarde/restauration de configuration versionnée, avec une
  politique explicite pour les secrets.

Critère de fin : le modèle de menace, la gestion des clés, la récupération et la
procédure d’installation sont documentés et testés.

## Priorité 2 — finaliser Home Assistant et les notifications

À faire :

- vérifier après redémarrage du broker toutes les entités découvertes : mesures,
  relais, modes, consignes, états et alarmes ;
- contrôler l’absence de doublons après changement du nom d’appareil ou de
  l’identifiant MQTT ;
- fournir un exemple d’automatisation Home Assistant pour notification mobile,
  courriel et, via un service externe, SMS ;
- distinguer les notifications immédiates, les rappels d’alarme persistante et
  les messages de retour à la normale ;
- vérifier les tableaux de bord fournis avec les entités réellement générées par
  la version courante.

Critère de fin : une alarme réelle déclenche une notification compréhensible,
sans doublon, et le retour à la normale est correctement signalé.

## Priorité 3 — remettre toute la documentation au même niveau

Le présent README décrit la cible actuelle, mais plusieurs documents secondaires
portent encore le numéro 3.1.2 ou renvoient vers des ressources absentes.

À faire :

- actualiser `docs/README.md`, la mise en service, le raccordement et le projet
  Fritzing pour la 3.1.4 ;
- supprimer ou corriger les liens vers `mqtt-hardening.md`, absent du dépôt ;
- distinguer clairement les documents Waveshare actuels des profils FlowIO,
  Supervisor, FlowConnectDisplay et Micronova ;
- corriger les traductions mixtes français/anglais et les caractères mal encodés ;
- produire une procédure unique d’effacement, flash, première configuration,
  validation et retour arrière ;
- documenter la sauvegarde des réglages et les paramètres à relever pour le
  dossier technique du coffret.

Critère de fin : un installateur peut suivre la documentation depuis une carte
vierge sans devoir consulter les anciens profils ni reconstituer les étapes.

## Conditions proposées pour qualifier une version de production

La cible pourra être considérée comme prête pour une installation autonome sans
surveillance lorsque les points suivants seront tous satisfaits :

- artefacts firmware et SPIFFS reproductibles, signés et publiés ensemble ;
- campagne fonctionnelle et de sécurité terminée sur le coffret réel ;
- endurance réseau/MQTT/Web sans fuite mémoire ni blocage ;
- protections électriques et états sûrs validés ;
- couverture automatisée des automatismes critiques ;
- clés de production, Secure Boot, chiffrement et procédure de récupération
  décidés et documentés ;
- documentation et schémas alignés avec la version livrée.
