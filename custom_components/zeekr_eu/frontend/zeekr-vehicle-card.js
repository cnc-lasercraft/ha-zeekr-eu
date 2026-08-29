/**
 * Zeekr Vehicle Card - Custom Lovelace Card for Home Assistant
 * Pure vanilla JS + Shadow DOM (no Lit, no imports, no external dependencies)
 *
 * Entity IDs are discovered from the zeekr_eu integration's registry entries,
 * so the card works on any install without naming its entities.
 *
 * Usage:
 *   type: custom:zeekr-vehicle-card
 *
 * Optional:
 *   device_id: <vehicle>              # only needed with more than one car
 *   wallbox_power_entity: sensor.x    # power fallback while AC charging
 *   entities: { battery_level: ... }  # pin individual entities by hand
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CARD_VERSION = "3.0.0";
const CARD_NAME = "zeekr-vehicle-card";

// The car illustration, inlined so the card is a single self-contained file
// with no second asset to deploy. Kept as an <img> src so the layout that the
// left column depends on is bit-for-bit what it was as a /local/ URL.
const VEHICLE_SVG = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDI4LjMuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkViZW5lXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9Ii0xOTEuNTUgMTkxLjU1IDY4NC43MyAzMDEuNjQiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgLTE5MS41NSAxOTEuNTUgNjg0LjczIDMwMS42NDsiIHhtbDpzcGFjZT0icHJlc2VydmUiPgo8c3R5bGUgdHlwZT0idGV4dC9jc3MiPgoJLnN0MHtmaWxsOiNGRkZGRkY7c3Ryb2tlOiMxMjEwMEU7c3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO30KCS5zdDF7ZmlsbDojODA4MTgxO3N0cm9rZTojMTIxMDBFO3N0cm9rZS13aWR0aDowLjU7c3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO30KCS5zdDJ7ZmlsbDojM0QzRDNCO3N0cm9rZTojMTIxMDBFO3N0cm9rZS13aWR0aDowLjU7c3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO30KCS5zdDN7ZmlsbDojREFEQURBO3N0cm9rZTojMTIxMDBFO3N0cm9rZS13aWR0aDowLjU7c3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO30KCS5zdDR7ZmlsbDpub25lO3N0cm9rZTojMTIxMDBFO3N0cm9rZS13aWR0aDowLjU7c3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO30KPC9zdHlsZT4KPGcgdHJhbnNmb3JtPSJyb3RhdGUoOTAsIDE1MC44MiwgMzQyLjM3KSI+CjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xNy4xNCw0OTguN2wxLjItMjg2LjNjLTYuMDYtMjcuNzItNC4xNy04Mi40NCwzLjY2LTEyMS41YzEuOTgtOS42MywzLjQ0LTE5LjM1LDUuMjItMjcuNTQKCWMyLjkyLTE0LjA0LDguNjItMjYuOTgsMjAuMTYtMzguMzdjMi40OS0yLjQ2LDUuMy00LjU2LDguMzYtNi4yNEM3OS44Niw1LjUxLDExMi42NSwwLjI3LDE1MC44MiwwCgljMzguMTcsMC4yNyw3MC45Niw1LjUxLDk1LjA4LDE4Ljc1YzMuMDYsMS42OCw1Ljg3LDMuNzgsOC4zNiw2LjI0YzExLjU0LDExLjM5LDE3LjI0LDI0LjMzLDIwLjE2LDM4LjM3CgljMS43OCw4LjE5LDMuMjQsMTcuOTEsNS4yMiwyNy41NGM3LjgzLDM5LjA2LDkuNzIsOTMuNzgsMy42NiwxMjEuNWwxLjIsMjg2LjNjMCwwLjQxLDAuMTIsMC44LDAuMzUsMS4xMmwyLjE3LDMuMDgKCWMwLjI4LDAuNCwwLjMzLDAuOTIsMC4xMywxLjM3bC0xLjk0LDQuNDhjLTAuMTEsMC4yNS0wLjE3LDAuNTItMC4xNywwLjc5bDAuMzYsNjkuMTZjMC4yLDIzLjg0LTIuNDUsNDIuMDMtOC4wNiw1NC4zMgoJYy0wLjY2LDEuNDItMS4yNCwyLjg4LTEuNzcsNC4zNWMtMi4wOCw1LjY4LTUuNTMsMTEuMjQtOS44MSwxNi43MmMtMC41OCwwLjc0LTEuMjUsMS40LTIsMS45NwoJYy0yOC42LDIxLjYyLTY3Ljg3LDI5LjAxLTExMi45NCwyOC42NmMtNDUuMDcsMC4zNS04NC4zNC03LjA0LTExMi45NC0yOC42NmMtMC43NS0wLjU3LTEuNDItMS4yMy0yLTEuOTcKCWMtNC4yOC01LjQ4LTcuNzMtMTEuMDQtOS44MS0xNi43MmMtMC41My0xLjQ3LTEuMTEtMi45My0xLjc3LTQuMzVjLTUuNjEtMTIuMjktOC4yNi0zMC40OC04LjA2LTU0LjMybDAuMzYtNjkuMTYKCWMwLTAuMjctMC4wNi0wLjU0LTAuMTctMC43OWwtMS45NC00LjQ4Yy0wLjItMC40NS0wLjE1LTAuOTcsMC4xMy0xLjM3bDIuMTctMy4wOEMxNy4wMiw0OTkuNSwxNy4xNCw0OTkuMTEsMTcuMTQsNDk4LjdMMTcuMTQsNDk4LjcKCXoiLz4KPHBhdGggY2xhc3M9InN0MSIgZD0iTTM0LjQyLDI5OC45OGMwLjgzLTQ1Ljg1LDIuNjEtODguOTgsNS44NS0xMjguMDRsLTAuODMtMC4wM2wxMC4wMi02MS4xOWMwLjA0LTAuMjksMC4xNS0wLjU3LDAuMzItMC44MgoJYzAuMzgtMC41NiwwLjQ0LTEuMjcsMC4yLTEuOTFjLTIuNzMtNy4xNC0zLjYyLTE0Ljg4LTAuODUtMjMuODJjMC4yLTAuNjcsMC40LTEuMzQsMC41Ny0yLjAxYzEuNTItNS45MSw0LjczLTE0LjgyLDcuODItMjMuNzQKCWwwLjUzLDAuNzdjMi4wNy00LjM1LDQuODgtOC4yOCw4LjA1LTEyLjAyYzE2LTE2LjQyLDQ2LjgyLTIxLjk2LDg0LjcyLTIyLjMyYzM3LjksMC4zNiw2OC43Miw1LjksODQuNzIsMjIuMzIKCWMzLjE3LDMuNzQsNS45OCw3LjY3LDguMDYsMTIuMDJsMC41Mi0wLjc3YzMuMDksOC45Miw2LjMsMTcuODMsNy44MiwyMy43NGMwLjE3LDAuNjcsMC4zNywxLjM0LDAuNTcsMi4wMQoJYzIuNzcsOC45NCwxLjg4LDE2LjY4LTAuODUsMjMuODJjLTAuMjQsMC42NC0wLjE4LDEuMzUsMC4yLDEuOTFjMC4xNywwLjI1LDAuMjgsMC41MywwLjMyLDAuODJsMTAuMDIsNjEuMTlsLTAuODMsMC4wMwoJYzMuMjQsMzkuMDYsNS4wMiw4Mi4xOSw1Ljg1LDEyOC4wNGwxLjIsMTg1LjU4Yy0xLjA4LDExLjM0LTUuMzIsMjEuNDItMTIuNDksMzAuMzFjLTEsMS4yNC0yLjIxLDIuMjgtMy41OSwzLjA2CgljLTIxLjY1LDEyLjI1LTYxLjUyLDE4LjEzLTEwMS41MiwxOS42NGMtNDAtMS41MS03OS44Ny03LjM5LTEwMS41Mi0xOS42NGMtMS4zOC0wLjc4LTIuNTktMS44Mi0zLjU5LTMuMDYKCWMtNy4xNy04Ljg5LTExLjQxLTE4Ljk3LTEyLjQ5LTMwLjMxTDM0LjQyLDI5OC45OEwzNC40MiwyOTguOTh6Ii8+CjxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0yMC44Niw1OTguOTJjMTAuNDQsNDMuMzIsMjYuODgsNTIuOTIsNDcuMTYsNjQuMzJjMTkuNDQsMTAuMDgsNTIuMTgsMTQuMzEsODIuOCwxNC41NQoJYzMwLjYyLTAuMjQsNjMuMzYtNC40Nyw4Mi44LTE0LjU1YzIwLjI4LTExLjQsMzYuNzItMjEsNDcuMTYtNjQuMzJjLTAuNzUsMTguNTUtNS4xNSwzNC40LTExLjg1LDQzLjgKCWMtMC43LDAuOTktMS4yNCwxLjg1LTEuODUsMi43MmMtMTguNDMsMjYuMTUtNjAuODYsMzcuMzMtMTE2LjI2LDM2Ljc2Yy01NS40LDAuNTctOTcuODMtMTAuNjEtMTE2LjI2LTM2Ljc2CgljLTAuNjEtMC44Ny0xLjE1LTEuNzMtMS44NS0yLjcyQzI2LjAxLDYzMy4zMiwyMS42MSw2MTcuNDcsMjAuODYsNTk4LjkyeiIvPgo8cGF0aCBjbGFzcz0ic3QyIiBkPSJNMTguMDksMTE1LjRjMC4yNCwzMi4wNywwLjA1LDYyLjg3LTAuNzIsOTEuOTNDMTMuNTMsMTg0LjQ0LDE0LjA1LDE0Ny44OSwxOC4wOSwxMTUuNHoiLz4KPHBhdGggY2xhc3M9InN0MiIgZD0iTTI4My41NSwxMTUuNGM0LjA0LDMyLjQ5LDQuNTYsNjkuMDQsMC43Miw5MS45M0MyODMuNSwxNzguMjcsMjgzLjMxLDE0Ny40NywyODMuNTUsMTE1LjR6Ii8+CjxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik0zMC41NSw1MS40MWMzLjQtOS40OCw4LjY1LTE4LjM0LDE2LjgzLTI2LjQyYzIuNDktMi40Niw1LjMtNC41Niw4LjM2LTYuMjRDNzkuODYsNS41MSwxMTIuNjUsMC4yNywxNTAuODIsMAoJYzM4LjE3LDAuMjcsNzAuOTYsNS41MSw5NS4wOCwxOC43NWMzLjA2LDEuNjgsNS44NywzLjc4LDguMzYsNi4yNGM4LjE4LDguMDgsMTMuNDMsMTYuOTQsMTYuODMsMjYuNDIKCWMtNy4wMy0xMC45My0xNC44Mi0yMC4yMi0yMy43MS0yNy4xMmMtMi4zNy0xLjg0LTQuOTMtMy40My03LjYzLTQuNzdDMjEyLjAyLDUuNzEsMTgyLjE5LDAuOTMsMTUwLjgyLDIuNzkKCWMtMzEuMzctMS44Ni02MS4yLDIuOTItODguOTMsMTYuNzNjLTIuNywxLjM0LTUuMjYsMi45My03LjYzLDQuNzdDNDUuMzcsMzEuMTksMzcuNTgsNDAuNDgsMzAuNTUsNTEuNDF6Ii8+CjxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0yNjYuODksNDUwLjI2aC0zLjYxYy03Ljk5LTM2LjgzLTE1LjEtNzEuMzEtMTcuOS0xMDMuNzZjLTAuNTEtNy4xOC0wLjk0LTE0LjY1LTEuMjktMjIuMzdsMjEuNDUsMTAuNzIKCUwyNjYuODksNDUwLjI2eiIvPgo8cGF0aCBjbGFzcz0ic3QzIiBkPSJNMjQ1LjE1LDE4Ny45MmgwLjAxYzUuODEtMS41MSwxMS4yLTIuODIsMTUuMjgtMy41MWMwLjAyLDAuMjEsMC4wNCwwLjQyLDAuMDYsMC42MwoJYzEuODUsMTcuNjMsMy4wMiw1My4yNyw0LjIsODguOGwwLjUsMzYuMjlsLTIxLjg1LTYuMTdDMjQyLjMxLDI2Ny4wMywyNDIuODgsMjI2LjI5LDI0NS4xNSwxODcuOTJMMjQ1LjE1LDE4Ny45MnoiLz4KPHBhdGggY2xhc3M9InN0MyIgZD0iTTgyLjU5LDExNC4wMmMxNi4zNywxLjA2LDQyLDEuNTMsNjguMjMsMS45YzI1Ljk0LTAuMzcsNTEuODEtMC44Niw2OC4yMy0xLjkKCWMxLjA5LDg0LjQ1LDQuMTQsMTcyLjUyLDguNjEsMjYzLjI0Yy0yMiwyLjI4LTQ4LjUyLDMuMDMtNzYuODQsMy4xN2MtMjguMzItMC4xNC01NC44NC0wLjg5LTc2Ljg0LTMuMTcKCUM3OC40NSwyODYuNTQsODEuNSwxOTguNDcsODIuNTksMTE0LjAyeiIvPgo8cGF0aCBjbGFzcz0ic3QzIiBkPSJNMTUwLjgyLDQwNi4wOGMyOS42Ni0wLjEyLDU4LjE0LTIuMTgsODUuMTctNi42MWMtMC4xNCwwLjI2LTAuMTgsMC41OS0wLjA5LDAuOTUKCWM4Ljk3LDMwLjQ1LDE1LjU2LDY3LjIzLDIxLjA0LDEwNi42M2MtMjEuNTYsOS4zNi02My4xNywxOC4zMS0xMDAuNzYsMjFjLTMuNTcsMC4yNi03LjE1LDAuMjYtMTAuNzIsMAoJYy0zNy42MS0yLjY5LTc5LjIxLTExLjY0LTEwMC43Ni0yMWM1LjQ4LTM5LjQsMTIuMDctNzYuMTgsMjEuMDQtMTA2LjYzYzAuMDktMC4zNiwwLjA1LTAuNjktMC4wOS0wLjk1CglDOTIuNjgsNDAzLjksMTIxLjE2LDQwNS45NiwxNTAuODIsNDA2LjA4TDE1MC44Miw0MDYuMDh6Ii8+CjxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0zNi45NCwyNzMuODRjMS4xOC0zNS41MywyLjM1LTcxLjE3LDQuMi04OC44YzAuMDItMC4yMSwwLjA0LTAuNDIsMC4wNi0wLjYzYzQuMDgsMC42OSw5LjQ3LDIsMTUuMjgsMy41MWgwLjAxCgljMi4yNSwzOCwyLjgzLDc4LjMxLDEuODMsMTE0Ljk1bC0yMS44Niw2LjE4TDM2Ljk0LDI3My44NEwzNi45NCwyNzMuODR6Ii8+CjxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0zNi4wOSwzMzUuNzFMNTcuNTEsMzI1Yy0wLjM0LDcuNDEtMC43NiwxNC41OS0xLjI1LDIxLjVjLTIuOCwzMi40NS05LjkxLDY2LjkzLTE3LjksMTAzLjc2aC0zLjYxCglMMzYuMDksMzM1LjcxTDM2LjA5LDMzNS43MXoiLz4KPHBhdGggY2xhc3M9InN0MyIgZD0iTTU4LjA1LDU4LjE5YzIuMDctNC4zNSw0Ljg4LTguMjgsOC4wNS0xMi4wMmMxNi0xNi40Miw0Ni44Mi0yMS45Niw4NC43Mi0yMi4zMgoJYzM3LjksMC4zNiw2OC43Miw1LjksODQuNzIsMjIuMzJjMy4xNywzLjc0LDUuOTgsNy42Nyw4LjA2LDEyLjAyYy0zLjcxLDguMzctNy43OSwxNi4yNC0xMi44MywyNC4wOWMtMC43LDEuMDktMi4xOCwxLjM4LTMuMjUsMC42NAoJbC0xMS44Mi04LjEzYy0xLjY5LTEuMTYtMy40Ni0yLjIxLTUuMy0zLjEzYy0xNi40NS04LjIzLTM2LjY1LTEyLjQzLTU5LjU4LTEyLjI2Yy0yMi45My0wLjE3LTQzLjEzLDQuMDMtNTkuNTgsMTIuMjYKCWMtMS44NCwwLjkyLTMuNjEsMS45Ny01LjMsMy4xM2wtMTEuODIsOC4xM2MtMS4wNywwLjc0LTIuNTUsMC40NS0zLjI1LTAuNjRDNjUuODMsNzQuNDMsNjEuNzUsNjYuNTYsNTguMDUsNTguMTlMNTguMDUsNTguMTl6Ii8+CjxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik03My45OCwzNzcuMjZjNC40Ny05MC43Miw3LjUyLTE3OC43OSw4LjYxLTI2My4yNGMxNi4zNywxLjA2LDQyLDEuNTMsNjguMjMsMS45CgljMjUuOTQtMC4zNyw1MS44MS0wLjg2LDY4LjIzLTEuOWMxLjA5LDg0LjQ1LDQuMTQsMTcyLjUyLDguNjEsMjYzLjI0Yy0yMiwyLjI4LTQ4LjUyLDMuMDMtNzYuODQsMy4xNwoJQzEyMi41LDM4MC4yOSw5NS45OCwzNzkuNTQsNzMuOTgsMzc3LjI2eiIvPgo8cGF0aCBjbGFzcz0ic3QzIiBkPSJNMzYuNDYsMzA5LjA1bDAuNDgtMzUuMjFjMS4xOC0zNS41MywyLjM1LTcxLjE3LDQuMi04OC44YzAuMDItMC4yMSwwLjA0LTAuNDIsMC4wNi0wLjYzCgljNC4wOCwwLjY5LDkuNDcsMiwxNS4yOCwzLjUxaDAuMDFjMi4yNSwzOCwyLjgzLDc4LjMxLDEuODMsMTE0Ljk1TDM2LjQ2LDMwOS4wNXoiLz4KPHBhdGggY2xhc3M9InN0MyIgZD0iTTM0Ljc1LDQ1MC4yNmwxLjM0LTExNC41NUw1Ny41MSwzMjVjLTAuMzQsNy40MS0wLjc2LDE0LjU5LTEuMjUsMjEuNWMtMi44LDMyLjQ1LTkuOTEsNjYuOTMtMTcuOSwxMDMuNzZIMzQuNzUKCUwzNC43NSw0NTAuMjZ6Ii8+CjxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0yNDQuMDksMzI0LjEzbDIxLjQ1LDEwLjcybDEuMzUsMTE1LjQxaC0zLjYxYy03Ljk5LTM2LjgzLTE1LjEtNzEuMzEtMTcuOS0xMDMuNzYKCUMyNDQuODcsMzM5LjMyLDI0NC40NCwzMzEuODUsMjQ0LjA5LDMyNC4xM3oiLz4KPHBhdGggY2xhc3M9InN0MyIgZD0iTTI0NS4xNiwxODcuOTJjMC45Mi0yNS43NywyLjkzLTUxLjU1LDYuMDMtNzcuMzJjNC40MiwyOC45OSw4LjQyLDU2LjYyLDkuMjUsNzMuODEKCUMyNTYuMzYsMTg1LjEsMjUwLjk3LDE4Ni40MSwyNDUuMTYsMTg3LjkyeiIvPgo8cGF0aCBjbGFzcz0ic3QzIiBkPSJNNDEuMiwxODQuNDFjMC44My0xNy4xOSw0LjgzLTQ0LjgyLDkuMjUtNzMuODFjMy4xLDI1Ljc3LDUuMTEsNTEuNTUsNi4wMyw3Ny4zMgoJQzUwLjY3LDE4Ni40MSw0NS4yOCwxODUuMSw0MS4yLDE4NC40MXoiLz4KPHBhdGggY2xhc3M9InN0NCIgZD0iTTc3LjE2LDExMy43NWMtMi41MSwxMDEuNzEtMy42OCwyMzYuNTMtMTIuNDksMjg1LjEiLz4KPHBhdGggY2xhc3M9InN0NCIgZD0iTTIyNC40OCwxMTMuNzVjMi41MSwxMDEuNzEsMy42OCwyMzYuNTMsMTIuNDksMjg1LjEiLz4KPHBhdGggY2xhc3M9InN0NCIgZD0iTTcwLjc4LDY2NC41OUM2MS41MSw2MjUuNDYsNTQsNTg3LjMsNDkuOTYsNTUxLjA4Yy0wLjItMS43OS0wLjMzLTMuNTctMC40NC01LjM3CgljLTAuNjUtOS45NS0yLjQtMjAuNzctNC43OS0zMi4xIi8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik04NC44NSw2NjkuNzRjMS43Ni00OC44Ni02LjItMTA4LjM5LTI0LjM5LTE0Ni42MiIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNMzMuMyw0ODUuMjlsLTEyLjg5LDcuNzJjLTAuOTgsMC41OC0yLjE1LDAuNzQtMy4yNCwwLjQ0bDAsMCIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNODIuNTksMTE0LjAyYy0wLjI2LTAuMDItMC4xMSwwLTAuMzctMC4wMmMtMC44OC0wLjA2LTEuNzUtMC4wOC0yLjYzLTAuMTFjLTguMi0wLjI3LTEzLjU5LTMuNi0xNi4zOS05LjczIi8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0xNTAuODIsODkuMWMtMTYuOTksMC40NC0zMy42MSwxLjEyLTQ1LjcyLDQuODZjLTE3LjIyLDQuNjgtMjguNiw5Ljc4LTI4LjUxLDE5LjY3Ii8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0yNS42MSw3MS40OWMzLjIyLTkuMDEsNi42NC0xNy4yOCwxMC40LTI0LjIyYzEuNi0yLjk1LDMuNi01LjY1LDUuOTQtOC4wNmM3Ljg5LTguMSwxOC41OC0xNi4yNywzMC41LTI0LjQ5Ii8+CjxsaW5lIGNsYXNzPSJzdDQiIHgxPSI1NC4wMyIgeTE9IjY3LjQ3IiB4Mj0iMzcuNTUiIHkyPSI0MS40NSIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNNDAuMTMsMTcyLjZsLTkuNDgtMi41NmMtMC43Mi0wLjItMS40My0wLjQ1LTIuMTMtMC43M2MtNC40NC0xLjc4LTguMDYtMi4xMS0xMC40Ny0wLjMzIi8+CjxsaW5lIGNsYXNzPSJzdDQiIHgxPSIxOC4wMyIgeTE9IjE3MS4xMiIgeDI9IjE0Ljc4IiB5Mj0iMTcyLjkyIi8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0zNC4yNSwzMjQuNmMtNi42NSwxLjQ0LTEyLjIxLDMuNjQtMTYuNDEsNi43OCIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNNzUuNTMsNjcyLjhjLTI4LjIyLTExLjc4LTQ4LjI2LTI5Ljc0LTUxLjAyLTYwLjc3Ii8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0xNTAuODIsNjEuMDJjLTI3LjM5LTAuODEtNTYuNjQsNi4zMy03MS40NSwyMC4wMWMtMy4wNiwyLjgyLTUuOTEsNS44OC04LjI5LDkuMjkKCWMtMTAuOSwxNS42My0xNS4xOCwzMi4wNy0xNi4zMyw1MC40NCIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNNTQuNzUsNzEuODFjLTEuMjYsMy42OC0yLjMsNy4zNi0zLjA3LDExLjA0Yy0xLjQzLDYuODEtMS41OCwxMy44NC0wLjU4LDIwLjcyYzAuOTEsNi4yNSwwLjU4LDUuODEsMS4zMSwxNC43OAoJYzYuNTgsNTcuMTIsOS4xMiwxMjMuMzMsNy41NiwxODMuMmMwLjYsNjEuNjItMTIuOTcsMTE4Ljk3LTI0LjYzLDE2Ny4wOWwtMi4wNyw3LjI0Ii8+CjxsaW5lIGNsYXNzPSJzdDQiIHgxPSI2My4yMSIgeTE9IjEwNC4xNiIgeDI9IjUzLjgiIHkyPSI2OC4xNCIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNMzkuNSw0NC41M2MtOC41NCwzMy45LTEyLjg5LDY0LjM2LTEzLjU0LDk2LjIzbC0wLjQxLDI3LjU1bC0xLjY5LDExMi40M2wwLjUzLDQ2LjkybDEuMjIsMTA4LjEyCgljMC4xOCw0LjkxLDAuMjksOS43NCwwLjMzLDE0LjQ4Ii8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik00MS45Niw2NDQuNDFjLTguMy0xNC4xOS0xNC43Ni0yOC45LTE2LjY2LTQ0Ljg5Yy0yLjg2LTE3LjQ4LTUuNjYtNDEuNzItMy4zLTY5LjM3CgljMS4wNS0xMi4yOCwyLjE4LTI1LjU3LDIuOTctMzkuODhjMC40MS03LjQ4LDAuNzItMTUuMjMsMC44OC0yMy4yNyIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNMzQuOTMsMjc1Ljc2Yy00LjYyLDYuOTYtNi45MSwyNC45NC03LjU1LDUwLjc0Yy0wLjUyLDIxLjY1LDAuMTEsNDguOCwxLjUyLDc5LjU4bDEuMTMsNDQuMzMiLz4KPHBhdGggY2xhc3M9InN0NCIgZD0iTTMwLjAzLDQ2OS42MmwtMC4wNywxMS4yM2MwLjAzLDIuMTktMC4wNCw0LjM4LTAuMjEsNi41NmMtMC4xLDEuNC0wLjI0LDIuNzktMC40Miw0LjE4CgljLTUuMTMsNDAuOTEtNC42Niw4MC4yMiwxLjEzLDExOC4wMWMzLjU5LDE2LjEsMTEuMDQsMzAuODgsMjIuMzYsNDQuMzQiLz4KPGxpbmUgY2xhc3M9InN0NCIgeDE9IjQyLjUyIiB5MT0iNTA2LjA3IiB4Mj0iNDIuMTUiIHkyPSI1MDkuOTkiLz4KPGxpbmUgY2xhc3M9InN0NCIgeDE9IjU5LjcxIiB5MT0iMzIxLjAxIiB4Mj0iMzQuMjUiIHkyPSIzMzMuNjciLz4KPGxpbmUgY2xhc3M9InN0NCIgeDE9IjYwIiB5MT0iMzA1LjQ0IiB4Mj0iMzQuMzMiIHkyPSIzMTIuODQiLz4KPHBhdGggY2xhc3M9InN0NCIgZD0iTTIzMC44Niw2NjQuNTljOS4yNy0zOS4xMywxNi43OC03Ny4yOSwyMC44Mi0xMTMuNTFjMC4yLTEuNzksMC4zMy0zLjU3LDAuNDQtNS4zNwoJYzAuNjUtOS45NSwyLjQtMjAuNzcsNC43OS0zMi4xIi8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0yMTYuNzksNjY5Ljc0Yy0xLjc2LTQ4Ljg2LDYuMi0xMDguMzksMjQuMzktMTQ2LjYyIi8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0yNjguMzUsNDg1LjI5bDEyLjg5LDcuNzJjMC45OCwwLjU4LDIuMTUsMC43NCwzLjI0LDAuNDRsMCwwIi8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0yMTkuMDUsMTE0LjAyYzAuNDMtMC4wMy0wLjA0LDAsMC4zNy0wLjAyYzAuODgtMC4wNiwxLjc1LTAuMDgsMi42My0wLjExYzguMi0wLjI3LDEzLjU5LTMuNiwxNi4zOS05LjczIi8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0xNTAuODIsODkuMWMxNi45OSwwLjQ0LDMzLjYxLDEuMTIsNDUuNzIsNC44NmMxNy4yMiw0LjY4LDI4LjYsOS43OCwyOC41MSwxOS42NyIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNMjc2LjAzLDcxLjQ5Yy0zLjIyLTkuMDEtNi42NC0xNy4yOC0xMC40LTI0LjIyYy0xLjYtMi45NS0zLjYtNS42NS01Ljk0LTguMDYKCWMtNy44OS04LjEtMTguNTgtMTYuMjctMzAuNS0yNC40OSIvPgo8bGluZSBjbGFzcz0ic3Q0IiB4MT0iMjQ3LjYxIiB5MT0iNjcuNDciIHgyPSIyNjQuMSIgeTI9IjQxLjQ1Ii8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0yNjEuNTEsMTcyLjZsOS40OC0yLjU2YzAuNzItMC4yLDEuNDMtMC40NSwyLjEzLTAuNzNjNC40NC0xLjc4LDguMDYtMi4xMSwxMC40Ny0wLjMzIi8+CjxsaW5lIGNsYXNzPSJzdDQiIHgxPSIyODMuNjEiIHkxPSIxNzEuMTIiIHgyPSIyODYuODYiIHkyPSIxNzIuOTIiLz4KPHBhdGggY2xhc3M9InN0NCIgZD0iTTI2Ny4zOSwzMjQuNmM2LjY1LDEuNDQsMTIuMjEsMy42NCwxNi40MSw2Ljc4Ii8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0yMjYuMTEsNjcyLjhjMjcuOTgtMTEuNjgsNDguNTEtMzIuNTEsNTEuMDItNjAuNzciLz4KPHBhdGggY2xhc3M9InN0NCIgZD0iTTE1MC44Miw2MS4wMmMyNy4zOS0wLjgxLDU2LjY0LDYuMzMsNzEuNDUsMjAuMDFjMy4wNiwyLjgyLDUuOTEsNS44OCw4LjI5LDkuMjkKCWMxMC45LDE1LjYzLDE1LjE4LDMyLjA3LDE2LjMzLDUwLjQ0Ii8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0yNDYuODksNzEuODFjMS4yNiwzLjY4LDIuMyw3LjM2LDMuMDcsMTEuMDRjMS40Myw2LjgxLDEuNTgsMTMuODQsMC41OCwyMC43MmMtMC45MSw2LjI1LTAuNTgsNS44MS0xLjMxLDE0Ljc4CgljLTYuNTgsNTcuMTItOS4xMiwxMjMuMzMtNy41NiwxODMuMmMtMC42LDYxLjYyLDEyLjk3LDExOC45NywyNC42MywxNjcuMDlsMi4wNyw3LjI0Ii8+CjxsaW5lIGNsYXNzPSJzdDQiIHgxPSIyMzguNDMiIHkxPSIxMDQuMTYiIHgyPSIyNDcuODQiIHkyPSI2OC4xNCIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNMjYyLjE0LDQ0LjUzYzguNTQsMzMuOSwxMi44OSw2NC4zNiwxMy41NCw5Ni4yM2wwLjQxLDI3LjU1bDEuNjksMTEyLjQzbC0wLjUzLDQ2LjkybC0xLjIyLDEwOC4xMgoJYy0wLjE4LDQuOTEtMC4yOSw5Ljc0LTAuMzMsMTQuNDgiLz4KPHBhdGggY2xhc3M9InN0NCIgZD0iTTI1OS42OCw2NDQuNDFjOC4zLTE0LjE5LDE0Ljc2LTI4LjksMTYuNjYtNDQuODljMi44Ni0xNy40OCw1LjY2LTQxLjcyLDMuMy02OS4zNwoJYy0xLjA1LTEyLjI4LTIuMTgtMjUuNTctMi45Ny0zOS44OGMtMC40MS03LjQ4LTAuNzItMTUuMjMtMC44OC0yMy4yNyIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNMjY2LjcxLDI3NS43NmM0LjYyLDYuOTYsNi45MSwyNC45NCw3LjU1LDUwLjc0YzAuNTIsMjEuNjUtMC4xMSw0OC44LTEuNTIsNzkuNThsLTEuMTMsNDQuMzMiLz4KPHBhdGggY2xhc3M9InN0NCIgZD0iTTI3MS42MSw0NjkuNjJsMC4wNywxMS4yM2MtMC4wMywyLjE5LDAuMDQsNC4zOCwwLjIxLDYuNTZjMC4xLDEuNCwwLjI0LDIuNzksMC40Miw0LjE4CgljNS4xMyw0MC45MSw0LjY2LDgwLjIyLTEuMTMsMTE4LjAxYy0zLjU5LDE2LjEtMTEuMDQsMzAuODgtMjIuMzYsNDQuMzQiLz4KPGxpbmUgY2xhc3M9InN0NCIgeDE9IjI1OS4xMiIgeTE9IjUwNi4wNyIgeDI9IjI1OS40OSIgeTI9IjUwOS45OSIvPgo8bGluZSBjbGFzcz0ic3Q0IiB4MT0iMjQxLjkzIiB5MT0iMzIxLjAxIiB4Mj0iMjY3LjQ1IiB5Mj0iMzMzLjciLz4KPGxpbmUgY2xhc3M9InN0NCIgeDE9IjI0MS42NCIgeTE9IjMwNS40NCIgeDI9IjI2Ny4zMSIgeTI9IjMxMi44NCIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNNDQuNyw1MDcuMDVjNS40OS0zOS40LDEyLjA4LTc2LjE4LDIxLjA0LTEwNi42M2MwLjIzLTAuODgtMC4zOS0xLjYxLTEuMDYtMS41NwoJYy0wLjI0LDAuMDEtMC40NCwwLjE4LTAuNTcsMC4zOGwwLDBjLTEuMDYsMS42Mi0xLjkxLDMuMzgtMi40OCw1LjIzYy05LjU4LDMwLjgzLTE1LjM1LDY1LjI3LTE5LjEsMTAxLjYxCglDNDMuMjQsNTA2LjQsNDMuOTUsNTA2LjcyLDQ0LjcsNTA3LjA1Ii8+CjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik0yNTYuOTQsNTA3LjA1Yy01LjQ5LTM5LjQtMTIuMDgtNzYuMTgtMjEuMDQtMTA2LjYzYy0wLjIzLTAuODgsMC4zOS0xLjYxLDEuMDYtMS41NwoJYzAuMjQsMC4wMSwwLjQ0LDAuMTgsMC41NywwLjM4bDAsMGMxLjA2LDEuNjIsMS45MSwzLjM4LDIuNDgsNS4yM2M5LjU4LDMwLjgzLDE1LjM1LDY1LjI3LDE5LjEsMTAxLjYxCgljLTAuNzIsMC4zMy0xLjQxLDAuNjUtMi4xOCwwLjk4Ii8+CjxsaW5lIGNsYXNzPSJzdDQiIHgxPSIyNjEuMzciIHkxPSIxNzAuOTQiIHgyPSIyNTAuMjkiIHkyPSIxMDUuMjkiLz4KPGxpbmUgY2xhc3M9InN0NCIgeDE9IjI2NS4yIiB5MT0iMzEwLjEzIiB4Mj0iMjY3LjMxIiB5Mj0iMzEwLjc5Ii8+CjxsaW5lIGNsYXNzPSJzdDQiIHgxPSIyNDMuMzUiIHkxPSIzMDMuOTYiIHgyPSIyNDEuNjUiIHkyPSIzMDMuNDgiLz4KPGxpbmUgY2xhc3M9InN0NCIgeDE9IjI2NS41NCIgeTE9IjMzNC44NSIgeDI9IjI2Ny40NSIgeTI9IjMzNS44MiIvPgo8bGluZSBjbGFzcz0ic3Q0IiB4MT0iMjQ0LjA5IiB5MT0iMzI0LjEzIiB4Mj0iMjQyLjAxIiB5Mj0iMzIzLjA3Ii8+CjxsaW5lIGNsYXNzPSJzdDQiIHgxPSIyNjYuODkiIHkxPSI0NTAuMjYiIHgyPSIyNjguMiIgeTI9IjQ1MC4yNiIvPgo8bGluZSBjbGFzcz0ic3Q0IiB4MT0iMjYzLjI4IiB5MT0iNDUwLjI2IiB4Mj0iMjYxLjkyIiB5Mj0iNDUwLjI2Ii8+CjxsaW5lIGNsYXNzPSJzdDQiIHgxPSI0MC4yNyIgeTE9IjE3MC45NCIgeDI9IjUxLjM1IiB5Mj0iMTA1LjI5Ii8+CjxsaW5lIGNsYXNzPSJzdDQiIHgxPSIzNi40NCIgeTE9IjMxMC4xMyIgeDI9IjM0LjMzIiB5Mj0iMzEwLjc5Ii8+CjxsaW5lIGNsYXNzPSJzdDQiIHgxPSI1OC4yOSIgeTE9IjMwMy45NiIgeDI9IjU5Ljk5IiB5Mj0iMzAzLjQ4Ii8+CjxsaW5lIGNsYXNzPSJzdDQiIHgxPSIzNi4xIiB5MT0iMzM0Ljg1IiB4Mj0iMzQuMiIgeTI9IjMzNS44MiIvPgo8bGluZSBjbGFzcz0ic3Q0IiB4MT0iNTcuNTUiIHkxPSIzMjQuMTMiIHgyPSI1OS42MyIgeTI9IjMyMy4wNyIvPgo8bGluZSBjbGFzcz0ic3Q0IiB4MT0iMzQuNzUiIHkxPSI0NTAuMjYiIHgyPSIzMy40NCIgeTI9IjQ1MC4yNiIvPgo8bGluZSBjbGFzcz0ic3Q0IiB4MT0iMzguMzYiIHkxPSI0NTAuMjYiIHgyPSIzOS43MiIgeTI9IjQ1MC4yNiIvPgo8cGF0aCBjbGFzcz0ic3QxIiBkPSJNNS40MSw0NTcuOThsLTAuOTctMS40NEMxLjU1LDQ1Mi4yMywwLDQ0Ny4xNCwwLDQ0MS45MmwwLDBjMC0wLjIxLDAuMi0wLjM2LDAuNC0wLjI5bDI1Ljk5LDguNzloMy42NXYxOS4wOAoJbC01LjI4LTMuMTVjLTUuOTMsMS41Ny0xMS4xMiwwLjE5LTE1LjYxLTMuOTJDNy43Miw0NjEuMTIsNi41LDQ1OS41OSw1LjQxLDQ1Ny45OEw1LjQxLDQ1Ny45OHoiLz4KPHBhdGggY2xhc3M9InN0MSIgZD0iTTEuMyw0NDIuOTJsMjEuNzQsNy4yN2MwLjg2LDAuMjksMS40NCwxLjA5LDEuNDQsMnY5LjkxYzAsMC43OC0wLjMxLDEuNTItMC44NywyLjA2bDAsMAoJYy0wLjU0LDAuNTItMS4yNiwwLjgyLTIuMDEsMC44MmwwLDBjLTIuOTIsMC01LjgyLTAuNy04LjM1LTIuMTdjLTQuODItMi44LTkuNTYtNy41Ni0xMS42OS0xNi4wNmMtMC4yOS0xLjE3LTAuNTEtMi41Ni0wLjI1LTMuODQKCWwwLDBMMS4zLDQ0Mi45MnoiLz4KPHBhdGggY2xhc3M9InN0MSIgZD0iTTI5Ni4yMyw0NTcuOThsMC45Ny0xLjQ0YzIuODktNC4zMSw0LjQ0LTkuNCw0LjQ0LTE0LjYybDAsMGMwLTAuMjEtMC4yLTAuMzYtMC40LTAuMjlsLTI1Ljk5LDguNzloLTMuNjV2MTkuMDgKCWw1LjI4LTMuMTVjNS45MywxLjU3LDExLjEyLDAuMTksMTUuNjEtMy45MmMxLjQzLTEuMzEsMi42NS0yLjg0LDMuNzMtNC40NUgyOTYuMjN6Ii8+CjxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0zMDAuMzQsNDQyLjkybC0yMS43NCw3LjI3Yy0wLjg2LDAuMjktMS40NCwxLjA5LTEuNDQsMnY5LjkxYzAsMC43OCwwLjMxLDEuNTIsMC44NywyLjA2bDAsMAoJYzAuNTQsMC41MiwxLjI2LDAuODIsMi4wMSwwLjgybDAsMGMyLjkyLDAsNS44Mi0wLjcsOC4zNS0yLjE3YzQuODItMi44LDkuNTYtNy41NiwxMS42OS0xNi4wNmMwLjI5LTEuMTcsMC41MS0yLjU2LDAuMjUtMy44NGwwLDAKCUwzMDAuMzQsNDQyLjkyeiIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNMjQuNzUsNDY2LjM0YzEuODctMi42MywxLjgxLTguNjIsMS42My0xNS45MyIvPgo8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNMjc2Ljg5LDQ2Ni4zNGMtMS44Ny0yLjYzLTEuODEtOC42Mi0xLjYzLTE1LjkzIi8+CjwvZz4KPC9zdmc+Cg==";

// The integration this card reads from.
const INTEGRATION_DOMAIN = "zeekr_eu";

// Every entity the card needs, as [domain, entity_id suffix].
//
// Entity IDs are resolved against the integration's registry entries rather
// than built from a prefix. zeekr_eu derives IDs from the device name and the
// VIN, and which of the two wins depends on when the entity was first created,
// so the same logical sensor shows up as `binary_sensor.zeekr_5278_charging_status`
// on one install and `binary_sensor.zeekr_l6t..._zeekr_5278_charging_status` on
// the next. The trailing part is the only stable piece, so we match on that.
const ENTITY_CATALOG = {
  // Core telemetry
  battery_level:   ["sensor", "battery_level"],
  range:           ["sensor", "range"],
  odometer:        ["sensor", "odometer"],
  interior_temp:   ["sensor", "interior_temperature"],
  consumption:     ["sensor", "trip_2_average_consumption"],

  // Charging
  charge_power:    ["sensor", "charge_power"],
  charge_current:  ["sensor", "charge_current"],
  charge_voltage:  ["sensor", "charge_voltage"],
  charge_speed:    ["sensor", "charge_speed"],
  charger_state:   ["sensor", "charger_state"],
  charging:        ["binary_sensor", "charging_status"],
  plugged_in:      ["binary_sensor", "plugged_in"],
  charging_switch: ["switch", "charging"],

  // Tyre pressures and temperatures
  tire_fl:         ["sensor", "tire_pressure_driver"],
  tire_fr:         ["sensor", "tire_pressure_passenger"],
  tire_rl:         ["sensor", "tire_pressure_driverrear"],
  tire_rr:         ["sensor", "tire_pressure_passengerrear"],
  tire_temp_fl:    ["sensor", "tire_temperature_driver"],
  tire_temp_fr:    ["sensor", "tire_temperature_passenger"],
  tire_temp_rl:    ["sensor", "tire_temperature_driverrear"],
  tire_temp_rr:    ["sensor", "tire_temperature_passengerrear"],

  // Tyre warnings
  tire_pre_warn_driver:        ["binary_sensor", "tire_pre_warning_driver"],
  tire_pre_warn_passenger:     ["binary_sensor", "tire_pre_warning_passenger"],
  tire_pre_warn_driverrear:    ["binary_sensor", "tire_pre_warning_driverrear"],
  tire_pre_warn_passengerrear: ["binary_sensor", "tire_pre_warning_passengerrear"],
  tire_temp_warn_driver:        ["binary_sensor", "tire_temp_warning_driver"],
  tire_temp_warn_passenger:     ["binary_sensor", "tire_temp_warning_passenger"],
  tire_temp_warn_driverrear:    ["binary_sensor", "tire_temp_warning_driverrear"],
  tire_temp_warn_passengerrear: ["binary_sensor", "tire_temp_warning_passengerrear"],

  // Tyre pressure targets (integration config entities)
  tire_season:       ["select", "reifensaison"],
  tire_front_summer: ["number", "reifendruck_vorne_sommer"],
  tire_front_winter: ["number", "reifendruck_vorne_winter"],
  tire_rear_summer:  ["number", "reifendruck_hinten_sommer"],
  tire_rear_winter:  ["number", "reifendruck_hinten_winter"],

  // Charge planning
  charge_mode:     ["select", "lademodus"],
  laden_min_soc:   ["number", "laden_min_soc"],
  laden_max_soc:   ["number", "laden_max_soc"],
  notladung_start: ["number", "notladung_start"],
  notladung_stop:  ["number", "notladung_stop"],

  // Doors, windows, openings
  door_fl:   ["binary_sensor", "driver_door_open"],
  door_fr:   ["binary_sensor", "passenger_door_open"],
  door_rl:   ["binary_sensor", "driver_rear_door_open"],
  door_rr:   ["binary_sensor", "passenger_rear_door_open"],
  trunk:     ["binary_sensor", "trunk_open"],
  hood:      ["binary_sensor", "hood_open"],
  lock:      ["lock", "central_locking"],
  window_driver:        ["cover", "window_driver"],
  window_passenger:     ["cover", "window_passenger"],
  window_driverrear:    ["cover", "window_driverrear"],
  window_passengerrear: ["cover", "window_passengerrear"],
  sunshade:         ["cover", "sunshade"],
  sunroof_position: ["sensor", "sunroof_position"],
  sun_curtain_rear: ["sensor", "sun_curtain_rear_position"],

  // Comfort and status
  climate:        ["climate", "climate"],
  defroster:      ["switch", "defroster"],
  sentry:         ["switch", "sentry_mode"],
  steering_heat:  ["switch", "steering_wheel_heat"],
  flash:          ["button", "flash_blinkers"],
  fragrance:      ["binary_sensor", "fragrance_active"],
  engine_running: ["binary_sensor", "engine_running"],

  seat_heat_driver:     ["select", "driver_seat_heat"],
  seat_heat_passenger:  ["select", "passenger_seat_heat"],
  seat_heat_rear_left:  ["select", "rear_left_seat_heat"],
  seat_heat_rear_right: ["select", "rear_right_seat_heat"],
  seat_vent_driver:     ["select", "driver_seat_vent"],
  seat_vent_passenger:  ["select", "passenger_seat_vent"],
};

// Seat keys rendered in the "AKTIV" list, with their German labels.
const SEAT_HEAT_KEYS = {
  seat_heat_driver: "Fahrer",
  seat_heat_passenger: "Beifahrer",
  seat_heat_rear_left: "Hinten L",
  seat_heat_rear_right: "Hinten R",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// All entity IDs the integration has registered, optionally narrowed to one
// vehicle. Returns [] when the registry holds no zeekr_eu entries; the card
// reports that rather than guessing at IDs that may belong to something else.
function zeekrEntityIds(hass, deviceId) {
  var reg = hass && hass.entities;
  if (!reg) return [];
  var ids = [];
  for (var id in reg) {
    var ent = reg[id];
    if (!ent || ent.platform !== INTEGRATION_DOMAIN) continue;
    if (deviceId && ent.device_id !== deviceId) continue;
    ids.push(id);
  }
  return ids;
}

// Vehicles the integration has registered, as [{id, name}], for the editor.
function zeekrDevices(hass) {
  var reg = hass && hass.entities;
  if (!reg) return [];
  var devices = (hass && hass.devices) || {};
  var seen = {};
  var out = [];
  for (var id in reg) {
    var ent = reg[id];
    if (!ent || ent.platform !== INTEGRATION_DOMAIN || !ent.device_id) continue;
    if (seen[ent.device_id]) continue;
    seen[ent.device_id] = true;
    var dev = devices[ent.device_id];
    out.push({
      id: ent.device_id,
      name: (dev && (dev.name_by_user || dev.name)) || ent.device_id,
    });
  }
  return out;
}

// Escape text that ends up inside generated HTML (device names are user input).
function esc(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Pick the entity whose ID ends in `suffix`. A few entities carry no prefix at
// all (`button.flash_blinkers`), so an exact match counts too. Where several
// match, the shortest ID wins — that is the one without the extra VIN segment.
function pickEntity(ids, domain, suffix) {
  var prefix = domain + ".";
  var best = null;
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (!id.startsWith(prefix)) continue;
    var object = id.slice(prefix.length);
    if (object !== suffix && !object.endsWith("_" + suffix)) continue;
    if (best === null || id.length < best.length) best = id;
  }
  return best;
}

function stateVal(hass, entityId) {
  var s = hass.states[entityId];
  return s ? s.state : undefined;
}

function stateNum(hass, entityId) {
  var v = stateVal(hass, entityId);
  return v !== undefined && v !== "unavailable" && v !== "unknown" ? parseFloat(v) : null;
}

function isOn(hass, entityId) {
  return stateVal(hass, entityId) === "on";
}

function kpaToBars(kpa) {
  if (kpa === null || kpa === undefined) return "--";
  return (kpa / 100).toFixed(1) + ' bar';
}

function fmt(val, decimals) {
  if (val === null || val === undefined) return "--";
  return decimals !== undefined ? val.toFixed(decimals) : String(val);
}

function tirePressureColor(kpa, targetBar) {
  if (kpa === null || kpa === undefined || !targetBar) return "";
  var actual = kpa / 100;
  var diff = Math.abs(actual - targetBar);
  if (diff > 0.3) return "color:#e53935;";     // rot: >0.3 bar daneben
  if (diff > 0.15) return "color:#ff9800;";     // orange: >0.15 bar
  return "color:#2e7d32;";                       // grün: OK (dunkel)
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
var CARD_STYLES = `
  :host {
    display: block;
  }

  ha-card {
    padding: 16px 16px 32px;
    background: var(--ha-card-background, var(--card-background-color, #fff));
    border-radius: var(--ha-card-border-radius, 12px);
    overflow: visible;
    container-type: inline-size;
    container-name: zeekr-card;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 4px;
  }

  .lock-icon {
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    transition: background 0.2s;
  }

  .lock-icon:hover {
    background: rgba(128, 128, 128, 0.15);
  }

  .main-layout {
    display: flex;
    gap: 12px;
    align-items: center;
    overflow: visible;
  }

  .vehicle-container {
    position: relative;
    flex: 0 0 50%;
    min-width: 0;
    padding: 36px 0 40px;
    overflow: visible;
  }

  .info-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @container zeekr-card (max-width: 500px) {
    .main-layout {
      flex-direction: column;
    }
    .vehicle-container {
      flex: none;
      width: 100%;
    }
    .info-column {
      width: 100%;
    }
    .top-row {
      flex-wrap: wrap;
      justify-content: center;
    }
    .battery-section {
      flex: 0 0 100%;
    }
    .info-row {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 8px 16px;
      justify-content: center;
    }
  }


  .vehicle-bg {
    width: 75%;
    height: auto;
    display: block;
    margin: 0 auto;
    filter: brightness(0.85) contrast(1.1);
    opacity: 0.85;
  }

  .bubble {
    position: absolute;
    width: clamp(8px, 3cqi, 21px);
    height: clamp(8px, 3cqi, 21px);
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.3);
    transition: background 0.3s;
  }

  .bubble.closed { background: #4caf50; }
  .bubble.open { background: #e53935; animation: pulse-bubble 1.5s infinite; }

  @keyframes pulse-bubble {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.7; }
  }

  .bubble-door-fl { top: 78%; left: 47%; }
  .bubble-door-fr { top: 15%; left: 47%; }
  .bubble-door-rl { top: 78%; left: 63.5%; }
  .bubble-door-rr { top: 15%; left: 63.5%; }
  .bubble-hood    { top: 50%; left: 14.75%; transform: translateY(-50%); }
  .bubble-trunk   { top: 50%; right: 13%; transform: translateY(-50%); }
  .bubble-hood.open { transform: translateY(-50%) scale(1); }


  .tire-label {
    position: absolute;
    font-size: clamp(10px, 2.5cqi, 18px);
    font-weight: 600;
    color: var(--primary-text-color);
    opacity: 0.85;
    background: none;
    padding: 0;
    text-align: center;
    line-height: 1.3;
  }

  .tire-temp {
    font-size: clamp(9px, 2.3cqi, 18px);
    font-weight: 600;
    display: block;
  }

  .tire-fl { bottom: -6px; left: 26%; transform: translateX(-50%); }
  .tire-fr { top: -6px; left: 26%; transform: translateX(-50%); }
  .tire-rl { bottom: -6px; left: 71%; transform: translateX(-50%); }
  .tire-rr { top: -6px; left: 71%; transform: translateX(-50%); }

  .plug-icon {
    position: absolute;
    bottom: 4%;
    left: 76%;
  }

  .plug-icon ha-icon {
    --mdc-icon-size: clamp(16px, 5cqi, 38px) !important;
  }

  .legend {
    display: block;
    text-align: center;
    font-size: 13px;
    opacity: 0.65;
    margin-top: 8px;
  }

  .legend .legend-item {
    display: inline-flex;
    margin: 0 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }

  .legend-dot.green { background: #4caf50; }
  .legend-dot.red { background: #e53935; }
  .legend-dot.orange { background: #ff9800; }

  .battery-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0;
    flex: 1;
  }

  .battery-gauge {
    position: relative;
    width: 150px;
    height: 90px;
    overflow: hidden;
  }

  .battery-gauge svg {
    width: 150px;
    height: 150px;
  }

  .battery-gauge-bg {
    fill: none;
    stroke: rgba(128, 128, 128, 0.2);
    stroke-width: 8;
    stroke-linecap: round;
  }

  .battery-gauge-fill {
    fill: none;
    stroke-width: 8;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.8s ease, stroke 0.5s ease;
  }

  .battery-gauge-fill.charging {
    animation: pulse-charge 2s ease-in-out infinite;
  }

  .gauge-value {
    position: absolute;
    bottom: 4px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 30px;
    font-weight: 700;
    color: var(--primary-text-color);
    line-height: 1;
  }

  .gauge-range {
    text-align: center;
    font-size: 17px;
    font-weight: 500;
    color: var(--secondary-text-color);
    margin-top: 2px;
  }

  @keyframes pulse-charge {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }

  .charge-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: #ff9800;
    margin: 0;
    font-weight: 500;
  }

  .charge-info span {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .charge-info ha-icon {
    color: #ff9800;
  }

  .top-row {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
  }

  .info-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 19px;
    color: var(--secondary-text-color);
    margin: 0;
    flex: 1;
  }

  .info-row span {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .info-row ha-icon {
    color: var(--secondary-text-color);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 4px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    background: rgba(128, 128, 128, 0.1);
    color: var(--primary-text-color);
    transition: background 0.2s, transform 0.1s;
  }

  .action-btn .btn-label {
    font-size: 13px;
    font-weight: 500;
    line-height: 1.2;
  }

  .action-btn:hover {
    background: rgba(128, 128, 128, 0.2);
  }

  .action-btn:active {
    transform: scale(0.93);
  }

  .action-btn.active {
    background: var(--primary-color);
    color: #fff;
  }

  .action-btn.active ha-icon {
    color: #fff;
  }

  .action-btn ha-icon {
    color: var(--primary-text-color);
  }

  .preheat-btn.active {
    background: #ff5722;
  }
`;

// ---------------------------------------------------------------------------
// SVG builder
// ---------------------------------------------------------------------------
function buildVehicleSvg(doors, hood, trunk) {
  var dc = function (open) { return open ? "#e53935" : "transparent"; };
  var dOp = function (open) { return open ? "0.5" : "0"; };
  var hoodColor = hood ? "#e53935" : "transparent";
  var hoodOp = hood ? "0.4" : "0";
  var trunkColor = trunk ? "#e53935" : "transparent";
  var trunkOp = trunk ? "0.4" : "0";

  // Overlay-only SVG matching the rotated background image (610x267 rotated = 267x610)
  return '<svg viewBox="0 0 267 610" xmlns="http://www.w3.org/2000/svg" class="vehicle-svg">'
    + '<defs>'
    + '<linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="var(--primary-text-color)" stop-opacity="0.08" />'
    + '<stop offset="100%" stop-color="var(--primary-text-color)" stop-opacity="0.03" />'
    + '</linearGradient>'
    + '<linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#81d4fa" stop-opacity="0.35" />'
    + '<stop offset="100%" stop-color="#4fc3f7" stop-opacity="0.18" />'
    + '</linearGradient>'
    + '</defs>'

    // Body shell - Zeekr 7X: rounded, flowing, muscular rear shoulders, pinched waist
    + '<path d="'
    + 'M 72,42 '
    + 'C 68,36 68,28 80,22 L 140,22 C 152,28 152,36 148,42 '  // Front nose, rounded
    + 'L 152,70 '                                                  // Front fender widens
    + 'C 156,85 158,95 158,110 '                                   // Front wheel arch
    + 'L 158,140 '
    + 'C 156,160 154,170 152,180 '                                 // Pinched waist
    + 'L 152,220 '
    + 'C 154,240 156,250 158,260 '                                 // Widens to rear
    + 'L 160,300 '                                                  // Rear wheel arch - wider
    + 'C 160,320 158,340 156,360 '
    + 'L 152,390 '
    + 'C 150,400 146,408 136,412 L 84,412 C 74,408 70,400 68,390 '  // Rear end
    + 'L 64,360 '
    + 'C 62,340 60,320 60,300 '
    + 'L 62,260 '                                                   // Rear wheel arch left
    + 'C 64,250 66,240 68,220 '
    + 'L 68,180 '
    + 'C 66,170 64,160 62,140 '                                    // Pinched waist left
    + 'L 62,110 '
    + 'C 62,95 64,85 68,70 '                                       // Front wheel arch left
    + 'Z'
    + '" fill="url(#bodyGrad)" stroke="var(--primary-text-color)" stroke-width="1.5" stroke-opacity="0.3" />'

    // Windshield - wide, swept back
    + '<path d="M 78,68 C 78,58 86,52 96,50 L 124,50 C 134,52 142,58 142,68 L 144,110 C 144,116 140,120 134,122 L 86,122 C 80,120 76,116 76,110 Z" fill="url(#glassGrad)" stroke="var(--primary-text-color)" stroke-width="0.8" stroke-opacity="0.2" />'

    // A-pillar lines
    + '<line x1="78" y1="68" x2="76" y2="110" stroke="var(--primary-text-color)" stroke-width="0.6" stroke-opacity="0.15" />'
    + '<line x1="142" y1="68" x2="144" y2="110" stroke="var(--primary-text-color)" stroke-width="0.6" stroke-opacity="0.15" />'

    // Panorama glass roof
    + '<path d="M 80,132 C 80,128 84,126 90,126 L 130,126 C 136,126 140,128 140,132 L 140,270 C 140,274 136,276 130,276 L 90,276 C 84,276 80,274 80,270 Z" fill="url(#glassGrad)" fill-opacity="0.5" stroke="var(--primary-text-color)" stroke-width="0.5" stroke-opacity="0.12" />'

    // Rear window - smaller, more angled
    + '<path d="M 82,310 C 80,306 82,300 88,296 L 132,296 C 138,300 140,306 138,310 L 136,335 C 136,340 132,342 126,342 L 94,342 C 88,342 84,340 84,335 Z" fill="url(#glassGrad)" stroke="var(--primary-text-color)" stroke-width="0.8" stroke-opacity="0.2" />'

    // Hood
    + '<path d="M 80,28 C 80,24 88,22 96,22 L 124,22 C 132,22 140,24 140,28 L 142,48 L 78,48 Z" fill="' + hoodColor + '" fill-opacity="' + (hood ? '0.4' : '0.1') + '" stroke="' + hoodColor + '" stroke-width="0.8" stroke-opacity="0.4" />'

    // Trunk / tailgate
    + '<path d="M 76,365 L 144,365 L 142,395 C 140,404 136,410 126,412 L 94,412 C 84,410 80,404 78,395 Z" fill="' + trunkColor + '" fill-opacity="' + (trunk ? '0.4' : '0.1') + '" stroke="' + trunkColor + '" stroke-width="0.8" stroke-opacity="0.4" />'

    // Door FL (driver front left)
    + '<path d="M 62,118 L 76,118 L 76,195 L 66,195 C 62,193 60,188 60,182 L 60,130 C 60,124 61,120 62,118 Z" fill="' + dc(doors.fl) + '" fill-opacity="' + dOp(doors.fl) + '" stroke="' + dc(doors.fl) + '" stroke-width="0.8" stroke-opacity="0.5" />'

    // Door FR (passenger front right)
    + '<path d="M 144,118 L 158,118 C 159,120 160,124 160,130 L 160,182 C 160,188 158,193 154,195 L 144,195 Z" fill="' + dc(doors.fr) + '" fill-opacity="' + dOp(doors.fr) + '" stroke="' + dc(doors.fr) + '" stroke-width="0.8" stroke-opacity="0.5" />'

    // Door RL (driver rear left)
    + '<path d="M 66,205 L 76,205 L 76,290 L 64,290 C 62,288 60,284 60,278 L 60,218 C 60,212 62,208 66,205 Z" fill="' + dc(doors.rl) + '" fill-opacity="' + dOp(doors.rl) + '" stroke="' + dc(doors.rl) + '" stroke-width="0.8" stroke-opacity="0.5" />'

    // Door RR (passenger rear right)
    + '<path d="M 144,205 L 154,205 C 158,208 160,212 160,218 L 160,278 C 160,284 158,288 156,290 L 144,290 Z" fill="' + dc(doors.rr) + '" fill-opacity="' + dOp(doors.rr) + '" stroke="' + dc(doors.rr) + '" stroke-width="0.8" stroke-opacity="0.5" />'

    // Side windows front (left & right)
    + '<path d="M 64,124 L 74,124 L 74,190 L 68,190 C 64,188 62,184 62,178 L 62,134 C 62,128 63,125 64,124 Z" fill="url(#glassGrad)" opacity="0.5" />'
    + '<path d="M 146,124 L 156,124 C 157,125 158,128 158,134 L 158,178 C 158,184 156,188 152,190 L 146,190 Z" fill="url(#glassGrad)" opacity="0.5" />'

    // Side windows rear (left & right)
    + '<path d="M 68,210 L 74,210 L 74,284 L 66,284 C 64,282 62,278 62,272 L 62,224 C 62,216 64,212 68,210 Z" fill="url(#glassGrad)" opacity="0.5" />'
    + '<path d="M 146,210 L 152,210 C 156,212 158,216 158,224 L 158,272 C 158,278 156,282 154,284 L 146,284 Z" fill="url(#glassGrad)" opacity="0.5" />'

    // Wheels - rounded rects
    + '<rect x="44" y="92" width="16" height="44" rx="5" fill="var(--primary-text-color)" fill-opacity="0.22" stroke="var(--primary-text-color)" stroke-width="1" stroke-opacity="0.35" />'
    + '<rect x="160" y="92" width="16" height="44" rx="5" fill="var(--primary-text-color)" fill-opacity="0.22" stroke="var(--primary-text-color)" stroke-width="1" stroke-opacity="0.35" />'
    + '<rect x="44" y="296" width="16" height="44" rx="5" fill="var(--primary-text-color)" fill-opacity="0.22" stroke="var(--primary-text-color)" stroke-width="1" stroke-opacity="0.35" />'
    + '<rect x="160" y="296" width="16" height="44" rx="5" fill="var(--primary-text-color)" fill-opacity="0.22" stroke="var(--primary-text-color)" stroke-width="1" stroke-opacity="0.35" />'

    // Headlight bar - thin, spanning full width (Zeekr signature)
    + '<rect x="74" y="30" width="72" height="2.5" rx="1.2" fill="#fff9c4" fill-opacity="0.6" />'

    // Tail light bar - thin, spanning full width (Zeekr signature)
    + '<rect x="78" y="395" width="64" height="2.5" rx="1.2" fill="#ef9a9a" fill-opacity="0.6" />'

    // Side mirrors
    + '<ellipse cx="56" cy="105" rx="5" ry="3" fill="var(--primary-text-color)" fill-opacity="0.15" stroke="var(--primary-text-color)" stroke-width="0.6" stroke-opacity="0.25" />'
    + '<ellipse cx="164" cy="105" rx="5" ry="3" fill="var(--primary-text-color)" fill-opacity="0.15" stroke="var(--primary-text-color)" stroke-width="0.6" stroke-opacity="0.25" />'

    // Roof rail accent lines
    + '<line x1="82" y1="130" x2="82" y2="275" stroke="var(--primary-text-color)" stroke-width="0.4" stroke-opacity="0.1" />'
    + '<line x1="138" y1="130" x2="138" y2="275" stroke="var(--primary-text-color)" stroke-width="0.4" stroke-opacity="0.1" />'

    + '</svg>';
}

// ---------------------------------------------------------------------------
// Card class
// ---------------------------------------------------------------------------
class ZeekrVehicleCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._entities = {};
    this._lockEntity = null;
    this._defrosterEntity = null;
    this._sentryEntity = null;
    this._steeringHeatEntity = null;
    this._chargingSwitchEntity = null;
    this._climateEntity = null;
    this._flashEntity = null;
    this._seatHeatEntities = null;
    this._resolved = false;
    this._foundVehicle = false;
    this._prevStates = {};
  }

  setConfig(config) {
    this._config = Object.assign({}, config || {});
    // Entity IDs are resolved from the registry once `hass` arrives, so no
    // configuration is required for a single-vehicle install.
    this._resolved = false;
  }

  // Map every catalogue key to a concrete entity ID. Explicit `entities:`
  // overrides in the card config always win, so an install with renamed
  // entities can still pin them by hand.
  _resolveEntities() {
    var ids = zeekrEntityIds(this._hass, this._config.device_id);
    var overrides = this._config.entities || {};
    var resolved = {};

    for (var key in ENTITY_CATALOG) {
      var entry = ENTITY_CATALOG[key];
      resolved[key] = overrides[key] || pickEntity(ids, entry[0], entry[1]);
    }

    this._entities = resolved;
    this._lockEntity = resolved.lock;
    this._defrosterEntity = resolved.defroster;
    this._sentryEntity = resolved.sentry;
    this._steeringHeatEntity = resolved.steering_heat;
    this._chargingSwitchEntity = resolved.charging_switch;
    this._climateEntity = resolved.climate;
    this._flashEntity = resolved.flash;

    this._seatHeatEntities = {};
    for (var seatKey in SEAT_HEAT_KEYS) {
      this._seatHeatEntities[seatKey] = resolved[seatKey];
    }

    this._foundVehicle = ids.length > 0;
    this._resolved = true;
  }

  set hass(value) {
    var old = this._hass;
    this._hass = value;

    // Resolve entity IDs once, and keep retrying while nothing has been found:
    // the card can be rendered before the integration's registry entries exist.
    if (value && this._config && (!this._resolved || !this._foundVehicle)) {
      this._resolveEntities();
    }

    // State diffing: only re-render when watched entities change
    if (old && value) {
      var watchList = Object.values(this._entities)
        .concat([this._config && this._config.wallbox_power_entity])
        .filter(Boolean);

      var changed = false;
      for (var i = 0; i < watchList.length; i++) {
        var id = watchList[i];
        if (old.states[id] !== value.states[id]) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
    }

    this._render();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 6;
  }

  static getConfigElement() {
    return document.createElement("zeekr-vehicle-card-editor");
  }

  static getStubConfig() {
    return {
      tire_season: "summer",
      tire_front_summer: 2.5,
      tire_rear_summer: 2.5,
      tire_front_winter: 2.7,
      tire_rear_winter: 2.7,
    };
  }

  // --- Render ---
  _render() {
    if (!this._hass || !this._config) return;

    if (!this._foundVehicle) {
      this.shadowRoot.innerHTML = '<ha-card style="padding:16px;line-height:1.5;">'
        + '<b>Zeekr Vehicle Card</b><br>'
        + 'Keine Entities der Integration <code>' + INTEGRATION_DOMAIN + '</code> gefunden. '
        + 'Ist die Zeekr-Integration eingerichtet?'
        + '</ha-card>';
      return;
    }

    var h = this._hass;
    var e = this._entities;

    // Gather values
    var soc = stateNum(h, e.battery_level);
    var range = stateNum(h, e.range);
    var odometer = stateNum(h, e.odometer);
    var interiorTemp = stateNum(h, e.interior_temp);
    var consumption = stateNum(h, e.consumption);

    var isCharging = isOn(h, e.charging);
    var isPlugged = isOn(h, e.plugged_in);
    var chargePower = stateNum(h, e.charge_power);
    var chargeCurrent = stateNum(h, e.charge_current);
    var chargeVoltage = stateNum(h, e.charge_voltage);
    var chargeSpeed = stateNum(h, e.charge_speed);

    // The Zeekr cloud often reports chargePower=0 / isCharging=false during AC
    // sessions on an external OCPP wallbox even though the car is actively
    // pulling current. Fall back to the wallbox sensor as ground truth: if it
    // reports >1 kW we treat the car as charging and use that power value.
    var wallboxPower = this._config.wallbox_power_entity
      ? stateNum(h, this._config.wallbox_power_entity)
      : null;
    var wallboxCharging = wallboxPower !== null && wallboxPower > 1.0;
    if (wallboxCharging) {
      isCharging = true;
      if (chargePower === null || chargePower < wallboxPower) {
        chargePower = wallboxPower;
      }
    }

    var doors = {
      fl: isOn(h, e.door_fl),
      fr: isOn(h, e.door_fr),
      rl: isOn(h, e.door_rl),
      rr: isOn(h, e.door_rr),
    };
    var hoodOpen = isOn(h, e.hood);
    var trunkOpen = isOn(h, e.trunk);

    var tireFL = stateNum(h, e.tire_fl);
    var tireFR = stateNum(h, e.tire_fr);
    var tireRL = stateNum(h, e.tire_rl);
    var tireRR = stateNum(h, e.tire_rr);
    var tireTempFL = stateNum(h, e.tire_temp_fl);
    var tireTempFR = stateNum(h, e.tire_temp_fr);
    var tireTempRL = stateNum(h, e.tire_temp_rl);
    var tireTempRR = stateNum(h, e.tire_temp_rr);

    // Tire pressure targets from HA helpers
    var season = stateVal(h, e.tire_season);
    var isWinter = season === "Winter";
    var targetF = stateNum(h, isWinter
      ? e.tire_front_winter
      : e.tire_front_summer) || (isWinter ? 2.7 : 2.5);
    var targetR = stateNum(h, isWinter
      ? e.tire_rear_winter
      : e.tire_rear_summer) || (isWinter ? 2.7 : 2.5);

    var locked = stateVal(h, this._lockEntity) === "locked";
    var lockColor = locked ? "#4caf50" : "#e53935";
    var lockIcon = locked ? "mdi:lock" : "mdi:lock-open-variant";

    var climateState = this._climateEntity ? stateVal(h, this._climateEntity) : null;
    var climateOn = climateState && climateState !== "off" && climateState !== "unavailable";

    var defrosterOn = isOn(h, this._defrosterEntity);
    var sentryOn = isOn(h, this._sentryEntity);
    var steeringHeatOn = isOn(h, this._steeringHeatEntity);

    var seatHeatAny = false;
    if (this._seatHeatEntities) {
      for (var _sk in this._seatHeatEntities) {
        var _se = this._seatHeatEntities[_sk];
        if (_se) {
          var _s = stateVal(h, _se);
          if (_s && _s !== "Off" && _s !== "off" && _s !== "unavailable" && _s !== "unknown") {
            seatHeatAny = true;
            break;
          }
        }
      }
    }

    // Vorklima active = any preconditioning subsystem actually running
    var preheatActive = climateOn || defrosterOn || steeringHeatOn || seatHeatAny;

    // Battery bar color
    var battColor = "#4caf50";
    if (isCharging) battColor = "#ff9800";
    else if (soc !== null && soc <= 20) battColor = "#e53935";
    else if (soc !== null && soc <= 50) battColor = "#ffc107";

    // Build HTML
    var html = '<style>' + CARD_STYLES + '</style>'
      + '<ha-card>'

      // Header
      + '<div class="header">'
      + '<div class="lock-icon" id="header-lock">'
      + '<ha-icon icon="' + lockIcon + '" style="color: ' + lockColor + '; --mdc-icon-size: 22px;"></ha-icon>'
      + '</div>'
      + '</div>'

      // Main 2-column layout
      + '<div class="main-layout">'

      // Vehicle image with status bubbles
      + '<div class="vehicle-container">'
      + '<img src="' + VEHICLE_SVG + '" class="vehicle-bg" alt="" />'
      + '<div class="bubble bubble-door-fl ' + (doors.fl ? 'open' : 'closed') + '"></div>'
      + '<div class="bubble bubble-door-fr ' + (doors.fr ? 'open' : 'closed') + '"></div>'
      + '<div class="bubble bubble-door-rl ' + (doors.rl ? 'open' : 'closed') + '"></div>'
      + '<div class="bubble bubble-door-rr ' + (doors.rr ? 'open' : 'closed') + '"></div>'
      + '<div class="bubble bubble-hood ' + (hoodOpen ? 'open' : 'closed') + '"></div>'
      + '<div class="bubble bubble-trunk ' + (trunkOpen ? 'open' : 'closed') + '"></div>'
      + '<div class="tire-label tire-fl" style="' + tirePressureColor(tireFL, targetF) + '">' + kpaToBars(tireFL) + '<span class="tire-temp">' + (tireTempFL !== null ? tireTempFL.toFixed(0) + '°C' : '') + '</span></div>'
      + '<div class="tire-label tire-fr" style="' + tirePressureColor(tireFR, targetF) + '">' + kpaToBars(tireFR) + '<span class="tire-temp">' + (tireTempFR !== null ? tireTempFR.toFixed(0) + '°C' : '') + '</span></div>'
      + '<div class="tire-label tire-rl" style="' + tirePressureColor(tireRL, targetR) + '">' + kpaToBars(tireRL) + '<span class="tire-temp">' + (tireTempRL !== null ? tireTempRL.toFixed(0) + '°C' : '') + '</span></div>'
      + '<div class="tire-label tire-rr" style="' + tirePressureColor(tireRR, targetR) + '">' + kpaToBars(tireRR) + '<span class="tire-temp">' + (tireTempRR !== null ? tireTempRR.toFixed(0) + '°C' : '') + '</span></div>'
      + (isPlugged
        ? '<div class="plug-icon"><ha-icon icon="mdi:ev-plug-type2" style="--mdc-icon-size: 38px; color: #ff9800;"></ha-icon></div>'
        : '')
      + '<div style="position:absolute;bottom:-12px;left:0;right:0;text-align:center;font-size:13px;opacity:0.65;">'
      + '<span style="margin:0 6px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#4caf50;vertical-align:middle;"></span> Zu</span>'
      + '<span style="margin:0 6px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#e53935;vertical-align:middle;"></span> Offen</span>'
      + '<span style="margin:0 6px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff9800;vertical-align:middle;"></span> Kabel</span>'
      + '</div>'
      + '</div>'

      // Right info column
      + '<div class="info-column">'

      // Top row: gauge left, info right
      + '<div class="top-row">'

      // Battery gauge
      + (function() {
          var r = 48;
          var circ = Math.PI * r;
          var offset = circ - (soc !== null ? soc : 0) / 100 * circ;
          return '<div class="battery-section">'
            + '<div class="battery-gauge">'
            + '<svg viewBox="0 0 120 120">'
            + '<path class="battery-gauge-bg" d="M 12,60 A 48,48 0 0,1 108,60" />'
            + '<path class="battery-gauge-fill' + (isCharging ? ' charging' : '') + '" d="M 12,60 A 48,48 0 0,1 108,60" stroke="' + battColor + '" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" />'
            + '</svg>'
            + '<div class="gauge-value">' + (soc !== null ? soc.toFixed(0) : "--") + '%</div>'
            + '</div>'
            + '<div class="gauge-range">' + (range !== null ? range.toFixed(0) : "--") + ' km</div>'
            + (function() {
                var cs = stateVal(h, e.charger_state);
                var csMap = {'0': 'Getrennt', '1': 'Verbunden', '2': 'Laden', '3': 'Pausiert', '4': 'Fertig'};
                var csText = csMap[cs] || cs || '';
                var csColor = cs === '2' ? '#ff9800' : 'var(--secondary-text-color)';
                if (!csText) return '';
                return '<div style="text-align:center;font-size:13px;font-weight:500;color:' + csColor + ';margin-top:2px;line-height:1.6;">'
                  + '<ha-icon icon="mdi:ev-station" style="--mdc-icon-size:16px;color:' + csColor + ';"></ha-icon> ' + csText
                  + '</div>';
              })()
            + '</div>';
        })()

      // Info column right of gauge
      + '<div class="info-row">'
      + (interiorTemp !== null
        ? '<span><ha-icon icon="mdi:thermometer" style="--mdc-icon-size: 22px;"></ha-icon> ' + interiorTemp.toFixed(1) + '&deg;C</span>'
        : '')
      + (odometer !== null
        ? '<span><ha-icon icon="mdi:counter" style="--mdc-icon-size: 22px;"></ha-icon> ' + odometer.toLocaleString() + ' km</span>'
        : '')
      + (consumption !== null
        ? '<span><ha-icon icon="mdi:leaf" style="--mdc-icon-size: 22px;"></ha-icon> ' + consumption.toFixed(1) + ' kWh</span>'
        : '')
      + '</div>'

      // Charge details (3rd column)
      + '<div class="info-row">'
      + '<span style="' + (isCharging ? 'color:#ff9800;' : '') + '"><ha-icon icon="mdi:flash" style="--mdc-icon-size: 22px;' + (isCharging ? ' color: #ff9800;' : '') + '"></ha-icon> ' + fmt(chargePower, 1) + ' kW</span>'
      + '<span style="' + (isCharging ? 'color:#ff9800;' : '') + '"><ha-icon icon="mdi:current-ac" style="--mdc-icon-size: 22px;' + (isCharging ? ' color: #ff9800;' : '') + '"></ha-icon> ' + fmt(chargeCurrent, 1) + ' A</span>'
      + '<span style="' + (isCharging ? 'color:#ff9800;' : '') + '"><ha-icon icon="mdi:sine-wave" style="--mdc-icon-size: 22px;' + (isCharging ? ' color: #ff9800;' : '') + '"></ha-icon> ' + fmt(chargeVoltage, 0) + ' V</span>'
      + '<span style="' + (isCharging ? 'color:#ff9800;' : '') + '"><ha-icon icon="mdi:speedometer" style="--mdc-icon-size: 22px;' + (isCharging ? ' color: #ff9800;' : '') + '"></ha-icon> +' + fmt(chargeSpeed, 0) + ' km/h</span>'
      + '</div>'

      + '</div>' // top-row

      // Action buttons
      + '<div class="actions">'
      + '<button class="action-btn preheat-btn' + (preheatActive ? ' active' : '') + '" id="btn-preheat">'
      + '<ha-icon icon="mdi:car-seat-heater" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">Vorklima ' + (preheatActive ? 'Ein' : 'Aus') + '</span>'
      + '</button>'
      + '<button class="action-btn' + (locked ? ' active' : '') + '" id="btn-lock">'
      + '<ha-icon icon="' + lockIcon + '" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">' + (locked ? 'Verriegelt' : 'Entriegelt') + '</span>'
      + '</button>'
      + '<button class="action-btn' + (climateOn ? ' active' : '') + '" id="btn-climate">'
      + '<ha-icon icon="mdi:air-conditioner" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">Klima ' + (climateOn ? 'Ein' : 'Aus') + '</span>'
      + '</button>'
      + '<button class="action-btn" id="btn-flash">'
      + '<ha-icon icon="mdi:car-light-alert" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">Blinken</span>'
      + '</button>'
      + '<button class="action-btn' + (defrosterOn ? ' active' : '') + '" id="btn-defrost">'
      + '<ha-icon icon="mdi:car-defrost-front" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">Defrost ' + (defrosterOn ? 'Ein' : 'Aus') + '</span>'
      + '</button>'
      + '<button class="action-btn' + (sentryOn ? ' active' : '') + '" id="btn-sentry">'
      + '<ha-icon icon="mdi:shield-car" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">Überwachung ' + (sentryOn ? 'Ein' : 'Aus') + '</span>'
      + '</button>'
      + '<button class="action-btn' + (isCharging ? ' active' : '') + '" id="btn-charging">'
      + '<ha-icon icon="mdi:battery-charging" style="--mdc-icon-size: 22px;"></ha-icon>'
      + '<span class="btn-label">Laden ' + (isCharging ? 'Ein' : 'Aus') + '</span>'
      + '</button>'
      + '</div>'

      + (function(seatHeatEntities) {
          var items = [];
          if (isCharging) items.push('<ha-icon icon="mdi:battery-charging" style="--mdc-icon-size:16px;color:#ff9800;"></ha-icon> Laden aktiv');
          if (isPlugged && !isCharging) items.push('<ha-icon icon="mdi:ev-plug-type2" style="--mdc-icon-size:16px;color:#ff9800;"></ha-icon> Kabel eingesteckt');
          if (climateOn) items.push('<ha-icon icon="mdi:air-conditioner" style="--mdc-icon-size:16px;color:#4fc3f7;"></ha-icon> Klima');
          if (defrosterOn) items.push('<ha-icon icon="mdi:car-defrost-front" style="--mdc-icon-size:16px;color:#4fc3f7;"></ha-icon> Defrost');
          if (steeringHeatOn) items.push('<ha-icon icon="mdi:steering" style="--mdc-icon-size:16px;color:#ff5722;"></ha-icon> Lenkradheizung');
          if (seatHeatEntities) {
            var seatNames = SEAT_HEAT_KEYS;
            for (var sk in seatHeatEntities) {
              var se = seatHeatEntities[sk];
              if (se) {
                var sv = stateVal(h, se);
                if (sv && sv !== 'unavailable' && sv !== 'unknown' && sv !== 'Off' && sv !== 'off') {
                  items.push('<ha-icon icon="mdi:car-seat-heater" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> ' + seatNames[sk] + ' ' + sv);
                }
              }
            }
          }
          var chargingSw = stateVal(h, e.charging_switch);
          if (chargingSw === 'on') items.push('<ha-icon icon="mdi:ev-plug-type2" style="--mdc-icon-size:16px;color:#ff9800;"></ha-icon> Lade-Switch Ein');
          var driverVent = stateVal(h, e.seat_vent_driver);
          if (driverVent && driverVent !== 'Off' && driverVent !== 'off' && driverVent !== 'unavailable') items.push('<ha-icon icon="mdi:fan" style="--mdc-icon-size:16px;color:#4fc3f7;"></ha-icon> Belüftung Fahrer ' + driverVent);
          var passVent = stateVal(h, e.seat_vent_passenger);
          if (passVent && passVent !== 'Off' && passVent !== 'off' && passVent !== 'unavailable') items.push('<ha-icon icon="mdi:fan" style="--mdc-icon-size:16px;color:#4fc3f7;"></ha-icon> Belüftung Beifahrer ' + passVent);
          if (sentryOn) items.push('<ha-icon icon="mdi:shield-car" style="--mdc-icon-size:16px;color:#66bb6a;"></ha-icon> Überwachung');
          if (!locked) items.push('<ha-icon icon="mdi:lock-open-variant" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Entriegelt');
          if (doors.fl || doors.fr || doors.rl || doors.rr) items.push('<ha-icon icon="mdi:car-door" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Tür offen');
          if (hoodOpen) items.push('<ha-icon icon="mdi:car" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Motorhaube offen');
          if (trunkOpen) items.push('<ha-icon icon="mdi:car-back" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Heckklappe offen');
          // Fenster (irgendeines offen)
          var anyWindowOpen = false;
          ['driver', 'passenger', 'driverrear', 'passengerrear'].forEach(function(w) {
            if (stateVal(h, e['window_' + w]) === 'open') anyWindowOpen = true;
          });
          if (anyWindowOpen) items.push('<ha-icon icon="mdi:window-open-variant" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Fenster offen');
          // Schiebedach
          var sunroofPos = stateNum(h, e.sunroof_position);
          if (sunroofPos !== null && sunroofPos > 0 && sunroofPos < 101) items.push('<ha-icon icon="mdi:car-select" style="--mdc-icon-size:16px;color:#4fc3f7;"></ha-icon> Schiebedach offen');
          // Sonnenrollo Innenraum
          if (stateVal(h, e.sunshade) === 'open') items.push('<ha-icon icon="mdi:blinds-open" style="--mdc-icon-size:16px;color:#4fc3f7;"></ha-icon> Sonnenrollo offen');
          // Heck-Sonnenschutz
          var curtainRearPos = stateNum(h, e.sun_curtain_rear);
          if (curtainRearPos !== null && curtainRearPos > 0 && curtainRearPos < 101) items.push('<ha-icon icon="mdi:blinds-horizontal" style="--mdc-icon-size:16px;color:#4fc3f7;"></ha-icon> Heck-Sonnenschutz offen');
          // Duft
          if (isOn(h, e.fragrance)) items.push('<ha-icon icon="mdi:spray" style="--mdc-icon-size:16px;color:#ab47bc;"></ha-icon> Duft aktiv');
          // Motor läuft
          if (isOn(h, e.engine_running)) items.push('<ha-icon icon="mdi:engine" style="--mdc-icon-size:16px;color:#66bb6a;"></ha-icon> Motor läuft');
          var tireWarnPos = ['driver', 'passenger', 'driverrear', 'passengerrear'];
          var tireWarnNames = ['VL', 'VR', 'HL', 'HR'];
          for (var tw = 0; tw < 4; tw++) {
            if (isOn(h, e['tire_pre_warn_' + tireWarnPos[tw]])) items.push('<ha-icon icon="mdi:tire" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Reifendruck ' + tireWarnNames[tw]);
            if (isOn(h, e['tire_temp_warn_' + tireWarnPos[tw]])) items.push('<ha-icon icon="mdi:thermometer-alert" style="--mdc-icon-size:16px;color:#e53935;"></ha-icon> Reifentemp ' + tireWarnNames[tw]);
          }

          if (items.length === 0) return '';
          return '<div style="margin-top:10px;padding:8px 10px;background:rgba(128,128,128,0.08);border-radius:8px;font-size:13px;line-height:1.6;">'
            + '<div style="font-size:11px;opacity:0.5;margin-bottom:4px;">AKTIV</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;">'
            + items.map(function(i){return '<span>' + i + '</span>';}).join('')
            + '</div>'
            + '</div>';
        })(this._seatHeatEntities)

      + '</div>' // info-column
      + '</div>' // main-layout

      + '</ha-card>';

    this.shadowRoot.innerHTML = html;

    // Attach event listeners
    var self = this;
    var headerLock = this.shadowRoot.getElementById("header-lock");
    if (headerLock) headerLock.addEventListener("click", function () { self._toggleLock(); });

    var btnPreheat = this.shadowRoot.getElementById("btn-preheat");
    if (btnPreheat) btnPreheat.addEventListener("click", function () { self._togglePreheat(); });

    var btnLock = this.shadowRoot.getElementById("btn-lock");
    if (btnLock) btnLock.addEventListener("click", function () { self._toggleLock(); });

    var btnClimate = this.shadowRoot.getElementById("btn-climate");
    if (btnClimate) btnClimate.addEventListener("click", function () { self._toggleClimate(); });

    var btnFlash = this.shadowRoot.getElementById("btn-flash");
    if (btnFlash) btnFlash.addEventListener("click", function () { self._flashBlinkers(); });

    var btnDefrost = this.shadowRoot.getElementById("btn-defrost");
    if (btnDefrost) btnDefrost.addEventListener("click", function () { self._toggleSwitch(self._defrosterEntity); });

    var btnSentry = this.shadowRoot.getElementById("btn-sentry");
    if (btnSentry) btnSentry.addEventListener("click", function () { self._toggleSwitch(self._sentryEntity); });

    var btnCharging = this.shadowRoot.getElementById("btn-charging");
    if (btnCharging) btnCharging.addEventListener("click", function () { self._toggleSwitch(self._chargingSwitchEntity); });
  }

  // --- Actions ---
  _toggleLock() {
    var h = this._hass;
    if (!h) return;
    var locked = stateVal(h, this._lockEntity) === "locked";
    h.callService("lock", locked ? "unlock" : "lock", {
      entity_id: this._lockEntity,
    });
  }

  _togglePreheat() {
    if (!this._hass) return;
    var h = this._hass;
    var climateState = this._climateEntity ? stateVal(h, this._climateEntity) : null;
    var isActive = climateState && climateState !== "off" && climateState !== "unavailable"
      && isOn(h, this._steeringHeatEntity);

    if (isActive) {
      // Turn everything off
      if (this._climateEntity) {
        h.callService("climate", "set_hvac_mode", {
          entity_id: this._climateEntity,
          hvac_mode: "off",
        });
      }
      if (isOn(h, this._steeringHeatEntity)) {
        h.callService("switch", "turn_off", { entity_id: this._steeringHeatEntity });
      }
      // Turn off driver seat heater
      var seats = this._seatHeatEntities;
      if (seats && seats.driver && stateVal(h, seats.driver) !== "Off") {
        h.callService("select", "select_option", {
          entity_id: seats.driver,
          option: "Off",
        });
      }
    } else {
      // Turn everything on: Climate 22°C, steering heat, front seats max
      if (this._climateEntity) {
        h.callService("climate", "set_temperature", {
          entity_id: this._climateEntity,
          temperature: 22,
          hvac_mode: "heat_cool",
        });
      }
      h.callService("switch", "turn_on", { entity_id: this._steeringHeatEntity });
      // Driver seat heater to Level 3
      var seats = this._seatHeatEntities;
      if (seats && seats.driver) {
        h.callService("select", "select_option", {
          entity_id: seats.driver,
          option: "Level 3",
        });
      }
    }
  }

  _toggleClimate() {
    if (!this._climateEntity || !this._hass) return;
    var state = stateVal(this._hass, this._climateEntity);
    var isOff = state === "off";
    this._hass.callService("climate", "set_hvac_mode", {
      entity_id: this._climateEntity,
      hvac_mode: isOff ? "heat_cool" : "off",
    });
  }

  _flashBlinkers() {
    if (!this._flashEntity || !this._hass) return;
    this._hass.callService("button", "press", {
      entity_id: this._flashEntity,
    });
  }

  _toggleSwitch(entityId) {
    if (!entityId || !this._hass) return;
    this._hass.callService("switch", "toggle", {
      entity_id: entityId,
    });
  }
}

// ---------------------------------------------------------------------------
// Card editor (plain HTMLElement)
// ---------------------------------------------------------------------------
class ZeekrVehicleCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
  }

  setConfig(config) {
    this._config = Object.assign({}, config);
    this._render();
  }

  set hass(value) {
    // Needed to list the vehicles the integration has registered.
    var first = !this._hass;
    this._hass = value;
    if (first) this._render();
  }

  _render() {
    if (!this._config) return;

    var self = this;
    var vehicles = zeekrDevices(this._hass);
    var vehicleField;
    if (vehicles.length > 1) {
      vehicleField = '<select id="cfg-device" class="native-select">'
        + '<option value=""' + (this._config.device_id ? '' : ' selected') + '>Automatisch (erstes Fahrzeug)</option>'
        + vehicles.map(function (v) {
            return '<option value="' + esc(v.id) + '"'
              + (self._config.device_id === v.id ? ' selected' : '') + '>' + esc(v.name) + '</option>';
          }).join('')
        + '</select>';
    } else if (vehicles.length === 1) {
      vehicleField = '<div class="hint">Erkannt: <b>' + esc(vehicles[0].name) + '</b></div>';
    } else {
      vehicleField = '<div class="hint warn">Keine Zeekr-Integration gefunden. '
        + 'Die Card findet ihre Entities automatisch, sobald die Integration eingerichtet ist.</div>';
    }

    var isSummer = (this._config.tire_season || 'summer') === 'summer';
    var act = 'background:var(--primary-color);color:#fff;border-color:var(--primary-color);';
    var inact = 'background:transparent;color:var(--primary-text-color);border-color:rgba(128,128,128,0.3);';
    var sumStyle = isSummer ? act : inact;
    var winStyle = !isSummer ? act : inact;

    this.shadowRoot.innerHTML = '<style>'
      + '.editor { padding: 16px; display: flex; flex-direction: column; gap: 16px; }'
      + '.section { background: var(--ha-card-background, rgba(128,128,128,0.06)); border-radius: 12px; padding: 16px; }'
      + '.section-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--primary-text-color); }'
      + '.season-toggle { display: flex; gap: 8px; margin-bottom: 16px; }'
      + '.season-btn { flex: 1; padding: 12px; border: 2px solid; border-radius: 12px; cursor: pointer; font-size: 15px; font-weight: 600; text-align: center; transition: all 0.2s; }'
      + '.season-btn:hover { opacity: 0.85; }'
      + '.pressure-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }'
      + '.pressure-card { background: var(--card-background-color, rgba(128,128,128,0.08)); border-radius: 10px; padding: 12px; text-align: center; }'
      + '.pressure-card .label { font-size: 12px; opacity: 0.6; margin-bottom: 4px; }'
      + '.pressure-card ha-textfield { width: 100%; }'
      + '.active-hint { text-align: center; font-size: 13px; margin-top: 8px; padding: 8px; border-radius: 8px; }'
      + '.hint { font-size: 13px; opacity: 0.75; padding: 8px 0; }'
      + '.hint.warn { color: var(--error-color, #e53935); opacity: 1; }'
      + '.native-select { width: 100%; padding: 10px; border-radius: 8px; font-size: 14px;'
      + '  background: var(--card-background-color, #fff); color: var(--primary-text-color);'
      + '  border: 1px solid rgba(128,128,128,0.4); }'
      + '</style>'

      + '<div class="editor">'

      // Fahrzeug
      + '<div class="section">'
      + '<div class="section-title"><ha-icon icon="mdi:car" style="--mdc-icon-size:20px;"></ha-icon> Fahrzeug</div>'
      + vehicleField
      + '</div>'

      // Wallbox (optional)
      + '<div class="section">'
      + '<div class="section-title"><ha-icon icon="mdi:ev-station" style="--mdc-icon-size:20px;"></ha-icon> Wallbox (optional)</div>'
      + '<ha-textfield label="Leistungs-Sensor" value="' + esc(this._config.wallbox_power_entity || '') + '" '
      + 'helper="z.B. sensor.wallbox_power — dient als Ersatzwert, wenn die Cloud beim AC-Laden 0 kW meldet" '
      + 'id="cfg-wallbox" style="width:100%;"></ha-textfield>'
      + '</div>'

      // Reifendruck
      + '<div class="section">'
      + '<div class="section-title"><ha-icon icon="mdi:tire" style="--mdc-icon-size:20px;"></ha-icon> Reifendruck</div>'

      // Saison Toggle
      + '<div class="season-toggle">'
      + '<button class="season-btn" id="btn-summer" style="' + sumStyle + '">☀️ Sommerreifen</button>'
      + '<button class="season-btn" id="btn-winter" style="' + winStyle + '">❄️ Winterreifen</button>'
      + '</div>'

      // Aktiver Hinweis
      + '<div class="active-hint" style="background:' + (isSummer ? 'rgba(255,193,7,0.12)' : 'rgba(33,150,243,0.12)') + ';">'
      + (isSummer ? '☀️ Aktiv: Sommerreifen' : '❄️ Aktiv: Winterreifen')
      + ' — Soll: <b>' + (isSummer ? (this._config.tire_front_summer || 2.5) : (this._config.tire_front_winter || 2.7)) + '</b> bar (V) / '
      + '<b>' + (isSummer ? (this._config.tire_rear_summer || 2.5) : (this._config.tire_rear_winter || 2.7)) + '</b> bar (H)'
      + '</div>'

      // Druckwerte Grid
      + '<div style="margin-top: 12px;">'
      + '<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; text-align:center; font-size: 12px; opacity: 0.5; margin-bottom: 4px;">'
      + '<span>☀️ Sommer</span><span>❄️ Winter</span>'
      + '</div>'

      + '<div style="font-size: 13px; font-weight: 600; margin: 8px 0 4px; opacity: 0.7;">Vorderachse</div>'
      + '<div class="pressure-grid">'
      + '<ha-textfield label="bar" type="number" step="0.1" value="' + (this._config.tire_front_summer || 2.5) + '" id="cfg-tfs"></ha-textfield>'
      + '<ha-textfield label="bar" type="number" step="0.1" value="' + (this._config.tire_front_winter || 2.7) + '" id="cfg-tfw"></ha-textfield>'
      + '</div>'

      + '<div style="font-size: 13px; font-weight: 600; margin: 8px 0 4px; opacity: 0.7;">Hinterachse</div>'
      + '<div class="pressure-grid">'
      + '<ha-textfield label="bar" type="number" step="0.1" value="' + (this._config.tire_rear_summer || 2.5) + '" id="cfg-trs"></ha-textfield>'
      + '<ha-textfield label="bar" type="number" step="0.1" value="' + (this._config.tire_rear_winter || 2.7) + '" id="cfg-trw"></ha-textfield>'
      + '</div>'
      + '</div>'

      // Farbskala Erklärung
      + '<div style="margin-top: 12px; font-size: 12px; opacity: 0.6; display: flex; gap: 12px; justify-content: center;">'
      + '<span><span style="color:#4caf50;">●</span> ±0.15 OK</span>'
      + '<span><span style="color:#ff9800;">●</span> ±0.3 Achtung</span>'
      + '<span><span style="color:#e53935;">●</span> &gt;0.3 Warnung</span>'
      + '</div>'

      + '</div>' // section

      + '</div>';

    var self = this;

    var device = this.shadowRoot.getElementById("cfg-device");
    if (device) device.addEventListener("change", function (ev) { self._valueChanged("device_id", ev.target.value || undefined); });

    var wallbox = this.shadowRoot.getElementById("cfg-wallbox");
    if (wallbox) wallbox.addEventListener("input", function (ev) { self._valueChanged("wallbox_power_entity", ev.target.value || undefined); });

    var btnSummer = this.shadowRoot.getElementById("btn-summer");
    if (btnSummer) btnSummer.addEventListener("click", function () { self._valueChanged("tire_season", "summer"); });

    var btnWinter = this.shadowRoot.getElementById("btn-winter");
    if (btnWinter) btnWinter.addEventListener("click", function () { self._valueChanged("tire_season", "winter"); });

    var cfgTfs = this.shadowRoot.getElementById("cfg-tfs");
    if (cfgTfs) cfgTfs.addEventListener("input", function (ev) { self._valueChanged("tire_front_summer", parseFloat(ev.target.value)); });

    var cfgTfw = this.shadowRoot.getElementById("cfg-tfw");
    if (cfgTfw) cfgTfw.addEventListener("input", function (ev) { self._valueChanged("tire_front_winter", parseFloat(ev.target.value)); });

    var cfgTrs = this.shadowRoot.getElementById("cfg-trs");
    if (cfgTrs) cfgTrs.addEventListener("input", function (ev) { self._valueChanged("tire_rear_summer", parseFloat(ev.target.value)); });

    var cfgTrw = this.shadowRoot.getElementById("cfg-trw");
    if (cfgTrw) cfgTrw.addEventListener("input", function (ev) { self._valueChanged("tire_rear_winter", parseFloat(ev.target.value)); });
  }

  _valueChanged(key, value) {
    if (!this._config) return;
    var newConfig = Object.assign({}, this._config);
    if (value === undefined || value === "") {
      delete newConfig[key];
    } else {
      newConfig[key] = value;
    }
    this._config = newConfig;
    var event = new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
// The integration registers this file automatically, but a leftover manual
// /local/ dashboard resource can load it a second time. Defining an existing
// custom element throws and takes the whole frontend down, so bail out instead.
if (customElements.get(CARD_NAME)) {
  console.warn("[ZEEKR] zeekr-vehicle-card is already registered - skipping the duplicate load. "
    + "Remove the manual /local/zeekr-vehicle-card.js dashboard resource; the integration now ships the card.");
} else {
  customElements.define(CARD_NAME, ZeekrVehicleCard);
  customElements.define(CARD_NAME + "-editor", ZeekrVehicleCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CARD_NAME,
    name: "Zeekr Vehicle Card",
    description: "A custom card for Zeekr 7X vehicle overview",
    preview: true,
    documentationURL: "https://github.com/cnc-lasercraft/ha-zeekr-eu",
  });
}

console.info(
  "%c ZEEKR-VEHICLE-CARD %c v" + CARD_VERSION + " ",
  "color: #fff; background: #1a237e; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;",
  "color: #1a237e; background: #e8eaf6; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;"
);
