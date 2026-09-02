# Suppression dans le journal d’activité

- Une case permet de sélectionner un événement ; le bouton de sélection globale
  ne sélectionne que les événements affichés (période et filtre courants).
- Changer de période ou de filtre efface la sélection pour éviter de supprimer
  accidentellement des événements masqués.
- « Supprimer la sélection » et « Vider tout le journal » demandent confirmation.
  La seconde commande concerne tout l’historique, pas seulement la vue affichée.
- Les événements émis après l’acceptation de la commande « tout » sont conservés.

Les POST `/api/activity/delete` (paramètre formulaire `ids`, identifiants séparés
par des virgules, maximum 768) et `/api/activity/purge` exigent l’administrateur
et passent par le contrôle CSRF commun. Ils répondent 202 avec `delete_id`.
L’interface interroge `/api/activity/status` : `delete_state` vaut 1 pendant le
traitement, 2 à sa réussite et 3 en cas d’échec, éventuellement partiel.
Un délai dépassé ou une réponse perdue n’est jamais annoncé comme une réussite.
Les POST destructifs ne sont pas automatiquement rejoués en cas d’erreur réseau.

La tâche du journal est l’unique rédactrice du SPIFFS. Elle vide d’abord les
événements en attente puis écrit des marqueurs de suppression internes
(`code=65535`, `seq` identifie l’événement, `state=1` signifie jusqu’à ce numéro).
Chaque marqueur est persisté avant de retirer les événements de la mémoire.
La relecture au démarrage applique ces marqueurs dans l’ordre. Le numéro de
séquence n’est pas remis à zéro après une suppression. Ces marqueurs ne sont
pas affichés comme des événements. Il s’agit d’une suppression logique
persistante, pas d’un effacement sécurisé des octets en flash.

La rotation habituelle des fichiers continue de limiter la rétention ; les
marqueurs restent après les événements auxquels ils se rapportent. Un retour
à un ancien firmware qui ne comprend pas ces marqueurs peut réafficher des
événements supprimés. Sauvegarder le journal avant tout changement de firmware.

Validation locale : `node scripts/test_activity_page.cjs`, compilation PlatformIO
et vérification des assets. À valider sur matériel avec autorisation : suppression
d’un événement de test, sélection multiple, redémarrage et vérification de leur
absence, ainsi que conservation des événements non sélectionnés. Ne pas purger
les traces utiles au diagnostic `task_wdt` sans sauvegarde et accord explicite.
