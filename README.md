# Network Workbench

Network Workbench is a standalone, browser-only educational simulator for a secure three-tier network. It models packet addressing, service ports, firewall decisions, editable least-privilege rules, and guided lessons. The Web, App, and Data isometric blocks and their SVG topology are intentionally editable learning visuals; the animated trace is CSS-only and does not represent real traffic.

## Open it

- Open `index.html` directly in a browser, or serve this folder with `python3 -m http.server` and visit the printed local URL.
- Use **Simulate** to send a modeled packet and inspect each firewall checkpoint.
- Use **Rules** to experiment. Policy edits stay in memory and never change a real firewall.
- Use **Learn** for the guided exercises and tier-path explanation.

## Development check

```sh
node tests-v4.js
```

The checks cover the recommended policy, in-memory edits and reset behavior, simulation model helpers, rendering, lesson interactions, and cancellation/snapshot behavior. The recommended baseline remains: Client → Web `:443`, Web → App `:5000`, and App → Database `:3306`; other direct paths are denied by default.
