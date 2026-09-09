# Flow.io Waveshare 3.2.1

## Objet de la version

La version 3.2.1 corrige un défaut de fiabilité réseau touchant la coexistence
Ethernet/Wi-Fi (perte de MQTT selon l'interface active au démarrage ou en cours
de fonctionnement), rend l'interface Web utilisable sans accès Internet
(icônes auto-hébergées), et affiche séparément les adresses IP Ethernet et
Wi-Fi lorsque les deux interfaces sont actives.

## Fiabilité réseau Ethernet/Wi-Fi et MQTT

Sur la cible Waveshare, Ethernet et Wi-Fi peuvent être actifs simultanément.
Deux défauts distincts empêchaient MQTT de rester connecté selon les
combinaisons de démarrage et de bascule :

- **Bascule à chaud** — lorsque le câble Ethernet était débranché alors que le
  Wi-Fi restait associé (ou l'inverse), le indicateur combiné de disponibilité
  réseau ne changeait jamais d'état, si bien que rien n'indiquait au module
  MQTT que sa connexion TCP/TLS restait liée à une route désormais morte.
  Le changement d'interface active déclenche désormais une impulsion de cet
  indicateur, qui force une reconnexion MQTT propre vers l'interface
  effectivement disponible.
- **Démarrage Wi-Fi seul** — sans câble Ethernet, le pilote Ethernet démarre
  tout de même (chemin de récupération physique par bouton BOOT) mais
  n'obtient jamais d'adresse IP. La résolution DNS pouvait rester associée à
  la configuration DNS vide de cette interface Ethernet inutilisée au lieu de
  celle, valide, fournie par le Wi-Fi, provoquant l'échec permanent de
  connexion au broker MQTT (`ESP_ERR_ESP_TLS_CANNOT_RESOLVE_HOSTNAME`) malgré
  un Wi-Fi pleinement fonctionnel. La route réseau par défaut du système est
  désormais explicitement réévaluée à chaque changement d'interface active, et
  la requête DHCP Ethernet est différée jusqu'à l'obtention d'un lien physique
  réel au lieu d'être émise de façon spéculative sans câble.

Ces deux correctifs ont été validés sur la carte réelle dans les combinaisons
suivantes : Ethernet seul au démarrage, Wi-Fi seul au démarrage, les deux au
démarrage puis débranchement d'Ethernet, et Wi-Fi seul puis branchement puis
débranchement d'Ethernet.

## Interface Web utilisable sans accès Internet

Les icônes de l'interface Web dépendaient du chargement d'une police depuis le
CDN Google Fonts. Sans accès Internet sur le réseau utilisé pour joindre le
Waveshare, aucune icône ne s'affichait nulle part dans l'application.

- Une police locale allégée (`msr-icons.woff2`, environ 75 Ko), extraite par
  analyse réelle des glyphes utilisés, remplace cette dépendance. Les 66
  icônes employées par l'interface sont désormais servies directement par le
  Waveshare et s'affichent avec ou sans accès Internet.

## Adresses IP Ethernet et Wi-Fi

Lorsque les deux interfaces sont actives, seule une adresse IP combinée était
visible, masquant systématiquement l'une des deux interfaces.

- La page `Réseau` affiche désormais l'adresse IP de chaque interface dans sa
  propre carte.
- Le tableau de bord affiche un badge Ethernet et un badge Wi-Fi indépendants,
  chacun masqué individuellement si l'interface correspondante n'est pas
  connectée, au lieu d'un badge unique reflétant une seule interface à la
  fois.
- La page `Informations` affiche une ligne d'adresse IP par interface
  connectée, plutôt qu'une ligne unique.

## Navigation

`Mises à Jour` est désormais placé après `Utilisateurs` dans le menu latéral.

## Diagnostic des redémarrages watchdog

Une partition `coredump` de 64 Ko était réservée dans la table de partitions
depuis l'origine mais n'était reliée à aucun mécanisme de capture : un
redémarrage watchdog (`task_wdt`, déjà observé et non résolu, voir
[RESTANT_A_FAIRE.md](../RESTANT_A_FAIRE.md)) n'y laissait donc aucune trace
exploitable au-delà de la raison du reset elle-même.

- La capture de core dump vers cette partition est désormais activée
  (`custom_sdkconfig` dans `platformio.ini`).
- Un résumé (tâche et adresse à l'origine du blocage) s'affiche directement
  dans le journal de démarrage suivant un tel événement.
- Une extraction complète (trace d'appel) reste possible après coup avec
  `espcoredump.py`, sans avoir besoin d'être connecté au moniteur série au
  moment exact de l'incident.

**Non vérifié à la compilation** : cet ajout n'a pas pu être compilé ni
déclenché sur la carte réelle dans le cadre de cette session. Les 64 Ko
réservés peuvent s'avérer insuffisants selon le nombre de tâches actives au
moment d'un crash ; le journal signale alors explicitement un dépassement le
cas échéant, sans autre conséquence.

## Compatibilité et mise à jour

Les clés de configuration persistantes et les affectations matérielles
restent compatibles avec la 3.2.0. Une mise à jour normale conserve donc le
réseau, MQTT, l'administrateur et les autres réglages enregistrés en NVS.

Cette version modifie les fichiers de l'interface Web (police d'icônes, pages
Réseau, tableau de bord, Informations, ordre du menu). Une migration complète
depuis la 3.2.0 nécessite donc de flasher les deux images :

1. le firmware, pour les correctifs réseau Ethernet/Wi-Fi/MQTT ;
2. la SPIFFS, pour les correctifs d'interface Web.

**Attention** : une mise à jour complète de la SPIFFS remplace ses fichiers,
y compris le journal d'activité (`/activity.log`). Sauvegarder ce journal au
préalable si nécessaire ; la configuration réseau, MQTT et administrateur
n'est pas concernée, car stockée séparément en NVS.

## Validation réalisée

- flash du firmware et de la SPIFFS sur la carte réelle ;
- démarrage Ethernet seul : MQTT connecté ;
- démarrage Wi-Fi seul : MQTT connecté (préalablement en échec avant ce
  correctif) ;
- démarrage avec les deux interfaces puis débranchement d'Ethernet à chaud :
  MQTT reste connecté ;
- démarrage Wi-Fi seul puis branchement puis débranchement d'Ethernet à
  chaud : MQTT reste connecté ;
- affichage des icônes de l'interface Web vérifié sur un réseau sans accès
  Internet ;
- affichage simultané des adresses IP Ethernet et Wi-Fi vérifié sur le
  tableau de bord, la page Réseau et la page Informations.

Cette validation ne remplace pas un essai d'endurance prolongé. Le suivi des
bascules réseau et des reconnexions MQTT sur la durée reste une action
ouverte dans [RESTANT_A_FAIRE.md](../RESTANT_A_FAIRE.md).
