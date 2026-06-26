# Asset Credits

This project uses third-party pixel-art assets. Most originate from the
**Liberated Pixel Cup (LPC)** community on [OpenGameArt.org](https://opengameart.org),
which are licensed under **CC-BY-SA 3.0** and/or **GPL 3.0**. These licenses
require attribution and that derivative artwork be shared under the same terms —
this applies to **any public distribution, including a free/hosted demo**, not
only to commercial sales.

> ⚠️ **Action needed:** The tiles below were added to the repo before formal
> tracking. Replace each `TODO` with the actual author name(s) and source URL
> from the page you originally downloaded them from. The OpenGameArt LPC
> collection is the canonical place to confirm authorship:
> https://opengameart.org/content/lpc-collection

## Tiles (`client/public/tiles/`)

| Asset(s)                                  | Source / Author                          | License        |
|-------------------------------------------|------------------------------------------|----------------|
| `grass.png`, `dirt.png`, `water.png`      | LPC terrain tiles — TODO (author + URL)  | CC-BY-SA 3.0   |
| `treetop.png`, `trunk.png`                | LPC trees — TODO (author + URL)          | CC-BY-SA 3.0   |
| `rock.png`, `signs.png`, `bridges.png`, `chests.png`, `inside.png` | LPC props — TODO (author + URL) | CC-BY-SA 3.0   |
| `house.png`, `housealternate.png`         | LPC buildings — TODO (author + URL)      | CC-BY-SA 3.0   |

### Derived assets generated in this repo
Built by `scripts/` from the LPC tiles above; they inherit the same CC-BY-SA license:
- `client/public/buildings/*.png` — composited by `scripts/generate-buildings.mjs`
- `client/public/tiles/tree_oak_top.png`, `tree_pine_top.png`, `tree_stem.png` — extracted by `scripts/generate-trees.mjs`

## Character sprites (`client/public/sprites/`)
- `char_1.png` – `char_4.png` — LPC character spritesheets — TODO (author + URL) — CC-BY-SA 3.0 / GPL 3.0

## How to satisfy the license
1. Keep this file in the repo.
2. Fill in every `TODO` with the real author and source URL.
3. Add a short "Credits" line in the app or README linking here.
