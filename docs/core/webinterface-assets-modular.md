# Interface Web : chargement modulaire

## Objectif

La version 3.2.0 sépare le noyau de navigation des contrôleurs de pages. Le
Waveshare ne télécharge et ne décompresse au démarrage que le shell, les styles
communs et le module de la page affichée. Les autres ressources sont chargées
une seule fois, lors de leur première ouverture.

## Ressources de base

- `index.html` : bootstrap minimal ;
- `app-core.js` : récupération du shell, gestion des réponses temporaires
  `503 Busy` et chargeur idempotent JS/CSS ;
- `sh.html` : structure HTML de l'application ;
- `app.js` : navigation, services HTTP partagés, état d'en-tête et orchestration
  des modules ;
- `app-core.css` : styles communs au shell et aux composants réutilisables.

## Modules chargés à la demande

| Ressource | Pages ou responsabilité |
|---|---|
| `pool.js` | Tableau de bord et Piscine |
| `calibration.js` + `calibration.css` | Étalonnage |
| `activity.js` + `activity.css` | Journal d'activité |
| `updates.js` | Mises à jour |
| `config.js` | arbre Config Store, édition, import et export |
| `network.js` + `network.css` | Ethernet, Wi-Fi et MQTT |
| `io-summary.js` + `io-summary.css` | Entrées/Sorties |
| `info.js` | Informations |
| `logs.js` | terminal de logs WebSocket et lecture des logs de démarrage, chargé au premier clic |

`config.js` expose aussi les services de documentation Config Store
utilisés par Piscine et Étalonnage. Son chargement reste différé tant qu'aucune
de ces fonctions n'en a besoin.

## Cache et versionnement

Les URL portent l'empreinte calculée par
`WebInterfaceServer::webAssetVersion_()`. Cette empreinte inclut chaque module
compressé : un nouveau SPIFFS force donc le navigateur à récupérer les seuls
fichiers qui ont changé.

Chaque ressource déclarée doit être présente dans les quatre endroits suivants :

1. `scripts/prepare_spiffs_data.py` ;
2. `scripts/gzip_web_assets.sh` ;
3. le contrôle d'intégrité et l'empreinte de `WebInterfaceServer.cpp` ;
4. une route HTTP `/webinterface/<ressource>`.

## Documentation Config Store segmentée

Les documents de configuration sont stockés dans `data/wc/` avec des noms
courts compatibles SPIFFS :

- `i.j` : index ;
- `mXXXXXXXX.j` : document d'un module.

Ils sont générés par `scripts/generate_cfgdoc_chunks.py` et accessibles par :

- `GET /api/cfgdoc/index` ;
- `GET /api/cfgdoc/module?name=<module>`.

Si ces fragments sont indisponibles, l'interface utilise les fichiers
`cfgdocs.<langue>.json` et `cfgmods.<langue>.json`.

## Validation avant flash

1. vérifier la syntaxe de tous les fichiers JavaScript ;
2. ouvrir chaque page dans un navigateur et vérifier que son module n'apparaît
   qu'après la première navigation ;
3. générer tous les fichiers `.gz` ;
4. construire le firmware et SPIFFS ;
5. exécuter `scripts/verify_release.py` ;
6. flasher le firmware puis SPIFFS et contrôler le journal de démarrage.
