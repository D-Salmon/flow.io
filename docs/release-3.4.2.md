# Notes de version 3.4.2

## Mémoire Home Assistant

Les tables de découverte Home Assistant sont allouées en PSRAM en priorité, avec repli en mémoire interne si cette allocation échoue. Elles ne sont utilisées que pendant la préparation et la publication MQTT des entités, puis libérées après la découverte initiale. Le bitmap compact des notifications reste en RAM interne.

Cette version ne modifie pas le comportement des automatismes ni l’affectation des relais.

## Validation

- Compilation PlatformIO Waveshare ESP32-S3.
- Vérification sur contrôleur à effectuer après flash.
