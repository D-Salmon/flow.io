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

## Comptes Web et rôles

- l’ancien identifiant administrateur configuré par Rescue est migré sans
  changer son mot de passe ;
- l’interface utilise une page de connexion et une session valable sept jours ;
- un administrateur gère les comptes, le réseau, la configuration système et
  les mises à jour ;
- un opérateur consulte et pilote la piscine, sans accès aux opérations système ;
- le menu latéral affiche le compte actif, permet de changer son propre mot de
  passe et de se déconnecter ;
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
- minification et contrôle de 26 ressources Web ;
- compilation `Waveshare-ESP32-S3` réussie ;
- JavaScript de l’interface vérifié syntaxiquement ;
- image SPIFFS de 1,5 Mo générée ;
- package de release généré avec empreintes SHA-256 ;
- firmware et SPIFFS flashés sur le Waveshare réel ;
- démarrage Web et page de connexion vérifiés par adresse IP et par
  `flowio.local` ;
- redirection d’un accès sans session vérifiée sans boucle ;
- parcours authentifié Administrateur/Opérateur, accumulation sur sept jours
  et défauts matériels simulés encore à valider sur la carte ;
- essai matériel du nouveau basculement A/B encore requis.
