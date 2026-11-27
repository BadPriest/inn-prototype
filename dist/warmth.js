// The room's warmth (inn#110): one temperature for the whole room, in the outdoor temperature's steps, plus
// what's near each spot (the fire or a heater close by, the cold by the front door). Guests feel it against
// the step they feel right at: colder, and the cold creeps into them; warmer than that by far, and they roast.
import { NEEDS, ROOM, TOO_HOT, WEATHER } from "./data.js";
import { dist } from "./world.js";
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const insulationIndex = (g) => Math.max(0, Math.min(ROOM.insulation.pull.length - 1, Math.round(g.insulation) + 2));
/** How far the fire's own warmth carries (tiles): less the colder it is out. */
export function fireReach(g) {
    return NEEDS.fire.radius * NEEDS.fireReachByTemperature[g.weather.tempStep];
}
/** The fire, if lit, and every lit heater. */
export function heatSources(g) {
    const out = [];
    for (const f of g.world.furniture) {
        if (f.kind === "fireplace" && g.fireLit)
            out.push({ at: f.center, room: ROOM.fire.room, local: ROOM.fire.local, reach: fireReach(g) });
        else if (f.kind === "heater" && f.equip?.heat && g.heatersLit.has(f.id))
            out.push({ at: f.center, ...f.equip.heat });
    }
    return out;
}
const guestsInside = (g) => g.patrons.filter((p) => p.state !== "leaving").length;
/** How aired the room is: 0 with every window shut, 1 with enough of them open. */
export const airing = (g) => Math.min(1, g.windowsOpen.size * ROOM.windows.perWindow);
/**
 * Where the room is heading: the outside pulled towards comfortable, what's lit (kept by the insulation), the guests.
 * Open windows let the outside in, let the warmth out, and the draught cools.
 */
export function roomTarget(g) {
    const i = insulationIndex(g), out = g.weather.temp, air = airing(g);
    const heat = heatSources(g).reduce((a, s) => a + s.room, 0) * ROOM.insulation.keep[i] + Math.min(ROOM.guestsMost, ROOM.perGuest * guestsInside(g));
    return out + (ROOM.comfortable - out) * ROOM.insulation.pull[i] * (1 - air) + heat * (1 - ROOM.windows.heatLost * air) - ROOM.windows.breeze * air;
}
/** Open a window, or close it. */
export function toggleWindow(g, x, y) {
    const key = `${x},${y}`;
    if (g.windowsOpen.delete(key)) {
        g.say("You close the window.");
        return;
    }
    g.windowsOpen.add(key);
    const out = g.weather.temp;
    g.say(out < ROOM.comfortable - 1 ? "You open the window. Cold air pours in." : out > ROOM.comfortable ? "You open the window. Air moves through the room." : "You open the window. Fresh air comes in.");
}
let saidStuffy = -1;
/** Every frame: the keeper is told once a day when the room's stuffy with every window shut. */
export function stuffyRoom(g) {
    if (saidStuffy === g.day || g.windowsOpen.size || roomTemp(g) < ROOM.windows.stuffyFrom)
        return;
    saidStuffy = g.day;
    g.say("🪟 It's getting stuffy in here. Open a window or two to let the air through.");
}
export const roomTemp = (g) => g.room.temp ?? roomTarget(g);
/** A temperature as its step's name, in lower case ("cool"). */
export function stepName(temp) {
    const steps = WEATHER.temperature.steps;
    return steps[Math.max(0, Math.min(steps.length - 1, Math.round(temp)))].name.toLowerCase();
}
export const roomName = (g) => stepName(roomTemp(g));
/** Every frame the clock runs: the room settles towards its target; the cold at the door flares while it's open. */
export function updateRoom(g, simMinutes) {
    const target = roomTarget(g);
    g.room.temp = g.room.temp === null ? target : g.room.temp + (target - g.room.temp) * Math.min(1, simMinutes / 60 / (ROOM.insulation.settleHours[insulationIndex(g)] * (1 - 0.5 * airing(g))));
    g.room.flare = g.frontDoor.open ? 1 : Math.max(0, g.room.flare - simMinutes / ROOM.door.flareMinutes);
}
/** 1 in the doorway, fading to 0 at the edge of the door's patch. */
function nearDoor(g, pos) {
    const d = g.world.frontDoor;
    return clamp01(1 - dist(pos, { x: d.x + 0.5, y: d.y + 0.5 }) / ROOM.door.radius);
}
/** The warmth at a spot: the room's, plus whatever's lit near it, pulled towards the outside by the door. */
export function tempAt(g, pos) {
    let t = roomTemp(g);
    for (const s of heatSources(g))
        t += s.local * clamp01(1 - dist(pos, s.at) / s.reach);
    const door = nearDoor(g, pos);
    if (door > 0)
        t += (g.weather.temp - t) * (ROOM.door.chill + (1 - ROOM.door.chill) * g.room.flare) * door;
    return t;
}
/** 1 right by something lit, fading to 0 at the edge of its reach: how fast wet clothes dry and snow melts. */
export function byTheHeat(g, pos) {
    return Math.max(0, ...heatSources(g).map((s) => clamp01(1 - dist(pos, s.at) / s.reach)));
}
export const isByTheDoor = (g, pos) => nearDoor(g, pos) > 0;
/** Too hot at this warmth for someone who feels right at `comfort`: 0 fine … 1 roasting. */
export const tooHotAt = (temp, comfort) => clamp01((temp - comfort - ROOM.hot.over) / ROOM.hot.span);
/** Too hot where they are: 0 fine … 1 roasting. */
export const tooHot = (g, p) => tooHotAt(tempAt(g, p.pos), p.comfort);
/** How much colder someone walks in than they came out: by how far the day is under what they feel right at. */
export const arrivalChill = (g, comfort) => Math.max(0, comfort - g.weather.temp) * ROOM.arrivalPerStep;
/** Each game hour, how the cold changes in them where they are: up when it's colder than they feel right at. */
export const chillPerHour = (g, p) => ROOM.coldPerStepHour * (p.comfort - tempAt(g, p.pos)) - ROOM.indoorRelief;
/** A cold day out: sitting warm and comfortable, they're in no hurry to go. Game minutes of stay added per hour. */
export function cosyPerHour(g, p) {
    if (g.weather.temp >= ROOM.cosy.outsideBelow)
        return 0;
    const here = tempAt(g, p.pos);
    return here >= p.comfort - 0.5 && tooHotAt(here, p.comfort) === 0 ? ROOM.cosy.stayPerHour : 0;
}
/** A cold day out: passers-by come in for the warmth, by how much warmer the room is than outside. 1 otherwise. */
export function warmthDraw(g) {
    if (g.weather.temp >= ROOM.draw.outsideBelow)
        return 1;
    return 1 + Math.min(ROOM.draw.most, ROOM.draw.perStep * Math.max(0, roomTemp(g) - g.weather.temp - 1));
}
/** How much a spot appeals for its warmth: a cold guest leans towards the warm, and nobody wants to roast. */
export function warmthAppeal(g, at, who) {
    const here = tempAt(g, at);
    const warmer = Math.max(0, here - roomTemp(g));
    return (1 + ROOM.seekWarmth * who.cold * warmer) * (1 - TOO_HOT.seatAvoid * tooHotAt(here, who.comfort));
}
/** This cold or over, they shiver: 0 not at all … 1 hard. */
export const shiverOf = (p) => (p.needs.warmth < ROOM.shiverAt ? 0 : 0.4 + 0.6 * clamp01((p.needs.warmth - ROOM.shiverAt) / (1 - ROOM.shiverAt)));
