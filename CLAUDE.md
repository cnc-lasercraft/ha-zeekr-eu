# ha-zeekr-eu

Custom Component für Home Assistant: Domain `zeekr_eu`
API eingebettet als `api/` Unterordner (basiert auf zeekr_ev_api v0.1.12, MIT Lizenz).

## Deploy
```bash
cd /Volumes/Daten/ClaudeCode/ha-zeekr-eu/custom_components
tar czf - --exclude='._*' zeekr_eu | ssh has 'cd /homeassistant/custom_components && sudo tar xzf -'
```
`--exclude='._*'` ist nötig, sonst landen macOS-AppleDouble-Dateien auf dem HA.
Danach HA neustarten (User macht das selbst).

Die Lovelace-Card liegt in `custom_components/zeekr_eu/frontend/` und wird von der
Integration selbst registriert (`/zeekr_eu/zeekr-vehicle-card.js?v=<VERSION>`) — kein
`www/`, keine Lovelace-Ressource, kein Ressourcen-Bump. Cache-Busting läuft über
`const.VERSION`, die mit `manifest.json` synchron bleiben muss.

## HA Logs
```bash
ssh has 'sudo docker logs homeassistant --since 5m 2>&1' | grep -i zeekr
```

## SSH-Zugang
```
ssh has
```
- Docker braucht `sudo`
- scp funktioniert nicht, tar über SSH verwenden

## Credentials
Gesichert in `.zeekr_credentials.json` (gitignored).

## Verwandte Projekte
- **../zeekr_analysis/** — Reverse Engineering der Zeekr App
- **../zeekr_ev/** — Altes Projekt (veraltet)

## Wichtig
- Nicht hetzen, jede Änderung verifizieren
- HA-Neustarts dem User überlassen
