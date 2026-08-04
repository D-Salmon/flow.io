# Flow.io Waveshare 3.1.1 — fiabilisation Wi-Fi

La version 3.1.1 prolonge la base Waveshare 3.1.0 et améliore la reprise de la
connexion Wi-Fi, sans modifier la priorité Ethernet ni le portail de
configuration sécurisé.

## Changements

- ajout d'une voie de connexion de secours lorsque `WiFi.begin()` retourne
  immédiatement `WL_CONNECT_FAILED` ;
- validation bornée du SSID et du mot de passe avant de transmettre la
  configuration à l'ESP-IDF ;
- recherche sur tous les canaux et sélection du point d'accès selon le signal ;
- compatibilité PMF sans l'imposer aux routeurs qui ne le prennent pas en
  charge ;
- conservation du mode AP+station lorsque le portail de configuration est actif ;
- retour à la temporisation normale si la voie de secours échoue ;
- conservation de la coordination Ethernet/Wi-Fi de la version 3.1.0.

## Comportement réseau

Ethernet reste prioritaire au démarrage. Le Wi-Fi reste disponible comme voie
de secours et pour le provisioning. Le reconnecteur automatique interne reste
désactivé afin que la machine d'état Flow.io reste seule responsable des délais
et des nouvelles tentatives.

## Validation

- API ESP-IDF employées vérifiées dans les en-têtes ESP32-S3 PlatformIO ;
- validation matérielle Ethernet/Wi-Fi encore requise avant production.

Les limitations de production documentées pour la 3.1.0 restent applicables.
