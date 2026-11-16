// ALL AUTHORED CONTENT LIVES HERE. Edit freely: no code changes needed.
// Times are in game minutes. [centre, spread] pairs are organic values.

import type { Organic } from "./core.js";

// ---------------------------------------------------------------------------
// The map. One character per tile. See TILE_LEGEND below.
export const MAP: string[] = [
  "######################o###########",
  "#B~~d~w~#::#,,SS,R,O,,,,,,,,,PPPP#",
  "#B~~~~~~#::#,,,,,,,,,,,,,,,,,,,,,#",
  "#~~~~~~~#::#,,,,,,,,,,,,,,,,,,,,,#",
  "o~~~~~~~D::#,,,,,,,,KK,,,,,,,,,,,#",
  "#~~~~~~~#::#,,,,,,,,,,,,,,,,,,,,,#",
  "#~~~~~~~#::#W,,,,,,,,,,,,,,,,,,,,#",
  "#########::#nDnnnnhnnnZnHnDnAnYnV#",
  "#..........#_____________________#",
  "#..........#_==k===k===k=g==k===f#",
  "#.............s.s.s.s.s.s.s.s.s..#",
  "o................................o",
  "#G..............c....c...........#",
  "#.........ctc..ctc..ctc..ctc.....#",
  "#...............c....c..........F#",
  "#...............................F#",
  "###..###........c....c....ccc....#",
  "#X;;;;;#..ctc..ctc..ctc..ctttc...#",
  "#b;;;;b#........c....c....ccc....o",
  "#b;;;;b#.........................#",
  "#b;;;;b#.........................#",
  "###E########o#######o#######o#####",
];

export type TileKind =
  | "wall" | "floor" | "staff" | "door" | "front"
  | "stool" | "chair" | "bench" | "table" | "counter"
  | "furniture";

export interface TileDef {
  kind: TileKind;
  floor: string; // floor colour drawn underneath
  label?: string; // short label drawn on furniture
  name?: string; // name shown in prompts
  interact?: InteractKind;
}

export type InteractKind =
  | "bed" | "desk" | "wardrobe" | "station" | "hatch" | "tap" | "garnish"
  | "frontdoor" | "fireplace" | "pantry" | "coats" | "table" | "piesafe" | "bin" | "snacks" | "gramophone";

const C = {
  wall: "#2a211d",
  window: "#4f6474",
  tap: "#8a6a4a",
  kitchen: "#a39c8e",
  bed: "#7a5c48",
  hall: "#6e5644",
  staff: "#7d5f43",
  entry: "#7c766c",
};

export const TILE_LEGEND: Record<string, TileDef> = {
  "#": { kind: "wall", floor: C.wall },
  n: { kind: "wall", floor: "#4a3a2e", name: "Nook" }, // a gap in the counter wall where a kettle or a coffee pot can stand
  f: { kind: "door", floor: C.staff, name: "Counter flap" }, // the service door through the counter: the keeper only
  r: { kind: "wall", floor: "#3a302a", name: "Let to a tenant" }, // the small tavern's spare room: someone else's storage, locked
  o: { kind: "wall", floor: C.window, name: "Window" }, // rain is heard at the windows
  ".": { kind: "floor", floor: C.tap },
  ";": { kind: "floor", floor: C.entry },
  "~": { kind: "staff", floor: C.bed },
  ":": { kind: "staff", floor: C.hall },
  ",": { kind: "staff", floor: C.kitchen },
  _: { kind: "staff", floor: C.staff },
  D: { kind: "door", floor: C.hall },
  E: { kind: "front", floor: C.entry, label: "Door", name: "Front door", interact: "frontdoor" },
  s: { kind: "stool", floor: C.tap },
  b: { kind: "bench", floor: C.entry },
  c: { kind: "chair", floor: C.tap },
  t: { kind: "table", floor: C.tap, label: "", name: "Table", interact: "table" },
  "=": { kind: "counter", floor: C.staff, label: "", name: "Counter" },
  g: { kind: "counter", floor: C.staff, label: "Gar", name: "Garnish spot", interact: "garnish" },
  h: { kind: "furniture", floor: C.kitchen, label: "Hatch", name: "Kitchen hatch", interact: "hatch" },
  Z: { kind: "furniture", floor: C.staff, label: "Pies", name: "Pie safe", interact: "piesafe" },
  A: { kind: "furniture", floor: C.staff, label: "Ale", name: "Ale tap", interact: "tap" },
  Y: { kind: "furniture", floor: C.staff, label: "Cid", name: "Cider tap", interact: "tap" },
  S: { kind: "furniture", floor: C.kitchen, label: "Stove", name: "Stove", interact: "station" },
  R: { kind: "furniture", floor: C.kitchen, label: "Pan", name: "Griddle", interact: "station" },
  O: { kind: "furniture", floor: C.kitchen, label: "Oven", name: "Oven", interact: "station" },
  H: { kind: "furniture", floor: C.staff, label: "Kettle", name: "Tea kettle", interact: "station" },
  V: { kind: "furniture", floor: C.staff, label: "Coffee", name: "Coffee pot", interact: "station" },
  k: { kind: "counter", floor: C.staff, label: "", name: "Snack spot", interact: "snacks" },
  G: { kind: "furniture", floor: C.tap, label: "♫", name: "Gramophone", interact: "gramophone" }, // a bowl here serves the stools beside it
  K: { kind: "furniture", floor: C.kitchen, label: "Prep", name: "Prep table", interact: "station" },
  W: { kind: "furniture", floor: C.kitchen, label: "Bin", name: "Scrap bin", interact: "bin" },
  P: { kind: "furniture", floor: C.kitchen, label: "Pantry", name: "Pantry", interact: "pantry" },
  F: { kind: "furniture", floor: C.tap, label: "Fire", name: "Fireplace", interact: "fireplace" },
  B: { kind: "furniture", floor: C.bed, label: "Bed", name: "Bed", interact: "bed" },
  d: { kind: "furniture", floor: C.bed, label: "Desk", name: "Desk", interact: "desk" },
  w: { kind: "furniture", floor: C.bed, label: "Ward", name: "Wardrobe", interact: "wardrobe" },
  X: { kind: "furniture", floor: C.entry, label: "Coats", name: "Coat rack", interact: "coats" },
};

// ---------------------------------------------------------------------------
// Kitchen equipment: bought at the desk and placed anywhere in the kitchen (or behind the bar), moved
// whenever you like. Not part of the map: the letters below only say where the first ones stand.
// Each piece has one or more slots, each a place to cook: a hob takes a pot or a pan, an oven bakes.

export interface EquipSlot { name: string; kinds: StationKind[] }
export interface Equipment {
  id: string;
  name: string;
  label: string; // drawn on it
  icon: string;
  w: number; // footprint in tiles
  h: number;
  slots: EquipSlot[];
  blurb: string;
  boilSpeed?: number; // kettles: how much faster than the plain one
  urn?: boolean; // brews a whole urn of tea, poured by the cup
  kind?: "piesafe" | "tap"; // not a place to cook: works like this furniture instead
  tap?: string; // a barrel: the drink it pours (a recipe id)
  /** Where it's listed in the shop. */
  group: EquipGroup;
  /** What it burns, if anything. */
  fuel?: Fuel;
}

export type EquipGroup = "cooking" | "drinks" | "storage";
export const EQUIP_GROUPS: { id: EquipGroup | "goods"; name: string; icon: string }[] = [
  { id: "cooking", name: "Cooking", icon: "🔥" },
  { id: "drinks", name: "Drinks", icon: "🍺" },
  { id: "storage", name: "Storage", icon: "🗄️" },
  { id: "goods", name: "Supplies", icon: "📦" },
];
export type Fuel = "wood";
export const FUELS: Record<Fuel, { icon: string; name: string }> = { wood: { icon: "🪵", name: "wood" } };

const HOB: EquipSlot = { name: "Hob", kinds: ["stove", "griddle"] }; // a pot or a pan
const OVEN: EquipSlot = { name: "Oven", kinds: ["oven"] };

export const EQUIPMENT: Equipment[] = [
  { id: "stove1", name: "Wood stove", label: "Stove", icon: "🔥", w: 2, h: 1, slots: [HOB], group: "cooking", fuel: "wood",
    blurb: "A small stove with one hob: a pot of stew or porridge, or a pan for eggs, toast or fish. One at a time." },
  { id: "stove2", name: "Two-hob stove", label: "Stove ⚬⚬", icon: "🍳", w: 2, h: 1, slots: [HOB, HOB], group: "cooking", fuel: "wood",
    blurb: "Two hobs: a pot and a pan, two pots, two pans, whatever the day needs." },
  { id: "range", name: "Range stove", label: "Range stove", icon: "🥧", w: 2, h: 1, slots: [HOB, OVEN], group: "cooking", fuel: "wood",
    blurb: "A range stove: one hob on top and an oven below, for pies and roasts." },
  { id: "oven", name: "Bread oven", label: "Oven", icon: "🍞", w: 2, h: 1, slots: [OVEN, OVEN], group: "cooking", fuel: "wood",
    blurb: "A big brick oven with room for two bakes at once: bread, pies, a roast, in any pair." },
  { id: "prep", name: "Prep table", label: "Prep", icon: "🔪", w: 2, h: 1, slots: [{ name: "Table", kinds: ["prep"] }], group: "cooking",
    blurb: "A scrubbed table and a good knife, for cold dishes put together by hand." },
  { id: "kettle", name: "Tea kettle", label: "Kettle", icon: "🫖", w: 1, h: 1, slots: [{ name: "Kettle", kinds: ["kettle"] }], group: "drinks",
    blurb: "Boil it once, then steep a cup at a time, each with its own leaf." },
  { id: "copperkettle", name: "Copper kettle", label: "Copper", icon: "🫖", w: 1, h: 1, slots: [{ name: "Kettle", kinds: ["kettle"] }], boilSpeed: 2, group: "drinks",
    blurb: "Boils twice as fast as the plain one." },
  { id: "urn", name: "Tea urn", label: "Urn", icon: "⚱️", w: 1, h: 1, slots: [{ name: "Urn", kinds: ["kettle"] }], urn: true, group: "drinks",
    blurb: "Brews a whole urn of one tea, about 8 cups, poured straight from it." },
  { id: "coffee", name: "Coffee pot", label: "Coffee", icon: "☕", w: 1, h: 1, slots: [{ name: "Coffee pot", kinds: ["coffee"] }], group: "drinks",
    blurb: "A whole pot at a time, poured by the cup until it's gone." },
  { id: "alekeg", name: "Ale barrel", label: "Ale", icon: "🍺", w: 1, h: 1, slots: [], kind: "tap", tap: "ale", group: "drinks",
    blurb: "A barrel of ale on a tap. Another one means a second place to pour from." },
  { id: "ciderkeg", name: "Cider barrel", label: "Cid", icon: "🍏", w: 1, h: 1, slots: [], kind: "tap", tap: "cider", group: "drinks",
    blurb: "A barrel of cider on a tap. Another one means a second place to pour from." },
  { id: "piesafe", name: "Pie safe", label: "Pies", icon: "🥧", w: 1, h: 1, slots: [], kind: "piesafe", group: "storage",
    blurb: "A screened cupboard that keeps whole pies, sliced as they're asked for. Each holds 4 pies; your pie safes share them." },
];

/** Where the first equipment stands, by map letter. The old separate pan ("R") is gone: hobs take pans now. */
export const EQUIPMENT_OF_TILE: Record<string, string> = { S: "stove1", O: "oven", K: "prep", H: "kettle", V: "coffee", Z: "piesafe", A: "alekeg", Y: "ciderkeg" };
/** What's under an equipment letter once it's lifted off the map. */
export const UNDER_EQUIPMENT: Record<string, string> = { S: ",", R: ",", O: ",", K: ",", H: "n", V: "n", Z: "n", A: "n", Y: "n" };
/** Tiles equipment can stand on: the kitchen floor, behind the bar, and the nooks in the counter wall. */
export const PLACEABLE_ON = [",", "_", "n"];

/** Things to buy that aren't placed. */
export interface Goods { id: string; name: string; icon: string; blurb: string; fuel?: Fuel }
export const GOODS: Goods[] = [
  { id: "trays", name: "Wider trays", icon: "🍽️", blurb: "Carry 3 dishes per tray, and 5 drinks." },
  { id: "firewood", name: "Seasoned oak", icon: "🪵", fuel: "wood", blurb: "Dry, well-split firewood that burns hotter: everything on a hob, in an oven or over a flame cooks a little faster." },
];
/** Seasoned oak: how much faster anything heated cooks. */
export const FIREWOOD_BOOST = 1.12;

/** Which drink each tap letter pours. */
export const TAP_OF_TILE: Record<string, string> = { A: "ale", Y: "cider" };

export const ROOM_LABELS: { text: string; x: number; y: number }[] = [
  { text: "Bedroom", x: 4, y: 5.6 },
  { text: "Kitchen", x: 22, y: 6.2 },
  { text: "Taproom", x: 20, y: 11.6 },
  { text: "Coat hall", x: 4, y: 19.8 },
];

// ---------------------------------------------------------------------------
// The inns you can start in. Each has its own map, room names, hanging lamps and which rooms open onto
// which (for how sound carries). The equipment drawn on a map is where it starts; it can be moved.

export type InnId = "medium" | "small";
export interface Inn {
  id: InnId;
  name: string;
  icon: string;
  blurb: string;
  traits: string[];
  map: string[];
  rooms: { text: string; x: number; y: number }[];
  lamps: { x: number; y: number; r: number }[];
  roomLinks: [string, string][];
}

/**
 * The small tavern: the real start. Two four-seat tables and three stools, a small fire, the gramophone,
 * a one-hob stove, a kettle, one barrel of ale and the pantry. No oven, no prep table. The kitchen's spare
 * room is let to a tenant as storage.
 */
export const SMALL_MAP: string[] = [
  "####o#######o#########",
  "#B~dw~#,,SS,PPP#rrrrr#",
  "#B~~~~#,,,,,,,,#rrrrr#",
  "#~~~~~#,,,,,,,,#rrrrr#",
  "#~~~~~#W,,,,,,,#rrrrr#",
  "###D###nDnHnAn##rrrrr#",
  "#.....#_______#......#",
  "#G....#==g=k=f#......#",
  "#.......s.s.s........#",
  "o...c...............F#",
  "#..ctc.........c....F#",
  "#...c.........ctc....#",
  "#..............c.....o",
  "####o###E######o######",
];

export const INNS: Inn[] = [
  {
    id: "medium", name: "The big tavern", icon: "🏰", traits: ["busy", "needs staff"],
    blurb: "Six tables, a long bar, an oven and pies, a coat hall. Lively, and a lot for one keeper: you'll lose some guests at the busy times.",
    map: MAP, rooms: ROOM_LABELS,
    lamps: [
      { x: 4.5, y: 3.5, r: 4 }, // bedroom
      { x: 10, y: 5, r: 2.5 }, // hall
      { x: 17, y: 3.5, r: 5 }, { x: 27, y: 3.5, r: 5 }, // kitchen
      { x: 5.5, y: 11, r: 5 }, // taproom, by the door side
      { x: 16, y: 9.5, r: 5 }, { x: 26, y: 9.5, r: 5 }, // along the counter
      { x: 3.5, y: 18.5, r: 3.5 }, // coat hall
    ],
    roomLinks: [["bedroom", "hall"], ["hall", "taproom"], ["kitchen", "taproom"], ["entry", "taproom"]],
  },
  {
    id: "small", name: "A small tavern", icon: "🏠", traits: ["cosy", "one keeper"],
    blurb: "Two tables, three stools at a short bar, a small fire. A one-hob stove, a kettle and a barrel of ale; no oven yet. The spare room is let to a tenant.",
    map: SMALL_MAP,
    rooms: [
      { text: "Bedroom", x: 3.5, y: 3.6 },
      { text: "Kitchen", x: 11, y: 3.4 },
      { text: "Let out", x: 18.5, y: 3.2 },
      { text: "Taproom", x: 10, y: 11.2 },
    ],
    lamps: [
      { x: 3.5, y: 2.5, r: 3.5 }, // bedroom
      { x: 11, y: 2.5, r: 4 }, // kitchen
      { x: 10, y: 6.5, r: 3.5 }, // behind the bar
      { x: 4.5, y: 10, r: 4.5 }, { x: 15.5, y: 10, r: 4.5 }, // over the tables
    ],
    roomLinks: [["bedroom", "taproom"], ["kitchen", "taproom"]],
  },
];
export const innOf = (id: InnId | undefined): Inn => INNS.find((i) => i.id === id) ?? INNS[0];

// ---------------------------------------------------------------------------
// Tags, ingredients, recipes.
// Tags are deliberately a little evocative, and few ingredients share one.

export type StationKind = "stove" | "griddle" | "oven" | "kettle" | "coffee" | "prep";

export interface Ingredient { id: string; name: string; icon: string; tags: string[] }

export const INGREDIENTS: Ingredient[] = [
  { id: "beef", icon: "🥩", name: "Beef", tags: ["rich"] },
  { id: "mushroom", icon: "🍄", name: "Mushroom", tags: ["earthy"] },
  { id: "roots", icon: "🥕", name: "Root veg", tags: ["sweet", "homely"] },
  { id: "pepper", icon: "🌶️", name: "Pepper", tags: ["fiery"] },
  { id: "herbs", icon: "🌿", name: "Herbs", tags: ["fragrant"] },
  { id: "sausage", icon: "🌭", name: "Smoked sausage", tags: ["smoky"] },
  { id: "apple", icon: "🍎", name: "Apple", tags: ["sweet", "crisp"] },
  { id: "berry", icon: "🫐", name: "Berries", tags: ["tart"] },
  { id: "meat", icon: "🍖", name: "Minced meat", tags: ["rich", "savoury"] },
  { id: "cheese", icon: "🧀", name: "Cheese & onion", tags: ["savoury"] },
  { id: "walnut", icon: "🌰", name: "Walnut", tags: ["earthy", "crisp"] },
  { id: "radish", icon: "🔴", name: "Radish", tags: ["fiery", "crisp"] },
  { id: "herring", icon: "🐟", name: "Pickled herring", tags: ["briny"] },
  { id: "crumb", icon: "🍞", name: "Breadcrumb", tags: ["crisp"] },
  { id: "zest", icon: "🍋", name: "Lemon zest", tags: ["bright"] },
  { id: "mint", icon: "🌱", name: "Mint", tags: ["fragrant"] },
  { id: "chamomile", icon: "🌼", name: "Chamomile", tags: ["homely"] },
  { id: "black", icon: "🍂", name: "Black leaf", tags: ["bitter"] },
  { id: "smokedleaf", icon: "🪵", name: "Smoked leaf", tags: ["smoky"] },
  { id: "lightroast", icon: "🫘", name: "Light roast", tags: ["bright"] },
  { id: "darkroast", icon: "☕", name: "Dark roast", tags: ["bitter"] },
  { id: "chicory", icon: "🌾", name: "Chicory", tags: ["earthy"] },
  { id: "spiced", icon: "🧂", name: "Spiced blend", tags: ["fiery"] },
  // Mornings and roasts
  { id: "butter", icon: "🧈", name: "Butter", tags: ["rich", "homely"] },
  { id: "honey", icon: "🍯", name: "Honey", tags: ["sweet"] },
  { id: "bacon", icon: "🥓", name: "Bacon", tags: ["smoky", "salty"] },
  { id: "tomato", icon: "🍅", name: "Fried tomato", tags: ["tart", "savoury"] },
  { id: "chives", icon: "🌿", name: "Chives", tags: ["fragrant", "bright"] },
  { id: "pork", icon: "🐖", name: "Pork", tags: ["rich", "savoury"] },
  { id: "lamb", icon: "🐑", name: "Lamb", tags: ["rich", "fragrant"] },
  { id: "fowl", icon: "🐓", name: "Fowl", tags: ["homely", "light"] },
];

export type ItemKind = "food" | "drink";

export interface Recipe {
  id: string;
  name: string;
  kind: ItemKind;
  station: StationKind | "tap";
  baseTags: string[];
  slots: number; // ingredients you must choose
  maxSlots?: number; // ...and may choose, if more than that (default: the same). Meant to grow through progression or cards, not by default
  options: string[]; // ingredient ids allowed in the slots
  blurb?: string; // shown when you choose it at the station
  minutes: Organic; // crafting time
  tended?: boolean; // only progresses while the keeper is at the station
  servings?: Organic; // made whole and served in portions: a pot of stew, a pie in slices
  storedIn?: "piesafe"; // a whole one waits on the station; the keeper carries it to the pie safe, where it's sliced
  internal?: boolean; // made at a station but never ordered or put on the bill of fare (hot water for tea)
  batch?: string; // what a whole batch is called when it's ready ("a roast"); default: a pot of it
  icon: string;
}

export const RECIPES: Recipe[] = [
  { id: "stew", blurb: "A pot that keeps the whole room warm. Slow to make and generous once it's done: it feeds whoever asks, a ladle at a time, until the pot scrapes bottom.", icon: "🍲", name: "Stew", kind: "food", station: "stove", baseTags: ["warm", "hearty"], slots: 2,
    options: ["beef", "mushroom", "roots", "pepper", "herbs", "sausage"], minutes: [14, 3], servings: [7, 1] },
  { id: "fish", blurb: "Fresh from the morning boats, into a hot pan. It needs you standing over it the whole time, and it's worth it.", icon: "🐟", name: "Fried fish", kind: "food", station: "griddle", baseTags: ["warm", "briny"], slots: 1,
    options: ["crumb", "herbs", "zest"], minutes: [6, 1.5], tended: true },
  { id: "pie", blurb: "Golden and lidded, cut into slices that keep in the pie safe. Tomorrow it's day-old, and still somebody's favourite.", icon: "🥧", name: "Pie", kind: "food", station: "oven", baseTags: ["warm", "homely"], slots: 1,
    options: ["apple", "berry", "meat", "cheese"], minutes: [20, 4], servings: [6, 1], storedIn: "piesafe" },
  { id: "salad", blurb: "Cold and crisp, put together by hand at the prep table. Quick to make, and easy to get just right.", icon: "🥗", name: "Salad", kind: "food", station: "prep", baseTags: ["cold", "light"], slots: 2,
    options: ["apple", "walnut", "radish", "herbs", "cheese", "herring"], minutes: [4, 1] },
  // Breakfast and other quick pan dishes: tended, like the fish.
  { id: "scrambled", blurb: "Beaten, into a buttered pan, stirred slow until they just set. Stay with them; they turn rubbery the moment you look away.", icon: "🍳", name: "Scrambled eggs", kind: "food", station: "griddle", baseTags: ["warm", "mild"], slots: 1,
    options: ["chives", "cheese", "bacon", "mushroom", "pepper"], minutes: [4, 1], tended: true },
  { id: "toast", blurb: "Thick slices from the baker's loaf, browned in the pan. Quick, cheap, and nobody's ever sorry to see it.", icon: "🍞", name: "Toast", kind: "food", station: "griddle", baseTags: ["warm", "crisp"], slots: 1,
    options: ["butter", "honey", "berry", "cheese", "herring"], minutes: [3, 0.8], tended: true },
  { id: "fryup", blurb: "The working breakfast: whatever's in the larder, fried in one pan and piled on one plate. Sets anyone up till noon.", icon: "🥓", name: "Fried breakfast", kind: "food", station: "griddle", baseTags: ["warm", "hearty", "savoury"], slots: 2,
    options: ["bacon", "sausage", "mushroom", "tomato", "crumb"], minutes: [7, 1.5], tended: true },
  // A pot for the morning
  { id: "porridge", blurb: "Oats, milk and a long slow stir. A pot of it carries the morning crowd, a bowl at a time.", icon: "🥣", name: "Porridge", kind: "food", station: "stove", baseTags: ["warm", "homely", "mild"], slots: 1,
    options: ["honey", "apple", "berry", "walnut", "butter"], minutes: [10, 2], servings: [7, 1] },
  // Bread: a batch of loaves, sliced to order until it's gone. Good alongside a stew or a soup.
  { id: "bread", blurb: "A batch of loaves from the oven, crusty outside and soft in the middle, sliced to order. Good alongside a stew.", icon: "🍞", name: "Bread", kind: "food", station: "oven", baseTags: ["warm", "homely"], slots: 1,
    options: ["butter", "herbs", "walnut", "cheese", "honey"], minutes: [18, 3], servings: [8, 1], batch: "a batch of bread" },
  // Roasts: a whole joint in the oven, carved to order until it's gone. It holds the oven while it lasts.
  { id: "roast", blurb: "A whole joint in the oven, an afternoon's work, carved to order until the bone's bare. The oven's taken while it lasts.", icon: "🍖", name: "Roast", kind: "food", station: "oven", baseTags: ["warm", "hearty", "rich"], slots: 2,
    options: ["beef", "pork", "lamb", "fowl", "roots", "herbs", "apple"], minutes: [26, 4], servings: [9, 1.5], batch: "a roast" },
  { id: "coffee", blurb: "A whole pot at a time, poured by the cup until it's gone. The beans decide what kind of morning it is.", icon: "☕", name: "Coffee", kind: "drink", station: "coffee", baseTags: ["warm", "rich"], slots: 1,
    options: ["lightroast", "darkroast", "chicory", "spiced"], minutes: [8, 2], servings: [7, 1] },
  { id: "water", internal: true, blurb: "Boil the kettle once, then steep a cup at a time, each with the leaf its drinker likes, until the water's gone.", icon: "♨️", name: "Boil the kettle", kind: "drink", station: "kettle", baseTags: ["warm"], slots: 0,
    options: [], minutes: [4, 1], servings: [3, 0.8] },
  { id: "tea", blurb: "A cup for one, steeped behind the counter. What goes in the pot decides who it comforts.", icon: "🍵", name: "Tea", kind: "drink", station: "kettle", baseTags: ["warm", "mild"], slots: 1,
    options: ["mint", "chamomile", "black", "smokedleaf"], minutes: [3, 1] },
  { id: "ale", icon: "🍺", name: "Ale", kind: "drink", station: "tap", baseTags: ["cold", "bitter", "hearty"], slots: 0,
    options: [], minutes: [0, 0] },
  { id: "cider", icon: "🍏", name: "Cider", kind: "drink", station: "tap", baseTags: ["cold", "crisp", "sweet"], slots: 0,
    options: [], minutes: [0, 0] },
];

// Snack bowls: complimentary, set on a table. Their tags join the table's visit.
export interface Snack { id: string; name: string; icon: string; tags: string[]; thirsty: number; blurb?: string }

export const SNACKS: Snack[] = [
  { id: "peanuts", name: "Salted peanuts", icon: "🥜", tags: ["salty", "crisp"], thirsty: 0.3, blurb: "Roasted and well salted. Nothing sends people to the bar faster." },
  { id: "olives", name: "Olives", icon: "🫒", tags: ["briny", "salty"], thirsty: 0.25, blurb: "Brined and glossy, for those who like a sharp edge." },
  { id: "eggs", name: "Pickled eggs", icon: "🥚", tags: ["tart", "savoury"], thirsty: 0.1, blurb: "From the big jar on the counter. An acquired taste, fondly acquired." },
  { id: "crostini", name: "Crostini", icon: "🥖", tags: ["crisp", "savoury"], thirsty: 0.15, blurb: "Little toasts rubbed with garlic and a slick of oil. Gone before you've turned round." },
  { id: "breadbutter", name: "Bread & butter", icon: "🍞", tags: ["homely", "rich"], thirsty: 0.05, blurb: "Thick slices and a pat of butter. Nobody says no to it." },
  { id: "cheese", name: "Cheese board", icon: "🧀", tags: ["rich", "savoury"], thirsty: 0.15, blurb: "A hard cheese, a soft one and something blue, cut into cubes." },
  { id: "pretzels", name: "Pretzels", icon: "🥨", tags: ["salty", "crisp"], thirsty: 0.3, blurb: "Knotted, baked dark, crusted with salt. Thirsty work." },
  { id: "chestnuts", name: "Roast chestnuts", icon: "🌰", tags: ["earthy", "sweet"], thirsty: 0.05, blurb: "Split and roasted by the fire, still warm in the paper." },
  { id: "onions", name: "Pickled onions", icon: "🧅", tags: ["tart", "fiery"], thirsty: 0.15, blurb: "Small, sharp and vinegary, from the crock under the counter." },
  { id: "apples", name: "Dried apple rings", icon: "🍎", tags: ["sweet", "crisp"], thirsty: 0.05, blurb: "Chewy, sweet, and gentle on the thirst." },
];

export interface Garnish { id: string; name: string; tags: string[]; icon: string }

export const GARNISHES: Garnish[] = [
  { id: "lemon", icon: "🍋", name: "Lemon", tags: ["bright", "tart"] },
  { id: "honey", icon: "🍯", name: "Honey", tags: ["sweet"] },
  { id: "spice", icon: "🌶️", name: "Spice", tags: ["warm", "fiery"] },
  { id: "sprig", icon: "🌿", name: "Mint sprig", tags: ["fragrant"] },
];

// ---------------------------------------------------------------------------
// Patrons. Stage 1: archetype visitors only, all Open schema.

export interface TasteSet { love: string[]; like: string[]; dislike: string[] }

export interface Archetype {
  id: string;
  name: string;
  color: string;
  weight: number; // how often they turn up
  /** 0..1: how readily one of them gives their name (a chance at each hello and each serve). */
  openness: number;
  needs: NeedLevels; // how hungry, thirsty and cold they tend to arrive
  weather: WeatherTaste; // weather they love or dislike (by weather tag)
  tastes: TasteSet;
  extraLikes: string[]; // each visitor draws one of these as a personal extra like
  fussiness: Organic; // 0..1
  patience: Organic; // minutes they'll wait for an order before it starts to wear
  stay: Organic; // minutes they intend to stay
  consume: Organic; // minutes to eat or drink one serving
  walk: Organic; // tiles per real second at speed x1
  foodBias: number; // a leaning toward food (1) or drink (0), on top of hunger and thirst
  garnishAsk: number; // chance a drink order asks for a garnish
  messiness: Organic; // 0..1
}

export const ARCHETYPES: Archetype[] = [
  { id: "dock", openness: 0.45, name: "Dockworker", color: "#b5651d", weight: 3,
    weather: { love: [], dislike: ["stormy", "cold"] },
    needs: { hunger: [0.5, 0.15], thirst: [0.75, 0.15], warmth: [0.3, 0.15] },
    tastes: { love: ["rich", "hearty"], like: ["smoky", "savoury", "bitter", "salty"], dislike: ["light", "fragrant"] },
    extraLikes: ["fiery", "briny", "warm"],
    fussiness: [0.5, 0.2], patience: [40, 10], stay: [120, 40], consume: [22, 6], walk: [2.6, 0.4],
    foodBias: 0.6, garnishAsk: 0.15, messiness: [0.7, 0.2] },
  { id: "scholar", openness: 0.2, name: "Scholar", color: "#5b7fb5", weight: 2,
    weather: { love: ["rain", "light-rain"], dislike: ["sunny"] },
    needs: { hunger: [0.35, 0.15], thirst: [0.45, 0.15], warmth: [0.4, 0.15] },
    tastes: { love: ["fragrant"], like: ["mild", "homely", "bright"], dislike: ["fiery", "smoky", "salty"] },
    extraLikes: ["tart", "crisp", "warm"],
    fussiness: [0.7, 0.15], patience: [32, 8], stay: [100, 30], consume: [26, 6], walk: [2.0, 0.3],
    foodBias: 0.4, garnishAsk: 0.4, messiness: [0.15, 0.1] },
  { id: "traveller", openness: 0.55, name: "Traveller", color: "#6f9e5a", weight: 3,
    weather: { love: ["sunny"], dislike: ["rain", "stormy"] },
    needs: { hunger: [0.75, 0.15], thirst: [0.5, 0.15], warmth: [0.45, 0.15] },
    tastes: { love: ["warm"], like: ["hearty", "sweet", "homely", "savoury", "crisp"], dislike: [] },
    extraLikes: ["earthy", "rich", "bright"],
    fussiness: [0.2, 0.15], patience: [55, 15], stay: [90, 30], consume: [20, 5], walk: [2.4, 0.4],
    foodBias: 0.55, garnishAsk: 0.2, messiness: [0.4, 0.2] },
  { id: "farmer", openness: 0.7, name: "Farmhand", color: "#a89a3c", weight: 2,
    weather: { love: ["light-rain"], dislike: ["cold"] },
    needs: { hunger: [0.6, 0.15], thirst: [0.55, 0.15], warmth: [0.3, 0.15] },
    tastes: { love: ["earthy"], like: ["homely", "tart", "crisp"], dislike: ["sweet", "briny"] },
    extraLikes: ["hearty", "smoky", "fresh"],
    fussiness: [0.4, 0.2], patience: [45, 10], stay: [110, 35], consume: [20, 5], walk: [2.2, 0.4],
    foodBias: 0.5, garnishAsk: 0.15, messiness: [0.5, 0.2] },
];

// ---------------------------------------------------------------------------
// Names. Every guest has one; at first you know them by their role ("Farmhand"). Regulars give their
// name once you know them well enough, by how open they are (their taste schema); passing visitors
// might tell you at a hello or a serve, by their archetype's openness.
export const NAMES = {
  /** Familiarity a regular needs before they'll tell you their name, by schema. */
  learnAt: { open: 0, unformed: 2, veiled: 5, reserved: 10 } as Record<string, number>,
  /** Passing visitors' names. */
  visitors: ["Tomas", "Ada", "Bram", "Elsie", "Corin", "Mabel", "Osric", "Nell", "Pip", "Rowan", "Tilda", "Edwin",
    "Ivy", "Garrick", "Lise", "Hob", "Agnes", "Fenn", "Wren", "Jory", "Bess", "Alder", "Mott", "Clem", "Odo", "Petra",
    "Saul", "Hetty", "Arn", "Greta", "Lew", "Marta", "Ned", "Orla", "Rudd", "Sabine"],
  lines: ["I'm {name}, by the way.", "Name's {name}.", "Call me {name}.", "{name}. Pleased to meet you."],
  reservedLines: ["It's {name}.", "{name}.", "You can call me {name}."],
};

// ---------------------------------------------------------------------------
// Named regulars. Each has a taste schema: how their tastes work and how you solve them.
//   open      Real, fixed tastes; clear reactions.            Skill: read and match.
//   reserved  Real tastes; muted, quiet; Delight comes slowly. Skill: patience.
//   unformed  No settled tastes; rolled each visit; strong reactions lock tags in. Skill: shape.
//   veiled    Real tastes under noise; a true Delight is a breakthrough. Skill: discover.

export type SchemaId = "open" | "reserved" | "unformed" | "veiled";

export interface Regular {
  id: string;
  name: string;
  color: string;
  blurb: string; // shown in the journal
  /** What you call them until you learn their name ("Baker"). None: they go by it already. */
  role?: string;
  schema: SchemaId;
  joinsOnDay: number; // starts visiting from this day
  habit: [fromHour: number, toHour: number]; // when they tend to arrive
  needs: NeedLevels; // how hungry, thirsty and cold they tend to arrive
  weather: WeatherTaste; // weather they love or dislike (by weather tag)
  food: TasteSet; // true tastes (for unformed: ignored; see target)
  drink: TasteSet;
  /** Unformed only: how many tags must lock in, per kind, before they're resolved. */
  target?: { food: number; drink: number };
  cravings: string[]; // tags they might crave on a given night
  fussiness: number;
  patience: Organic;
  stay: Organic;
  consume: Organic;
  walk: Organic;
  foodBias: number;
  garnishAsk: number;
  messiness: number;
}

export const REGULARS: Regular[] = [
  { id: "hedda", role: "Miller's widow", name: "Hedda", color: "#c9a0dc", schema: "reserved", joinsOnDay: 1, habit: [11, 13],
    weather: { love: ["rain", "grey"], dislike: ["stormy"] },
    needs: { hunger: [0.55, 0.1], thirst: [0.3, 0.1], warmth: [0.55, 0.1] },
    blurb: "The miller's widow. Says little.",
    food: { love: ["savoury"], like: ["warm", "earthy"], dislike: ["sweet", "tart", "fiery"] },
    drink: { love: ["homely"], like: ["mild", "warm", "fragrant", "bitter"], dislike: [] },
    cravings: ["earthy", "homely", "rich"],
    fussiness: 0, patience: [80, 10], stay: [90, 20], consume: [28, 5], walk: [1.6, 0.2],
    foodBias: 0.7, garnishAsk: 0, messiness: 0.1 },
  { id: "tobin", role: "Newcomer", name: "Tobin", color: "#e07b5f", schema: "unformed", joinsOnDay: 1, habit: [18, 20],
    weather: { love: ["stormy"], dislike: ["grey"] },
    needs: { hunger: [0.5, 0.2], thirst: [0.6, 0.2], warmth: [0.2, 0.1] },
    blurb: "New in town. Doesn't seem to know what he likes.",
    food: { love: [], like: [], dislike: [] }, drink: { love: [], like: [], dislike: [] },
    target: { food: 7, drink: 4 },
    cravings: ["sweet", "smoky", "fiery", "tart", "rich", "briny", "crisp", "earthy"],
    fussiness: 0.2, patience: [50, 10], stay: [150, 30], consume: [18, 5], walk: [2.8, 0.3],
    foodBias: 0.55, garnishAsk: 0.3, messiness: 0.8 },
  { id: "maren", role: "Baker", name: "Maren", color: "#f0c05a", schema: "open", joinsOnDay: 3, habit: [15, 17],
    weather: { love: ["sunny"], dislike: ["grey", "cold"] },
    needs: { hunger: [0.35, 0.1], thirst: [0.45, 0.1], warmth: [0.3, 0.1] },
    blurb: "Bakes for half the street. Hopeful about most things.",
    food: { love: ["sweet", "warm"], like: ["homely", "crisp"], dislike: ["bitter", "briny"] },
    drink: { love: ["sweet"], like: ["warm", "fragrant"], dislike: ["bitter"] },
    cravings: ["tart", "fragrant", "homely"],
    fussiness: 0.3, patience: [50, 10], stay: [80, 20], consume: [20, 5], walk: [2.2, 0.3],
    foodBias: 0.5, garnishAsk: 0.4, messiness: 0.3 },
  { id: "ferryman", name: "The ferryman", color: "#4f8a8b", schema: "veiled", joinsOnDay: 5, habit: [20, 22],
    weather: { love: ["stormy"], dislike: ["sunny"] }, // secretly loves a good storm
    needs: { hunger: [0.6, 0.1], thirst: [0.55, 0.1], warmth: [0.65, 0.1] },
    blurb: "Takes the night crossing. Hard to read.",
    food: { love: ["smoky", "briny"], like: ["hearty"], dislike: ["light", "sweet"] },
    drink: { love: ["bitter"], like: ["smoky", "warm"], dislike: ["sweet", "fragrant"] },
    cravings: ["smoky", "briny", "fiery", "rich"],
    fussiness: 0.55, patience: [40, 8], stay: [120, 30], consume: [20, 5], walk: [2.0, 0.3],
    foodBias: 0.6, garnishAsk: 0.2, messiness: 0.4 },
  { id: "wil", role: "Old-timer", name: "Old Wil", color: "#b0b0a0", schema: "open", joinsOnDay: 7, habit: [9, 11],
    weather: { love: [], dislike: ["cold"] },
    needs: { hunger: [0.65, 0.1], thirst: [0.6, 0.1], warmth: [0.4, 0.1] },
    blurb: "Eats anything, says so loudly. Hard to surprise.",
    food: { love: ["rich"], like: ["warm", "hearty", "savoury", "smoky", "earthy", "homely", "crisp", "sweet"], dislike: [] },
    drink: { love: ["hearty"], like: ["bitter", "cold", "sweet", "warm", "crisp"], dislike: [] },
    cravings: ["fiery", "briny"],
    fussiness: 0.1, patience: [70, 10], stay: [140, 30], consume: [15, 4], walk: [1.5, 0.2],
    foodBias: 0.6, garnishAsk: 0.1, messiness: 0.6 },
  { id: "ysolde", role: "Courier", name: "Ysolde", color: "#9db4ff", schema: "unformed", joinsOnDay: 9, habit: [16, 19],
    weather: { love: ["sunny", "cold"], dislike: ["rain", "stormy"] },
    needs: { hunger: [0.55, 0.15], thirst: [0.5, 0.15], warmth: [0.4, 0.1] },
    blurb: "A courier between towns. Picky, or maybe just unsure.",
    food: { love: [], like: [], dislike: [] }, drink: { love: [], like: [], dislike: [] },
    target: { food: 4, drink: 3 },
    cravings: ["bright", "crisp", "fragrant", "tart", "light", "fiery"],
    fussiness: 0.6, patience: [35, 8], stay: [70, 20], consume: [18, 5], walk: [2.6, 0.3],
    foodBias: 0.5, garnishAsk: 0.5, messiness: 0.2 },
];

// ---------------------------------------------------------------------------
// Needs: groundwork for mood. Real values, measured, not faked. Orders grow from hunger and thirst
// (with foodBias as a personal leaning); the debug view shows them and every unmet stretch is logged,
// so we learn what mood will have to react to. 0 = fully met, 1 = desperate.

/** Weather someone loves or dislikes, by weather tag. Only talk for now; mood will read it. */
export interface WeatherTaste { love: string[]; dislike: string[] }

export type NeedId = "hunger" | "thirst" | "warmth";
export const NEED_IDS: NeedId[] = ["hunger", "thirst", "warmth"];
export type NeedLevels = Record<NeedId, Organic>;

export const NEEDS = {
  // Drift while inside, per game hour.
  risePerHour: { hunger: 0.08, thirst: 0.12, warmth: 0 } as Record<NeedId, number>,
  indoorWarmthPerHour: 0.05, // just being out of the weather eases the cold a little
  // The fire: full effect at the hearth, fading to nothing at the edge of the radius (tiles).
  fire: { radius: 6.5, warmthPerHour: 0.45 }, // reaches the nearest tables
  // A serving eases needs over the time it takes to eat or drink it.
  serving: {
    food: { hunger: 0.5, thirst: 0.05, warmth: 0 },
    drink: { hunger: 0.05, thirst: 0.45, warmth: 0 },
  } as Record<ItemKind, Record<NeedId, number>>,
  warmTag: 0.15, // a serving tagged warm also eases the cold
  snackThirstPerHour: 0.4, // times the snack's `thirsty`: a salty bowl makes people thirstier
  // An unmet stretch starts above `unmetAt` and ends once back under `metAt` (the gap stops flicker).
  unmetAt: 0.65,
  metAt: 0.55,
  logCap: 300, // stretches kept per day
  // Ordering. Below `fullAt` they don't want that kind of thing (not even after a Delight nearby);
  // above `wantAt` they surely do; in between, the chance ramps up. Everyone orders on sitting down.
  fullAt: 0.2,
  wantAt: 0.45,
  // The soft edge of full: now and then, a full patron has one more drink anyway.
  graceEvery: 45, // game minutes, at least, between one-more-drinks
  graceChance: 0.3, // when they're done and full, chance of one more
};

// Flow and shelter: how many come in. Passing traffic (the hour's flow × the location's traffic) times a
// shelter factor from the weather: rain drives passers-by indoors (more so in a busy place), and keeps
// them until it stops. A storm thins the street, since fewer people are out at all.
export const SHELTER = {
  fullAt: 0.45, // rain intensity at which the pull indoors is at its strongest
  stormThins: 0.5, // in the storm band, the street has this much fewer people on it
  waitOut: [150, 50] as Organic, // game minutes past their usual stay they'll wait for the rain to stop
  checkEvery: [20, 8] as Organic, // game minutes between looking out (and maybe ordering again)
  waitLines: ["I'll wait till it eases.", "Not going out in that.", "Might as well stay put."],
  braveLines: ["Can't wait all day.", "Right. Into it, then.", "It's not going to stop, is it."],
  // When the rain stops, each guest (or party, as one) weighs why they came against what they still need.
  leaveFor: { shelter: 0.85, company: 0.45, drink: 0.3, food: 0.2 } as Record<string, number>,
  idleLeave: 0.3, // waiting it out with nothing left to do: more likely to go
  overstayLeave: 0.2, // past their usual stay: more likely to go
  stillWants: 0.45, // times how much they still want food or drink: less likely to go
  goLines: ["That's our chance, then.", "Rain's stopped. I'm off.", "Right, while it's dry."],
  stayLines: ["No rush now. It's nice in here.", "Might as well finish here.", "I'll stay a bit, I think."],
};

// Soaked: guests in from the rain. How wet comes from the rain's intensity as they arrive; it fades as
// they dry (faster by a lit fire). Wet guests get cold, want the fire and something warm, and drip.
export const SOAKING = {
  fromRain: [1, 0.2] as Organic, // soaked = rain intensity × this: a drizzle dampens, a storm drenches
  warmthOnArrival: 0.35, // times soaked: added to the warmth need as they come in
  chillPerHour: 0.12, // times soaked: wet clothes keep them cold
  dryPerHour: 0.3, // drying off indoors: a drenched guest is dry in about three hours
  fireDryPerHour: 0.9, // at the hearth, fading to nothing at the edge of the fire's reach (NEEDS.fire.radius)
  dripPerHour: 2, // times soaked: drips that leave a puddle near them
  fireSeatPull: 4, // soaked guests weigh a seat by a lit fire up to this much more
  fireSeatRange: 7, // tiles from the fire that count as "by the fire" for choosing a seat
  warmCraving: 0.5, // soaked past this: they crave something warm (if they had no craving)
  warmOrderPull: 2, // times the warmth need: how much more a warm dish appeals
  tint: "#7fb0e0",
};

/**
 * Seasonal tastes: what people fancy shifts through the year. A layer between long-term tastes and
 * the day's craving: a serve with a tag in season scores a little better (unless they dislike it),
 * dishes with one sound better when ordering, and cravings lean toward them.
 */
export const SEASONAL_TASTES = {
  inSeason: {
    spring: ["bright", "fragrant", "tart", "light"],
    summer: ["light", "cold", "crisp", "bright"],
    autumn: ["earthy", "hearty", "sweet", "homely"],
    winter: ["warm", "hearty", "rich", "smoky"],
  } as Record<CalendarSeasonId, string[]>,
  scoreBonus: 1, // a serve with any tag in season (that they don't dislike)
  orderPull: 0.5, // per tag in season: how much more a dish appeals when ordering
  cravingPull: 2.5, // a regular's possible cravings in season are this much likelier
  visitorCraving: 0.25, // chance a passing visitor craves something in season
};

/**
 * Asking for it by name: some guests order a particular leaf or bean ("Mint tea", "Coffee, dark roast"):
 * regulars who know their own mind, and fussy strangers now and then. They ask for what they truly like
 * best. Serve another and it lands like a missing garnish.
 */
export const SPECIFIC_ORDERS = {
  regular: 0.6, // a regular who's open about their tastes (open, or opened up / solved)
  fussy: 0.4, // a stranger this fussy or more (fussyAt)
  fussyAt: 0.45,
  anyone: 0.12, // anyone else with a clear favourite, now and then
  wrongLines: ["That's not what I asked for.", "I did say which one.", "Not the one I wanted, but fine."],
};

/** Tags an unformed patron may roll each visit, and that cravings may name. */
export const TASTE_POOL = [
  "sweet", "tart", "savoury", "bitter", "rich", "earthy", "smoky", "briny", "fiery", "salty",
  "fragrant", "homely", "crisp", "bright", "hearty", "light", "warm", "cold", "mild",
];

export const SCHEMA_TUNING = {
  reservedThreshold: [5, 4, 3] as number[], // Delight threshold by familiarity band
  reservedBands: [0, 4, 8] as number[], // familiarity at which each band starts
  veiledNoiseFlips: 2, // tags whose valence is flipped per serve
  veiledHonestCraving: 0.33,
  cravingChance: 0.6, // chance a regular has a craving on a given visit
  cravingBonus: 2,
  unformedRoll: { love: 2, like: 2, dislike: 2 }, // tags rolled per visit, per kind
  driftChance: 0.1, // per visit, a resolved regular's like may drift
  unformedDislikeLockAt: -3, // a reaction this bad (before fussiness) locks the disliked tags in
};

// ---------------------------------------------------------------------------
// The calendar. A Stardew-style year of calendar seasons ("season" alone means a guest's or the
// keeper's long-term emotional state). Lengths are tunable; 28 days is exactly four weeks, so every
// calendar season starts on the same weekday. Spring 1 of year 1 is a Monday.

export type CalendarSeasonId = "spring" | "summer" | "autumn" | "winter";

export const CALENDAR = {
  seasons: [
    { id: "spring", name: "Spring", days: 28, arrives: "Spring is here." },
    { id: "summer", name: "Summer", days: 28, arrives: "Summer is here." },
    { id: "autumn", name: "Autumn", days: 28, arrives: "Autumn is here." },
    { id: "winter", name: "Winter", days: 28, arrives: "Winter is here." },
  ] as { id: CalendarSeasonId; name: string; days: number; arrives: string }[],
  weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

// ---------------------------------------------------------------------------
// Where the inn stands, picked when a save starts. It reshapes the year (calendar season lengths,
// always 112 days in all), tilts the weather, sets how many people pass by and who they are, and how
// much a downpour drives them indoors.

export type LocationId = "town" | "dockside" | "mountainside" | "crossroads" | "hills";

export interface Location {
  id: LocationId;
  name: string;
  icon: string;
  traits: string[]; // short chips on its card
  blurb: string;
  days: [spring: number, summer: number, autumn: number, winter: number]; // sums to 112
  rain: number; // more (> 1) or less rain: weights the sky toward rain, and rain lingers
  storm: number; // how often a storm breaks, against the calendar season's own odds
  cold?: { seasons: CalendarSeasonId[]; nights: CalendarSeasonId[] }; // instead of WEATHER's
  traffic: number; // passing traffic, times the hour's flow
  shelter: number; // how much rain drives passers-by indoors (used by flow, inn#22)
  visitors: Partial<Record<string, number>>; // archetype id -> times its usual weight
  marketDay?: string; // the weekday of the market (busier midday); none out on the mountain
  street: "streetTown" | "streetCountry"; // what's heard through the open door
}

export const LOCATIONS: Location[] = [
  { id: "town", name: "Town centre", icon: "🏘️", traits: ["busy", "rain rush"], days: [28, 28, 28, 28], rain: 1, storm: 1, traffic: 1.3, shelter: 1.5, visitors: {}, street: "streetTown", marketDay: "Saturday",
    blurb: "On the market square. Busy all year; when it rains, half the street comes in." },
  { id: "dockside", name: "Dockside", icon: "⚓", traits: ["dockworkers", "wet", "stormy"], days: [28, 28, 28, 28], rain: 1.3, storm: 1.6, traffic: 1.1, shelter: 1.1, visitors: { dock: 2.5, scholar: 0.6 }, street: "streetTown", marketDay: "Friday",
    blurb: "By the harbour, where the boats come in. Thirsty dockworkers, wet weather, the odd storm off the sea." },
  { id: "mountainside", name: "Mountainside", icon: "🏔️", traits: ["long winter", "quiet", "cold"], days: [21, 21, 28, 42], rain: 1.2, storm: 1.2, traffic: 0.6, shelter: 0.6, street: "streetCountry",
    cold: { seasons: ["autumn", "winter"], nights: ["spring", "summer"] },
    visitors: { traveller: 2, farmer: 1.5, dock: 0.3, scholar: 0.6 },
    blurb: "On the pass road, high up. Long winters, few passers-by, and everyone who comes in is glad of the fire." },
  { id: "crossroads", name: "Crossroads", icon: "🪧", traits: ["travellers", "quiet"], days: [28, 28, 28, 28], rain: 1, storm: 1, traffic: 0.85, shelter: 0.4, visitors: { traveller: 2.5, dock: 0.4 }, street: "streetCountry", marketDay: "Wednesday",
    blurb: "Where the roads meet, out among the fields. Travellers passing through; rain or shine, much the same." },
  { id: "hills", name: "Hill country", icon: "🌳", traits: ["long summer", "gentle", "farmers"], days: [35, 35, 21, 21], rain: 0.8, storm: 0.4, traffic: 0.8, shelter: 0.7, visitors: { farmer: 2.5, traveller: 1.2, dock: 0.3 }, street: "streetCountry", marketDay: "Thursday",
    cold: { seasons: ["winter"], nights: ["autumn"] },
    blurb: "Among green hills and smallholdings. Long, gentle springs and summers; soft rain, hardly ever a storm." },
];

/** The gramophone (sound/gramophone.ts): its records, and how many play per winding. */
export const GRAMOPHONE = {
  records: [
    { sound: "recordBoat", title: "Go, Little Boat" },
    { sound: "recordBlow", title: "Let It Blow" },
    { sound: "recordRound", title: "Round We Go" },
    { sound: "recordApple", title: "The Apple Tree" },
    { sound: "recordRoad", title: "The Road Can Wait" },
  ],
  // The spring runs this many seconds of music per winding. Short for testing (about two records) so the
  // run-down comes round; the real thing would run longer. Winding stays optional, a small chore.
  springSeconds: 240,
  // Giving out mid-record: the last seconds sag to this speed and level (pitch drags down with it).
  sag: { seconds: 5, toRate: 0.45, toLevel: 0.35 },
};

/** Market day: busier around the middle of the day. */
export const MARKET = { from: 9, to: 15, flow: 1.5 };

/** The morning paper's town news (newspaper.ts). */
export const NEWS = {
  market: "Market day today: stalls on the square from nine. Expect a busy midday.",
  marketSoon: "Market day is {day}, as ever.",
  afterStorm: ["Branches down on the north road after last night's storm.", "The ferry was held at the far bank overnight, by the wind.", "A chimney pot came down on Weaver's Row in the night. Nobody hurt."],
  seasons: {
    spring: ["Lambing's begun up the valley.", "The orchards are in blossom along the river road.", "Spring cleaning at the chapel; volunteers wanted."],
    summer: ["Hay's in early this year, they say.", "Swimming at the mill pond, for those who dare.", "Strawberries at the market, while they last."],
    autumn: ["The apple harvest is under way; the cider presses are busy.", "Geese overhead, heading south.", "Mushroom pickers warned off the old wood."],
    winter: ["Ice on the mill pond. Skaters warned off.", "Firewood prices up again.", "Carollers were heard on the high street last night."],
  } as Record<CalendarSeasonId, string[]>,
  gossip: [
    "Electric lamps were lit on the high street for the first time. Opinions differ.",
    "Lost: one grey cat, answers to Pudding.",
    "The miller's wheel is mended at last.",
    "A travelling tinker is in town, mending pots.",
    "The council meets on the matter of the bridge. Again.",
    "Letters: a reader asks why the church clock runs four minutes slow.",
  ],
};

// ---------------------------------------------------------------------------
// Time of day. One value that greetings, chatter, cravings, flow and (later) weather all read.
// Nothing hard-codes "evening": the inn can be open from the morning on.

export type TimeOfDay = "morning" | "midday" | "afternoon" | "evening" | "night";

/** The clock hour each part of the day starts at, in order through the day. Night runs past midnight. */
export const TIME_OF_DAY: { id: TimeOfDay; from: number }[] = [
  { id: "night", from: 0 },
  { id: "morning", from: 5 },
  { id: "midday", from: 11 },
  { id: "afternoon", from: 14 },
  { id: "evening", from: 17 },
  { id: "night", from: 22 },
];

export function timeOfDayAt(hour: number): TimeOfDay {
  let id: TimeOfDay = "night";
  for (const t of TIME_OF_DAY) if (hour >= t.from) id = t.id;
  return id;
}

/** Words for each part of the day, filled into lines: {time} how people greet, {now} "tonight" and the like. */
export const TIME_WORDS: Record<TimeOfDay, { time: string; now: string; part: string }> = {
  morning: { time: "Morning", now: "this morning", part: "morning" },
  midday: { time: "Good day", now: "today", part: "day" },
  afternoon: { time: "Afternoon", now: "this afternoon", part: "afternoon" },
  evening: { time: "Evening", now: "tonight", part: "evening" },
  night: { time: "Evening", now: "tonight", part: "night" },
};

// ---------------------------------------------------------------------------
// Talk. {tag} is filled in from the speaker's own tastes, so chatter can give tastes away.
// {time} and {now} come from the time of day (TIME_WORDS). A line with `when` is only said then.
export type Line = string | { text: string; when: TimeOfDay[] };

export const CHATTER = {
  small: [
    "Wind's turned, they say.", "Did you hear about the mill?",
    { text: "Market was busy today.", when: ["midday", "afternoon", "evening"] },
    "My feet are killing me.",
    { text: "Long day.", when: ["afternoon", "evening", "night"] },
    { text: "Early start, this.", when: ["morning"] },
    "Quiet in here {now}. I like it.",
    "Ferry was late again.", "Haven't been here in a while.", "Fire's nice.",
    "You still owe me for last time.",
  ] as Line[],
  /** Talk about the weather, by weather tag (weatherTags in weather.ts). Never sunshine talk in a downpour. */
  weather: {
    sunny: [
      { text: "Lovely day out.", when: ["morning", "midday", "afternoon"] },
      { text: "Sun's out, for once.", when: ["morning", "midday", "afternoon"] },
      { text: "Clear night out. Stars and all.", when: ["evening", "night"] },
    ],
    grey: ["Grey out {now}.", "Looks like rain.", "Can't make its mind up, that sky."],
    "light-rain": ["Bit of drizzle out.", "Just spitting, out there.", "Soft rain. Good for the gardens."],
    rain: ["Raining properly now.", "Wet out there.", "You'd want a good coat {now}."],
    stormy: ["Coming down in buckets out there.", "Listen to that wind.", "Nobody's crossing the river in this.", "Hope the roof holds."],
    cold: ["Bitter out.", "Cold enough to freeze your ears off.", "Good to be near a fire {now}."],
  } as Record<string, Line[]>,
  weatherChance: 0.3, // share of small talk that's about the weather
  /** Said on sitting down, by what they walked in from. */
  cameIn: {
    "light-rain": ["Only a bit of drizzle.", "Just spitting out there."],
    rain: ["Wet one out there.", "Mind the puddle by the door."],
    storm: ["Coming down in buckets out there!", "Blown in like a leaf, me."],
  } as Record<string, string[]>,
  /** A guest or two remarks when the weather changes. */
  weatherTurns: {
    rainStarts: ["Here comes the rain.", "Glad I'm in here."],
    stormBreaks: ["Listen to that!", "Hark at it now."],
    rainStops: ["Sounds like it's stopped.", "That's eased off."],
    clears: ["Sun's coming out."],
  } as Record<string, string[]>,
  /** Weather tastes: {w} is the weather's name (WEATHER_NAMES), {W} the same with a capital. */
  weatherLove: ["Now this is my kind of weather.", "I do love a {w}.", "Nothing better than a {w}."],
  weatherDislike: ["Can't stand {w}.", "{W}. Just my luck.", "I could do without {w}."],
  love: ["Nothing beats something {tag}.", "I'd walk a mile for anything {tag}.", "Give me {tag} any day."],
  like: ["Something {tag} would go down well.", "I don't mind a bit of {tag}."],
  dislike: ["Can't abide anything {tag}.", "Keep anything {tag} away from me.", "Never cared for {tag} things."],
  replies: ["Mm.", "Too right.", "Is that so?", "Ha!", "Same here.", "You always say that.", "Hm."],
  greet: { morning: "Morning!", midday: "Good day!", afternoon: "Afternoon.", evening: "Evening!", night: "Still up?" } as Record<TimeOfDay, string>,
  answer: {
    stranger: ["{time}.", "Hello.", "Mm, hello."],
    known: ["Ah, there you are.", "Good to see you.", "{time}, keeper."],
    reserved: ["Mm.", "…{time}.", "Hm."], // the reserved, until they open up
    friend: ["There's my favourite keeper.", "Was hoping you'd come by.", "Sit with us a moment, if you can."],
  },
};
/** How people name a weather tag, for weather tastes: fondly ("a good storm") or not ("storms"). */
export const WEATHER_NAMES: Record<string, { love: string; dislike: string }> = {
  sunny: { love: "sunny day", dislike: "all this sun" },
  grey: { love: "grey day", dislike: "grey skies" },
  "light-rain": { love: "soft rain", dislike: "drizzle" },
  rain: { love: "rainy day", dislike: "rain" },
  stormy: { love: "good storm", dislike: "storms" },
  cold: { love: "crisp cold day", dislike: "the cold" },
};

export const TALK_TUNING = {
  chatEvery: [30, 12] as Organic, // game minutes between things a person says
  hintChance: 0.2, // a line that gives a taste away (about one in five)
  overhearRange: 5, // tiles: the journal notes chatter heard this close
  greetRange: 1.7, // tiles: walking this close starts a quick hello
  inspireRange: 4, // tiles: people this close notice someone else's Delight
};

// ---------------------------------------------------------------------------
// Sounds. Which files play for what, how loud, how much the pitch wanders.
// Volumes are relative: every file is evened out to the same loudness when it loads.
//   heardEverywhere: not muffled by walls (the shop bell is how you know someone came in)
//   loop: plays continuously while its source is active (cooking: sound/loops.ts; crowd: sound/crowd.ts)
//         with several files, they take turns instead of one repeating
//   slice: the file holds several separate sounds (footsteps); it's cut at the quiet gaps when it
//          loads and each piece is one pick
//   room: the sound of a whole room rather than of a spot: not panned, muffled from the next room
//   trim: cut the silence at the start when it loads, so a cue lands right on its action
// Files in assets/sounds/questionable are parked: not used, not packed into standalone.html.
export interface SoundDef {
  files: string[]; volume: number; pitch: number;
  loop?: boolean; heardEverywhere?: boolean; slice?: boolean; room?: string; trim?: boolean;
  tone?: "gramophone"; // played through the gramophone's horn and turntable (GRAMOPHONE_TONE)
  bus?: "cue" | "music"; // its own volume setting: cues tell you something, music is the gramophone. Else: atmosphere
}

/**
 * The gramophone's sound, put on the records as they play (the files stay clean): a narrow band (no
 * bass, dulled highs), the horn's nasal resonance, a soft edge of distortion, and the turntable's
 * wow (slow speed wobble) and flutter (fast shimmer).
 */
export const GRAMOPHONE_TONE = {
  highpass: 320, // Hz: below this, gone
  lowpass: 3400, // Hz: above this, dulled
  horn: { freq: 1400, gain: 6, q: 1.2 }, // the horn's resonance (dB)
  drive: 2.4, // distortion: 1 is clean, higher is grittier
  wow: { rate: 0.55, depth: 0.006 }, // Hz, and how far the speed wanders (fraction)
  flutter: { rate: 6.5, depth: 0.0018 },
  makeUp: 1.6, // the band-limiting makes it quieter: this brings it back up
};

const SND = "assets/sounds/";
export const SOUNDS: Record<string, SoundDef> = {
  doorOpens: { files: [SND + "door-opens-1.opus"], volume: 0.8, pitch: 0.05 },
  doorCloses: { files: [SND + "door-closes.opus"], volume: 0.8, pitch: 0.05 },
  bell: { bus: "cue", files: [SND + "shopkeeper-bell-1.opus", SND + "shopkeeper-bell-2.opus"], volume: 0.55, pitch: 0.05, heardEverywhere: true },
  pour: { files: [SND + "drink-pouring-1.opus", SND + "drink-pouring-2.opus", SND + "drink-pouring-3.opus"], volume: 0.7, pitch: 0.07 },
  // A cup from the urn (TUNING.urnPourSeconds long, about 2 s).
  urnPour: { files: [SND + "tea-pouring.opus"], volume: 0.6, pitch: 0.06 },
  kettle: { files: [SND + "kettle-water-boiling-looping.opus"], volume: 0.45, pitch: 0.04, loop: true },
  stewCooking: { files: [SND + "stew-cooking-loop.opus"], volume: 0.5, pitch: 0.04, loop: true },
  stewSimmering: { files: [SND + "stew-simmering-loop.opus"], volume: 0.4, pitch: 0.04, loop: true },
  // Footsteps: one step per stride (see SOUND_TUNING), so the pace always matches the walking.
  keeperWalk: { files: [SND + "indoors-walk-step-loop.opus", SND + "indoors-walk-cycle-4-step-loop.opus"], volume: 0.4, pitch: 0.06, slice: true },
  keeperRun: { files: [SND + "indoors-run-cycle-loop.opus"], volume: 0.45, pitch: 0.06, slice: true },
  patronStep: { files: [SND + "indoors-walk-step-loop.opus", SND + "indoors-walk-cycle-4-step-loop.opus"], volume: 0.16, pitch: 0.1, slice: true },
  // Cues: the game telling you something. Chords barely vary in pitch, so they stay in tune.
  order: { bus: "cue", files: [SND + "order-two-taps.opus", SND + "order-three-taps.opus"], volume: 0.5, pitch: 0.05, trim: true, heardEverywhere: true },
  paper: { bus: "cue", files: [SND + "check-sound.opus"], volume: 0.45, pitch: 0.04, trim: true },
  // Confirming a decision: putting up the bill of fare, taking an upgrade. Not routine work (cooking,
  // garnishing). Which buttons play it: confirmSound on a MenuItem, or confirmed() in menu.ts.
  // Switch off with SOUND_TUNING.confirmSound.
  confirm: { bus: "cue", files: [SND + "piano-confirm.opus"], volume: 0.45, pitch: 0.01, trim: true },
  servePositive: { bus: "cue", files: [SND + "serving-outcome-positive-1-chord.opus", SND + "serving-outcome-positive-2-chord.opus"], volume: 0.5, pitch: 0.01, trim: true },
  serveNeutral: { bus: "cue", files: [SND + "serving-outcome-neutral-1-chord.opus", SND + "serving-outcome-neutral-2-chord.opus"], volume: 0.45, pitch: 0.01, trim: true },
  serveNegative: { bus: "cue", files: [SND + "serving-outcome-negative-1-chord.opus", SND + "serving-outcome-negative-2-chord.opus"], volume: 0.45, pitch: 0.01, trim: true },
  delight: { bus: "cue", files: [SND + "delight-1.opus", SND + "delight-2.opus"], volume: 0.6, pitch: 0.01, trim: true },
  // The fire, heard from the fireplace. Which plays when: FIRE below.
  fireSmall: { files: [SND + "fireplace-small-loop.opus"], volume: 0.21, pitch: 0.03, loop: true },
  fireMedium: { files: [SND + "fireplace-med-loop.opus"], volume: 0.3, pitch: 0.03, loop: true },
  fireLarge: { files: [SND + "fireplace-large-loop.opus"], volume: 0.36, pitch: 0.03, loop: true },
  // The murmur of the taproom, by how many people are in it (CROWD below).
  crowdLow: { files: [SND + "occupancy-bg-low-1-loop.opus", SND + "occupancy-bg-low-2-loop.opus"], volume: 0.28, pitch: 0.02, loop: true, room: "taproom" },
  crowdComfortable: { files: [SND + "occupancy-bg-comfortable-1-loop.opus"], volume: 0.36, pitch: 0.02, loop: true, room: "taproom" },
  crowdBusy: { files: [SND + "occupancy-bg-busy-1-loop.opus"], volume: 0.44, pitch: 0.02, loop: true, room: "taproom" },
  crowdPacked: { files: [SND + "occupancy-bg-packed-1-loop.opus"], volume: 0.5, pitch: 0.02, loop: true, room: "taproom" },
  // Weather (sound/weather.ts mixes these by rain intensity; WEATHER_SOUND below).
  // Indoors: the rain on the building, heard everywhere inside.
  rainSoftIn: { files: [SND + "rain-soft-ambience-loop.opus"], volume: 0.22, pitch: 0.01, loop: true },
  rainMediumIn: { files: [SND + "rain-medium-ambience-loop.opus"], volume: 0.3, pitch: 0.01, loop: true },
  rainStormIn: { files: [SND + "rain-storm-ambience-loop.opus"], volume: 0.4, pitch: 0.01, loop: true },
  // Outdoors: heard from the front door while it's open.
  rainSoftOut: { files: [SND + "rain-soft-outside-ambience-loop.opus"], volume: 0.55, pitch: 0.01, loop: true },
  rainMediumOut: { files: [SND + "rain-medium-outside-ambience-loop.opus"], volume: 0.65, pitch: 0.01, loop: true },
  // At the windows: louder as the keeper walks near one.
  rainWindow: { files: [SND + "sfx-rain-window-loop.opus"], volume: 0.4, pitch: 0.02, loop: true },
  // Wind outside: heard faintly around the building, fully through the open door.
  windSoft: { files: [SND + "wind-soft-outside-ambience-loop.opus"], volume: 0.35, pitch: 0.02, loop: true },
  windMedium: { files: [SND + "wind-medium-outside-ambience-loop.opus"], volume: 0.45, pitch: 0.02, loop: true },
  windStrong: { files: [SND + "wind-strong-outside-ambience-loop.opus"], volume: 0.55, pitch: 0.02, loop: true },
  // The gramophone's records (assets/sounds/gramophone: smaller copies of the originals in music/).
  recordBoat: { tone: "gramophone", bus: "music", files: [SND + "gramophone/go-little-boat.opus"], volume: 0.2, pitch: 0 },
  recordBlow: { tone: "gramophone", bus: "music", files: [SND + "gramophone/let-it-blow.opus"], volume: 0.2, pitch: 0 },
  recordRound: { tone: "gramophone", bus: "music", files: [SND + "gramophone/round-we-go.opus"], volume: 0.2, pitch: 0 },
  recordApple: { tone: "gramophone", bus: "music", files: [SND + "gramophone/the-apple-tree.opus"], volume: 0.2, pitch: 0 },
  recordRoad: { tone: "gramophone", bus: "music", files: [SND + "gramophone/the-road-can-wait.opus"], volume: 0.2, pitch: 0 },
  // The gramophone's own sounds: winding it, the needle, the surface noise, the end of a record, the spring giving out.
  gramoCrank: { bus: "music", files: [SND + "sfx-gramophone-winding-crank.opus"], volume: 0.5, pitch: 0.03 },
  gramoNeedle: { bus: "music", files: [SND + "sfx-gramophone-needle-drop.opus"], volume: 0.45, pitch: 0.04, trim: true },
  gramoCrackle: { bus: "music", files: [SND + "sfx-gramophone-surface-crackle-loop.opus", SND + "sfx-gramophone-surface-crackle-loop-2.opus"], volume: 0.12, pitch: 0.02, loop: true },
  gramoRunout: { bus: "music", files: [SND + "sfx-gramophone-record-finished.opus"], volume: 0.4, pitch: 0.02 },
  gramoWindDown: { bus: "music", files: [SND + "sfx-gramophone-winding-down.opus"], volume: 0.5, pitch: 0.02 },
  // Thunder in the storm band: a close crack now and then, otherwise a rumble nearby.
  thunderClose: { files: [SND + "sfx-thunder-close-1.opus", SND + "sfx-thunder-close-2.opus"], volume: 0.7, pitch: 0.06, heardEverywhere: true },
  thunderNearby: { files: [SND + "sfx-thunder-nearby-1.opus", SND + "sfx-thunder-nearby-2.opus"], volume: 0.5, pitch: 0.06, heardEverywhere: true },
  // The street outside, heard through the open front door. Which one: WEATHER_SOUND.street.
  streetTown: { files: [SND + "street-loop-towncenter.opus"], volume: 0.5, pitch: 0.01, loop: true },
  streetCountry: { files: [SND + "street-loop-countryside.opus"], volume: 0.5, pitch: 0.01, loop: true },
};

/**
 * How the weather layers mix. Each layer's share by rain intensity (0..1): [from, full, fadesFrom, gone]
 * means silent below `from`, full between `full` and `fadesFrom`, silent again past `gone`.
 */
export const WEATHER_SOUND = {
  layers: {
    soft: [0, 0.12, 0.35, 0.6],
    medium: [0.28, 0.5, 0.8, 1.01],
    storm: [0.62, 0.85, 1.01, 1.02],
  } as Record<"soft" | "medium" | "storm", [number, number, number, number]>,
  driftSeconds: 2.5, // how fast the mix follows the rain
  doorSeconds: 0.5, // how fast the outdoors swells in and out with the door
  window: { fullWithin: 1.2, goneAt: 6 }, // tiles from the nearest window
  idleStopSeconds: 6, // a layer silent this long stops playing
  // Wind follows how wild it is out: the rain's intensity, or a breeze on grey days. Same shape as layers.
  wind: {
    soft: [0.05, 0.15, 0.4, 0.6],
    medium: [0.4, 0.6, 0.8, 0.95],
    strong: [0.7, 0.88, 1.01, 1.02],
  } as Record<"soft" | "medium" | "strong", [number, number, number, number]>,
  greyBreeze: { overcast: 0.15, cloudy: 0.08 } as Record<string, number>, // how wild a dry sky counts as
  windIndoors: 0.3, // with the door shut, the wind is this loud inside, in the rain
  windIndoorsDry: 0.15, // ...and on a dry grey day, a breeze you barely hear inside
  rainDrownsStreet: 0.8, // at full rain the street is this much quieter
};

export const SOUND_TUNING = {
  wakeSeconds: 9, // the soundscape fades in over this long when the game starts and each morning: the keeper waking
  targetLoudness: 0.12, // every file is evened out to about this (RMS of its audible part)
  fullVolumeWithin: 2.5, // tiles: full volume this close
  fadeOverTiles: 16, // tiles beyond that over which it fades to quiet
  quietest: 0.2, // a sound in the same room never fades below this
  nextRoom: 0.35, // a sound in the next room over is this loud; two rooms away, silent
  panWidth: 12, // tiles left or right for a full pan
  loopFadeMs: 400,
  // Footsteps
  keeperStride: 1.5, // tiles per step when walking (4.2 tiles/s: about 2.8 steps a second)
  keeperRunStride: 2.4, // tiles per step when running (7 tiles/s: about 2.9 steps a second)
  patronStride: 1.1,
  patronStepsAtOnce: 3, // at most this many guest footsteps sounding together
  // Cues
  outcomeBreathMs: 300, // serving a whole table: each reaction rings out, then this pause, then the next
  outcomeBreathJitterMs: 70, // ...give or take, so it feels played rather than sequenced
  paperGapMs: 300, // two paper ticks closer than this sound as one
  confirmSound: true, // a piano note when you confirm a decision (bill of fare, upgrades): the "confirm" sound
  // The crowd
  crowdFadeMs: 3000,
  crowdSettleMs: 2500, // the headcount must hold this long before the murmur changes
};

/**
 * The fire's life, as sound. Each stage plays for `seconds` (real seconds), then the next; a stage
 * without `seconds` holds. Stages crossfade. Another kind of fireplace can get its own order later.
 *   lighting: kindling catches, it roars up, then settles for the evening
 *   dousing: embers for a while, then quiet
 */
export interface FireStage { sound: string; seconds?: number }
export const FIRE: { lighting: FireStage[]; dousing: FireStage[]; crossfadeMs: number } = {
  lighting: [{ sound: "fireSmall", seconds: 4 }, { sound: "fireLarge", seconds: 25 }, { sound: "fireMedium" }],
  dousing: [{ sound: "fireSmall", seconds: 12 }],
  crossfadeMs: 2500,
};

/** Taproom murmur: the busiest level whose headcount is reached (people in the taproom). */
/** Which cue answers each serving outcome. LEAVING is a guest giving up, not a serve: the synth tone covers it. */
export const OUTCOME_SOUND: Record<string, string> = {
  DELIGHT: "delight", PLEASED: "servePositive", FULFILLED: "serveNeutral", UNFINISHED: "serveNegative", COMPLAINS: "serveNegative",
};

export const CROWD: { sound: string; from: number }[] = [
  { sound: "crowdLow", from: 1 },
  { sound: "crowdComfortable", from: 6 },
  { sound: "crowdBusy", from: 15 },
  { sound: "crowdPacked", from: 27 },
];

/** Rooms, for which sounds carry where. Floor characters from MAP; furniture takes the room around it. */
export const ROOM_OF_TILE: Record<string, string> = {
  "~": "bedroom", ":": "hall", ",": "kitchen", ".": "taproom", "_": "taproom", "=": "taproom", g: "taproom",
  s: "taproom", c: "taproom", t: "taproom", ";": "entry", b: "entry", E: "entry",
};
// Which rooms open onto which: each inn has its own (INNS[].roomLinks).

// ---------------------------------------------------------------------------
// The front door: it opens when someone is in the doorway and closes once the doorway is clear.
export const DOOR_TUNING = {
  doorwayRadius: 2.2, // tiles around the front door that count as "in the doorway"
  holdOpenMs: 1800, // the door stays open at least this long for a group (real time)
  holdOpenQuickMs: 900, // … and this long for one person on their own
  settleMs: 300, // the doorway must be clear this long before the door closes
  bellDelayMs: 400, // the shop bell rings this long after the door starts to open
  quickRate: 1.25, // one person: door sounds play this much faster, and the bell comes sooner
  fadeMs: 70, // a door sound that's cut off fades out this quickly
};

// ---------------------------------------------------------------------------
// Order tickets along the top of the map (see ui/tickets.ts).
export const TICKETS = {
  width: 76, // px per ticket card, before UI scaling
  gap: 8,
  restMs: 320, // a new ticket rests this long at the snap point before sliding into the row
  warmFrom: [0.6, 0.85] as [number, number], // share of the way to a walkout where the ring turns amber, then red
};

// ---------------------------------------------------------------------------
// The bill of fare: what's on today. Set at the desk.
export const DEFAULT_MENU = ["ale", "cider"];

// Meal times: an advanced way to run the bill of fare. Off by default (one all-day bill).
// Hours are clock hours from the morning; past midnight keeps counting (25 = 1 AM).
export type MealId = "breakfast" | "lunch" | "dinner";
export const MEALS: { id: MealId; name: string; icon: string; from: number; to: number }[] = [
  { id: "breakfast", name: "Breakfast", icon: "🍳", from: 7, to: 10 },
  { id: "lunch", name: "Lunch", icon: "🥪", from: 12, to: 14 },
  { id: "dinner", name: "Dinner", icon: "🍽️", from: 18, to: 21 },
];

// Upgrades, chosen at the desk. No economy yet: they unlock as you serve more patrons.
export interface Upgrade { id: string; name: string; icon: string; desc: string; unlockAtServed: number }

export const UPGRADES: Upgrade[] = [
  { id: "kettle", name: "Copper kettle", icon: "🫖", desc: "The kettle boils twice as fast.", unlockAtServed: 8 },
  { id: "urn", name: "Tea urn", icon: "⚱️", desc: "Adds a choice at the kettle: brew a whole urn, about 8 cups, poured straight from it. Single cups stay.", unlockAtServed: 20 },
  { id: "trays", name: "Wider trays", icon: "🍽️", desc: "Carry 3 dishes per tray, and 5 drinks.", unlockAtServed: 35 },
];

// ---------------------------------------------------------------------------
// Weather: a set of states with allowed transitions and a minimum time in each, never noise.
// Rain has one continuous intensity (0..1) with named bands; a storm is a band of rain, not a state.
// What everyone reads: tags (the sky's, the band's, and `cold` from the calendar season and hour),
// and events: WeatherChanged, RainBandChanged, Thunder. Fog and snow come later.

export type SkyId = "clear" | "cloudy" | "overcast" | "rain";
export type RainBandId = "light-rain" | "rain" | "storm";

export const WEATHER = {
  skies: {
    clear: { name: "Clear", icon: "☀️", nightIcon: "🌙", minHours: 3, tags: ["sunny"] },
    cloudy: { name: "Cloudy", icon: "⛅", nightIcon: "☁️", minHours: 1.5, tags: [] },
    overcast: { name: "Overcast", icon: "☁️", nightIcon: "☁️", minHours: 2, tags: ["grey"] },
    rain: { name: "Rain", icon: "🌧️", nightIcon: "🌧️", minHours: 1, tags: ["wet"] },
  } as Record<SkyId, { name: string; icon: string; nightIcon: string; minHours: number; tags: string[] }>,
  /** Bands of rain intensity, in order. A band is entered at `from` and left `hysteresis` below it. */
  bands: [
    { id: "light-rain", name: "Light rain", icon: "🌦️", from: 0, tags: ["light-rain"] },
    { id: "rain", name: "Rain", icon: "🌧️", from: 0.35, tags: ["rain"] },
    { id: "storm", name: "Storm", icon: "⛈️", from: 0.7, tags: ["heavy-rain", "stormy"] },
  ] as { id: RainBandId; name: string; icon: string; from: number; tags: string[] }[],
  hysteresis: 0.06,
  bandMinMinutes: 30, // a band holds at least this long before easing or building again (a storm breaking doesn't wait)
  // Rain intensity: eases toward a target, which wanders now and then. A storm breaking jumps it.
  rainEasePerHour: 0.35,
  rainWanderEvery: [40, 15] as Organic, // game minutes between new targets while raining
  rainEndsBelow: 0.12, // once easing off, the rain stops under this
  showerStart: [0.55, 0.12] as Organic, // a sudden shower (cloudy → rain) comes down this hard at once
  stormJump: 0.3, // how far a storm breaking jumps the intensity, straight away
  stormLasts: [100, 35] as Organic, // game minutes a storm rages before the rain wanders again
  thunderPerHour: 3, // in the storm band
  coldSeasons: ["winter"] as string[],
  coldNightSeasons: ["autumn", "spring"] as string[], // cold in the evening and at night
  /**
   * Per calendar season:
   *   start   odds of the sky on the first morning of a save
   *   stay    once past its minimum time, chance per hour a sky holds (else it moves on)
   *   to      where it moves on to, by weight. cloudy → rain is a sudden shower (abrupt)
   *   rain    how hard rain tends to be (target intensity)
   *   storm   chance per hour of rain that a storm breaks
   */
  seasons: {
    spring: {
      start: { clear: 2, cloudy: 3, overcast: 2, rain: 1 },
      stay: { clear: 0.6, cloudy: 0.5, overcast: 0.55, rain: 0.55 },
      to: { clear: { cloudy: 1 }, cloudy: { clear: 1, overcast: 1, rain: 0.5 }, overcast: { cloudy: 1, rain: 1.4 }, rain: { overcast: 1, cloudy: 1.2 } },
      rain: [0.28, 0.2], storm: 0.03,
    },
    summer: {
      start: { clear: 5, cloudy: 2, overcast: 1, rain: 0.3 },
      stay: { clear: 0.85, cloudy: 0.5, overcast: 0.45, rain: 0.4 },
      to: { clear: { cloudy: 1 }, cloudy: { clear: 2, overcast: 0.6, rain: 0.35 }, overcast: { cloudy: 1.2, rain: 0.8 }, rain: { cloudy: 1.5, overcast: 0.5 } },
      rain: [0.5, 0.25], storm: 0.08,
    },
    autumn: {
      start: { clear: 1, cloudy: 2, overcast: 3, rain: 2 },
      stay: { clear: 0.55, cloudy: 0.5, overcast: 0.7, rain: 0.75 },
      to: { clear: { cloudy: 1 }, cloudy: { clear: 0.6, overcast: 1.4, rain: 0.25 }, overcast: { cloudy: 0.7, rain: 1.5 }, rain: { overcast: 1.5, cloudy: 0.5 } },
      rain: [0.45, 0.2], storm: 0.05,
    },
    winter: {
      start: { clear: 1, cloudy: 2, overcast: 4, rain: 2 },
      stay: { clear: 0.6, cloudy: 0.5, overcast: 0.75, rain: 0.7 },
      to: { clear: { cloudy: 1 }, cloudy: { clear: 0.7, overcast: 1.5, rain: 0.1 }, overcast: { cloudy: 0.6, rain: 1.2 }, rain: { overcast: 1.6, cloudy: 0.4 } },
      rain: [0.4, 0.15], storm: 0.02,
    },
  } as Record<CalendarSeasonId, {
    start: Record<SkyId, number>; stay: Record<SkyId, number>; to: Record<SkyId, Partial<Record<SkyId, number>>>;
    rain: Organic; storm: number;
  }>,
  /** What the keeper notices, in the log. */
  lines: {
    sky: {
      "clear>cloudy": "Clouds are drifting over.", "cloudy>clear": "The sky's clearing.",
      "cloudy>overcast": "The sky's closing in, grey.", "overcast>cloudy": "The cloud's breaking up.",
      "overcast>rain": "It's starting to rain.", "cloudy>rain": "A sudden shower comes down!",
      "rain>overcast": "The rain has stopped.", "rain>cloudy": "The rain has stopped. Brighter out.",
    } as Record<string, string>,
    heavier: { rain: "The rain's getting heavier.", storm: "It's pouring now. A proper storm." } as Record<string, string>,
    stormBreaks: "A storm breaks!",
    easing: { "light-rain": "The rain's easing off.", rain: "The storm's passing. Still raining." } as Record<string, string>,
  },
};

// ---------------------------------------------------------------------------
// Light (ui/light.ts). Daylight by the hour, shifted by the calendar season, dimmed by the weather;
// lamps the keeper lights when it gets gloomy inside; candles on the tables; the fire.

export const LIGHT = {
  dawn: [5, 8] as [number, number], // daylight rises between these hours
  dusk: [17, 20.5] as [number, number], // and falls between these
  seasonShift: { winter: 1.5, autumn: 0.5, spring: 0, summer: -1 } as Record<string, number>, // hours: later dawn, earlier dusk
  weather: { clear: 1, cloudy: 0.85, overcast: 0.65, rain: 0.6, rainPerIntensity: 0.3 } as Record<string, number> & { rainPerIntensity: number },
  maxDark: 0.72, // how dark the inn gets with no light at all
  nightTint: "12,14,32", // the colour of the dark (r,g,b)
  lampsOnBelow: 0.45, // indoor light under this: the lamps go on
  lampsOffAbove: 0.6, // over this: they go out (the gap stops flicker)
  lampStrength: 0.85,
  lampWarm: 0.12,
  windowReach: 3.5, // tiles of daylight around a window
  fire: { reach: 6, strength: 0.95, warm: 0.22 },
  candle: { reach: 2, strength: 0.75, warm: 0.1 },
  keeperCandle: { from: 0.12, reach: 2.6, strength: 0.8, warm: 0.13 }, // the candle the keeper carries, once it's this dark
  flash: { near: 0.55, far: 0.2, ms: 350 },
  // Hanging lamps: each inn has its own (INNS[].lamps).
};

// ---------------------------------------------------------------------------
// Pacing and rules. Tune these by playing.

export const TUNING = {
  dayStartHour: 6,
  dayLengthMinutes: 20 * 60, // 6 AM to 2 AM
  realSecondsPerGameMinute: 2.5, // at speed x1. A chill pace.
  speeds: [0.5, 1, 2, 4],
  lineStaleMinutes: 12,
  // How long a spoken line stays up, in real seconds: base + per character, clamped. With someone at the
  // table waiting to talk, a line can be cut after this share of it.
  speech: { baseSeconds: 1.4, perChar: 0.05, minSeconds: 2.2, maxSeconds: 6, cutShare: 0.5 }, // a guest's line that waited this long for their table to go quiet is dropped
  quietClockBoost: 5, // extra speed while the inn is closed or empty
  keeperWalk: 4.2, // tiles per real second
  keeperRun: 7,
  trayCapacity: { drink: 4, food: 2 },
  hatchCapacity: 8,
  shelfCapacity: 2, // finished dishes a station can hold, waiting to be picked up
  pieSafeCapacity: 4, // whole pies per pie safe
  // Freshness, first pass: food left over a night turns day-old (still servable, a bit less nice);
  // anything older goes to the hens.
  staleTag: "day-old",
  stalePenalty: -1, // everyone minds day-old food a little
  speedUpFactor: 1.4, // holding Space at a crafting station
  delightThreshold: 3,
  scoring: { love: 2, like: 1, dislike: -2, missingGarnish: -2 },
  // Groups of visitors: chance of each size (1 to 6). Never larger than the biggest table.
  groupSizeWeights: [0.45, 0.28, 0.12, 0.08, 0.04, 0.03],
  outcomeShowMinutes: 10,
  // Mess
  tableDirtyAt: 2, // dirt units before a table counts as dirty
  spillChancePerHour: 0.5, // times messiness, while eating or drinking
  cleanSeconds: [2.4, 0.8] as Organic, // real seconds of holding Space
  pourSeconds: [3, 0.3] as Organic, // real seconds to pour a drink at a tap (an upgrade could shorten it)
  urnPourSeconds: [2, 0.2] as Organic, // real seconds to pour a cup of tea from the urn at the kettle
  // Snack bowls
  bowlEatenPerHour: 0.35, // share of a bowl one patron who likes it picks at in an hour
  bowlCommentChance: 0.5, // chance someone who loves or hates the snack says so
  // Arrivals per game hour, by clock hour (0-23). Multiplied by the debug flow slider.
  flowByHour: [
    0.6, 0.4, 0, 0, 0, 0, 0.3, 0.8, 1.0, 1.2, 1.2, 1.6,
    2.0, 1.8, 1.0, 0.8, 1.0, 2.2, 3.2, 3.4, 3.0, 2.4, 1.6, 1.0,
  ],
};
