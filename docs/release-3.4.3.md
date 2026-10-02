# Notes de version 3.4.3

## Forçage temporaire des équipements

Les équipements normalement pilotés par les automatismes peuvent recevoir un forçage manuel temporaire depuis le tableau de bord ou la page Piscine. L’opérateur choisit une durée comprise entre 1 et 1440 minutes. À l’échéance, le forçage est levé et le pilotage normal reprend. Le compte à rebours est volatile : un redémarrage annule les forçages actifs.

Les sécurités restent prioritaires : un équipement désactivé ou non câblé ne peut pas être démarré, les dépendances (notamment la filtration) sont contrôlées et les limites de durée maximale restent actives. Un forçage qui échoue à ces contrôles est refusé.

## Validation

- Vérification syntaxique du JavaScript et des fichiers de traduction.
- Compilation PlatformIO Waveshare ESP32-S3 réussie (RAM 31,7 %, Flash 33,9 %).
- Image SPIFFS et archive de la version 3.4.3 générées.
- Aucun flash effectué pour cette version.
