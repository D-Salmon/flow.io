# Historique des correctifs de securite

> **Note de re-verification (2026-08-02)** : ce document decrit un lot de
> correctifs anterieur (aligne sur la branche 2.5.0). Verifie point par
> point sur le depot `flow.io-agent-waveshare-3.1.0`.

Ce document conserve la trace du premier lot de corrections issu de l'audit
du kit Flow.io Waveshare Qwiic. Ces corrections sont reprises dans la version
actuelle du projet.

## Corrections appliquees

- `ESPAsyncWebServer` mis a jour vers `3.11.2`. **Non verifiable tel quel sur
  3.1.0** : `platformio.ini` epingle `ESP32Async/ESPAsyncWebServer @ ^3.6.0`,
  une plage compatible (pas un numero exact) ; `3.11.2` peut satisfaire cette
  plage mais aucun fichier du depot (pas de lock, pas de lib vendorisee) ne
  permet de confirmer que c'est la version reellement resolue au build.
- `AsyncTCP` mis a jour vers `3.4.10`. **Meme reserve** : `platformio.ini`
  epingle `ESP32Async/AsyncTCP @ ^3.3.2` (plage), pas `3.4.10` explicitement.
- `ArduinoJson` migre vers `7.4.3`. **Confirme** : `bblanchon/ArduinoJson @
  7.4.3` epingle en dur dans `platformio.ini`.
- Jeton CSRF aleatoire de 128 bits et controle des requetes mutantes.
- Validation stricte de l'origine WebSocket `/wslog`.
- En-tetes CSP, anti-clickjacking, anti-MIME-sniffing et isolation des ressources.
- Echappement et troncature sure des reponses JSON de configuration.
- MQTT TLS avec verification du certificat active par defaut.
- Transport d'ecran distant HMI UDP, protocole associe et port 42110
  **retires du profil `Waveshare-ESP32-S3`** — voir correction ci-dessous,
  cette ligne etait imprecise.
- Limitation Digest portee a 32 sources, avec blocage par IP et plafond global.
- Verification automatique de l'absence d'instanciation du transport HMI UDP
  dans le profil `Waveshare-ESP32-S3` — voir correction ci-dessous.

> **Correction (verifiee le 2026-08-02 sur le depot 3.1.0)** : contrairement
> a ce qu'indiquaient les deux puces ci-dessus (« supprimes », « absence...
> dans les sources »), le code du transport HMI UDP **est toujours present
> dans l'arborescence source** de la version 3.1.0 :
> `src/Core/Hmi/HmiUdpProtocol.h/.cpp`,
> `src/Modules/Network/HmiUdpServerModule/HmiUdpServerModule.h/.cpp`,
> `src/Modules/HMIModule/Drivers/RemoteHmiUdpDriver.h/.cpp` et
> `src/Modules/FlowConnectDisplay/FlowConnectDisplayUdpClientModule/`. Le
> port `42110` (`HMI_UDP_PORT`) est toujours defini dans
> `HmiUdpProtocol.h`. Ce code n'a pas ete supprime du projet : il reste
> utilise par les profils `FlowIO` et `FlowConnectDisplay`
> (`src/Profiles/FlowIO/FlowIOProfile.h`,
> `src/Profiles/FlowConnectDisplay/FlowConnectDisplayProfile.h`). Pour le
> profil `Waveshare-ESP32-S3` specifiquement, `HmiUdpServerModule` n'est
> instancie dans aucun fichier de profil et le `build_src_filter` de cet
> environnement ne l'exclut pas non plus explicitement (contrairement a
> d'autres modules hors-perimetre comme `Modules/Network/I2CCfgServerModule`).
> Le fichier est donc compile mais son code reste mort (jamais construit ni
> demarre) sur la carte Waveshare : il n'ouvre pas de socket UDP au
> demarrage. L'effet fonctionnel constate a l'epoque (« pas de serveur HMI
> UDP actif sur Waveshare ») reste donc exact, mais la formulation
> « supprimes des sources » etait fausse et pretait a confusion — recommande
> de reformuler en « non instancie sur ce profil » et d'ajouter
> explicitement ce dossier au `build_src_filter` d'exclusion de
> `env:Waveshare-ESP32-S3`, par coherence avec les autres modules hors
> perimetre et pour reduire la surface de code compilee inutilement.

## Validation

- Compilation PlatformIO `Waveshare-ESP32-S3` : reussie.
- Construction SPIFFS : reussie.
- `scripts/verify_release.py` : `release verification: OK`.
- Recherche des marqueurs HMI UDP dans les binaires : aucun resultat (constat
  de l'audit d'origine, **non reproduit sur 3.1.0** faute de binaire
  compilable dans l'environnement de re-verification ; a re-tester compte
  tenu de la correction ci-dessus sur la presence du code source).

Les anciens binaires de ce lot ont ete retires du paquet actuel. Le fichier
`binary/manifest.json` ne reference que les artefacts encore distribues.

## Compatibilite API

Les lectures HTTP restent inchangees. Un client qui effectue une action doit :

1. lire `/api/web/meta` avec l'authentification Digest ;
2. recuperer `csrf_token` ;
3. envoyer sa valeur dans `X-Flow-CSRF`.

Le Nextion local reste connecte en UART. Home Assistant continue d'utiliser
MQTT et ne depend pas du transport HMI supprime.

## Risques restant hors de ce lot

- L'administration Web reste en HTTP sans confidentialite de transport.
- Secure Boot v2, chiffrement flash/NVS et anti-rollback restent a industrialiser.
- Le socle Arduino-ESP32 2.0.17 (`env:FlowIO`) reste a migrer vers une
  branche maintenue. La carte de production `env:Waveshare-ESP32-S3` utilise
  deja un socle 3.x via le fork pioarduino (verifie le 2026-08-02 :
  framework-arduinoespressif32 3.3.11), mais celui-ci n'est pas epingle sur
  un tag de release precis (canal `stable`), ce qui reste a corriger pour
  garantir des builds reproductibles.

Le port 80 ne doit pas etre expose directement a Internet. Pour un acces Web
distant, utiliser un VPN ou un reverse proxy HTTPS de confiance.
