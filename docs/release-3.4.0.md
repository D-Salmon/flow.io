# Flow.io Waveshare 3.4.0

Cette version part de la 3.3.1 et refond la livraison du firmware et de
l’interface Web. Elle ne modifie pas les affectations des capteurs, des entrées
ou des relais.

## Interface Web minifiée

- les fichiers HTML, JavaScript, CSS et JSON sont minifiés avant la création de
  l’image SPIFFS ;
- les versions gzip sont générées en même temps et contrôlées par empreinte ;
- la préparation de SPIFFS échoue si un fichier source a changé sans nouvelle
  minification ;
- sur cette livraison, les 26 ressources Web passent d’environ 1,12 Mo à
  886 Ko minifiés et 205 Ko servis en gzip, sans suppression de fonction.
- une réponse temporaire « appareil occupé » reçue pendant la navigation est
  retentée sans remplacer ni bloquer la page déjà affichée.
- le Tableau de bord permet maintenant de commander directement les
  équipements. Les commandes automatisées restent verrouillées en mode automatique
  et les sécurités matérielles demeurent prioritaires ;
- les boutons de mode et d’équipement reflètent immédiatement la commande avec
  un état de confirmation en cours. L’interface recale ensuite cet affichage sur
  l’état réellement relu sur le contrôleur, sans attendre la relecture complète
  de toutes les données du Tableau de bord ;
- la page **Piscine** est recentrée sur les réglages : les cartes redondantes
  **État général** et **Contrôle des équipements** sont supprimées, et
  **Conditions générales** devient **Synthèse des réglages**. Les consignes pH
  et ORP sont centralisées dans **Qualité de l'eau**, auprès des mesures, et ne
  sont plus répétées dans les autres cartes. Lorsque le traitement de l'eau est
  désactivé, la carte ORP est masquée et les sorties de désinfection sont
  explicitement forcées à l'arrêt. La synthèse est positionnée juste avant
  **Affectation des sondes** et **Affectation des relais**.
- dans **Affectation des sondes**, une surveillance de pression ou un retour
  contacteur désactivé reprend le badge gris **Non câblé** de la sonde de débit.
  La mention **Entrée numérique** des retours est masquée tant qu’aucune entrée
  n’est affectée. Le fond arrondi des badges **Non câblé**, **Temporairement
  indisponible**, **Actif** et **Erreur** est défini dans les styles communs afin
  de rester visible sans avoir préalablement ouvert la page Entrées/Sorties.
- dans **Affectation des relais**, le badge décrit l’affectation physique du
  canal CH. Le relais de désinfection commun reste donc indiqué **Actif**
  lorsqu’il est correctement affecté : selon le traitement sélectionné, ce
  même relais commande la pompe doseuse ou l’électrolyseur.

## Comptes Web et rôles

Le bandeau indique simplement **Connecté en administrateur** ou **Connecté en
utilisateur**. Dans le menu latéral, l’accès local affiche **Se connecter comme
administrateur** et le rôle **Utilisateur**.

- l’ancien identifiant administrateur configuré par Rescue est migré sans
  changer son mot de passe ;
- l’interface utilise une page de connexion et une session valable sept jours ;
- un administrateur gère les comptes, le réseau, la configuration système et
  les mises à jour ;
- sans identification, l’interface ouvre une session locale temporaire sous le
  libellé « Opérateur local ». Aucun compte basique n’est créé ni stocké ;
- l’opérateur local peut consulter et piloter la piscine, l’historique, le
  journal d’activité, les entrées/sorties et les informations ;
- Réseau, Configuration, Utilisateurs, Mises à jour, redémarrage,
  récupération et Étalonnage restent réservés à une session Administrateur.
  Les menus sont masqués et les routes sensibles sont aussi refusées côté
  serveur ;
- le réglage **Interface Web > Exiger l’authentification Web** permet à
  l’administrateur d’imposer une identification dès l’ouverture. Il est
  désactivé par défaut ;
- les comptes Administrateur peuvent être modifiés mais pas supprimés. Leur
  bouton Supprimer est absent de l’interface et l’API applique la même règle ;
- un opérateur consulte et pilote la piscine, sans accès aux opérations système ;
- le menu latéral affiche le compte actif ; l’opérateur local peut y ouvrir la
  connexion administrateur et un compte identifié peut se déconnecter ;
- le bandeau de sécurité reprend le rôle de la session active et affiche
  « Administrateur connecté » ou « Opérateur connecté » ;
- les mots de passe nouveaux ou modifiés exigent au moins 12 caractères et
  sont stockés sous forme PBKDF2-HMAC-SHA256 avec sel individuel ;
- Rescue conserve son fonctionnement physique et remplace le compte
  administrateur lorsque ses identifiants sont modifiés.
- Rescue signale immédiatement une confirmation de mot de passe différente et
  bloque l’enregistrement tant que les deux valeurs ne correspondent pas.

## Historique local sur sept jours

- conservation des sept dernières journées complètes ainsi que de la journée
  en cours ;
- min, moyenne et max du pH, de l’ORP et des températures eau/air ;
- évolution des consignes pH, ORP et chauffage ;
- durées de filtration et de chauffage, volume et nombre de remplissages ;
- nouvelle page **Historique** avec courbes, synthèse et export CSV.
- l’icône de la page Historique utilise désormais un graphique pour la
  distinguer du Journal d’activité.

## État cohérent des sondes et équipements

PoolLogic publie désormais un état central utilisé par les pages **Piscine**,
**Entrées/Sorties** et les affectations de configuration. Les états possibles
sont : actif, désactivé, non câblé, matériel absent, temporairement
indisponible et bloqué par une sécurité. Les deux retours de contacteurs sont
inclus dans cette vue commune.

## Couple de mise à jour A/B

La flash de 16 Mo contient maintenant deux couples complets :

- `app0` + `spiffs0` ;
- `app1` + `spiffs1`.

Le package `binary/flowio-3.4.0.zip` contient exactement `manifest.json`,
`firmware.bin` et `spiffs.bin`. L’interface charge d’abord le filesystem puis
le firmware dans le couple inactif. Les tailles, les SHA-256, le descripteur de
version et les fichiers Web essentiels sont contrôlés avant de sélectionner le
nouveau couple au redémarrage.

Le rollback du bootloader est activé. Le nouveau firmware confirme son
démarrage seulement après avoir monté et validé le filesystem associé. En cas
d’échec, le bootloader revient au couple précédent.

## Journal persistant

Le journal d’activité et sa rotation sont déplacés dans la partition dédiée
`runtime` de 384 Ko. Cette partition n’appartient à aucun des deux couples de
release : une mise à jour du firmware et de l’interface Web ne l’efface plus.

Les ordres automatiques redondants ne sont plus présentés comme de nouvelles
demandes : un retour Maintenance → Automatique ne journalise pas « OFF
demandé » lorsque la pompe est déjà arrêtée. Les véritables changements d’état
et les ordres de sécurité restent consignés.

Les filtres **Automatismes** et **Manuel** utilisent désormais le code, la
source et le motif numériques de chaque événement. Ils restent donc exacts
pour les anciennes entrées du journal même lorsque leur libellé de source est
absent ou incomplet. Les alertes de sécurité ne sont pas assimilées aux
automatismes.

La suppression sélective et la purge complète utilisent désormais la session
administrateur de l’interface Web. Les commandes sont masquées pour
l’utilisateur local et ne dépendent plus de l’ancien contrôle HTTP Basic qui
provoquait une erreur 403 malgré une connexion administrateur valide.

Les compteurs du bandeau supérieur portent sur l’ensemble des événements
présents dans le journal chargé. La ligne **Chronologie** détaille séparément la
période de trois heures affichée : nombre total, alertes, actions manuelles et
événements d’équipement.

La page **Historique** inclut maintenant la journée en cours avant les sept
journées closes. Elle est identifiée par « Aujourd’hui — Journée en cours » dans
le tableau et par « Aujourd’hui » dans le graphique ; les indicateurs sur sept
jours continuent de porter uniquement sur les journées terminées.

Après l’ouverture de l’interface, les modules JavaScript et CSS des autres pages
accessibles sont préchargés en arrière-plan, à faible priorité et séquentiellement.
Le survol ou la prise de focus d’une entrée du menu anticipe aussi son chargement.
Les données dynamiques ne sont interrogées qu’à l’ouverture de la page afin de
ne pas augmenter la charge du contrôleur.

Le bloc de session du menu latéral affiche une grande initiale entourée d’un
halo, suivie uniquement du statut **Utilisateur** ou **Administrateur**. Le nom
du compte n’est pas affiché. L’action placée en dessous devient **Se déconnecter**
pour une session identifiée ou **Se connecter comme administrateur** pour
l’accès utilisateur local.


Le Tableau de bord n'affiche désormais que les alarmes réellement actives, toutes
en rouge. Les contrôles au repos, les sondes non câblées et les états inconnus ne
sont plus présentés comme des alarmes. Le firmware neutralise explicitement les
alarmes associées à une entrée déclarée non câblée.

Les titres d'alarme visibles dans le journal et le Tableau de bord sont harmonisés
en français, notamment **Niveau bassin bas**, **Température d'eau indisponible**,
**Durée maximale pompe pH dépassée** et **Durée maximale désinfection dépassée**.
Le portail propose désormais **Se connecter sans s'identifier** pour l'accès
utilisateur local.

## Nouveau Tableau de bord

Le Tableau de bord reprend l’organisation claire de la proposition du fork :
état général et plage de filtration en tête, puis cartes **Mode**,
**Équipements**, **Sondes** et **Alarmes**. Les valeurs des sondes utilisent
des couleurs distinctes pour être reconnues immédiatement.

Les modes conservent un état gris à l’arrêt. Dans la carte **Équipements**,
l’état « À l’arrêt » apparaît en rouge, les équipements actifs en vert et la
filtration en marche en bleu. La carte **Détails techniques personnalisables**,
devenue redondante, a été retirée du Tableau de bord.
Les quatre interrupteurs de mode sont maintenant de vraies commandes :
**Mode auto** bascule entre Automatique et Manuel sécurisé, puis **Mode hiver**,
**pH auto** et l’automatisation du traitement se règlent directement. Son
intitulé suit le traitement sélectionné : **Pompe chlore / brome auto**,
**Électrolyseur auto** ou **Pompe oxygène actif auto**. Avec **Aucun traitement
de l’eau**, cette commande disparaît du Tableau de bord. Activer **Mode auto**
active également pH auto et l’automatisation du traitement sélectionné ; quitter
le mode automatique coupe ces deux automatismes. Le traitement automatique
possède un réglage persistant propre à l’électrolyse et à l’oxygène actif ; le
chlore/brome conserve sa régulation ORP dédiée. Le mode Maintenance reste
disponible uniquement dans Configuration.

Les alarmes dont la cause est encore présente n’affichent plus la mention
redondante « Condition active ». Lorsque la cause a disparu mais que l’alarme
reste mémorisée, la seule action proposée est **Acquitter**.

Tous les textes du Tableau de bord ont été agrandis : titres de cartes à 17 px,
libellés principaux à 15 px, états à 14,5 px et mesures à 24 px. Le robot dispose désormais d'un réglage Activé / Désactivé dans sa carte Piscine ; le robot, le chauffage et le remplissage sont masqués du Tableau de bord lorsqu'ils sont désactivés. Les graisses,
interlignes, espacements et la largeur de menu de 216 px restent alignés sur le
fork. La première carte remonte sous le bandeau d’état et la couleur indique la
page active.

La pile typographique reprend exactement celle de la maquette du fork, avec la
police système native de chaque appareil. L’état sain est nommé **État normal**
et la carte d’état ne contient plus de raccourcis redondants vers Piscine et le
Journal.

Dans la barre latérale, **Piscine** devient **Réglages piscine** afin de mieux
distinguer cette page de réglages du Tableau de bord. Le titre de la page reste
**Piscine**.

En mode sombre, les boutons principaux utilisent maintenant un fond bleu/cyan
plein. Les boutons secondaires ont un fond bleu sombre et une bordure claire ;
les états survolé, désactivé et les actions dangereuses conservent ainsi un
contraste lisible sur toutes les cartes. Les quatre boutons de mode du Tableau
de bord restent délimités au repos et prennent une teinte verte lorsqu’ils sont
actifs, sans dépendre du survol pour être visibles. Les boutons de la carte
**Équipements** suivent la même présentation ; la filtration active conserve
sa teinte bleue et les autres équipements actifs leur teinte verte.

## Nouveau partitionnement

| Partition | Taille | Rôle |
|---|---:|---|
| `app0`, `app1` | 6,25 Mo chacune | firmwares A et B |
| `spiffs0`, `spiffs1` | 1,5 Mo chacune | interfaces Web A et B |
| `runtime` | 384 Ko | journal d’activité persistant |
| `coredump` | 64 Ko | diagnostic après plantage |

Le passage depuis une ancienne table de partitions exige un premier flash USB
du firmware et de SPIFFS. Les mises à jour suivantes peuvent utiliser le paquet
complet depuis la page **Mises à jour**.

## Validation

- la pile de la tâche EventBus passe de 4 à 6 Ko après analyse d’un rapport de
  plantage montrant seulement 112 octets libres au déclenchement de la
  protection de pile ;
- la pile HMI de 6 Ko est placée en PSRAM : la mémoire interne disponible après
  le démarrage Web passe de 12 472 à 18 880 octets et ne déclenche plus le
  redémarrage automatique pour pression mémoire ;
- minification et contrôle de 26 ressources Web ;
- compilation `Waveshare-ESP32-S3` réussie ;
- JavaScript de l’interface vérifié syntaxiquement ;
- test ciblé des filtres Automatismes et Manuel réussi ;
- image SPIFFS de 1,5 Mo générée ;
- package de release généré avec empreintes SHA-256 ;
- firmware et SPIFFS flashés sur le Waveshare réel ;
- démarrage Web et page de connexion vérifiés par adresse IP et par
  `flowio.local` ;
- stabilité vérifiée plus de cinq minutes après la période de grâce du
  watchdog, avec 30 requêtes Web réussies sur 30 et aucun redémarrage ;
- ouverture locale sans compte comme Opérateur et séparation des routes
  Administrateur compilées ;
- parcours authentifié Administrateur/Opérateur, accumulation sur sept jours
  et défauts matériels simulés encore à valider sur la carte ;
- essai matériel du nouveau basculement A/B encore requis.
