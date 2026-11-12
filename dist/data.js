// ALL AUTHORED CONTENT LIVES HERE. Edit freely: no code changes needed.
// Times are in game minutes. [centre, spread] pairs are organic values.
// ---------------------------------------------------------------------------
// The map. One character per tile. See TILE_LEGEND below.
export const MAP = [
    "##################################",
    "#B~~d~w~#::#,,SS,R,O,,,,H,,,,PPPP#",
    "#B~~~~~~#::#,,,,,,,,,,,,,,,,,,,,,#",
    "#~~~~~~~#::#,,,,,,,,,,,,,,,,,,,,,#",
    "#~~~~~~~D::#,,,,,,,,KK,,,,,,,,,,,#",
    "#~~~~~~~#::#,,,,,,,,,,,,,,,,,,,,,#",
    "#~~~~~~~#::#W,,,,,,,,,,,,,,,,,,,,#",
    "#########::##D####h###Z###D#A#Y###",
    "#..........#_____________________#",
    "#..........#_============g======##",
    "#.............s.s.s.s.s.s.s.s.s..#",
    "#................................#",
    "#...............c....c...........#",
    "#.........ctc..ctc..ctc..ctc.....#",
    "#...............c....c..........F#",
    "#...............................F#",
    "###..###........c....c....ccc....#",
    "#X;;;;;#..ctc..ctc..ctc..ctttc...#",
    "#b;;;;b#........c....c....ccc....#",
    "#b;;;;b#.........................#",
    "#b;;;;b#.........................#",
    "###E##############################",
];
const C = {
    wall: "#2a211d",
    tap: "#8a6a4a",
    kitchen: "#a39c8e",
    bed: "#7a5c48",
    hall: "#6e5644",
    staff: "#7d5f43",
    entry: "#7c766c",
};
export const TILE_LEGEND = {
    "#": { kind: "wall", floor: C.wall },
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
    H: { kind: "furniture", floor: C.kitchen, label: "Kettle", name: "Hearth kettle", interact: "station" },
    K: { kind: "furniture", floor: C.kitchen, label: "Prep", name: "Prep table", interact: "station" },
    W: { kind: "furniture", floor: C.kitchen, label: "Bin", name: "Scrap bin", interact: "bin" },
    P: { kind: "furniture", floor: C.kitchen, label: "Pantry", name: "Pantry", interact: "pantry" },
    F: { kind: "furniture", floor: C.tap, label: "Fire", name: "Fireplace", interact: "fireplace" },
    B: { kind: "furniture", floor: C.bed, label: "Bed", name: "Bed", interact: "bed" },
    d: { kind: "furniture", floor: C.bed, label: "Desk", name: "Desk", interact: "desk" },
    w: { kind: "furniture", floor: C.bed, label: "Ward", name: "Wardrobe", interact: "wardrobe" },
    X: { kind: "furniture", floor: C.entry, label: "Coats", name: "Coat rack", interact: "coats" },
};
/** Which crafting station each map letter is. Multi-tile stations share one id. */
export const STATION_OF_TILE = {
    S: "stove", R: "griddle", O: "oven", H: "kettle", K: "prep",
};
/** Which drink each tap letter pours. */
export const TAP_OF_TILE = { A: "ale", Y: "cider" };
export const ROOM_LABELS = [
    { text: "Bedroom", x: 4, y: 5.6 },
    { text: "Kitchen", x: 22, y: 6.2 },
    { text: "Taproom", x: 20, y: 11.6 },
    { text: "Coat hall", x: 4, y: 19.8 },
];
export const INGREDIENTS = [
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
];
export const RECIPES = [
    { id: "stew", blurb: "A pot that keeps the whole room warm. Slow to make and generous once it's done: it feeds whoever asks, a ladle at a time, until the pot scrapes bottom.", icon: "🍲", name: "Stew", kind: "food", station: "stove", baseTags: ["warm", "hearty"], slots: 2,
        options: ["beef", "mushroom", "roots", "pepper", "herbs", "sausage"], minutes: [14, 3], servings: [7, 1] },
    { id: "fish", blurb: "Fresh from the morning boats, into a hot pan. It needs you standing over it the whole time, and it's worth it.", icon: "🐟", name: "Fried fish", kind: "food", station: "griddle", baseTags: ["warm", "briny"], slots: 1,
        options: ["crumb", "herbs", "zest"], minutes: [6, 1.5], tended: true },
    { id: "pie", blurb: "Golden and lidded, cut into slices that keep in the pie safe. Tomorrow it's day-old, and still somebody's favourite.", icon: "🥧", name: "Pie", kind: "food", station: "oven", baseTags: ["warm", "homely"], slots: 1,
        options: ["apple", "berry", "meat", "cheese"], minutes: [20, 4], servings: [6, 1], storedIn: "piesafe" },
    { id: "salad", blurb: "Cold and crisp, put together by hand at the prep table. Quick to make, and easy to get just right.", icon: "🥗", name: "Salad", kind: "food", station: "prep", baseTags: ["cold", "light"], slots: 2,
        options: ["apple", "walnut", "radish", "herbs", "cheese", "herring"], minutes: [4, 1] },
    { id: "tea", blurb: "A cup for one, steeped at the hearth. What goes in the pot decides who it comforts.", icon: "🍵", name: "Tea", kind: "drink", station: "kettle", baseTags: ["warm", "mild"], slots: 1,
        options: ["mint", "chamomile", "black", "smokedleaf"], minutes: [3, 1] },
    { id: "ale", icon: "🍺", name: "Ale", kind: "drink", station: "tap", baseTags: ["cold", "bitter", "hearty"], slots: 0,
        options: [], minutes: [0, 0] },
    { id: "cider", icon: "🍏", name: "Cider", kind: "drink", station: "tap", baseTags: ["cold", "crisp", "sweet"], slots: 0,
        options: [], minutes: [0, 0] },
];
export const SNACKS = [
    { id: "peanuts", name: "Salted peanuts", icon: "🥜", tags: ["salty", "crisp"], thirsty: 0.3, blurb: "Roasted and well salted. Nothing sends people to the bar faster." },
    { id: "olives", name: "Olives", icon: "🫒", tags: ["briny", "salty"], thirsty: 0.25, blurb: "Brined and glossy, for those who like a sharp edge." },
    { id: "eggs", name: "Pickled eggs", icon: "🥚", tags: ["tart", "savoury"], thirsty: 0.1, blurb: "From the big jar on the counter. An acquired taste, fondly acquired." },
];
export const GARNISHES = [
    { id: "lemon", icon: "🍋", name: "Lemon", tags: ["bright", "tart"] },
    { id: "honey", icon: "🍯", name: "Honey", tags: ["sweet"] },
    { id: "spice", icon: "🌶️", name: "Spice", tags: ["warm", "fiery"] },
    { id: "sprig", icon: "🌿", name: "Mint sprig", tags: ["fragrant"] },
];
export const ARCHETYPES = [
    { id: "dock", name: "Dockworker", color: "#b5651d", weight: 3,
        tastes: { love: ["rich", "hearty"], like: ["smoky", "savoury", "bitter", "salty"], dislike: ["light", "fragrant"] },
        extraLikes: ["fiery", "briny", "warm"],
        fussiness: [0.5, 0.2], patience: [40, 10], stay: [120, 40], consume: [22, 6], walk: [2.6, 0.4],
        foodBias: 0.6, garnishAsk: 0.15, messiness: [0.7, 0.2] },
    { id: "scholar", name: "Scholar", color: "#5b7fb5", weight: 2,
        tastes: { love: ["fragrant"], like: ["mild", "homely", "bright"], dislike: ["fiery", "smoky", "salty"] },
        extraLikes: ["tart", "crisp", "warm"],
        fussiness: [0.7, 0.15], patience: [32, 8], stay: [100, 30], consume: [26, 6], walk: [2.0, 0.3],
        foodBias: 0.4, garnishAsk: 0.4, messiness: [0.15, 0.1] },
    { id: "traveller", name: "Traveller", color: "#6f9e5a", weight: 3,
        tastes: { love: ["warm"], like: ["hearty", "sweet", "homely", "savoury", "crisp"], dislike: [] },
        extraLikes: ["earthy", "rich", "bright"],
        fussiness: [0.2, 0.15], patience: [55, 15], stay: [90, 30], consume: [20, 5], walk: [2.4, 0.4],
        foodBias: 0.55, garnishAsk: 0.2, messiness: [0.4, 0.2] },
    { id: "farmer", name: "Farmhand", color: "#a89a3c", weight: 2,
        tastes: { love: ["earthy"], like: ["homely", "tart", "crisp"], dislike: ["sweet", "briny"] },
        extraLikes: ["hearty", "smoky", "fresh"],
        fussiness: [0.4, 0.2], patience: [45, 10], stay: [110, 35], consume: [20, 5], walk: [2.2, 0.4],
        foodBias: 0.5, garnishAsk: 0.15, messiness: [0.5, 0.2] },
];
export const REGULARS = [
    { id: "hedda", name: "Hedda", color: "#c9a0dc", schema: "reserved", joinsOnDay: 1, habit: [11, 13],
        blurb: "The miller's widow. Says little.",
        food: { love: ["savoury"], like: ["warm", "earthy"], dislike: ["sweet", "tart", "fiery"] },
        drink: { love: ["homely"], like: ["mild", "warm", "fragrant", "bitter"], dislike: [] },
        cravings: ["earthy", "homely", "rich"],
        fussiness: 0, patience: [80, 10], stay: [90, 20], consume: [28, 5], walk: [1.6, 0.2],
        foodBias: 0.7, garnishAsk: 0, messiness: 0.1 },
    { id: "tobin", name: "Tobin", color: "#e07b5f", schema: "unformed", joinsOnDay: 1, habit: [18, 20],
        blurb: "New in town. Doesn't seem to know what he likes.",
        food: { love: [], like: [], dislike: [] }, drink: { love: [], like: [], dislike: [] },
        target: { food: 7, drink: 4 },
        cravings: ["sweet", "smoky", "fiery", "tart", "rich", "briny", "crisp", "earthy"],
        fussiness: 0.2, patience: [50, 10], stay: [150, 30], consume: [18, 5], walk: [2.8, 0.3],
        foodBias: 0.55, garnishAsk: 0.3, messiness: 0.8 },
    { id: "maren", name: "Maren", color: "#f0c05a", schema: "open", joinsOnDay: 3, habit: [15, 17],
        blurb: "Bakes for half the street. Hopeful about most things.",
        food: { love: ["sweet", "warm"], like: ["homely", "crisp"], dislike: ["bitter", "briny"] },
        drink: { love: ["sweet"], like: ["warm", "fragrant"], dislike: ["bitter"] },
        cravings: ["tart", "fragrant", "homely"],
        fussiness: 0.3, patience: [50, 10], stay: [80, 20], consume: [20, 5], walk: [2.2, 0.3],
        foodBias: 0.5, garnishAsk: 0.4, messiness: 0.3 },
    { id: "ferryman", name: "The ferryman", color: "#4f8a8b", schema: "veiled", joinsOnDay: 5, habit: [20, 22],
        blurb: "Takes the night crossing. Hard to read.",
        food: { love: ["smoky", "briny"], like: ["hearty"], dislike: ["light", "sweet"] },
        drink: { love: ["bitter"], like: ["smoky", "warm"], dislike: ["sweet", "fragrant"] },
        cravings: ["smoky", "briny", "fiery", "rich"],
        fussiness: 0.55, patience: [40, 8], stay: [120, 30], consume: [20, 5], walk: [2.0, 0.3],
        foodBias: 0.6, garnishAsk: 0.2, messiness: 0.4 },
    { id: "wil", name: "Old Wil", color: "#b0b0a0", schema: "open", joinsOnDay: 7, habit: [9, 11],
        blurb: "Eats anything, says so loudly. Hard to surprise.",
        food: { love: ["rich"], like: ["warm", "hearty", "savoury", "smoky", "earthy", "homely", "crisp", "sweet"], dislike: [] },
        drink: { love: ["hearty"], like: ["bitter", "cold", "sweet", "warm", "crisp"], dislike: [] },
        cravings: ["fiery", "briny"],
        fussiness: 0.1, patience: [70, 10], stay: [140, 30], consume: [15, 4], walk: [1.5, 0.2],
        foodBias: 0.6, garnishAsk: 0.1, messiness: 0.6 },
    { id: "ysolde", name: "Ysolde", color: "#9db4ff", schema: "unformed", joinsOnDay: 9, habit: [16, 19],
        blurb: "A courier between towns. Picky, or maybe just unsure.",
        food: { love: [], like: [], dislike: [] }, drink: { love: [], like: [], dislike: [] },
        target: { food: 4, drink: 3 },
        cravings: ["bright", "crisp", "fragrant", "tart", "light", "fiery"],
        fussiness: 0.6, patience: [35, 8], stay: [70, 20], consume: [18, 5], walk: [2.6, 0.3],
        foodBias: 0.5, garnishAsk: 0.5, messiness: 0.2 },
];
/** Tags an unformed patron may roll each visit, and that cravings may name. */
export const TASTE_POOL = [
    "sweet", "tart", "savoury", "bitter", "rich", "earthy", "smoky", "briny", "fiery", "salty",
    "fragrant", "homely", "crisp", "bright", "hearty", "light", "warm", "cold", "mild",
];
export const SCHEMA_TUNING = {
    reservedThreshold: [5, 4, 3], // Delight threshold by familiarity band
    reservedBands: [0, 4, 8], // familiarity at which each band starts
    veiledNoiseFlips: 2, // tags whose valence is flipped per serve
    veiledHonestCraving: 0.33,
    cravingChance: 0.6, // chance a regular has a craving tonight
    cravingBonus: 2,
    unformedRoll: { love: 2, like: 2, dislike: 2 }, // tags rolled per visit, per kind
    driftChance: 0.1, // per visit, a resolved regular's like may drift
    unformedDislikeLockAt: -3, // a reaction this bad (before fussiness) locks the disliked tags in
};
// ---------------------------------------------------------------------------
// Talk. {tag} is filled in from the speaker's own tastes, so chatter can give tastes away.
export const CHATTER = {
    small: [
        "Wind's turned, they say.", "Did you hear about the mill?", "Market was busy today.",
        "My feet are killing me.", "Long day.", "Quiet in here tonight. I like it.",
        "Ferry was late again.", "Haven't been here in a while.", "Fire's nice.",
        "You still owe me for last time.", "Rain's coming.",
    ],
    love: ["Nothing beats something {tag}.", "I'd walk a mile for anything {tag}.", "Give me {tag} any day."],
    like: ["Something {tag} would go down well.", "I don't mind a bit of {tag}."],
    dislike: ["Can't abide anything {tag}.", "Keep anything {tag} away from me.", "Never cared for {tag} things."],
    replies: ["Mm.", "Too right.", "Is that so?", "Ha!", "Same here.", "You always say that.", "Hm."],
    greet: { morning: "Morning!", afternoon: "Afternoon.", evening: "Evening!", late: "Still up?" },
    answer: {
        stranger: ["Evening.", "Hello.", "Mm, hello."],
        known: ["Ah, there you are.", "Good to see you.", "Evening, keeper."],
        friend: ["There's my favourite keeper.", "Was hoping you'd come by.", "Sit with us a moment, if you can."],
    },
};
export const TALK_TUNING = {
    chatEvery: [30, 12], // game minutes between things a person says
    hintChance: 0.2, // a line that gives a taste away (about one in five)
    overhearRange: 5, // tiles: the journal notes chatter heard this close
    greetRange: 1.7, // tiles: walking this close starts a quick hello
    inspireRange: 4, // tiles: people this close notice someone else's Delight
};
const SND = "assets/sounds/";
export const SOUNDS = {
    doorOpens: { files: [SND + "door-opens-1.opus"], volume: 0.8, pitch: 0.05 },
    doorCloses: { files: [SND + "door-closes.opus"], volume: 0.8, pitch: 0.05 },
    bell: { files: [SND + "shopkeeper-bell-1.opus", SND + "shopkeeper-bell-2.opus"], volume: 0.55, pitch: 0.05, heardEverywhere: true },
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
    order: { files: [SND + "order-two-taps.opus", SND + "order-three-taps.opus"], volume: 0.5, pitch: 0.05, trim: true, heardEverywhere: true },
    paper: { files: [SND + "check-sound.opus"], volume: 0.45, pitch: 0.04, trim: true },
    // Confirming with a menu's main (gold) button: COOK, GARNISH IT, TURN IN... Switch off with SOUND_TUNING.confirmSound.
    confirm: { files: [SND + "piano-confirm.opus"], volume: 0.45, pitch: 0.01, trim: true },
    servePositive: { files: [SND + "serving-outcome-positive-1-chord.opus", SND + "serving-outcome-positive-2-chord.opus"], volume: 0.5, pitch: 0.01, trim: true },
    serveNeutral: { files: [SND + "serving-outcome-neutral-1-chord.opus", SND + "serving-outcome-neutral-2-chord.opus"], volume: 0.45, pitch: 0.01, trim: true },
    serveNegative: { files: [SND + "serving-outcome-negative-1-chord.opus", SND + "serving-outcome-negative-2-chord.opus"], volume: 0.45, pitch: 0.01, trim: true },
    delight: { files: [SND + "delight-1.opus", SND + "delight-2.opus"], volume: 0.6, pitch: 0.01, trim: true },
    // The fire, heard from the fireplace. Which plays when: FIRE below.
    fireSmall: { files: [SND + "fireplace-small-loop.opus"], volume: 0.25, pitch: 0.03, loop: true },
    fireMedium: { files: [SND + "fireplace-med-loop.opus"], volume: 0.35, pitch: 0.03, loop: true },
    fireLarge: { files: [SND + "fireplace-large-loop.opus"], volume: 0.42, pitch: 0.03, loop: true },
    // The murmur of the taproom, by how many people are in it (CROWD below).
    crowdLow: { files: [SND + "occupancy-bg-low-1-loop.opus", SND + "occupancy-bg-low-2-loop.opus"], volume: 0.16, pitch: 0.02, loop: true, room: "taproom" },
    crowdComfortable: { files: [SND + "occupancy-bg-comfortable-1-loop.opus"], volume: 0.22, pitch: 0.02, loop: true, room: "taproom" },
    crowdBusy: { files: [SND + "occupancy-bg-busy-1-loop.opus"], volume: 0.27, pitch: 0.02, loop: true, room: "taproom" },
    crowdPacked: { files: [SND + "occupancy-bg-packed-1-loop.opus"], volume: 0.32, pitch: 0.02, loop: true, room: "taproom" },
};
export const SOUND_TUNING = {
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
    confirmSound: true, // a piano note when you press a menu's main (gold) button (the "confirm" sound)
    // The crowd
    crowdFadeMs: 3000,
    crowdSettleMs: 2500, // the headcount must hold this long before the murmur changes
};
export const FIRE = {
    lighting: [{ sound: "fireSmall", seconds: 4 }, { sound: "fireLarge", seconds: 25 }, { sound: "fireMedium" }],
    dousing: [{ sound: "fireSmall", seconds: 12 }],
    crossfadeMs: 2500,
};
/** Taproom murmur: the busiest level whose headcount is reached (people in the taproom). */
/** Which cue answers each serving outcome. LEAVING is a guest giving up, not a serve: the synth tone covers it. */
export const OUTCOME_SOUND = {
    DELIGHT: "delight", PLEASED: "servePositive", FULFILLED: "serveNeutral", UNFINISHED: "serveNegative", COMPLAINS: "serveNegative",
};
export const CROWD = [
    { sound: "crowdLow", from: 1 },
    { sound: "crowdComfortable", from: 6 },
    { sound: "crowdBusy", from: 15 },
    { sound: "crowdPacked", from: 27 },
];
/** Rooms, for which sounds carry where. Floor characters from MAP; furniture takes the room around it. */
export const ROOM_OF_TILE = {
    "~": "bedroom", ":": "hall", ",": "kitchen", ".": "taproom", "_": "taproom", "=": "taproom", g: "taproom",
    s: "taproom", c: "taproom", t: "taproom", ";": "entry", b: "entry", E: "entry",
};
export const ROOM_LINKS = [
    ["bedroom", "hall"], ["hall", "taproom"], ["kitchen", "taproom"], ["entry", "taproom"],
];
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
// The bill of fare: what's on today. Set at the desk.
export const DEFAULT_MENU = ["ale", "cider"];
export const UPGRADES = [
    { id: "kettle", name: "Copper kettle", icon: "🫖", desc: "Tea brews twice as fast.", unlockAtServed: 8 },
    { id: "urn", name: "Tea urn", icon: "⚱️", desc: "Adds a choice at the kettle: brew a whole urn, about 8 cups, poured straight from it. Single cups stay.", unlockAtServed: 20 },
    { id: "trays", name: "Wider trays", icon: "🍽️", desc: "Carry 3 dishes per tray, and 5 drinks.", unlockAtServed: 35 },
];
// ---------------------------------------------------------------------------
// Pacing and rules. Tune these by playing.
export const TUNING = {
    dayStartHour: 6,
    dayLengthMinutes: 20 * 60, // 6 AM to 2 AM
    realSecondsPerGameMinute: 2.5, // at speed x1. A chill pace.
    speeds: [0.5, 1, 2, 4],
    quietClockBoost: 5, // extra speed while the inn is closed or empty
    keeperWalk: 4.2, // tiles per real second
    keeperRun: 7,
    trayCapacity: { drink: 4, food: 2 },
    hatchCapacity: 8,
    shelfCapacity: 2, // finished dishes a station can hold, waiting to be picked up
    pieSafeCapacity: 4, // whole pies
    // Freshness, first pass: food left over a night turns day-old (still servable, a bit less nice);
    // anything older goes to the hens.
    staleTag: "day-old",
    stalePenalty: -1, // everyone minds day-old food a little
    speedUpFactor: 1.4, // holding Space at a crafting station
    delightThreshold: 3,
    scoring: { love: 2, like: 1, dislike: -2, missingGarnish: -2 },
    reorderChance: 0.65,
    // Groups of visitors: chance of each size (1 to 6). Never larger than the biggest table.
    groupSizeWeights: [0.45, 0.28, 0.12, 0.08, 0.04, 0.03],
    outcomeShowMinutes: 10,
    // Mess
    tableDirtyAt: 2, // dirt units before a table counts as dirty
    spillChancePerHour: 0.5, // times messiness, while eating or drinking
    cleanSeconds: [2.4, 0.8], // real seconds of holding Space
    pourSeconds: [3, 0.3], // real seconds to pour a drink at a tap (an upgrade could shorten it)
    urnPourSeconds: [2, 0.2], // real seconds to pour a cup of tea from the urn at the kettle
    // Snack bowls
    bowlEatenPerHour: 0.35, // share of a bowl one patron who likes it picks at in an hour
    bowlCommentChance: 0.5, // chance someone who loves or hates the snack says so
    // Arrivals per game hour, by clock hour (0-23). Multiplied by the debug flow slider.
    flowByHour: [
        0.6, 0.4, 0, 0, 0, 0, 0.3, 0.8, 1.0, 1.2, 1.2, 1.6,
        2.0, 1.8, 1.0, 0.8, 1.0, 2.2, 3.2, 3.4, 3.0, 2.4, 1.6, 1.0,
    ],
};
