# Flow.io Waveshare 3.1.5

## Objet de la version

La version 3.1.5 améliore l’usage quotidien de la cible autonome Waveshare
ESP32-S3-POE-ETH-8DI-8RO N16R8. Elle rend les modes et les équipements principaux
accessibles depuis les vues opérationnelles, adapte la limite de fonctionnement
de l’électrolyseur au mode choisi et fiabilise le démarrage à froid.

## Interface Web

- Le mode de fonctionnement peut être changé directement depuis la carte
  `Vue d’ensemble` du tableau de bord.
- La page Piscine ne contient plus de bloc `Pilotage général` séparé : le mode
  principal rejoint l’état général, tandis que le mode hiver et le robot sont
  intégrés au contrôle des équipements.
- Le panneau `Contrôle des équipements` présente les commandes dans l’ordre
  filtration, électrolyseur ou pompe à chlore, pompe pH, éclairage, mode hiver,
  robot, chauffage et remplissage.
- Les équipements désactivés ou dépourvus d’affectation ne sont pas affichés.
- L’intitulé de la vue d’état du tableau de bord ne suggère plus qu’elle permet
  une commande manuelle.
- `Entrées/Sorties` est placé après `Configuration` dans la navigation latérale.
- Les états du remplissage, de l’éclairage et du chauffage sont inclus dans la
  réponse d’état compacte utilisée par l’interface.

Les commandes directes restent soumises aux dépendances de PoolDevice et aux
sécurités matérielles. Une demande refusée renvoie la cause dans l’interface.

Des [captures commentées du tableau de bord, de la page Piscine et de
l’étalonnage](integration/interface-web-3.1.5.md) présentent cette organisation.

## Politique de fonctionnement de l’électrolyseur

- En mode manuel ou maintenance, la limite quotidienne de fonctionnement de
  l’électrolyseur est désactivée afin de laisser la durée sous le contrôle de
  l’opérateur.
- En mode automatique, la limite effective est la plus grande valeur entre la
  limite configurée et la durée de filtration calculée augmentée de 60 minutes.
- La dépendance à la filtration et les sécurités matérielles restent actives
  quel que soit le mode.
- La politique est recalculée lorsque la configuration PoolLogic change.

## Journal d’activité et alarmes

Le journal d’activité reçoit désormais les événements de déclenchement, de
retour à la normale et de fin d’alarme. Une alarme mémorisée dont la condition
a disparu reste identifiable comme étant en attente d’acquittement.

## Démarrage et mémoire

- Le profil Waveshare utilise le mode flash DIO, nécessaire au démarrage à froid
  fiable de la carte testée. Une image QIO pouvait être correctement écrite puis
  échouer avant le lancement du bootloader.
- Le profil conserve 16 Mo de flash et 8 Mo de PSRAM Octal.
- Aucun changement de câblage n’est requis.

## Compatibilité et mise à jour

Les clés de configuration persistantes et les affectations matérielles restent
compatibles avec la 3.1.4. Une mise à jour normale conserve donc le réseau,
MQTT, l’administrateur et les autres réglages enregistrés en NVS.

Pour une migration complète depuis la 3.1.4, flasher les deux images provenant
de cette même révision :

1. `binary/flowios3-3.1.5.bin` pour le firmware ;
2. `binary/flowios3-spiffs-3.1.5.bin` pour l’interface Web.

Le SPIFFS n’a pas besoin d’être réécrit lorsqu’on applique uniquement une
recompilation ultérieure du firmware sans changement des fichiers Web.

## Artefacts

| Image | Taille | SHA-256 |
|---|---:|---|
| `flowios3-3.1.5.bin` | 2 145 984 octets | `85da9c1f590d2bdcf1503796798151b581a4163132e02e5e14d450cac83e188b` |
| `flowios3-spiffs-3.1.5.bin` | 8 257 536 octets | `cd95cf672d0a920765c2151e9a962b9abb2d1938c1eeeefe9c421ed93fbc4907` |

## Validation réalisée

- compilation PlatformIO de l’environnement `Waveshare-ESP32-S3` réussie ;
- flash du firmware sur la carte réelle et vérification de l’empreinte écrite ;
- démarrage avec détection de 8 Mo de PSRAM ;
- connexion Wi-Fi et MQTT TLS ;
- publication mDNS `flowio.local` ;
- démarrage de l’interface Web sur le port 80 ;
- détection de la nouvelle politique de durée en mode manuel ;
- parcours de commande des équipements essayé sur la carte utilisée.

Cette validation ne remplace pas une campagne complète avec tous les capteurs,
contacteurs et équipements de puissance raccordés. Les contrôles encore ouverts
sont suivis dans [RESTANT_A_FAIRE.md](../RESTANT_A_FAIRE.md).
