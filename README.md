# tcg-player-plugin

An [Omarchy](https://omarchy.org/) shell plugin for TCG Player.

Status: work in progress.

## Requirements

- [Omarchy](https://omarchy.org/) (Arch Linux + Hyprland) with `omarchy-shell` (Quickshell) running.

## Installation

Copy or clone this repository into your user plugin directory:

```bash
git clone https://github.com/wico216/tcg-player-plugin.git ~/.config/omarchy/plugins/tcg-player-plugin
```

Files under `~/.config/omarchy/plugins/` hot-reload on save — no restart needed.
If a change fails to apply, force a rescan:

```bash
omarchy-shell shell rescanPlugins
```

## Development

- User plugin code lives in `~/.config/omarchy/plugins/<plugin-id>/` and is yours to edit; it survives Omarchy updates.
- Never edit packaged plugins under `$OMARCHY_PATH/shell/plugins/` — clone built-ins with `omarchy plugin clone <id>` instead.
- Bar layout and plugin wiring are configured in `~/.config/omarchy/shell.json`.
- To restart the whole shell after bigger changes: `omarchy restart shell`.

## License

[MIT](LICENSE)
