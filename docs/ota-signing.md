# Signature des mises a jour OTA

La mise a jour distante du firmware Waveshare utilise une signature ECDSA
P-256 sur le SHA-256 exact du fichier `.bin`. Le serveur doit publier la
signature Base64 dans un fichier portant le meme nom suivi de `.sig`.

Le firmware telecharge d'abord cette signature, calcule le SHA-256 pendant
l'ecriture dans la partition OTA inactive, puis verifie la signature avant
d'activer la partition. Une image non signee ou signee avec une autre cle est
abandonnee.

## 1. Creer les cles hors du depot

Sur une machine de livraison protegee :

```sh
openssl ecparam -name prime256v1 -genkey -noout -out flowio-ota-private.pem
openssl ec -in flowio-ota-private.pem -pubout -out flowio-ota-public.pem
```

La cle privee ne doit jamais etre copiee dans ce depot, dans le firmware ou sur
l'appareil. La conserver dans un coffre CI, un HSM ou un support hors ligne.

## 2. Provisionner la cle publique

Copier le PEM public dans `include/Security/OtaPublicKey.h`, sous forme de chaine
multi-ligne C++. Tant que cette valeur est vide, l'OTA signee echoue de maniere
fermee avec `Cle publique OTA non provisionnee`.

## 3. Signer un artefact

```sh
python scripts/sign_ota.py binary/flowios3-3.1.0.bin \
  --private-key /chemin/protege/flowio-ota-private.pem
```

Le script produit `flowios3-3.1.0.bin.sig`, qui contient la signature DER
encodee en Base64. Publier les deux fichiers cote a cote :

```text
flowios3-3.1.0.bin
flowios3-3.1.0.bin.sig
```

## 4. Installer

Dans l'interface Web, charger le manifeste puis selectionner le firmware. Le
Waveshare derive automatiquement l'URL de la signature en ajoutant `.sig` a
l'URL du binaire. Le CSRF, le SHA-256 et la signature ECDSA sont verifies.

## Limites actuelles

- La mise a jour distante du firmware Waveshare echoue de maniere fermee tant
  que la cle publique n'est pas provisionnee ou que le fichier `.sig` manque.
- Les mises a jour distantes SPIFFS et Nextion sont refusees en mode signe :
  leurs partitions ne permettent pas encore une validation sure avant
  ecriture. Elles restent disponibles uniquement dans une compilation de
  developpement avec `FLOW_ALLOW_UNSIGNED_UPDATES=1`.
- Le transport HTTP actuel ne garantit pas la confidentialite. La signature
  protege l'authenticite et l'integrite du firmware, pas les metadonnees ni
  l'URL.
- La protection anti-retour de version et Secure Boot/eFuses restent a ajouter.
