// Checks data/*.json against data/schemas and against each other, then writes src/gamedata.gen.ts.
// Usage: node tools/gamedata.mjs   (the build runs it before compiling)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const FILES = ["dishes", "ingredients", "spoilage", "economy", "equipment", "suppliers", "locations", "walkthrough", "skills", "building"];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(readJson(join(dataDir, "schemas", "common.schema.json")), "common.schema.json");

const errors = [];
const fail = (file, msg) => errors.push(`data/${file}.json: ${msg}`);

const data = {};
for (const name of FILES) {
  let json;
  try {
    json = readJson(join(dataDir, `${name}.json`));
  } catch (e) {
    fail(name, `not valid JSON (${e.message})`);
    continue;
  }
  const validate = ajv.compile(readJson(join(dataDir, "schemas", `${name}.schema.json`)));
  if (!validate(json)) for (const e of validate.errors) fail(name, `${readablePath(json, e.instancePath)} ${e.message}${e.params?.additionalProperty ? ` ("${e.params.additionalProperty}")` : ""}`);
  delete json.$schema;
  data[name] = json;
}
if (errors.length) finish("Fix these first; the checks between files run once each file matches its schema.");

function readablePath(json, path) {
  if (!path) return "(top)";
  let node = json;
  return path.split("/").slice(1).map((key) => {
    node = node?.[key];
    return node && typeof node === "object" && typeof node.id === "string" ? node.id : key;
  }).join(" › ");
}

const { dishes, ingredients, spoilage, equipment, suppliers, locations } = data;

function uniqueIds(file, list) {
  const seen = new Set();
  for (const { id } of list) {
    if (seen.has(id)) fail(file, `id "${id}" is used twice`);
    seen.add(id);
  }
  return seen;
}
const dishIds = uniqueIds("dishes", dishes.dishes);
const ingredientIds = uniqueIds("ingredients", ingredients.ingredients);
const equipmentIds = uniqueIds("equipment", equipment.equipment);
const supplierIds = uniqueIds("suppliers", suppliers.suppliers);
uniqueIds("locations", locations.locations);

const roles = new Set(Object.keys(ingredients.roles));
const profiles = spoilage.profiles;
const stagesOf = (profileId) => Object.keys(profiles[profileId]?.stages ?? {});
const ingredientById = new Map(ingredients.ingredients.map((i) => [i.id, i]));

for (const i of ingredients.ingredients) {
  for (const r of i.roles) if (!roles.has(r)) fail("ingredients", `${i.id} has role "${r}", which isn't in roles`);
  for (const p of [i.spoilage, i.onceOpened].filter(Boolean)) if (!profiles[p]) fail("ingredients", `${i.id} uses spoilage profile "${p}", which isn't in spoilage.json`);
  for (const stage of Object.keys(i.spoilageOverrides ?? {})) if (!stagesOf(i.spoilage).includes(stage)) fail("ingredients", `${i.id} overrides stage "${stage}", which its profile "${i.spoilage}" doesn't have`);
  if (i.garnishFor && !i.roles.includes("garnish")) fail("ingredients", `${i.id} has garnishFor but not the garnish role`);
}

for (const [id, p] of Object.entries(profiles)) {
  for (const stage of Object.keys(p.stages)) if (!spoilage.stageEffects[stage] && !p.stageEffects?.[stage]) fail("spoilage", `profile ${id} has stage "${stage}" with no effects`);
}

function checkUse(dish, use, where) {
  if (use.id && !ingredientById.has(use.id)) return fail("dishes", `${dish} ${where} uses ingredient "${use.id}", which isn't in ingredients.json`);
  if (use.role && !roles.has(use.role)) return fail("dishes", `${dish} ${where} uses role "${use.role}", which isn't in ingredients.json roles`);
  if (!use.stages) return;
  const candidates = use.id ? [ingredientById.get(use.id)] : ingredients.ingredients.filter((i) => i.roles.includes(use.role));
  for (const stage of use.stages) {
    if (!candidates.some((i) => stagesOf(i.spoilage).includes(stage))) fail("dishes", `${dish} ${where} accepts stage "${stage}", which no matching ingredient's spoilage profile has`);
  }
}
for (const d of dishes.dishes) {
  if (d.ingredients) {
    d.ingredients.fundamental.forEach((u) => checkUse(d.id, u, "fundamental"));
    for (const g of ["base", "optional"]) {
      const { pick, options } = d.ingredients[g];
      options.forEach((u) => checkUse(d.id, u, g));
      if (pick[0] > pick[1]) fail("dishes", `${d.id} ${g} picks at least ${pick[0]} but at most ${pick[1]}`);
      if (pick[1] > options.length) fail("dishes", `${d.id} ${g} picks up to ${pick[1]} from ${options.length} options`);
    }
  }
  if (!d.ingredients && !d.boughtAs) fail("dishes", `${d.id} has neither ingredients nor boughtAs`);
  if (d.ingredients && !d.madeAt) fail("dishes", `${d.id} has ingredients but no madeAt`);
  if (d.madeAt && !d.minutes) fail("dishes", `${d.id} is made at a station but has no minutes`);
  if (d.boughtAs && !ingredientById.has(d.boughtAs)) fail("dishes", `${d.id} is bought as "${d.boughtAs}", which isn't in ingredients.json`);
  if (d.spoilage && !profiles[d.spoilage]) fail("dishes", `${d.id} uses spoilage profile "${d.spoilage}", which isn't in spoilage.json`);
  if (d.tableSnack && d.container !== "table") fail("dishes", `${d.id} is a table snack but its container is "${d.container}"`);
  if (d.batch?.storedIn && !equipmentIds.has(d.batch.storedIn)) fail("dishes", `${d.id} is stored in "${d.batch.storedIn}", which isn't in equipment.json`);
  if (d.garnish && !ingredients.ingredients.some((i) => i.garnishFor?.includes(d.container))) fail("dishes", `${d.id} takes a garnish, but no ingredient garnishes a ${d.container}`);
}

for (const e of equipment.equipment) {
  for (const h of e.holds ?? []) if (!dishIds.has(h)) fail("equipment", `${e.id} holds "${h}", which isn't in dishes.json`);
  if (e.shape && new Set(e.shape.map((row) => row.length)).size > 1) fail("equipment", `${e.id} has shape rows of different lengths`);
}

const sellable = new Set([...ingredientIds, ...equipmentIds]);
const checkInventory = (file, owner, lines) => {
  for (const line of lines) {
    if (!sellable.has(line.item)) fail(file, `${owner} sells "${line.item}", which is neither an ingredient nor equipment`);
    if (ingredientIds.has(line.item) && !line.pack) fail(file, `${owner} sells ingredient "${line.item}" with no pack`);
  }
};
for (const s of suppliers.suppliers) {
  checkInventory("suppliers", s.id, s.inventory);
  if (s.deliveryDays && s.orderBy === undefined) fail("suppliers", `${s.id} delivers but has no orderBy`);
  if (s.distanceInMinutes !== undefined && !s.openHours) fail("suppliers", `${s.id} can be fetched but has no openHours`);
}

for (const id of Object.keys(data.economy.startingPantry)) if (!ingredientIds.has(id)) fail("economy", `startingPantry has "${id}", which isn't in ingredients.json`);

for (const l of locations.locations) {
  const days = l.seasonDays.reduce((a, b) => a + b, 0);
  if (days !== 112) fail("locations", `${l.id} season days add up to ${days}, not 112`);
  for (const s of l.suppliers) {
    if (!supplierIds.has(s.id)) fail("locations", `${l.id} lists supplier "${s.id}", which isn't in suppliers.json`);
    if (s.inventory) checkInventory("locations", `${l.id} (${s.id})`, s.inventory);
  }
}

uniqueIds("walkthrough", data.walkthrough.steps);

{
  const { startKnown, recipes } = data.skills;
  const learnable = new Set();
  for (const id of startKnown) if (!dishIds.has(id)) fail("skills", `startKnown has "${id}", which isn't in dishes.json`);
  for (const { dish } of recipes) {
    if (!dishIds.has(dish)) fail("skills", `recipes has "${dish}", which isn't in dishes.json`);
    if (learnable.has(dish)) fail("skills", `"${dish}" is in recipes twice`);
    if (startKnown.includes(dish)) fail("skills", `"${dish}" is both known at the start and in recipes`);
    learnable.add(dish);
  }
  for (const d of dishes.dishes) {
    if (d.madeAt && !startKnown.includes(d.id) && !learnable.has(d.id)) fail("skills", `${d.id} is made at a station but is neither known at the start nor in recipes`);
  }
}

finish();

function finish(footnote = "") {
  if (errors.length) {
    console.error(`Game data has ${errors.length} problem${errors.length > 1 ? "s" : ""}:\n  ${errors.join("\n  ")}${footnote ? `\n${footnote}` : ""}`);
    process.exit(1);
  }
  const out = [
    "// Generated by tools/gamedata.mjs from data/*.json. Edit the JSON, not this file.",
    'import type { DishesData, IngredientsData, SpoilageData, EconomyData, EquipmentData, SuppliersData, LocationsData, WalkthroughData, SkillsData, BuildingData } from "./gamedata.js";',
    "",
    `export const DISHES_DATA: DishesData = ${JSON.stringify(data.dishes)};`,
    `export const INGREDIENTS_DATA: IngredientsData = ${JSON.stringify(data.ingredients)};`,
    `export const SPOILAGE_DATA: SpoilageData = ${JSON.stringify(data.spoilage)};`,
    `export const ECONOMY_DATA: EconomyData = ${JSON.stringify(data.economy)};`,
    `export const EQUIPMENT_DATA: EquipmentData = ${JSON.stringify(data.equipment)};`,
    `export const SUPPLIERS_DATA: SuppliersData = ${JSON.stringify(data.suppliers)};`,
    `export const LOCATIONS_DATA: LocationsData = ${JSON.stringify(data.locations)};`,
    `export const WALKTHROUGH_DATA: WalkthroughData = ${JSON.stringify(data.walkthrough)};`,
    `export const SKILLS_DATA: SkillsData = ${JSON.stringify(data.skills)};`,
    `export const BUILDING_DATA: BuildingData = ${JSON.stringify(data.building)};`,
    "",
  ].join("\n");
  writeFileSync(join(root, "src", "gamedata.gen.ts"), out);
  console.log("Game data checked: src/gamedata.gen.ts written.");
}
