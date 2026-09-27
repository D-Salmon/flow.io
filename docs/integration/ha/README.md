# Exemples Home Assistant

Les exemples de configuration Home Assistant sont regroupés dans ce dossier.
Pour le firmware 3.4.1, utiliser les deux fichiers suivants :

- [Carte Lovelace](home_assistant_dashboard_3_4_1.yaml) : carte à ajouter au
  tableau de bord Home Assistant.
- [Package Home Assistant](home_assistant_package_3_4_1.yaml) : package
  requis par cette carte, car il fournit ses helpers, ses alias d’alarmes et sa
  navigation avancée. Il peut être omis pour un tableau de bord personnalisé
  qui ne référence pas ces entités.

La carte 3.4.1 utilise les cartes personnalisées Mushroom, Mini Graph Card et
card-mod. Installer ces cartes dans Home Assistant avant d’ajouter la
configuration Lovelace. Les entités Flow.io sont découvertes par MQTT
Discovery ; la configuration du broker et de la découverte est décrite dans
la [documentation du module Home Assistant](../../modules/HAModule.md).

Suivre le [guide d’installation](installation.md) pour installer le package,
les cartes personnalisées et ajouter la carte au tableau de bord.

Les fichiers suffixés `3_1_0` sont conservés pour référence historique. Ils
ne doivent pas être considérés comme la configuration recommandée pour 3.4.1.
