# Les Veillées de Brumecombe — The Vigils of Brumecombe

*An original social-deduction game of the werewolf family, for Foundry VTT.*

[Version française](README.md) · [Changelog](CHANGELOG.md) · [Credits](modules/lakour-veillees/CREDITS.md)

> **First time? Follow the [tutorial](TUTORIAL.md)**: from installation to your first vigil (player accounts and
> passwords, the vault backup key, voice, the AI GM, troubleshooting).

<p align="center">
  <img src="docs/captures/village.png" alt="The village map of Brumecombe at night" width="49%">
  <img src="docs/captures/table-de-jeu.png" alt="The game table during a debate" width="49%">
</p>
<p align="center">
  <img src="docs/captures/vote.png" alt="Voting by clicking on the map" width="32%">
  <img src="docs/captures/carte-de-role.png" alt="A role card, received in secret" width="32%">
  <img src="docs/captures/chroniques.png" alt="The Chronicles of Brumecombe" width="32%">
</p>

Brumecombe is a village at the bottom of a valley, cut off from the world every autumn by a fog so thick you cannot see your
own hand. Eighteen houses with closed shutters, a chapel, a mill, a tavern, a stone bridge over the river. And this autumn,
some of you are wolves: by day they talk, vote and mourn with everyone else; by night they enter the houses. The village has
one weapon: words, and the vote.

> **Language note.** The interface of the system and of the content module is available in **French and English**. The
> game content itself (roles, trades, buildings, guides, variants, tables, holiday journals, and the whole of The Pact: its
> characters, The Village, the Gazette and séance cards) exists in both languages:
> `lakour-veillees` is the French module; **`lakour-veillees-en`** is the English edition, generated from the same sources
> and the translation dictionaries in `modules/lakour-veillees/contenu/en/` (`npm run fabriquer-veillees-en`). Same
> documents, same identifiers: enable only one of the two. Manifest: `releases/latest/download/lakour-veillees-en.json`.
> The English role names are original creations (Ash Reader, Lantern Keeper, Lady of the Ford…); the keys the system reads
> (map landmarks such as “Maison 1” or “Chapelle”, setups, balance) stay as they are. The narrator (human or AI) can narrate
> in any language.

## In short

**Les Veillées de Brumecombe** is a complete, original game: its roles, trades, buildings, texts, map and images are its
own. It uses the free mechanisms of the genre (a village, hidden wolves, secret nights, votes in broad daylight) and nothing
else: *nothing is taken from Les Loups-garous de Thiercelieux (a trademark of its publishers) nor from any other commercial
game*.

It can be played in two ways, at the narrator's choice: **the Vigils** proper (our roles, our trades, our buildings, our
variants), or **[The Pact](#the-pact-the-party-game-under-our-own-names)**, the werewolf game friends bring out at the end of
an evening, with its characters, its village personalities, its event cards and its variants: the same rules, rewritten, under
our own names and with our own texts. The two mix: our own creations remain available as options in The Pact.

It is played **in Foundry VTT**, online, with **6 to 18 players**, in an evening (a game lasts from twenty minutes to an hour
and a half depending on the size of the table). It can be run two ways:

- **with a human narrator**: the system does the tedious part (set-up, secret role distribution, night order, dawn
  resolution, timer, vote, tally) and the narrator does what a human does best: telling the story;
- **with the AI game master**: the narrator is an AI (Claude or ChatGPT, with your own key) that narrates, wakes the roles,
  runs the debate and tallies the votes; **AI companions** can take seats at the table like players, and the **Small table**
  mode lets 1 to 4 humans play with 2 to 8 AI players.

Either way, **no player has to give up their seat** to be the narrator, and **no secret ever goes through a player's
browser**: what they must not know is never sent to them.

**Transparency.** The code and the texts in this repository were written with the help of an AI (Claude, by
Anthropic) and reviewed by the author. The illustrations (world welcome screen, festive vigils, the werewolf logo that replaces a camera) are AI-generated, locally
(FLUX.2 klein 9B in ComfyStudio); the village map and the tokens are not (see [Credits](#credits)).

This repository holds three pieces:

| Piece | Folder | What it is |
|---|---|---|
| the **system** `lakour-loups` | `systems/lakour-loups/` | the rules, the game table, the board, the votes, the secrets |
| the **content module** `lakour-veillees` | `modules/lakour-veillees/` | roles, trades, buildings, village map, guides, set-ups |
| the **shared engine** `lakour-mj-ia` | `modules/lakour-mj-ia/` (submodule) | the AI game master, the companions, the secrets vault ([its repository](https://github.com/Hogun974/lakour-mj-ia)) |

## Who it is for, what you need

- **6 to 18 players** (ready-made set-ups for every size, in four levels: The Pact, Beginners, Classic, Chaos), or **4 to 12
  seats** in Small table mode with AI players. A group of friends online, one evening, a microphone each; a camera if you want
  to see each other.
- **Foundry VTT v14** (verified with 14.369). No game system to buy: the system is provided here.
- The **AI GM module** (`lakour-mj-ia`) is **required even without AI**: it keeps the encrypted vault of the game's secrets.
  Without an AI key it costs nothing and contacts nobody; voice and companions then run in "simple" mode (no AI) or stay off.
- Optional: Foundry's built-in A/V for automatic **voice rooms** (at night the wolves hear each other; the dead talk to the
  dead) and, if you wish, the players' **cameras** (see [Voice and cameras](#voice-and-cameras)); a Claude or OpenAI key for
  the AI GM and the companions.

## Installation

Three ways, from the simplest to the most complete. In all three you need **the system, the content module and the AI GM
module**.

### 1. From Foundry, with the manifests (recommended)

In Foundry's setup screen, **Game Systems › Install System**, then paste the manifest URL:

```
https://github.com/Hogun974/lakour-veillees/releases/latest/download/system.json
```

Then **Add-on Modules › Install Module**, twice:

```
https://github.com/Hogun974/lakour-veillees/releases/latest/download/module.json
https://github.com/Hogun974/lakour-mj-ia/releases/latest/download/module.json
```

Create a world with the **Les Veillées de Brumecombe** system, enable both modules (**La Kour — Les Veillées de Brumecombe**
and **La Kour – MJ IA**), then accept the prompt to **install the content** (guides, variants, village map): Game Settings ›
La Kour — Les Veillées de Brumecombe › Install.

### 2. A ready-made empty world

A world that is already configured (system, modules enabled, content installed, village map in place) is published with each
release, as an archive: Foundry 14 no longer installs a world from a manifest URL (the **Game Worlds** tab only offers
**Create World**).

1. First install the system and both modules from their manifests (way 1): the world requires them.
2. Download `la-kour-veillees-en.zip` (English) or `la-kour-veillees.zip` (French) from the
   [latest release](https://github.com/Hogun974/lakour-veillees/releases/latest).
3. Unzip it into `Data/worlds/la-kour-veillees-en/` (or `Data/worlds/la-kour-veillees/`) inside Foundry's data folder
   (**Configuration › User Data Path**; on a hosting service, its file manager): `world.json` directly in that folder.
4. **Restart Foundry**: the world then appears in **Game Worlds**.

The world is empty: no game, no player, no chronicle.
Its only user, **Gamemaster**, has no password: **set one** (Configuration › Users) **before inviting anyone**, or any guest
can log in as GM.

### 3. From source

```bash
git clone --recurse-submodules https://github.com/Hogun974/lakour-veillees.git
cd lakour-veillees
npm install                  # @foundryvtt/foundryvtt-cli, pinned versions
npm run fabriquer-veillees   # checks the content, writes src/ then compiles the compendiums into packs/
```

The compiled compendiums (`modules/lakour-veillees/packs/`) **are not versioned**: they must be built. Then copy
`systems/lakour-loups/` to `Data/systems/lakour-loups/`, `modules/lakour-veillees/` to `Data/modules/lakour-veillees/`
(without `src/` and `contenu/`, which only serve the build) and `modules/lakour-mj-ia/` to `Data/modules/lakour-mj-ia/`
(without `essais/`, `outils/`, `docs/`, `package*.json`). `node outils/empaqueter-paquets.mjs` produces the same archives as a
release, in `dist/`.

## How a vigil is played

A vigil runs in **rounds**: a night, a dawn, a day, a vote, and night falls again, until one side wins.

**Set-up.** The narrator opens the **Game Table** (button in the left bar, token layer). Its preparation is laid out in
**tabs**: *Players* (who plays, the AI players), *Composition* (the level: **The Pact**, offered first, Beginners, Classic,
Chaos or Small table; a set-up balanced by the system, a ready-made set-up, or roles picked by hand), *Village* (black
plague, Saint Martin's night, The Village; buildings: none, drawn at random or chosen; trades), *Variants* (the party game's),
and *Gazette and feast*. The summary of the active choices
and the **Deal** button stay visible below the tabs. Everyone receives a **role card** in secret and, if trades are in play, a
public **trade**; everyone has a **house** on the map ("House 1" to "House 18", six of them across the river). Every human
player also finds in their **secret notebook**, which opens by itself, an **explanation of their role**: what it does, when the
narrator calls them and what they will be asked, how many times it can be used, how they win, then their trade and their
personality if they have one. **The set-up stays secret**: neither the roles in play nor the number of wolves are announced;
only the buildings in play (4 to 6 when drawn at random) and the variants are, and each one changes a rule.

**Night.** Fog falls on the map, tokens go home, microphones go quiet (voice rooms: wolves hear each other, the dead hear each
other). The narrator wakes the roles **one by one, in order**: a **choice window** opens for the one player concerned ("Which
house do you light tonight?"); on the board the possible houses light up and **one click on a token** is enough. The wolves
wake together and choose their prey. The AI GM runs all of this alone; a human narrator follows the Table's **Night order**,
button after button.

**Dawn.** The system resolves the night (protections, remedies, locks, fire, poison, bite, harpoon, visits, lantern) and the
narrator tells what the village finds in the morning: who died, and sometimes how. Information roles get their answer in
their **secret notebook**. Depending on the setting, the roles of the dead are revealed or not; a dead player no longer talks
to the living, but may keep a **Last breath** (one vote, once).

**Day.** The village **debates**, on a timer (five minutes by default). **Day powers** (trades, Justice of the Peace,
Storyteller, buildings) are played with one click on the Game Table: the system checks the timing, applies the effect and
announces it. On the first day the village **elects its Bailiff** (double vote, breaks ties; with The Village, the Tenant
Farmers choose one of their own instead, from the second day on). Anyone can have a **statement**
written into the **Clerk's register**, the public memory of the vigil.

**Vote.** The narrator opens the vote; everyone **clicks a token** (or a name in the vote window), may change their mind until
closing; you see who has voted, never for whom. The vote closes by itself when the timer ends. The most accused is executed,
unless the Justice of the Peace cancels or the Weaver's ribbon grants a last minute of defence; tally bubbles appear on the
map, the register records every vote. Then night falls again.

**The end.** The Village wins when no wolf is left alive; the Pack, when it equals everyone else; loners and lovers have their
own conditions. The narrator reads the **end-of-game tale** (every role revealed) and the vigil joins the **Chronicles of
Brumecombe**, a journal everyone can read: the players' hall of fame, then each vigil. The next time the world is launched,
the village starts over.

The **player guide** (a world journal, readable by all) and the **narrator guide** (hidden from players) cover all of this,
and every building on the map is **pinned** to its rules page.

## The Pact: the party game, under our own names

**The Pact** level replays, rule for rule, the werewolf game that friends bring out at the end of an evening, with its
expansions: its characters, the village personalities, the event cards and the variants. The mechanics are the same;
the names, texts and images are those of Brumecombe, and no rules text or name from a published game is taken. Where the
physical table has no online equivalent, the guides say how it was adapted (for instance, each player's candle sits on their
card of the Game Table, or the characters' visible traits, below). Everything exists in French and in English.

- **Only the party game's characters**, from 6 to 18 players (one ready-made set-up per size, or the generator), **without our
  common buildings or our trades**: the vigil plays as it would around a real table. The other levels keep every role of the
  Vigils.
- **The Ash Reader is always there**, as in the party game, where the one who sees roles is never missing: the generator puts
  her in every set-up of the level. She is left out only if the narrator excludes her, if the roles are picked by hand, with
  Two Faces (which has its own deck), or when the Pilferer leaves her in the middle.
- **Our own creations, as options**: pick the roles by hand (*Composition* tab, "Pick the roles") to add a Vigils role to a
  vigil of The Pact, or tick some buildings (*Village* tab, "Chosen"). Trades, however, are never dealt at The Pact level.

### Roles by side

| Side | The party game's characters (our names) | Our own creations, as options |
|---|---|---|
| **The Pack** | Wolf of Brumecombe, Famished Wolf, Mother Wolf, Pale Wolf | Wolf in Disguise, Howling Wolf, Scenting Wolf, Wolf of the Reeds |
| **The Village** | Villager, Plain Villager, **Ash Reader** (always there), Matchmaker, Herbalist, Poacher, Child of the Mist, Bridge Warden, Greybeard, Whipping Boy, Village Innocent, Washerwomen (in pairs), Woodcutters (in threes), Ferret, Goose Girl, Stammering Clerk, Old Sergeant, Magpie, Stargazer; the Firebrand with The Village | Lantern Keeper, Bell Ringer, Gravedigger, Storyteller, Justice of the Peace, Hermit, Messenger, Keeper of the Keys, Dowser, Wolfhunter, Night Fisher; Sleepwalker and Rose Maiden on request |
| **The changing faces** (Village at the start, their side may change) | Pilferer, Mountebank, Mastiff, Woods Child, Chambermaid | — |
| **The loners** | Will-o'-the-Wisp, Hurdy-Gurdy Player, Zealot | Revenant, Peddler, Bounty Hunter, Arsonist, Lady of the Ford |
| **Offices and personalities** | the Bailiff; the Town Crier and the Executioner (Moon Gazette); the personalities and the Drifters (The Village) | the Passers-by (Knife Grinder, Marmot Showman, Pilgrim) |

Each power is in the [content](#the-content) tables below, and in the player's guide.

### The calling order

The system wakes the roles in the party game's order; the Game Table's **Night order** follows it, and so does the AI GM.

- **The first night**: Pilferer, Mountebank, Matchmaker, Ash Reader, Ferret, Washerwomen, Woodcutters, Woods Child, Magpie,
  Firebrand, Bridge Warden, the pack (with the Mastiff if it joined), Child of the Mist, Mother Wolf, Famished Wolf, Herbalist,
  Stargazer, Hurdy-Gurdy Player, then the charmed.
- **The following nights**: Mountebank, Ash Reader, Ferret, Magpie, Firebrand, Bridge Warden, the pack, Child of the Mist,
  Pale Wolf (every other night), Mother Wolf, Famished Wolf (as long as no wolf has died), Herbalist, Stargazer, Hurdy-Gurdy
  Player, the charmed; the Washerwomen and the Woodcutters every other night.
- **Every morning, every day**: the night's victims, the Goose Girl's geese, the Gazette card, the séance, the Town Crier's
  announcement, the debate, the vote (and the Chambermaid, who may step in), the Will-o'-the-Wisp if it falls in the first
  round, the Stammering Clerk's second vote.

What has no wake-up of its own happens by itself: the lovers learn of their bond in their notebook, the Oven-Keeper receives in
the morning what she glimpsed, the Stammering Clerk's signal is a secret day power. Our own creations, when in play, wake next
to the role they resemble.

### A simple game: no buildings, no trades

Two preparation choices (*Village* tab, and world settings) apply to every level: **Village buildings** (*none*: a simple game
with the characters only, where the map landmarks are mere scenery; *drawn at random*, as before; *chosen*: tick the ones of
the vigil) and **Trades** (yes or no). The Table keeps the last choice. The Pact draws no building and never deals a trade:
without The Village, it is therefore played with no building at all.

### The Village: personalities, Drifters, Firebrand

With **The Village** variant (box of the *Village* tab), some players hold one of Brumecombe's buildings and become a
**personality**, known to all; their role card stays secret (the Prior may be a wolf), and the building's power comes on top of
the role's. At the deal, the system proposes who holds what, announces it and writes it into the register; the narrator can
change each holder in "The Village" panel of the Table until the first night.

| Personality (building) | Power |
|---|---|
| **Tenant Farmers** (six farmsteads) | From the second day, they choose the Bailiff among themselves; when the last one dies, there is no Bailiff any more. |
| **Prior** (the priory) | Once, by day: a player shows him their card in secret. |
| **Bonesetter** (the hovel) | Once, by day: gives a player back the single-use power of their building, already spent. |
| **Schoolmaster** (the school) | Every day, before the vote, puts one or two players in the corner: they do not vote that day; he never votes. |
| **Oven-Keeper** (the bakehouse) | Every night, half-opens her eyes when the pack goes home: online, a one-in-three chance of glimpsing a wolf. |
| **Wigmaker** (the shop) | Once, by day: eliminates a player; if he was wrong (not a wolf), he pays with his life. |
| **Alehouse Keeper** (the alehouse) | Neither prey for the pack nor a candidate in the vote; votes openly, and loses that protection by voting against a condemned player. |
| **Provost** (the provostry) | When a building becomes free, lodges a Drifter there, who may refuse. |
| **Squire** (the manor) | Once, after a vote: pardons the condemned player who begs him (or himself); the pardoned player's card stays hidden. |

Players without a building are **Drifters**: no roof and no building power, but the Schoolmaster, the Wigmaker, the Magpie and
the Firebrand have no hold on them. The **Firebrand**, a Village role that exists only with this variant, sets fire to a
building once: its holder becomes a Drifter; if it was the house of the pack's prey, the prey escapes and the first wolf to its
right dies. If the Greybeard falls at the village's hand, the personalities lose their power like the trades (the Tenant Farmers
keep choosing the Bailiff). Neither at the small table nor on a Saint Martin's night.

### The Moon Gazette

**31 Event cards**, one read out every morning but the first by the last player eliminated (if nobody has died yet: by the
narrator). Each one acts **at once** (that day), **later** (the coming night or vote) or **for the whole game**: The Flood (no
vote, two shelters, maybe two victims), Heads or Tails (the condemned player pardoned or not), The Great Distrust (two votes per
player, for their friends: whoever gets none falls), The Executioner (an elected office, the only one to know the role of the
condemned), The Deadly Touch, The Nightmare, The Wraith… Settings: a card every morning, every other morning or one morning in
three; the narrator may pick the cards; permanent cards may be laid down from the start (boxes of the *Gazette and feast* tab).
The deck stays the narrator's secret. Three cards (Sunny Sunday, End of the Harvest, Grey Monday) let the narrator apply The
Thrall, Grape Harvest or the Chain of Innocents for that round only. With the Gazette, no Almanac of mists.

- **The characters' visible traits.** Many cards speak of the bodies of the players around the table (the women, the youngest,
  whoever wears glasses…). Online, they read the **traits of each player's character**, drawn at the deal and seen by all
  (sheet, Table card, chat): gender (from the first name), age, spectacles, visible jewel, dark headdress, clogs, pipe, house in
  the village or on an outlying farm. A GM can set an actor's traits by hand (flag `flags["lakour-loups"].traits`). The Zealot
  can also split the village by a trait (setting "The Zealot: how the village is split").
- **The Town Crier.** An office named by the Bailiff (never himself), to whom the narrator hands a few Gazette cards before the
  game (3 by default, 5 at most), taken out of the deck. Every morning from the day after being named, the Crier may read one,
  which applies. The Bailiff may dismiss the Crier after the announcement, before the vote; a Crier who dies is replaced.
- **The Stargazer and the séances.** The narrator keeps five séance cards of four questions each. Every night, the Stargazer
  may ask for a séance: in the morning she picks a question and names the **Medium**, who puts it to the spirit of the game's
  **first dead player**. The spirit answers yes or no and never lies: the system works out the answer from the game and the
  traits ("Does one of the wolves wear spectacles?"). Five séances at most.

The narrator keeps control of what an online game cannot judge alone: taking away the vote of whoever breaks a conduct card
(Black Moon, Good Manners, Neither Wolf nor Me; in the chat, the system itself spots "wolf" and "me"), reading a card, applying
a one-day variant, naming the Crier in place of an absent Bailiff. Guide pages: "The Moon Gazette" (Variants journal, readable by
all) and "Running the Moon Gazette" (narrator's guide).

### The party game's variants

Each one is a box of the *Variants* tab (and a world setting), announced at the deal. The figures come from the simulator
([`docs/equilibre-veillees.md`](docs/equilibre-veillees.md), in French): the pack's share of the games won by the pack or the
village, compared with the ordinary vigil (about one in two), with players who make fairly good use of what they know; within
± 8 points, a variant is within the margin.

| Variant | What it changes | Measured balance |
|---|---|---|
| **Candlelight vigil** | A candle per player, on their card of the Game Table, blown out at their death. **Dreadful**: each wolf blows out a candle himself at night; if they do not all blow out the same one, the pack has no victim, and the village sees the dark candles in the morning. | Within the margin (-1 point; dreadful, -9: slightly for the village). |
| **Chain of Innocents** | No vote: starting from the left neighbour of the last player eliminated, each one names a standing player whose innocence they vouch for, who sits down and names the next; the last one standing is condemned. | **It strongly favours the pack**: eight games in ten (+31 points), more than nine in ten at 16 players. Advice: from 9 to 12 players, **one wolf fewer**; from 13, **two fewer**; at 8 and below, keep two wolves. The generator keeps its wolf count: compose the vigil by hand. |
| **Whispering Wall** | Every night, every living player may write a short anonymous sentence; in the morning the wall is read out. Nobody, not even the narrator, knows who wrote what. | Within the margin (-4 points). |
| **Two Faces** | **Small twist**: a visible role, turned face up for all, and a secret allegiance that sets the side. **Big twist**: two secret cards per player. From 7 to 18 players (a second deck from 10). | **It favours the village**: the pack wins a little under four games in ten (-14 points with the small twist, -17 with the big one). Advice, the **"one more wolf allegiance"** box: from 16 players with the small twist (and at 13), from 12 with the big one; the pack comes back to four to six in ten. Below that, keep the basic deck (with the extra card, seven to nine in ten for the pack). |
| **Grape Harvest** | One more wolf, and every power tipsy: the pack only devours a neighbour of a wolf, the Ash Reader reads three mixed-up roles, the Bailiff votes alone and first, the Herbalist has a single phial with an uncertain outcome… | **It favours the pack**: seven games in ten (+19 points), even though the generator arms the village more (at medium and large tables it is already at its ceiling). |
| **The Thrall** | The pack's prey do not die: they lose their powers, secretly enthralled; an enthralled player condemned by the village drags down those enthralled before them; the pack wins once it has enthralled the second-to-last villager. | Uncorrected, it made the village win almost every time (-30 points); the generator compensates (a set-up less armed for the village): -7 points remain, within the margin. |
| **Black plague** | The variant with no wolves (see [Variants](#variants)); it can also be played at The Pact level. | Not measured by the simulator. |

No variant on a Saint Martin's night; neither Two Faces, nor Grape Harvest, nor The Thrall at the small table or in a black
plague (a chosen plague rules them out). **The Hamlets** (several villages playing at once, players moving from one to another)
are not there yet: a Foundry world runs only one vigil at a time.

### Balance, measured

Role weights and the generator's target are no longer set by hand: they are **measured**. A simulator plays thousands of
complete games with the real system and the real content; simulated players follow a policy per role (what a player would do
from what they know), with the skill of a real table: one piece of information in two for beginners, three in four for Classic
and The Pact, all of it for Chaos. Measured at those skill levels, the pack wins about **one game in two** among those won by
the pack or the village: **51% at The Pact level** (43 to 54% depending on size, the mode being
recommended from seven players: at six, no composition falls within the range), 54% at Classic, 51% at Chaos, 49% for Beginners
(who have **one wolf fewer** than the usual count for that, and the Old Sergeant from nine players).
Three loners were adjusted: the **Revenant** only wins if executed from the third day on, the **Bounty Hunter**'s target must
fall by the second day at the latest, and the simulated players keep an eye on the **Hurdy-Gurdy Player** (his rule is
unchanged; he wins 15% of the games he is in, against 33% before). The Village (+6 points) and the Gazette (+7) stay within the
margin. Method, seeds, tables and how to measure again: [`docs/equilibre-veillees.md`](docs/equilibre-veillees.md) (in French).

## The content

Roles are public: the player guide describes them all, as the genre requires. What is secret is who holds what. Those of the
party game (The Pact level) are sorted in [the table by side](#roles-by-side) above.

### The Pack (8 roles)

Wolves recognise each other on the first night and hunt together; some wake a second time, alone.

| Role | Power |
|---|---|
| **Wolf of Brumecombe** | Each night, with the pack, picks the victim. |
| **Famished Wolf** | Each night, as long as no wolf has died, kills a second victim alone. |
| **Wolf in Disguise** | Looks like a villager to every vision; loses the mask if he survives a vote that singled him out. |
| **Mother Wolf** | Once per game, infects the pack's prey instead of killing it: it secretly becomes a wolf. |
| **Howling Wolf** | Each night, silences a player for the next day's debate. |
| **Scenting Wolf** | Each night, sniffs a player and learns their side. |
| **Wolf of the Reeds** | Each night, watches a house and learns whether its occupant acted. |
| **Pale Wolf** | Hunts with the pack, but every other night devours one of its own alone; wins only if left the last one alive. |

### The Village (38 roles)

| Role | Power |
|---|---|
| **Villager** | No power, one vote. |
| **Lantern Keeper** | Lights a house each night: a wolf who enters it is unmasked at dawn. |
| **Ash Reader** | Each night, learns a player's role. |
| **Herbalist** | One remedy (saves the pack's victim) and one poison (kills), once each, both on the same night if she wishes. |
| **Bridge Warden** | Protects one player per night from the pack, never the same twice in a row. |
| **Bell Ringer** | Once per game, by day, rings the bell: the vote condemns two players. |
| **Gravedigger** | Each night, learns the exact role of a dead player. |
| **Poacher** | If she dies, she takes a player of her choice with her. |
| **Storyteller** | Once per game, forces two minutes of debate about one player, who cannot answer. |
| **Justice of the Peace** | Once per game, cancels a vote: the village votes again. |
| **Child of the Mist** | May spy on the pack at night and learn the wolves' names; if caught, she is the one the pack devours. |
| **Hermit** | Each night, learns the name of one player who acted, without knowing what they did. |
| **Messenger** | Each night, carries a secret message between two players. |
| **Matchmaker** | Binds two lovers on the first night, then plays with the village. |
| **Keeper of the Keys** | Each night, locks a house: nobody gets in, nobody gets out. |
| **Dowser** | Every other night, learns whether two players are on the same side. |
| **Wolfhunter** | Each night, learns a player's side; but he smells of wolf: every vision sees him as the pack's. |
| **Sleepwalker** *(on request)* | Believes he holds a vision role, but he dreams: his visions are false. |
| **Rose Maiden** *(on request)* | The village's pride: if the village executes her by vote, the Village loses at once. |
| **Night Fisher** | Once per game, throws his harpoon: the target dies at dawn unless protected. |
| **Plain Villager** | No power, but their card is turned face up from the deal: the whole village knows they are innocent. |
| **Greybeard** | The pack must attack him twice to kill him; if he falls at the village's hand, the villagers lose their powers. |
| **Whipping Boy** | If the vote ends in a tie, he is the one executed; he then chooses who will vote the next day. |
| **Village Innocent** | If the village votes against him, he is pardoned: his card is turned over, he stays, but no longer votes. |
| **Washerwomen** *(in pairs)* | Recognise each other on the first night, then meet every other night to confer. |
| **Woodcutters** *(in threes)* | Recognise each other on the first night, then meet every other night to confer. |
| **Ferret** | Each night, sniffs a player and their two neighbours: a wolf among them? If not, he loses his nose. |
| **Goose Girl** | Each morning, her geese honk if a wolf is one of her two neighbours. |
| **Stammering Clerk** | Once per game, right after a conviction, secretly calls for a second vote, without debate. |
| **Old Sergeant** | If the pack devours him, his old sword kills the first wolf to his left the following night. |
| **Magpie** | Each night, lays a black feather on a player: two more votes against them at the day's vote. |
| **Pilferer** | On the first night, may steal one of the two cards left in the middle and become that role; must do so if both are wolves. |
| **Mountebank** | Three roles are laid face up: each night, may play the power of one of them, each one only once. |
| **Woods Child** | On the first night, chooses a model: as long as it lives, is on the Village side; if it dies, joins the pack. |
| **Mastiff** | On the first night, chooses for good to be a wolf (hunting with the pack) or a plain villager. |
| **Chambermaid** | When the vote eliminates a player, may reveal herself before their card is turned over and secretly take their role. |
| **Firebrand** | With The Village variant: once per game, sets fire to a building; if it is the house of the wolves' prey, the wolf to its right dies there. |
| **Stargazer** | Each night, may ask for a séance: in the morning, a Medium puts a question to the first dead player, who answers yes or no without lying. |

### The loners (8 roles)

| Role | Power and victory |
|---|---|
| **Revenant** | Wins if executed by the village. |
| **Peddler** | Secretly swaps roles with another player, once; wins with the new side. |
| **Bounty Hunter** | Gets a target at the start: wins if the target is executed by day. |
| **Arsonist** | Douses one house per night; one night, sets fire to every doused house; wins alone. |
| **Lady of the Ford** | Every other night, lures a player to the ford where they drown; the pack cannot kill her; wins alone. |
| **Will-o'-the-Wisp** | The game begins with a day; if eliminated in the first round, wins alone; otherwise, becomes a plain villager. |
| **Hurdy-Gurdy Player** | Each night, charms two players; wins alone when every other living player is charmed. |
| **Zealot** | The village is split into two groups announced to all; wins alone if the whole other group is eliminated. |

### Passers-by (3 roles)

For a player who **joins mid-game**: the role is public, the side secret (drawn by the system), the power works once, by day.
**Knife Grinder** (sharpens a house's lock), **Marmot Showman** (sets his marmot on a doorstep), **Pilgrim** (prays on a doorstep and
learns the side). The village can exile them by vote; and any player may **leave the vigil** without dying or revealing
anything.

### Public trades (14)

Every player has one, known to all: a small day power, once per game, that feeds the debate without saying anything about
one's side. Blacksmith (a lock against the next wolf attack), Miller (how many wolves are still alive), Watchman (keeps a
player from visiting any house), Priest (blesses: cannot be silenced, speaks first), Huntress (did a player leave their house
last night?), Innkeeper (a bed at the Tavern), Apothecary (gives back a silenced voice), Newsmonger (a true but vague clue),
Weaver (a ribbon: one extra minute of defence when accused), Ferryman (a player sleeps across the river, out of reach but
unable to act), Tanner (fang marks on a body, or not), Schoolmistress (roll call: thirty seconds each), Chimney sweep (did a
house receive a visit?), Lock keeper (the pack cannot hunt across the river next night).

### Buildings (10, of which 4 to 6 per game)

Each is a place on the map and changes a rule: the **Chapel** (one player sheltered each night by a vote), the **Mill**
(counts living wolves), the **Tavern** (up to three sleepers protect each other, unless a wolf is among them), the **Gallows**
(absolute majority to execute), the **Well** (a dead player's last ten words, once), the **Forge** (a blade under the pillow
wounds and silences a wolf), the **Graveyard** (the side of the dead eventually comes out), the **Bridge** (houses 13 to 18 are
across the river; the pack never crosses two nights in a row), the **Washhouse** (a true but vague clue every morning), the
**Barn** (a hiding place where you can neither be found nor act).

### Ready-made set-ups (61)

- **Beginners, Classic, Chaos**: one set-up per size from 6 to 18 players (2 wolves up to 8 players, 3 up to 12, 4 up to 15,
  5 beyond; one fewer at the Beginners level; loners and special wolves by level), with its buildings.
- **The Pact**: one set-up per size from 6 to 18 players, with the party game's characters only, no buildings and no trades,
  the Ash Reader in each one.
- **Small table**: 4 to 12 seats, drawn by the system's generator with a fixed seed.
- The Game Table can also **compose** a balanced game for any number, or take a hand-written list of roles. Every ready-made
  set-up is drawn by that same generator. Balance weights, measured by the simulator, live in
  `modules/lakour-veillees/contenu/equilibre.mjs`.

### The map and the board

The **village of Brumecombe** map (42 × 30 squares, top-down, at night) is drawn by code: eighteen houses, the square, the
ten buildings, the river and its bridge, with two renderings (flat and raised) and ambient sounds. The **board** runs the
game without anyone touching anything: a **neutral** token (a hooded villager) per player while their role is hidden, in
front of their house at night, in a circle on the square by day, at the graveyard when dead; moves are animated, darkness
follows the phase, fog falls at night, the screen shakes on a death (client setting, honours `prefers-reduced-motion`). A
**banner** at the bottom tells everyone where they stand (phase, time left, role and trade, "your turn", Vote and "It's the
plague!" buttons, voice room state) and a soft **chime** signals when it is your turn. **Non-player villagers** (the priest,
the elder, the Vaudreys' dog…) and extras can bring the village to life.

## Variants

All are chosen at set-up, in the Game Table or the world settings; the Variants guide describes them.

| Variant | In one line |
|---|---|
| **Black plague** | Rarely (one game in thirty, or by the narrator's choice), there is **no wolf at all**: the fever kills each night, and its last victim picks the next from the grave. Anyone alive may shout "It's the plague!": true, the village wins; false, they hang for panic. |
| **The Bailiff** (default) | Elected on the first day; double vote, breaks ties and names a successor when dying. |
| **The Clerk's register** | The public memory: every vote, vote by vote, every death with its known cause, players' statements (three per day). |
| **Vigil masks** (default) | The pack secretly receives two or three Village roles absent from the game, which it may claim. |
| **Last breath** (default) | Each dead player keeps one vote, once, for an execution vote. |
| **Almanac of the fogs** | One omen per dawn (clear sky, frost, flood, fair, fog, knell, red moon, rumour, north wind, broken seal) that changes the rule of the day or of the next night. |
| **Final knell** | The day the vigil stops: if a wolf is still alive, the pack wins. |
| **Lucky star** | A beginner secretly protected on the first night. |
| **Passers-by** (default) | Join mid-game with a public role and a secret side; leave without dying; exile by vote. |
| **The dock** | Only the accused can be executed, tried one by one; each player accuses once a day. |
| **Mourning knell** | Each innocent executed rings the knell, and the pack gains a growing power. |
| **Saint Martin's night** | The short format: three more roles than players under the altar, one night, one vote, the end. |
| **Festive vigils** | A seasonal, illustrated variant at the narrator's choice: **Night of souls** (the dead whisper), **Winter vigil** (a gift that parries the first blow, snow that erases tracks), **Carnival of masks** (one vision deceived, a parade that shows an absent role), **Feast of the betrothed** (two sure allies, whom the pack has seen). |
| **The Pact** (level) | The party game's setup: only its characters, the Ash Reader always there, without our buildings or trades; the level offered first. See [The Pact](#the-pact-the-party-game-under-our-own-names). |
| **Buildings and trades** | Village buildings: none (a simple game), drawn at random or chosen; trades or not. Valid at every level. |
| **The Village** | Public personalities (Tenant Farmers, Prior, Bonesetter, Schoolmaster, Oven-Keeper, Wigmaker, Alehouse Keeper, Provost, Squire) hold the village buildings: a power on top of their secret role; the others are Drifters; the Firebrand comes into play. The Tenant Farmers choose the Bailiff. See [The Village](#the-village-personalities-drifters-firebrand). |
| **Party game variants** | **Candlelight vigil** (and its dreadful version), **Chain of Innocents** (the last one standing is condemned), **Whispering Wall** (anonymous sentences each night), **Two Faces** (a visible role and a secret allegiance, or two cards; one more wolf allegiance as an option), **Grape Harvest** (one more wolf, tipsy powers), **The Thrall** (the pack's prey enthralled instead of dying). Three of them tip the balance: see [the figures and the advice](#the-party-games-variants). |
| **The Moon Gazette** | 31 Event cards, one read out every morning but the first by the last player eliminated (or every other morning, one in three; or at the narrator's choice): absences, flood, deadly touch, distrust, nightmare, executioner… With it, every character has **visible traits** (gender, age, spectacles, jewel, clogs, headdress, pipe, village or outlying farm), which the cards read. The **Town Crier**, named by the Bailiff, holds a few cards in hand; the **Stargazer** has the first dead questioned (séances). See [The Moon Gazette](#the-moon-gazette). |
| **Small table** | 1 to 4 humans and 2 to 8 AI players: short pack, first night without a kill from two wolves up, humans never all wolves nor all on the same side, ties broken by lot, final knell set automatically. |
| **Sleepwalker, Rose Maiden** | On-request roles, added by hand by the narrator. |
| Settings | Reveal on death, the dead see everything, debate and vote length, night choice delay, chance of being spotted while spying, dead channel, voice rooms, cameras replaced by the werewolf and replacement picture, chat announcements, "your turn" signal, reset on world launch. |

## Voice and cameras

The Vigils are played **by voice** first: the Game Table (*Voice* section) switches the world to "Audio only" and gives the
players the microphone; the **voice rooms** then follow the game (at night only the wolves hear each other; the dead talk to
the dead; a silenced player stays quiet).

You can also **see each other**. The setting comes from the AI GM, for every LaKour world: in its console, the **Players'
cameras** block offers *Add video* (the world switches to "Audio & Video"; everyone reloads the page), *Give players the
camera* (the "Broadcast Video" permission) and *Cut* or *Allow the cameras* (world setting "Players' cameras allowed", on by
default). When cut, each player's camera closes in their own browser and no other browser shows it, even if switched back on
from the console; the GM keeps theirs, and microphones are never touched.

In the Vigils, a player's camera is **replaced by a werewolf** (a wolf howling before the moon, in a wrought-iron medallion)
whenever they must not be seen: **at night** for every living player (eyes closed), when they are **dead**, gone or a
**spectator**, **away for the day** because of a Gazette card (the dance, the foraging, the hunt…) and **silenced** during the
debate and the vote. Their video track is switched off at the source: their browser stops sending any picture. Every browser
works out the same thing from the public state alone, without receiving anything secret; the camera comes back by itself
afterwards, if the GM allows cameras. The GM is never replaced. Two world settings: **Cameras replaced by the werewolf** (on)
and **Picture in place of a camera** (empty: the module's werewolf; otherwise, a picture of your choice). The automated tests
cover these rules; a real game with cameras is still to be played to check the camera light and pop-out windows.

## How secrets are kept, in plain words

In an online werewolf game the temptation to open the browser console is strong. Here is exactly what you will find there:

- Foundry sends every browser all documents and all world settings, and every change to them. Whispers too: a chat message,
  whispered or not, reaches every browser; only its **display** is restricted to its recipients (checked in Foundry v14). So
  the system stores **no secret** there: no role on a sheet, no side, no night choice, no private chat message, no "secret"
  block in a villager's notes (it is removed on save). In the Vigils the AI GM whispers to GMs only, and only technical
  notices (error, budget reached, autopilot): never anything about roles, since every browser receives it.
- The complete game state **exists only on the narrator's side** (the active GM). In the console a player sees only **what
  concerns them**: the **public state** (phase, who has voted, closed results, deaths and public cause) and what the GM sends
  to them alone through the socket: their role card, their notebook, their choice windows, their vote, their voice-room line.
- The game's secrets are **encrypted** (AES-GCM 256 vault) with the AI GM module's key, which never leaves the narrator's
  browser. That key can be recovered only **by the GM** (their browser, or another connected GM handing it over) and with the
  **backup key** they exported. During the night nothing is written to the world: neither the number of wake-ups nor the
  moment of a choice can be read.
- **Voice rooms** are sorted at the source: at night a living player's voice goes to nobody (except a wolf's, to the wolves);
  the dead talk only to the dead; a spectator never hears the den. A silenced player can neither speak nor write during the
  debate.
- **The cursor and the "speaking" light are hidden at night.** Otherwise Foundry broadcasts everyone's activity to all
  (checked in Foundry v14): their cursor on the map, their pings, their ruler, their targets, and the voice "speaking"
  indicator. At night, and while a player makes a secret choice, none of this leaves their browser; at nightfall cursors
  vanish and speaking lights go out for everyone at the same moment. The GM stays visible: they should avoid pointing at a
  token during the night.
- **Cameras do not betray the night**: when the rule replaces a camera with the werewolf, the video track is switched off in
  the player's browser, not merely hidden for the others; and the rule reads only the public state, which every browser
  already knows.
- **AI companions** do not cheat: each has its own context, restricted to what a player in its seat would know.
- An automated test (`essais/non-fuite.test.mjs`) sifts **everything each player receives** during complete games and checks
  that no role, side, choice or secret of another player appears before its public reveal.

What remains visible is what the rules make public: the rhythm of the phases, who has voted, announced deaths, revealed
roles. What is in **your** browser (your card, your notebook) is in the clear, for you. And **a GM sees everything**: any user
with the GM role, assistants included, can become the narrator and reopen the vault; give that role to the narrator only. The
empty world has a **Gamemaster user without a password**: **set a password on it before inviting anyone**, or any guest can
log in as GM. Details and limits are in `docs/loups-contrat.md` (§ 6, in French).

## The AI game master, in brief

The `lakour-mj-ia` module brings an **AI narrator** (Claude or ChatGPT, with your own key, stored in your browser only) and
everything around it:

- it **prepares and runs a whole game by itself**: in a session, ask it for "a game of The Pact with The Village, the Gazette
  and 11 companions"; it composes (every level, The Village, the Gazette and the Crier, the party game's variants), deals in
  secret, **runs the nights** in the calling order, tells the dawn, reads the morning card, drives the debate, opens and
  tallies the votes, reads the end-of-game tale; the recommended personality is *La Voix de la brume*; an offline player is left
  out of the deal (unless you name them), and nothing more is played after victory;
- the narrator's **voice** (browser, free; or OpenAI, live) and **listening** to the players;
- **AI companions**: villagers played by the AI like players, each with its own mind and personality, who choose at night,
  coordinate as a pack, accuse, defend and vote; they know the roles and requests of The Pact, the Gazette and The Village; a
  companion called on by the narrator answers first; their model is picked from a list (by default, a cheap model of the
  provider); without a model or once the budget is reached, they play in simple mode, following the system's per-role
  policies, never repeating the same line twice; they also work without an AI GM session, with a human narrator ("+ AI
  player" button of the Table);
- the **autopilot**: when no living player of the game is held by a connected human any more, the game goes on by itself, step
  by step, in front of the spectators, with its safeguards;
- a **visible cost** and a **budget per session**: the console shows the session's estimated cost live (during a game it is
  kept in the GM's browser, never in the world, and survives a page reload), and the AI GM stops when it reaches the budget; a
  "validation" mode where every sensitive action waits for the human GM's approval; a **dummy** provider to try everything
  with no key and no cost;
- the **players' cameras** setting (see [Voice and cameras](#voice-and-cameras)).

The full guide is installed in the world by the module (journals "MJ IA — Guide du MJ" and "Guide des joueurs") and can be
read in [its repository](https://github.com/Hogun974/lakour-mj-ia).

## Tests

**673 Node tests** (`node --test`), no network, no cost: the system's pure logic (set-up, dealing, night, dawn, votes,
victory, every variant, every role and card of The Pact), its API, mutations (every broken rule must be caught), secret
non-leakage, the content contract, set-ups, map, tokens, cameras, companions, balance (a quick run of the simulator), and
complete simulated games to victory for every level and table size. The balance simulator (`essais/outils/simuler-veillees.mjs`)
and the weight calibration (`essais/outils/calibrer-poids.mjs`) are run separately: see
[`docs/equilibre-veillees.md`](docs/equilibre-veillees.md).

```bash
npm run essais               # every test of the repository (several minutes)
npm run contrat              # the shared contract of content modules (extras, token index, plans)
npm run valider -- <folder of a Foundry v14 installation>   # Foundry schemas, 0 errors expected
```

## Repository layout

```
systems/lakour-loups/         the system: logique/ (pure, tested in Node), scripts/ (Foundry), templates/, styles/, lang/
modules/lakour-veillees/      the content module: contenu/*.mjs = source of truth; src/ and assets/ built;
                              packs/ compiled (not versioned); scripts/main.js = installer; CREDITS.md
modules/lakour-mj-ia/         submodule: the shared engine (AI GM, companions, vault, build tools)
monde/                        the empty world published with each release (world.json, src/)
outils/                       fabriquer-veillees.mjs (content, compendiums), fabriquer-jetons-veillees.mjs (SVG tokens),
                              empaqueter-paquets.mjs (release archives)
essais/                       the Node tests of this repository, with their Foundry doubles
docs/                         loups-contrat.md (the contract between system, content and AI GM), plan-le-pacte.md (The
                              Pact's roadmap), gazette-de-la-lune.md (the cards, one by one), equilibre-veillees.md (the
                              measurements), plan-loup-garou.md, publication.md, captures/ (all in French)
.github/workflows/            release.yml: release on v* tags
```

## Contributing

Feedback, bug reports and ideas are welcome in the [issues](https://github.com/Hogun974/lakour-veillees/issues). To propose a
change:

- **content** is edited in `modules/lakour-veillees/contenu/*.mjs` (never in `src/` or `packs/`, which are built), then
  `npm run fabriquer-veillees` and `npm run essais`;
- the system's **logic** lives in `systems/lakour-loups/logique/`: pure functions, no Foundry, each with its tests;
  `scripts/` only wires them to Foundry;
- the **contract** `docs/loups-contrat.md` is the single source of truth for exchanges between the three pieces: update it
  with the code;
- nothing specific to this game goes into the shared engine `lakour-mj-ia`, and nothing of the engine is fixed here (parity
  rule: an engine improvement serves every world that uses it);
- everything is in French (code, comments, texts), with interface labels translated into English;
- nothing taken from a published game: no text, no map, no role list; a test rejects any mention of *Thiercelieux* in the
  content.

## Credits

- Game, texts, rules, map and code: **Jordan (La Kour)**, written with the help of an AI (**Claude**, by Anthropic) and
  reviewed by the author.
- Painted tokens (`assets/jetons/ia/`: roles, trades, buildings, extras): **AI-generated**, locally by the author (FLUX.2
  klein 9B in ComfyStudio), without any remote service or game-icons.net icon. These are the game's tokens.
- Fallback SVG tokens (and the relief version): icons from **[game-icons.net](https://game-icons.net)** (Caro Asercion,
  Cathelineau, DarkZaitzev, Delapouite, Lorc, Skoll), **CC BY 3.0** licence, recoloured and set in a medallion; the
  icon-by-icon list is in [`modules/lakour-veillees/CREDITS.md`](modules/lakour-veillees/CREDITS.md).
- Illustrations (world welcome screen, festive vigils, and the werewolf logo that replaces a camera,
  `assets/camera/loup-garou.webp`): **AI-generated**, locally by the author (FLUX.2 klein 9B in ComfyStudio), without any
  remote service. The logo's fallback (`loup-garou.svg`) is drawn by hand.
- Village map: drawn by code, no external image. Ambient sounds: synthesised loops from the shared engine.
- **An original game of the werewolf family** (social-deduction games born from the traditional game *Mafia*): nothing is
  taken from *Les Loups-garous de Thiercelieux* (a trademark of its publishers) nor from any other commercial game.

## Licence

- **The code** (the `lakour-loups` system, scripts, templates, `lang/`, tools, tests, `docs/`): **MIT** licence, see
  [`LICENSE`](LICENSE) (© 2026 Hogun974).
- **Original texts and images** (roles, trades, buildings, guides, variants, tables: `contenu/` and its English
  dictionaries, the `src/` and `packs/` compendiums, the English module `lakour-veillees-en`, the blank world `monde/`;
  map, illustrations and tokens in `assets/`): [**CC BY-NC-SA 4.0**](https://creativecommons.org/licenses/by-nc-sa/4.0/)
  (attribution, non-commercial, share-alike). Expected attribution: "LaKour — Hogun974", with a link to this repository
  and to the licence.

The folder-by-folder details and the third-party notices are in [`LICENCE-CONTENU.md`](LICENCE-CONTENU.md); both files
ship in the system, module and world archives.

The game-icons.net icons (token silhouettes) keep their own CC BY 3.0 licence. Foundry VTT is a trademark of Foundry
Gaming LLC; this project is not affiliated with it.
