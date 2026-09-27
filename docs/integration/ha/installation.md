# Installer les exemples Home Assistant Flow.io

Ce guide concerne les exemples Flow.io 3.4.1 de ce dossier. Il ne flashe pas
et ne modifie pas le firmware du Waveshare.

## 1. Vérifier MQTT et la découverte

Home Assistant et Flow.io doivent utiliser le même broker MQTT. Dans Flow.io,
ouvrez la configuration réseau et vérifiez que MQTT est activé, que l’adresse,
le port et les identifiants correspondent à ceux du broker, puis appliquez la
configuration. Les étapes détaillées sont dans le guide de
[première connexion](../premiere-connexion.md#6-configurer-mqtt).

Dans Home Assistant, vérifiez que l’intégration MQTT est configurée avec ce
même broker. Flow.io publie automatiquement ses entités par MQTT Discovery au
démarrage. Vérifiez que l’appareil Flow.io et ses entités apparaissent dans
l’intégration MQTT avant d’ajouter le tableau de bord.

## 2. Installer le package YAML

La carte fournie utilise des helpers et des alias d’alarmes créés par le
package. Pour l’utiliser telle quelle :

1. Sauvegardez la configuration Home Assistant.
2. Copiez [`home_assistant_package_3_4_1.yaml`](home_assistant_package_3_4_1.yaml)
   dans le dossier de configuration, sous `packages/`, par exemple avec le nom
   `flowio.yaml`.
3. Si les packages ne sont pas déjà activés, ajoutez à la section `homeassistant:`
   de `configuration.yaml` :

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```

   Si cette section existe déjà, ajoutez seulement la clé `packages` sans
   écraser les autres paramètres.
4. Vérifiez la configuration dans Home Assistant, puis redémarrez Home
   Assistant pour charger le package.

N’ajoutez pas une seconde clé `homeassistant:` si elle existe déjà. Si vous
préférez ne pas installer ce package, vous pouvez créer un tableau de bord
personnalisé, mais il faudra remplacer les entités `input_boolean.flowio_*`,
`input_select.flowio_*` et `binary_sensor.flowio_*` par vos propres helpers ou
par les entités natives correspondantes.

## 3. Installer les cartes personnalisées

La carte 3.4.1 utilise les cartes Lovelace personnalisées **Mushroom**,
**Mini Graph Card** et **card-mod**. Installez-les avec le gestionnaire de
cartes personnalisées de votre installation Home Assistant, puis vérifiez
qu’elles sont chargées comme ressources Lovelace. Redémarrez ou rechargez
l’interface si Home Assistant le demande.

La carte ne peut pas s’afficher correctement si l’une de ces dépendances est
absente. Le package YAML précédent ne les installe pas.

## 4. Ajouter la carte au tableau de bord

1. Ouvrez le tableau de bord Home Assistant et passez en mode édition.
2. Ajoutez une carte manuelle (éditeur de code YAML).
3. Copiez le contenu de
   [`home_assistant_dashboard_3_4_1.yaml`](home_assistant_dashboard_3_4_1.yaml)
   dans l’éditeur de la carte et enregistrez.

Le fichier fourni définit une carte `vertical-stack`, à placer dans la liste
`cards` d’une vue existante. Si vous éditez le YAML brut de toute une vue,
ajoutez ce bloc comme un élément de cette liste et conservez le reste de votre
configuration.

## 5. Vérifier le résultat

- Les jauges pH et ORP et les capteurs doivent afficher leur état après la
  réception des publications MQTT.
- Les interrupteurs représentent les fonctions logiques Flow.io. Une
  affectation à un autre relais CH ne demande aucune modification de la carte.
- Les alarmes et les commandes avancées apparaissent si le package est chargé.
- Une entité absente doit d’abord être recherchée dans **Paramètres → Appareils
  et services → MQTT**. Vérifiez ensuite le préfixe d’entité Flow.io configuré
  et que MQTT Discovery est activé.

Pour le détail du format Discovery, du préfixe des entités et des topics,
consultez la [documentation du module Home Assistant](../../modules/HAModule.md)
et la [référence MQTT](../../core/mqtt-topics.md).
