# IOModule (`moduleId: io`)

`IOModule` gère les entrées et sorties du profil Waveshare. Le profil actif et
son câblage sont assemblés dans `src/Profiles/Waveshare/` et décrits dans
[`schema-raccordement-waveshare.md`](../integration/schema-raccordement-waveshare.md).

## Capacités utilisées

- huit entrées numériques et huit sorties relais du contrôleur Waveshare ;
- entrées analogiques de la carte et convertisseurs ADS1115 ;
- sondes DS18B20 raccordées directement ou via le pont Qwiic DS2484 ;
- pilotes optionnels pour les capteurs présents dans le code et configurés dans
  l’interface.

Les capteurs facultatifs n’ont pas à être raccordés pour que le contrôleur
fonctionne. Les alarmes et interverrouillages associés ne s’appliquent que
lorsque la surveillance correspondante est activée dans les réglages.

## Affectations et états

Les sondes et contacts se configurent dans **Piscine → Affectation des sondes**.
Les sorties fonctionnelles sont affectées aux relais `CH1` à `CH8` dans
**Piscine → Affectation des relais**. Les affectations configurées dans
l’appareil sont visibles dans **Entrées/Sorties**. La configuration courante
est la source de vérité : ne pas déduire une fonction d’un numéro de slot ou
d’un ancien tableau de câblage.

Dans la branche 3.4.1, les affectations de relais sont modifiables. Choisir un
relais déjà affecté échange les deux fonctions dans le formulaire ; la
configuration enregistrée ne peut pas assigner le même relais à deux fonctions.
Voir le [README principal](../../README.md#affecter-librement-les-relais).

## Code de référence

- Profil et périphériques : `src/Profiles/Waveshare/WaveshareIoAssembly.cpp` ;
- capacités et broches de la carte : `src/Board/WaveshareBoard.h` ;
- acquisition, lecture et écriture : `src/Modules/IOModule/` ;
- textes et schéma de configuration : `src/Modules/IOModule/text/`.

Les anciens tableaux qui nomment le profil `FlowIO`, fixent des relais par
fonction ou décrivent un autre circuit de ports ne s’appliquent pas à cette
branche.
