# Flow.io Waveshare 3.1.2

## Objet de la version

La 3.1.2 permet de choisir depuis l'interface Web comment raccorder les deux
sondes de température DS18B20. Le firmware reste autonome sur une seule carte
Waveshare ESP32-S3-ETH-8DI-8RO.

## Nouveauté principale

Dans `Configuration > io > drivers > ds18b20`, le champ
`Raccordement des températures` propose :

- `Qwiic / DS2484` : mode par défaut, compatible avec les installations
  3.1.0 et 3.1.1 ;
- `GPIO direct` : température d'eau sur GPIO20 et température d'air sur
  GPIO19.

Le réglage est persistant et prend effet après redémarrage. Une valeur invalide
est refusée au démarrage au profit du mode sûr Qwiic/DS2484.

## Qwiic reste actif

Le sélecteur ne commande que les DS18B20. Il ne désactive jamais le bus
Qwiic/I²C GPIO42/GPIO41. La RTC, les ADS1115 et les capteurs I²C optionnels
restent accessibles lorsque les températures utilisent GPIO19/GPIO20.

## Compatibilité réseau

La 3.1.2 reprend sans modification fonctionnelle le réseau de la 3.1.1 :

- tentative Ethernet prioritaire ;
- Wi-Fi de secours conservé ;
- seconde méthode de connexion ESP-IDF si `WiFi.begin()` échoue immédiatement ;
- portail de configuration si aucun réseau n'est disponible ;
- interface Web, MQTT, Home Assistant et OTA disponibles sur le réseau actif.

## Migration depuis 3.1.1

1. Sauvegarder la configuration.
2. Installer le firmware 3.1.2 et son SPIFFS associé.
3. Redémarrer sans modifier le câblage : Qwiic/DS2484 reste le défaut.
4. Vérifier les deux températures et les équipements.
5. Pour passer aux GPIO, câbler les sondes selon le schéma 3.1.2, choisir
   `GPIO direct`, enregistrer puis redémarrer.

Ne pas déplacer les sondes pendant que la carte est alimentée.

## Vérifications automatisées

La chaîne de contrôle compile le firmware Waveshare et l'image SPIFFS, exécute
les tests natifs, l'analyse statique C++, la vérification OTA et le contrôle des
artefacts de version. Les essais électriques sur carte réelle restent
indispensables avant production.

## Documentation associée

- [Guide principal](README.md)
- [Raccordement 3.1.2](integration/schema-raccordement-waveshare.md)
- [Mise en service](integration/mise-en-service.md)
- [Validations restantes](../RESTANT_A_FAIRE.md)
