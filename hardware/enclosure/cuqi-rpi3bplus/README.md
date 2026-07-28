# Boîtier CUQI 7 pouces avec Raspberry Pi 3B+

## Architecture retenue

Le boîtier est un ensemble monobloc en trois éléments :

1. la façade CUQI d'origine (`7i-front.stl`) ;
2. un dos profond qui remplace entièrement `7i-back.stl` et porte le Raspberry Pi ;
3. une trappe arrière ventilée et démontable.

Le Raspberry Pi est orienté verticalement. Les prises Ethernet et USB sortent
vers le bas. Le passage latéral est réservé aux liaisons courtes HDMI, tactile
et alimentation.

La profondeur est calculée au plus juste pour un Raspberry Pi 3B+ sans
accessoire dépassant au-dessus des connecteurs. Employer des câbles HDMI et USB
courts ou coudés. Un dissipateur bas reste possible, mais un grand dissipateur
ou un ventilateur nécessiterait de réaugmenter la profondeur.

## Encombrement estimé

- Largeur : 172,6 mm
- Hauteur : 130,6 mm
- Profondeur totale : environ 50 mm
- Parois ajoutées : 2,4 mm

## Fichiers

- `cuqi_rpi3bplus_integrated.scad` : source paramétrique retenue
- `cuqi-rpi3bplus-integrated-back.stl` : dos profond avec supports du Pi
- `cuqi-rpi3bplus-rear-lid.stl` : trappe arrière
- `cuqi-rpi3bplus-integrated-open.png` : aperçu éclaté

## État

Les volumes STL sont exportables et les entraxes du Raspberry Pi 3B+ sont
intégrés. Le modèle reste un prototype tant que les passages des câbles et les
dégagements des connecteurs n'ont pas été contrôlés avec l'écran physique.

Matériel prévu :

- 4 vis et inserts M3 pour l'assemblage CUQI existant ;
- 4 inserts laiton thermiques M2,5 de 4 mm environ ;
- 4 vis M2,5 x 6 mm pour le Raspberry Pi ;
- 4 inserts M3 et 4 vis M3 courtes pour la trappe arrière.

Le Pi se pose sur les quatre entretoises du dos intégré. Les inserts M2,5 sont
posés à chaud dans les logements, depuis l'arrière ouvert, avant la mise en
place de la carte. Les quatre vis traversent ensuite la carte et se vissent
dans les inserts. Ajouter quatre rondelles nylon est recommandé pour ne pas
marquer le circuit imprimé.

## Fixation sur un panneau

La trappe arrière comporte deux lumières renforcées en trou de serrure,
espacées de 109 mm. Elles sont prévues pour des vis de panneau dont la tête ne
dépasse pas 8 mm environ et dont la tige mesure 4 mm au maximum.

Laisser dépasser les têtes de vis de 3 à 4 mm, engager les deux grandes
ouvertures, puis faire descendre le boîtier de 10 mm. Pour déposer l'ensemble,
le soulever de 10 mm puis le tirer vers soi. Deux petites butées en caoutchouc
autocollantes en partie basse éviteront les vibrations et les marques sur le
panneau.
