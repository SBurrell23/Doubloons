// ============================================================
// Doubloons! — core game data
// The gem economy mirrors Splendor exactly; the flavour is pirate.
// ============================================================

/** The five gem colours, in cyclic order. Card costs rotate around this ring. */
export const GEMS = ['pearl', 'sapphire', 'emerald', 'ruby', 'onyx'];

/** Gold joker. Never appears in a cost — only ever spent as a substitute. */
export const GOLD = 'doubloon';

export const ALL_TOKENS = [...GEMS, GOLD];

/**
 * The five gem colours. The keys are historical — the cards and their
 * art are keyed off them — but the stones themselves are amber and
 * amethyst rather than the original pearl and onyx, which read poorly
 * as white and black against the table.
 */
export const GEM_INFO = {
  pearl: { label: 'Amber', hex: 0xdd7a1e, ui: '#f0942c', dark: '#7d3f06' },
  sapphire: { label: 'Sapphire', hex: 0x2e6fd6, ui: '#4f8ef0', dark: '#1b3f80' },
  emerald: { label: 'Emerald', hex: 0x24a95f, ui: '#35c274', dark: '#146138' },
  ruby: { label: 'Ruby', hex: 0xd4343c, ui: '#ef5159', dark: '#7d1a20' },
  onyx: { label: 'Amethyst', hex: 0x7b3aa8, ui: '#9b57c6', dark: '#3d1a57' },
  doubloon: { label: 'Doubloon', hex: 0xe8b53a, ui: '#f0c34c', dark: '#8a6414' },
};

/**
 * The colour-blind option. Amethyst against ruby and sapphire is the
 * pair that goes first for most people, so rather than lettering all
 * five stones the switch replaces that one with a white one: a
 * different colour, a different value, and a different name.
 *
 * GEM_INFO is mutated in place because everything from the card
 * painter to the 3D materials already holds a reference to it. Whoever
 * flips this is responsible for repainting what is already drawn --
 * see applyGemPalette() in main.js.
 */
const AMETHYST = { label: 'Amethyst', hex: 0x7b3aa8, ui: '#9b57c6', dark: '#3d1a57' };
const WHITE_STONE = { label: 'Pearl', hex: 0xe6ded0, ui: '#f2ece0', dark: '#877f6f' };

export function setWhiteGem(on) {
  Object.assign(GEM_INFO.onyx, on ? WHITE_STONE : AMETHYST);
}

/** Tier display names. */
export const TIER_INFO = {
  1: { name: 'Deckhands & Cargo', sub: 'Tier I' },
  2: { name: 'Ships & Outposts', sub: 'Tier II' },
  3: { name: 'Legends of the Sea', sub: 'Tier III' },
};

// ------------------------------------------------------------
// Cost patterns, expressed as offsets around the GEMS ring from
// the card's own bonus colour. o0 is the card's own colour.
// This reproduces Splendor's cost distribution exactly: every
// colour gets the same eight/six/four shapes, rotated.
// ------------------------------------------------------------

const TIER1_PATTERNS = [
  { pts: 0, cost: { o1: 1, o2: 1, o3: 1, o4: 1 } },
  { pts: 0, cost: { o1: 1, o2: 2, o3: 1, o4: 1 } },
  { pts: 0, cost: { o1: 2, o2: 2, o4: 1 } },
  { pts: 0, cost: { o0: 1, o3: 1, o4: 3 } },
  { pts: 0, cost: { o3: 2, o4: 1 } },
  { pts: 0, cost: { o1: 2, o3: 2 } },
  { pts: 0, cost: { o3: 3 } },
  { pts: 1, cost: { o2: 4 } },
];

const TIER2_PATTERNS = [
  { pts: 1, cost: { o1: 3, o2: 2, o3: 2 } },
  { pts: 1, cost: { o0: 2, o1: 3, o3: 3 } },
  { pts: 2, cost: { o2: 1, o3: 4, o4: 2 } },
  { pts: 2, cost: { o3: 5, o4: 3 } },
  { pts: 2, cost: { o1: 5 } },
  { pts: 3, cost: { o4: 6 } },
];

const TIER3_PATTERNS = [
  { pts: 3, cost: { o1: 3, o2: 3, o3: 5, o4: 3 } },
  { pts: 4, cost: { o4: 7 } },
  { pts: 4, cost: { o0: 3, o3: 3, o4: 6 } },
  { pts: 5, cost: { o0: 3, o4: 7 } },
];

// ------------------------------------------------------------
// Flavour names — eight / six / four per colour per tier.
// ------------------------------------------------------------

const NAMES = {
  pearl: {
    1: ['Sailmender', 'Bosun', 'Salt Cook', 'Rope Coil', 'Spyglass', 'Moonlit Cask', 'Bone Dice', 'Pearl Diver'],
    2: ['Whitesail Sloop', 'Gullcliff Dock', 'Bleached Skerry', 'Saltworks', 'Ivory Galleon', 'Pearl Atoll'],
    3: ['The Pale Leviathan', 'Cathedral of Foam', 'Admiral Whitetide', 'The Ghost Armada'],
  },
  sapphire: {
    1: ['Helmsman', 'Tide Charts', 'Rain Barrel', 'Blue Lantern', 'Deep Sounder', 'Storm Whistle', 'Kelp Net', 'Wavecutter'],
    2: ['Stormrider Brig', 'Tidewatch Tower', 'Drowned Cove', 'Azure Reef', 'Bluewater Cutter', 'Maelstrom Berth'],
    3: ['The Krakens Eye', 'Throne of the Deep', 'Tempest Sovereign', 'The Drowning Crown'],
  },
  emerald: {
    1: ['Jungle Scout', 'Parrot Lookout', 'Lime Crate', 'Vine Rigging', 'Green Glass', 'Turtle Shell', 'Fern Charm', 'Mangrove Guide'],
    2: ['Verdant Schooner', 'Jungle Hideaway', 'Serpent Lagoon', 'Emerald Bay', 'Palmwood Barque', 'Smugglers Grove'],
    3: ['The Sea Serpent', 'Heart of the Isle', 'Viridian Warlord', 'The Emerald Compact'],
  },
  ruby: {
    1: ['Powder Monkey', 'Gunners Mate', 'Rum Cask', 'Red Sash', 'Fire Pot', 'Signal Flare', 'Cutlass', 'Scarlet Flag'],
    2: ['Crimson Frigate', 'Cannon Foundry', 'Ember Harbour', 'Bloodtide Raider', 'Ruby Anchorage', 'Powder Magazine'],
    3: ['The Burning Fleet', 'Forge of the Fallen', 'Crimson Corsair King', 'The Last Broadside'],
  },
  onyx: {
    1: ['Night Watch', 'Tar Bucket', 'Black Sash', 'Shadow Skiff', 'Iron Hook', 'Coal Store', 'Crows Nest', 'Grave Compass'],
    2: ['Blackwater Galleon', 'Smugglers Vault', 'Obsidian Cay', 'Nightfall Corvette', 'Onyx Drydock', 'The Tarred Keel'],
    3: ['The Black Flag', 'Vault of Dead Men', 'Lord of the Long Night', 'The Unlit Sea'],
  },
};

// ------------------------------------------------------------
// Deck construction
// ------------------------------------------------------------

function costFromPattern(bonus, pattern) {
  const base = GEMS.indexOf(bonus);
  const cost = {};
  for (const [key, amount] of Object.entries(pattern)) {
    const offset = Number(key.slice(1));
    cost[GEMS[(base + offset) % GEMS.length]] = amount;
  }
  return cost;
}

function buildTier(tier, patterns) {
  const cards = [];
  for (const bonus of GEMS) {
    patterns.forEach((pattern, i) => {
      cards.push({
        id: `t${tier}-${bonus}-${i}`,
        tier,
        bonus,
        points: pattern.pts,
        cost: costFromPattern(bonus, pattern.cost),
        name: NAMES[bonus][tier][i],
      });
    });
  }
  return cards;
}

/** All 90 development cards, keyed by tier. */
export function buildDecks() {
  return {
    1: buildTier(1, TIER1_PATTERNS),
    2: buildTier(2, TIER2_PATTERNS),
    3: buildTier(3, TIER3_PATTERNS),
  };
}

// ------------------------------------------------------------
// Pirate Lords (the "nobles"). Ten tiles; each worth 3 infamy.
// Requirements are bonus counts only — never tokens.
// ------------------------------------------------------------

export const LORDS = [
  { id: 'lord-1', name: 'Mad Jack Corrow', title: 'the Reefbreaker', req: { sapphire: 4, emerald: 4 } },
  { id: 'lord-2', name: 'Dame Isolde Vane', title: 'the Threefold', req: { pearl: 3, ruby: 3, onyx: 3 } },
  { id: 'lord-3', name: 'Capt. Bellweather', title: 'the Pale Hand', req: { pearl: 4, ruby: 4 } },
  { id: 'lord-4', name: 'Rasha Coldwater', title: 'the Vine Queen', req: { emerald: 4, ruby: 4 } },
  { id: 'lord-5', name: 'Old Tom Sixpence', title: 'the Bone Broker', req: { pearl: 4, onyx: 4 } },
  { id: 'lord-6', name: 'Serafina Drake', title: 'the Red Widow', req: { ruby: 4, onyx: 4 } },
  { id: 'lord-7', name: 'Nicodemus Quill', title: 'the Chartsmith', req: { pearl: 3, sapphire: 3, emerald: 3 } },
  { id: 'lord-8', name: 'The Gull of Marrow', title: 'the Unseen', req: { sapphire: 3, emerald: 3, ruby: 3 } },
  { id: 'lord-9', name: 'Bartholomew Sear', title: 'the Night Tide', req: { pearl: 3, sapphire: 3, onyx: 3 } },
  { id: 'lord-10', name: 'Anselm the Drowned', title: 'the Green Fathom', req: { emerald: 3, ruby: 3, onyx: 3 } },
];

export const LORD_POINTS = 3;

/** Token supply per gem colour, by player count. Gold is always 5. */
export const GEM_SUPPLY = { 2: 4, 3: 5, 4: 7 };
export const GOLD_SUPPLY = 5;
export const MAX_TOKENS_HELD = 10;
export const MAX_RESERVED = 3;
export const DEFAULT_TARGET_POINTS = 15;
