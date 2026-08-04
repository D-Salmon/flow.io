# Flow.io Kiosk pour Raspberry Pi 3B+

Ce paquet transforme une installation **Raspberry Pi OS Lite 32 bits
(Bookworm)** en écran tactile Flow.io dédié. Chromium démarre automatiquement
en plein écran sur `http://flowio.local`. Dans l'onglet **Mises à Jour**, le
mode kiosque ajoute un bouton **Arrêter l'écran** pour éteindre proprement le
Raspberry Pi avant de couper son alimentation.

## Préparer la carte microSD

1. Flasher Raspberry Pi OS Lite 32 bits avec Raspberry Pi Imager.
2. Dans les options d'Imager, configurer le Wi-Fi, le pays `FR`, le clavier
   français et activer SSH si nécessaire.
3. Démarrer le Raspberry Pi avec un écran HDMI et, le cas échéant, son câble
   tactile USB.

## Installer

Copier tout le dossier `flowio-rpi3-kiosk` sur le Raspberry Pi, puis lancer :

```sh
cd flowio-rpi3-kiosk
chmod +x *.sh
sudo ./install.sh
sudo reboot
```

Une connexion Internet est nécessaire pendant l'installation des paquets.

## Configuration

Avant l'installation, modifier `config.env` si l'adresse Flow.io n'est pas
`http://flowio.local`. Après installation, le fichier actif est :

```text
/etc/flowio-kiosk/config.env
```

Après une modification :

```sh
sudo systemctl restart flowio-kiosk
```

`DISPLAY_IDLE_SECONDS=300` met l'écran en veille après cinq minutes. Une
interaction tactile ou souris le réveille.

## Arrêter proprement l'écran

Le bouton **Arrêter l'écran** n'apparaît que dans Chromium lancé par ce paquet.
Il ouvre la commande locale `http://127.0.0.1:8765`, inaccessible depuis le
réseau. Maintenir le bouton de confirmation pendant trois secondes déclenche
un `systemctl poweroff`.

Attendre l'extinction complète de l'écran et de l'activité de la carte microSD
avant de couper l'alimentation. Le Waveshare continue à fonctionner lorsque le
Raspberry Pi est éteint ou débranché.

Le service d'arrêt :

- écoute uniquement sur l'interface locale `127.0.0.1` ;
- exige une confirmation maintenue pendant trois secondes ;
- protège la requête d'arrêt par un jeton CSRF généré au démarrage ;
- n'expose aucune commande générale ni aucun terminal.

## Diagnostic

```sh
sudo /usr/local/lib/flowio-kiosk/diagnostic.sh
```

Pour suivre les journaux en direct :

```sh
sudo journalctl -fu flowio-kiosk
```

## Désinstaller

Depuis le dossier copié :

```sh
sudo ./uninstall.sh
sudo reboot
```

## Contenu installé

- service systemd : `/etc/systemd/system/flowio-kiosk.service`
- commande locale d'arrêt :
  `/etc/systemd/system/flowio-kiosk-shutdown.service`
- configuration : `/etc/flowio-kiosk/config.env`
- scripts : `/usr/local/lib/flowio-kiosk/`
- utilisateur non privilégié : `flowio-kiosk`
