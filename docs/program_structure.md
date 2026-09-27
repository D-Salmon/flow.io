# Structure du programme Waveshare

Cette carte décrit les composants réellement utilisés par le profil
`Waveshare-ESP32-S3`. Les profils matériels historiques ne sont pas des cibles
de compilation de cette branche.

```mermaid
flowchart TB
  subgraph HW["Carte Waveshare ESP32-S3-POE-ETH-8DI-8RO"]
    ETH["Ethernet W5500"]
    WIFI["Wi-Fi"]
    DIN["8 entrées numériques"]
    RELAY["8 relais CH1–CH8"]
    I2C["I²C / ADS1115 / DS2484"]
    TFT["TFT local"]
    UART["Nextion UART optionnel"]
  end

  subgraph APP["Firmware — WaveshareProfile"]
    BOOT["Bootstrap / ModuleManager"]
    CONFIG["ConfigStore / NVS"]
    DATA["DataStore"]
    EVENTS["EventBus"]
    IO["IOModule"]
    LOGIC["PoolLogicModule"]
    DEVICE["PoolDeviceModule"]
    ALARM["AlarmModule"]
    WEB["WebInterfaceModule / SPIFFS"]
    MQTT["MQTTModule / HAModule"]
    HISTORY["PoolHistoryModule"]
  end

  ETH --> BOOT
  WIFI --> BOOT
  DIN <--> IO
  RELAY <--> IO
  I2C <--> IO
  TFT <--> APP
  UART <--> APP
  BOOT --> CONFIG
  IO <--> DATA
  LOGIC <--> DATA
  DEVICE <--> IO
  LOGIC --> DEVICE
  LOGIC --> ALARM
  APP <--> EVENTS
  WEB <--> APP
  MQTT <--> APP
  HISTORY <--> EVENTS
```

## Source de vérité du profil

- Environnement PlatformIO : `[env:Waveshare-ESP32-S3]` dans
  `platformio.ini`.
- Point d’entrée : `src/main.cpp` puis `src/App/Bootstrap.cpp`.
- Profil : `src/Profiles/Waveshare/`.
- Broches et capacités : `src/Board/WaveshareBoard.h`.
- Assemblage des entrées/sorties :
  `src/Profiles/Waveshare/WaveshareIoAssembly.cpp`.
- Ressources Web servies depuis SPIFFS : `data/webinterface/`.

L’ordre de démarrage et les dépendances effectives sont dans
`WaveshareBootstrap.cpp`. La présence d’un fichier sous `src/Modules/` ne
signifie pas à elle seule qu’un module est enregistré : vérifier cet assemblage
avant de le déclarer actif ou de le supprimer.
