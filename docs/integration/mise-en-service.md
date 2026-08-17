# Mise en service Flow.io Waveshare 3.1.4

Cette procédure concerne une seule carte Waveshare ESP32-S3-ETH-8DI-8RO.

## 1. Préparer le matériel

- Couper toutes les alimentations.
- Câbler l'alimentation continue protégée et la terre du coffret selon les
  règles applicables.
- Raccorder Ethernet si disponible.
- Câbler les capteurs et les contacteurs selon le
  [schéma Waveshare](schema-raccordement-waveshare.md).
- Laisser les équipements de puissance désactivés pour le premier démarrage.

## 2. Compiler et installer

Dans Visual Studio Code avec PlatformIO :

1. ouvrir le dossier du projet ;
2. sélectionner l'environnement `Waveshare-ESP32-S3` ;
3. lancer `Build` ;
4. téléverser le firmware ;
5. téléverser l'image du système de fichiers SPIFFS ;
6. ouvrir la console série à 115200 bauds pour contrôler le démarrage.

Le firmware et le SPIFFS doivent provenir exactement de la même version.

## 3. Configurer le réseau

Au démarrage, Ethernet est essayé en priorité. Si Ethernet n'est pas
opérationnel, le contrôleur tente le Wi-Fi enregistré. Sans réseau valide, le
portail de configuration Wi-Fi est activé.

Sur une carte neuve ou effacée, suivre le
[tutoriel de première connexion](premiere-connexion.md) pour récupérer le mot
de passe du point d'accès, créer l'administrateur Web et configurer le réseau.

Ne pas exposer l'interface HTTP directement à Internet.

## 4. Choisir les températures

Ouvrir l'interface Web puis :

1. aller dans `Configuration > io > drivers > ds18b20` ;
2. choisir `Qwiic / DS2484` ou `GPIO direct` ;
3. enregistrer ;
4. redémarrer le contrôleur ;
5. vérifier la température d'eau et la température d'air.

Le mode GPIO utilise GPIO20 pour l'eau et GPIO19 pour l'air. Qwiic reste actif
pour les autres capteurs dans les deux modes.

## 5. Vérifier les entrées et sorties

- Actionner chaque entrée séparément et vérifier son état Web.
- Tester chaque relais sans charge, puis avec la bobine du contacteur.
- Vérifier que toutes les sorties sont arrêtées au démarrage initial.
- Confirmer les polarités des niveaux de cuves et du compteur d'eau.
- Vérifier pH, ORP et pression avant d'activer leurs automatismes.

## 6. Activer progressivement l'automatisme

1. Valider la filtration manuelle.
2. Vérifier la planification calculée avec la température d'eau.
3. Activer la surveillance de pression seulement après étalonnage.
4. Activer séparément dosage, robot, remplissage, éclairage et chauffage.
5. Simuler chaque défaut et vérifier l'arrêt attendu.

## 7. Sauvegarder

Après validation, exporter la configuration, noter la version 3.1.4 et
conserver les sommes SHA-256 des fichiers installés avec le dossier du coffret.
