# Flow.io Waveshare 3.2.2

## Objet de la version

La version 3.2.2 empêche les automatismes de traitement d'utiliser des mesures
pH, ORP ou de température devenues incorrectes après l'arrêt de la circulation.
Elle conserve une valeur fiable pour l'affichage et sécurise également le calcul
de la durée du prochain cycle de filtration.

## Mesures figées à l'arrêt de la circulation

Les sondes montées sur la canalisation ne mesurent plus l'eau représentative du
bassin lorsque la filtration est arrêtée. Le module d'entrées/sorties conserve
donc une référence fiable acquise avant l'arrêt et la publie avec l'état
`held` (« mesure figée »).

- Les valeurs pH et ORP sont toujours figées lorsque la circulation est arrêtée.
- La température de l'eau est figée lorsque la sonde est déclarée montée en
  ligne. Une sonde immergée directement dans le bassin peut continuer à fournir
  une mesure active.
- Les filtres médians sont vidés au redémarrage de la circulation.
- Une période de stabilisation de 90 secondes est imposée avant de rendre les
  nouvelles mesures utilisables par les automatismes.

Les valeurs figées restent visibles à titre informatif, mais elles ne sont pas
utilisées par les régulations pH et ORP, le chauffage, les sécurités de
l'électrolyseur ni la compensation du traitement à l'oxygène actif. Les mesures
pH et ORP doivent en outre dater de moins de cinq minutes, et la température de
moins de dix minutes.

## Calcul de la durée de filtration

Le calcul quotidien officiel reste exécuté à 15 h.

- Une température figée depuis moins de 24 heures reste utilisable pour calculer
  le cycle suivant, car la température du bassin évolue lentement et une sonde
  en ligne ne peut pas fournir de nouvelle mesure sans circulation.
- Si cette valeur a plus de 24 heures, ou si aucune température n'est disponible,
  le système programme la durée minimale de deux heures.
- Lorsque ce cycle minimal démarre, l'arrivée d'une température fraîche après
  les 90 secondes de stabilisation déclenche un recalcul unique. L'heure de
  départ réelle est conservée et la durée ainsi que l'heure de fin du cycle en
  cours sont corrigées.
- Le calcul normal de 15 h reprend ensuite la main pour planifier le cycle
  suivant et positionner sa plage horaire selon la température.

## Interface Web et configuration

La page Piscine affiche explicitement « Mesure figée » pour les valeurs
concernées au lieu de les comparer à une consigne. La carte des protections
indique aussi si la sonde de température d'eau est montée en ligne ou immergée
dans le bassin.

Le réglage `poollogic/safety/sensor_hold_wat`, activé par défaut, correspond à
une sonde montée en ligne. Il doit être désactivé lorsque la sonde reste immergée
dans le bassin.

Le détecteur de débit se configure directement par son entrée numérique. Le
choix « Désactivé / non câblé » désactive sa surveillance, sans interrupteur
séparé. Les listes d'affectation masquent les entrées déjà utilisées par une
autre sonde ou un autre contact de la même famille.

Lorsqu'il est câblé, ce contact sec complète la surveillance de pression. Une
absence de débit après le délai de validation configuré arrête la filtration et
les équipements qui en dépendent. La surveillance apparaît dans les cartes
**Protections générales** et **Protections** ; son délai reste masqué lorsque le
détecteur est désactivé.

Dans la synthèse **Protections et temporisations**, le retour du contacteur de
l'électrolyseur apparaît désormais dans **Protections générales**, juste après
le retour du contacteur de filtration. Il reste affiché uniquement lorsque le
traitement par électrolyse est sélectionné.

Dans **Protections générales**, **Surveillance pression** est placée juste avant
**Surveillance débit**. L'ancien libellé « Validation après démarrage » devient
« Délai avant contrôle pression » : il indique le temps laissé à la pompe pour
établir la pression avant d'autoriser la détection d'une pression trop basse.
L'emplacement de la sonde d'eau distingue maintenant explicitement la
canalisation, dont la mesure est figée à l'arrêt, du bassin, où la mesure reste
continue. Ce choix est modifiable directement dans la carte **Protections** par
une liste **Canalisation — mesure figée à l'arrêt** / **Bassin — mesure
continue**.

La carte **Affectation des relais** masque de la même façon les relais déjà
attribués. Elle permet maintenant d'affecter l'éclairage et présente les
fonctions dans l'ordre suivant : pompe de filtration, désinfection, pompe pH,
éclairage, chauffage, pompe de remplissage et robot.

Les aides sous les affectations décrivent désormais le capteur, le contact ou
le relais à raccorder. L'entrée de niveau du produit désinfectant apparaît
uniquement avec un traitement liquide par pompe (chlore/brome ou oxygène actif) ;
elle est masquée avec l'électrolyse et lorsque le traitement est désactivé.

Le raccordement des deux sondes de température se choisit maintenant dans
**Piscine > Affectation des sondes**. L'eau et l'air disposent chacun de leur
propre réglage : une entrée Axx disponible reliée à GPIO20 pour l'eau ou GPIO19
pour l'air, le bus Qwiic par un pont DS2484 à l'adresse I²C fixe `0x18`, ou
`Désactivé / non câblé`. Les raccordements peuvent être combinés. Un changement
de raccordement nécessite un redémarrage et ces réglages ne sont plus proposés
dans l'arborescence technique Configuration.

Les sondes pH et ORP ne proposent plus une liste d'entrées analogiques dans
cette carte. Elles utilisent les canaux fixes A1 et A0 de la carte pH/ORP
obligatoire. L'interface permet seulement de choisir son adresse I²C `0x48` ou
`0x49`; le second ADS1115 reçoit automatiquement l'autre adresse afin d'éviter
toute collision sur le bus. Les choix indiquent explicitement « ORP canal A0,
pH canal A1 ». Les entrées logiques pH et ORP sont ramenées à leurs affectations
fixes lors de l'enregistrement de la carte.

La sonde de pression peut, elle, utiliser une entrée Axx disponible ou un canal
A0, A1, A2 ou A3 de l'ADS1115 externe sur Qwiic. Le canal choisi est mesuré par
rapport à la masse commune. L'ADS1115 externe conserve l'autre adresse entre
`0x48` et `0x49`. La liste affiche directement cette adresse disponible et est
actualisée lorsque l'adresse de la carte pH/ORP change.

Le raccordement par défaut de la pression est désormais le canal A0 de cet
ADS1115 externe. Une configuration 3.2.2 ayant encore l'ancien défaut sur le
canal A2 de la carte pH/ORP est migrée une seule fois vers ce second
convertisseur.

La page **Entrées/Sorties** affiche également l'adresse I²C réellement utilisée
pour chacun des deux convertisseurs : « ADS1115 pH/ORP » et « ADS1115 externe ».
Les noms Axx restent des identifiants logiques ; le raccordement physique est
déterminé par l'affectation du canal correspondant.

Les ports physiques de cette page portent maintenant leur désignation `DIx` ou
`CHx`. `CH1` à `CH8` reprend la sérigraphie des sorties relais du Waveshare ;
les anciens noms visibles `EXIO1` à `EXIO8` sont migrés automatiquement sans
modifier les identifiants techniques internes. L'ancien slot logique
`io_chl_gen` est migré vers un relais `CH6`
ordinaire et réellement affectable. La désinfection continue d'utiliser un
seul relais configurable, quel que soit le traitement sélectionné.

Le tableau des affectations fonctionnelles résout désormais les entrées depuis
`poollogic/sensors` et le raccordement réel des sorties depuis
`io/output/d00` à `io/output/d07`. Les changements faits dans `Piscine`
apparaissent donc dans `Entrées/Sorties`, y compris les retours des contacteurs
et le relais CH réellement utilisé. `Configuration` présente ces mêmes
raccordements dans `io/output`. La branche interne `poollogic/devices` est
masquée sur Waveshare afin qu'elle ne fasse pas doublon.

Dans `Piscine > Affectation des relais`, les fonctions gardent leur slot
PoolDevice fixe, donc leur type, leurs dépendances et leurs sécurités. Le choix
porte uniquement sur le relais physique `CH1` à `CH8`. Les listes écartent
les relais déjà affectés et `CH6` est libre par défaut.

Les changements qui reconstruisent un pilote matériel — adresse ADS1115,
canal, source analogique, transport DS2484 ou raccordement physique d'une
entrée ou d'un relais — annoncent puis déclenchent un redémarrage après
enregistrement.

Pour les températures, ce diagnostic distingue maintenant une DS18B20 directe
sur GPIO20 (eau) ou GPIO19 (air) d'une DS18B20 raccordée au pont DS2484 à
l'adresse I²C `0x18`.

La page Rescue suit désormais un parcours unique. Après la connexion au point
d'accès `flow.io-xxxxxx` et un appui de cinq secondes sur BOOT, elle permet de
préparer les accès Web, le Wi-Fi et, si nécessaire, MQTT. Les boutons placés en
fin de page permettent d'annuler les saisies ou d'enregistrer l'ensemble ; ce
n'est qu'après cet enregistrement global que le Waveshare redémarre. La page et
son état de récupération restent consultables sans provoquer de demande
d'identification HTTP en mode point d'accès. Les réglages sensibles restent
inaccessibles tant que la récupération BOOT n'est pas active ou que
l'administrateur n'est pas authentifié.

Le même formulaire permet de conserver Ethernet en DHCP ou de saisir une
configuration IPv4 fixe. Lorsqu'une récupération BOOT est ouverte, le premier
client qui charge explicitement Rescue réserve la fenêtre de cinq minutes à son
adresse IP. Les autres appareils du réseau restent soumis à l'authentification
administrateur. La réservation est supprimée à l'expiration, à la prochaine
activation de BOOT ou lors de l'enregistrement final.

Après chaque flash du firmware par PlatformIO, un script écoute brièvement le
port USB et enregistre le SSID ainsi que le mot de passe Rescue déjà conservé
par la carte dans `local-device/rescue-access.txt`. Ce fichier en clair reste
local et son dossier est exclu de Git.

Le bus Qwiic utilise maintenant réellement la fréquence de `400 kHz` déclarée
par le profil Waveshare. Auparavant, ses broches provenaient bien du profil,
mais l'initialisation conservait implicitement la valeur par défaut de
`100 kHz`.

## Compatibilité et mise à jour

La configuration existante reste compatible avec la version 3.2.1. Les nouvelles
clés persistantes conservent des valeurs par défaut compatibles avec le câblage
historique, dont `pl_shwat` pour l'emplacement de la sonde de température et
`pl_slgt` pour le relais d'éclairage.

Cette version modifie à la fois le firmware et l'interface Web. Une mise à jour
complète nécessite donc de flasher :

1. `binary/flowios3-3.2.2.bin` ;
2. `binary/flowios3-spiffs-3.2.2.bin`.

Le flash de la SPIFFS remplace ses fichiers, dont le journal d'activité
`/activity.log`. Les paramètres enregistrés en NVS ne sont pas effacés.

## Validation réalisée

- compilation complète de l'environnement PlatformIO `Waveshare-ESP32-S3` ;
- génération de l'image SPIFFS et du manifeste de livraison ;
- flash du firmware et de la SPIFFS sur la carte Waveshare réelle ;
- redémarrage contrôlé sur le port série : SPIFFS montée, serveur Web démarré,
  Wi-Fi et MQTT initialisés ;
- validation syntaxique du JavaScript de la page Piscine ;
- validation syntaxique du JavaScript de la page Rescue intégrée au firmware ;
- validation des fichiers JSON de traduction et de documentation ;
- contrôle des différences Git sans erreur d'espacement.

Le comportement des mesures figées et du recalcul après 90 secondes reste à
observer lors d'un cycle réel d'arrêt et de redémarrage de la filtration.
