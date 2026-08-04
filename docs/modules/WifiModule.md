# WifiModule (`moduleId: wifi`)

## Reprise de connexion en 3.1.1

Le chemin normal utilise `WiFi.begin()`. Si cet appel retourne immédiatement
`WL_CONNECT_FAILED`, le module valide les longueurs des identifiants puis arme
une connexion de secours avec `esp_wifi_set_config()` et
`esp_wifi_connect()`. La recherche couvre tous les canaux, sélectionne le point
d'accès selon le signal et conserve AP+station si le portail est actif.

Le reconnecteur automatique interne reste désactivé : les temporisations et
les nouvelles tentatives restent gérées par la machine d'état du module, en
coordination avec Ethernet.

## Rôle

Gestion de la connectivité WiFi STA:
- machine d'états (`Disabled`, `Idle`, `Connecting`, `Connected`, `ErrorWait`)
- publication de l'état réseau dans `DataStore`
- exposition d'un service WiFi minimal

Type: module actif.

## Dépendances

- `loghub`
- `datastore`
- `eventbus`

## Affinité / cadence

- core: 0
- task: `wifi`
- délais d'état: 200ms à 2s selon état

## Services exposés

- `wifi` -> `WifiService`
  - `state`
  - `isConnected`
  - `getIP`

## Services consommés

- `datastore`
- `loghub`

## Config / NVS

Module config: `wifi` (`moduleId = ConfigModuleId::Wifi`, branche locale `1`)
- `enabled` (`wifi_en`)
- `ssid` (`wifi_ssid`)
- `pass` (`wifi_pass`)

## DataStore

Écritures via `WifiRuntime.h`:
- `setWifiReady(...)` -> `DataKeys::WifiReady`
- `setWifiIp(...)` -> `DataKeys::WifiIp`

## EventBus / MQTT

- abonnement `ConfigChanged` pour appliquer `system/devicename` au mDNS
- pas de publication EventBus directe
- impact indirect: `MQTTModule` et `TimeModule` surveillent `DataKeys::WifiReady`
