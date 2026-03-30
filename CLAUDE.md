# ha-zeekr-eu

Custom Component für Home Assistant: Domain `zeekr_eu`
API eingebettet als `api/` Unterordner (basiert auf zeekr_ev_api v0.1.12, MIT Lizenz).

## Deploy
```bash
cd /Volumes/Daten/ClaudeCode/ha-zeekr-eu/custom_components
tar czf - zeekr_eu | ssh has 'cd /homeassistant/custom_components && sudo tar xzf -'
```
Danach HA neustarten (User macht das selbst).

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
