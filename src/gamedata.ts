import type { Organic } from "./core.js";
import type { CalendarSeasonId, StationKind } from "./data.js";

export type Pence = number;
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type Container = "cup" | "glass" | "bowl" | "plate" | "table";
export type PickUp = "ladle" | "pour" | "slice" | "take";
export type MealTime = "breakfast" | "lunch" | "dinner" | "between";
export type Hours = [from: number, to: number];
export type DeliveryDays = "daily" | Weekday[];

export interface IngredientUse { id?: string; role?: string; units: number; stages?: string[] }
export interface IngredientGroup { pick: [min: number, max: number]; options: IngredientUse[] }

export interface DishEffect {
  openness?: number;
  patience?: number;
  hunger?: number;
  thirst?: number;
  flipTag?: { from: string; to: string };
  shown?: string;
}

export interface DishData {
  id: string;
  name: string;
  icon: string;
  tableSnack?: boolean;
  container: Container;
  boughtAs?: string;
  garnish?: { pick: [min: number, max: number] };
  traySlots: number;
  pickUp: PickUp;
  meals: MealTime[];
  madeAt?: { kinds: StationKind[] };
  tended?: boolean;
  minutes?: Organic;
  batch?: { servings: Organic; calledWhenReady?: string; storedIn?: string };
  tags: string[];
  ingredients?: { fundamental: IngredientUse[]; base: IngredientGroup; optional: IngredientGroup };
  spoilage?: string;
  price?: { fixed?: Pence };
  seasons?: { craved?: CalendarSeasonId[] };
  effects?: {
    needs?: { hunger?: number; thirst?: number; warmth?: number };
    minutesToEat?: Organic;
    mess?: number;
    onConsuming?: DishEffect[];
  };
  text?: { craftingStation?: string; snackBowl?: string; journal?: string; patronOrders?: string[]; patronPraises?: string[]; patronComplaints?: string[] };
}
export interface DishesData { dishes: DishData[] }

export interface StageEffect { addTags: string[]; removeTags: string[]; priceFactor: number; tastePenalty: number; unservable?: boolean }

export interface IngredientData {
  id: string;
  name: string;
  icon: string;
  unit: string;
  worth: Pence;
  tags: string[];
  roles: string[];
  garnishFor?: Container[];
  spoilage: string;
  onceOpened?: string;
  spoilageOverrides?: Record<string, Partial<StageEffect>>;
  seasons?: CalendarSeasonId[];
}
export interface IngredientsData { roles: Record<string, string>; ingredients: IngredientData[] }

export interface SpoilageProfile { stages: Record<string, number>; stageEffects?: Record<string, Partial<StageEffect>> }
export interface SpoilageData { stageEffects: Record<string, StageEffect>; profiles: Record<string, SpoilageProfile> }

export interface EconomyData {
  price: { markup: number; margin: number; prepPerMinute: { tended: Pence; untended: Pence }; perTraySlot: Pence; roundShownTo: Pence };
  houseLevels: { id: "cheap" | "fair" | "dear"; factor: number; flow: number }[];
  tips: { delight: { share: number; atLeast: Pence }; pleased: { share: number; atLeast: Pence }; walkoutShare: number };
  startingPurse: Pence;
  startingPantry: Record<string, number>;
  deliveryFee: Pence;
  sellBackShare: number;
  fetchMinutes: number;
  suppliers: { priceFactor: number };
}

export type EquipmentType = "crafting" | "storage" | "gear" | "utensil" | "tray";
export interface EquipmentPiece {
  id: string;
  name: string;
  icon: string;
  type: EquipmentType;
  label?: string;
  shape?: string[];
  shopTab: "cooking" | "drinks" | "storage" | "serving";
  price: Pence;
  line?: string;
  tier?: number;
  slots?: { name: string; kinds: StationKind[] }[];
  craftingSpeed?: number;
  fuel?: "wood";
  usedIn?: StationKind[];
  servingsBonus?: number;
  holds?: string[];
  capacity?: { batches?: number; servings?: number };
  serveSeconds?: Organic;
  traySlots?: number;
  text?: { shopCard?: string };
}
export interface EquipmentData { equipment: EquipmentPiece[] }

export interface InventoryLine { item: string; pack?: { units: number; name: string } }
export interface SupplierFields {
  priceFactor?: number;
  deliveryDays?: DeliveryDays;
  orderBy?: number;
  distanceInMinutes?: number;
  openHours?: Hours;
  inventory?: InventoryLine[];
}
export interface SupplierData extends SupplierFields { id: string; name: string; icon: string; people: string[]; inventory: InventoryLine[] }
export interface SuppliersData { suppliers: SupplierData[] }

export interface LocationData {
  id: string;
  name: string;
  icon: string;
  seasonDays: [spring: number, summer: number, autumn: number, winter: number];
  rainWeight: number;
  stormWeight: number;
  cold?: { seasons: CalendarSeasonId[]; nights: CalendarSeasonId[] };
  traffic: number;
  shelter: number;
  visitorWeights: Record<string, number>;
  marketDay?: string;
  streetSound: "streetTown" | "streetCountry";
  suppliers: ({ id: string } & SupplierFields)[];
  text: { cardChips: string[]; card: string };
}
export interface LocationsData { locations: LocationData[] }

export type WalkthroughStepId = "desk" | "bill" | "cook" | "open" | "greet" | "make" | "carry" | "eat" | "buy";
export interface WalkthroughData { steps: { id: WalkthroughStepId; text: string; reward: number }[] }

export interface SkillsData { startKnown: string[]; servedPerPoint: number; recipes: { dish: string; points: number }[] }
