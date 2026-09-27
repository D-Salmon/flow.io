# Exemples Home Assistant

Les exemples de configuration Home Assistant sont regroupés dans ce dossier.
Pour le firmware 3.4.1, utiliser les deux fichiers suivants :

- [Carte Lovelace](home_assistant_dashboard_3_4_1.yaml) : carte à ajouter au
  tableau de bord Home Assistant.
- [Package Home Assistant](home_assistant_package_3_4_1.yaml) : package
  optionnel fournissant les alias d’alarmes et les commandes de navigation
  avancée utilisées par la carte.

La carte 3.4.1 utilise les cartes personnalisées Mushroom, Mini Graph Card et
card-mod. Installer ces cartes dans Home Assistant avant d’ajouter la
configuration Lovelace. Les entités Flow.io sont découvertes par MQTT
Discovery ; la configuration du broker et de la découverte est décrite dans
la [documentation du module Home Assistant](../../modules/HAModule.md).

Les fichiers suffixés `3_1_0` sont conservés pour référence historique. Ils
ne doivent pas être considérés comme la configuration recommandée pour 3.4.1.
