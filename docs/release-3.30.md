# Flow.io Waveshare 3.30

La version 3.30 conserve la base fonctionnelle, matérielle et de sécurité de la
3.2.2. Elle intègre uniquement trois apports ciblés issus de l'évaluation de la
branche Flow.io-Waveshare plus récente.

## Identification et compatibilité Nextion

- interrogation `connect` du Nextion au démarrage ;
- lecture stricte du modèle, du type de dalle tactile et de la version interne ;
- normalisation d'une identité de compatibilité indépendante des variantes
  résistive/capacitive ;
- rejet d'un fichier canonique `FlowIO_Nextion_<modèle>-<version>.tft` lorsque
  son modèle ne correspond pas à l'écran détecté ;
- maintien du mode de récupération lorsque l'identité du Nextion ne peut pas
  être lue.

## Reçu persistant des mises à jour

Chaque mise à jour reçoit un `operation_id`. Son état est persisté en NVS avec
signature de format et checksum. Après redémarrage, une opération marquée prête
à redémarrer devient `succeeded`, tandis qu'une opération restée `running`
devient `interrupted`. L'API de statut publie l'identifiant de démarrage,
l'opération courante et le dernier résultat ; les réponses d'acceptation Web et
commande retournent aussi l'identifiant d'opération.

La vérification ECDSA des mises à jour Waveshare et la politique de refus des
mises à jour SPIFFS/Nextion distantes non signées restent inchangées.

## Surveillance de la mémoire interne

- séparation des métriques de heap global et de RAM interne ;
- décisions de pression mémoire fondées sur la RAM interne, avec hystérésis ;
- réutilisation d'un snapshot de tâches au lieu d'une allocation périodique ;
- historique de diagnostic placé en PSRAM lorsqu'il est activé ;
- exposition des valeurs internes dans l'état de santé.

La pile du moniteur système reste en RAM interne afin de préserver la capture de
core dump configurée dans la 3.2.2.

## Validation

- compilation PlatformIO de `Waveshare-ESP32-S3` réussie ;
- compilation séparée des tests `test_nextion_display_identity` et
  `test_firmware_update_receipt` réussie ;
- aucun flash ni essai matériel 3.30 réalisé à ce stade.

Avant déploiement, vérifier sur carte réelle la détection du modèle Nextion, les
trois chemins de mise à jour et les transitions de pression mémoire.
