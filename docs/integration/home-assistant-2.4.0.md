# Tableau de bord Home Assistant — branche 2.4.0

Cette intégration remplace le tableau de bord historique `PoolMaster` par une
version alignée sur les entités MQTT Discovery du profil `FlowIOS3`.

Fichiers :

- `home_assistant_dashboard_2.4.0.yaml` : carte Lovelace complète ;
- `home_assistant_package_2.4.0.yaml` : helpers de navigation et décodage des
  alarmes.

## Périmètre de compatibilité

Le tableau de bord couvre :

- pH, ORP, pression et températures ;
- filtration, robot, éclairage, chauffage, remplissage et pompes de dosage ;
- modes automatiques, hivernage et désinfection ;
- consignes, fenêtres PID, débits et durées maximales ;
- consommations journalières et volumes restants des bidons ;
- alarmes de pression, niveaux et durées maximales ;
- diagnostic de mémoire et durée de fonctionnement.

Les fonctions historiques suivantes ne sont pas reprises :

- les interrupteurs séparés `ph_pid` et `orp_pid` : la 2.4.0 utilise
  `pl_ph_auto` et `pl_orp_auto` ;
- le relais générique `Aux` : les huit relais ont maintenant un rôle défini ;
- `publish_settings` : les modifications envoyées par les entités Discovery
  sont persistées directement ;
- les remises à zéro de calibration : elles ne sont pas exposées comme boutons
  Home Assistant et restent à réaliser dans l’interface de configuration ;
- les deux anciens boutons de redémarrage `PoolMaster` et `Supervisor` : cette
  édition autonome n’utilise plus cette séparation. Le redémarrage reste
  disponible depuis l’interface Web.

Le bouton `button.fio_alm_reset_all` n’efface pas une condition encore active.
Il acquitte uniquement les alarmes mémorisées dont la condition a disparu.

## Identifiants d’entités

Les fichiers utilisent le préfixe Discovery par défaut :

```text
ha/entity_prefix = fio
```

Exemples :

```text
sensor.fio_io_ph
switch.fio_io_flt_pmp
number.fio_pl_psi_high
button.fio_alm_reset_all
```

Si `ha/entity_prefix` a été personnalisé ou si les entités ont été renommées
dans Home Assistant, remplacer `fio_` dans les deux fichiers par le préfixe
réel. Home Assistant peut conserver un ancien `entity_id` dans son registre
même après une nouvelle publication Discovery ; vérifier les identifiants dans
`Outils de développement > États`.

## Installation du package

Dans `configuration.yaml`, activer les packages si ce n’est pas déjà fait :

```yaml
homeassistant:
  packages: !include_dir_named packages
```

Copier ensuite `home_assistant_package_2.4.0.yaml` dans le dossier
`config/packages/` de Home Assistant, puis :

1. vérifier la configuration ;
2. redémarrer Home Assistant ;
3. confirmer la présence de `binary_sensor.flowio_pressure_alarm` et
   `input_boolean.flowio_admin_mode`.

Le package décode `sensor.fio_alm_pack`. Le format firmware affecte cinq bits
par emplacement d’alarme :

| Emplacement | Alarme utilisée par le tableau |
|---:|---|
| 0 | pression basse |
| 1 | pression haute |
| 2 | niveau bidon pH |
| 3 | niveau bidon chlore |
| 4 | durée maximale pompe pH |
| 5 | durée maximale pompe chlore |
| 6 | niveau d’eau bas |

Cette correspondance dépend de l’ordre d’enregistrement des alarmes dans le
firmware 2.4.0. Elle doit être revue si cet ordre change.

## Installation du tableau de bord

Installer avec HACS :

- Mushroom ;
- Mini Graph Card ;
- card-mod.

Dans un tableau de bord Home Assistant :

1. choisir `Modifier le tableau de bord` ;
2. ajouter une carte manuelle ;
3. coller le contenu de `home_assistant_dashboard_2.4.0.yaml` ;
4. enregistrer.

## Correspondances principales avec l’ancien tableau

| Ancienne entité | Entité 2.4.0 |
|---|---|
| `sensor.poolmaster_ph_sensor` | `sensor.fio_io_ph` |
| `sensor.poolmaster_orp_redox_sensor` | `sensor.fio_io_orp` |
| `sensor.poolmaster_pump_pressure` | `sensor.fio_io_psi` |
| `sensor.poolmaster_water_temperature` | `sensor.fio_io_wat_tmp` |
| `sensor.poolmaster_air_temperature` | `sensor.fio_io_air_tmp` |
| `switch.poolmaster_filtration` | `switch.fio_io_flt_pmp` |
| `switch.poolmaster_filtration_mode_auto_manual` | `switch.fio_pl_auto` |
| `switch.poolmaster_ph_auto_mode` | `switch.fio_pl_ph_auto` |
| `switch.poolmaster_orp_auto_mode` | `switch.fio_pl_orp_auto` |
| `number.poolmaster_ph_pump_flow_rate_l_s` | `number.fio_pd1_flow` |
| `number.poolmaster_chl_pump_flow_rate_l_s` | `number.fio_pd2_flow` |
| `number.poolmaster_psi_low_threshold` | `number.fio_pl_psi_low` |
| `number.poolmaster_psi_high_threshold` | `number.fio_pl_psi_high` |

Les entités `pd1_flow` et `pd2_flow` sont exprimées en litres par heure malgré
le suffixe historique `_l_s` présent dans l’ancien tableau.
