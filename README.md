# ARC Raiders Hangar Hub - Speranza Workshop Terminal

An interactive, premium single-page web application designed to help players manage their inventory, analyze crafting recipes, simulate backpack loads, and outline skill trees in **ARC Raiders**.

This tool runs fully in the browser with **zero dependencies** and can be run offline locally or hosted for free on platforms like **GitHub Pages**.

---

## Key Features

1. **Item Database**: Search and filter through all **567 game items** (weapons, gadgets, refined materials, recyclables, blueprints, keys) by name, rarity, category, and craftability.
2. **Crafting Resolver**: A recursive calculator that decomposes any weapon or item blueprint down to its base raw materials. It recursively resolves predecessor weapon tiers (e.g. *Burletta IV* -> *Burletta III* -> *Burletta II* -> *Burletta I*) to sum up total scrap requirements.
3. **Stash Strategist**: Heuristics to audit your storage boxes, telling you which items to **Keep** (for early/late game hideout upgrades), **Sell** (for credit premiums), or **Recycle** (for components).
4. **Backpack Simulator & Salvage Analyzer**: Live simulation of your topside weight burden including equipped weapons (with *Loaded Arms* weight reduction skill support). Recommends what to drop first if overloaded, and highlights items that can be salvaged in-round to compress weight.
5. **Skill Planner**: Select from 5 playstyle builds (*Pure Scavenger*, *Combat Vanguard*, *High-Mobility Scout*, *Stealth Infiltrator*, *Outpost Tinkerer*) or design your own *Custom Build*. Includes inputs for **Character Level** and **Expedition Bonus Points** to dynamically cap available points and display level-appropriate advice.

---

## Technical Specifications
* **Frontend**: Vanilla HTML5, CSS3 Variables & Flexbox/Grid layouts.
* **Logic**: Vanilla JavaScript, offline-ready state machine.
* **Dependencies**: Zero local compilation. Relies onloaded FontAwesome CDN for interface icons.
* **CORS Compatibility**: The database is structured as a Javascript module (`items.js`), enabling the app to be run by double-clicking the file locally.

---

## How to Host on GitHub Pages (Free)

Hosting this toolkit on GitHub Pages takes under two minutes:
1. Log in to your GitHub account and create a new repository (e.g., `arc-raiders-hangar-hub`).
2. Upload all files from this folder (`index.html`, `style.css`, `app.js`, `items.js`, `items.json`, `LICENSE`, `README.md`) directly into the repository's root.
3. Go to the repository **Settings** tab.
4. In the left sidebar, click **Pages**.
5. Under **Build and deployment**, set the source to **Deploy from a branch**.
6. Select your branch (usually `main`) and root folder (`/root`), then click **Save**.
7. Within a minute, your public site will be active at `https://<your-username>.github.io/arc-raiders-hangar-hub/`.

---

## Credits & Data Sources

This fan-made tool is built upon resources provided by the gaming community:
* **Game Assets & IP**: All trademarks, names, images, and items belong to **[Embark Studios](https://www.embark-studios.com/)**.
* **Database**: Item attributes, stats, and recipes are sourced from the **[Teyk0o/ARDB Community Database](https://github.com/Teyk0o/ARDB)**.
* **Item Icons**: Artwork and icons are cached from **[ARCTracker.io](https://arctracker.io)**.
* **Interface Icons**: CDN libraries provided by **[FontAwesome](https://fontawesome.com)**.
* **Typography**: Google Fonts (*Outfit* and *Share Tech Mono*) provided by **[Google Fonts](https://fonts.google.com)**.

---

## License

This codebase is open-source and released under the [MIT License](LICENSE).
*(Note: Game trademarks, database values, and artwork belong to their respective copyright holders and are used under non-commercial fan guidelines.)*
