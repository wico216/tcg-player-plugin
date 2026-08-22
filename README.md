# tcg-player-plugin · wico216.tcg-player

An [Omarchy](https://omarchy.org/) shell plugin: a **Magic: The Gathering card search bar** for your status bar.

Type a card name — e.g. *one ring* — and a pane opens with every printing of the card: photo, set, collector number, and both TCGplayer market prices. Pick a version, choose **Foil** or **Non-foil**, and the pane shows that finish's TCGplayer price with a button to open it on TCGplayer.

## How prices work (no scraping needed)

TCGplayer has no public API, but the free [Scryfall API](https://scryfall.com/docs/api) already publishes TCGplayer retail ("market") prices per printing:

- `prices.usd` → TCGplayer non-foil price
- `prices.usd_foil` → TCGplayer foil price
- `purchase_uris.tcgplayer` → deep link to the product on TCGplayer

So this plugin talks only to Scryfall (one debounced, serialized request per search, honoring their rate limits) and never scrapes TCGplayer. Prices are daily snapshots, not live listings; if you ever want live per-listing prices we can add a scraper later (note: against TCGplayer ToS without permission).

## Install

```bash
git clone https://github.com/wico216/tcg-player-plugin.git ~/.config/omarchy/plugins/wico216.tcg-player
omarchy-shell shell rescanPlugins
omarchy bar put wico216.tcg-player --after omarchy.agents
```

Files under `~/.config/omarchy/plugins/` hot-reload on save. If a change fails to apply:

```bash
omarchy-shell shell rescanPlugins
```

## Use

- Click the 🔍 icon in the bar (or `omarchy-shell shell summon wico216.tcg-player open`)
- Type at least 2 characters; results debounce in as you type
- Click a version row to select it
- Toggle **Non-foil / Foil** to switch which TCGplayer price is shown
- **Open on TCGplayer** launches the product page in your browser
- `Esc` closes the pane

## Files

| File            | Purpose                                          |
|-----------------|--------------------------------------------------|
| `manifest.json` | Plugin contract (`bar-widget`, id `wico216.tcg-player`) |
| `BarWidget.qml` | Bar icon + popup pane (search, results, detail)   |

## Requirements

- Omarchy with `omarchy-shell` (Quickshell) running
- Network access to `api.scryfall.com` and `cards.scryfall.io`

## License

[MIT](LICENSE)
