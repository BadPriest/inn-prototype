// The physical inn: tiles, furniture, seats, and pathfinding.
import { EQUIPMENT, EQUIPMENT_OF_TILE, PLACEABLE_ON, innOf, TILE_LEGEND, TAP_OF_TILE, UNDER_EQUIPMENT } from "./data.js";
export class World {
    w;
    h;
    tiles;
    furniture = [];
    seats = [];
    tables = [];
    frontDoor = { x: 0, y: 0 };
    bedSide = { x: 2, y: 2 };
    /** Which inn this is (its map). */
    inn;
    constructor(placed = defaultLayout(), inn = "medium") {
        this.inn = inn;
        const map = innOf(inn).map;
        this.h = map.length;
        this.w = map[0].length;
        this.tiles = baseMap(map).map((row, y) => [...row].map((ch, x) => {
            const def = TILE_LEGEND[ch] ?? TILE_LEGEND["."];
            const k = def.kind;
            const keeperWalk = ["floor", "staff", "door", "front", "stool", "chair", "bench"].includes(k);
            const patronWalk = ["floor", "front", "stool", "chair", "bench"].includes(k);
            return { x, y, ch, def, keeperWalk, patronWalk, base: ch };
        }));
        this.buildFurniture();
        this.placeEquipment(placed);
        this.buildSeats();
        // Tables can span several tiles; each is keyed by its first (top-left) tile.
        for (const f of this.furniture) {
            if (f.kind !== "table")
                continue;
            const anchor = f.tiles[0];
            const key = `${anchor.x},${anchor.y}`;
            for (const s of this.seats) {
                if (s.table && f.tiles.some((t) => t.x === s.table.x && t.y === s.table.y))
                    s.table = { ...anchor };
            }
            this.tables.push({ key, tile: { ...anchor }, chairs: this.seats.filter((s) => s.table && s.table.x === anchor.x && s.table.y === anchor.y) });
        }
    }
    /** Every place to cook, by id. */
    slotIndex = new Map();
    slot(id) {
        return this.slotIndex.get(id);
    }
    /** Stand each piece of equipment on the floor. */
    placeEquipment(placed) {
        for (const p of placed) {
            const eq = EQUIPMENT.find((e) => e.id === p.type);
            if (!eq || eq.gear)
                continue;
            const tiles = [];
            for (let dy = 0; dy < eq.h; dy++)
                for (let dx = 0; dx < eq.w; dx++)
                    tiles.push({ x: p.x + dx, y: p.y + dy });
            if (!tiles.every((t) => this.tile(t.x, t.y)))
                continue;
            tiles.forEach((t, i) => {
                const tile = this.tile(t.x, t.y);
                tile.def = { kind: "furniture", floor: tile.def.floor, label: i === 0 ? eq.label : "", name: eq.name, interact: eq.kind ?? "station" };
                tile.keeperWalk = false;
                tile.patronWalk = false;
                tile.equip = p.uid;
            });
            const f = {
                id: p.uid, kind: eq.kind ?? "station", name: eq.name, tiles,
                center: { x: p.x + eq.w / 2, y: p.y + eq.h / 2 }, equip: eq, tap: eq.tap,
            };
            const counts = new Map();
            for (const s of eq.slots)
                counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
            const seen = new Map();
            f.slots = eq.slots.map((s, i) => {
                const n = (seen.get(s.name) ?? 0) + 1;
                seen.set(s.name, n);
                const name = (counts.get(s.name) ?? 1) > 1 ? `${s.name} ${n}` : s.name;
                const slot = { id: eq.slots.length === 1 ? p.uid : `${p.uid}#${i}`, name, kinds: s.kinds, f };
                this.slotIndex.set(slot.id, slot);
                return slot;
            });
            // Kettles and coffee pots set on its hot-drink slots: each is a place to make something, keyed by the gear's own id.
            for (const q of placed.filter((x) => x.on === p.uid).slice(0, eq.hotSlots ?? 0)) {
                const gear = EQUIPMENT.find((e) => e.id === q.type && e.gear);
                if (!gear)
                    continue;
                const slot = { id: q.uid, name: gear.name, kinds: gear.slots[0]?.kinds ?? [], f, speed: gear.craftingSpeed, gear };
                this.slotIndex.set(slot.id, slot);
                f.slots.push(slot);
            }
            this.furniture.push(f);
        }
    }
    /** Can this piece stand here? Floor it's allowed on, nothing else there, and everything still within reach. */
    canPlace(type, x, y, moving, layout, keeper) {
        const eq = EQUIPMENT.find((e) => e.id === type);
        if (!eq)
            return false;
        if (eq.gear)
            return !!this.stoveWithRoom(x, y, moving, layout);
        const kx = Math.floor(keeper.x), ky = Math.floor(keeper.y);
        for (let dy = 0; dy < eq.h; dy++)
            for (let dx = 0; dx < eq.w; dx++) {
                const t = this.tile(x + dx, y + dy);
                if (!t || !PLACEABLE_ON.includes(t.base))
                    return false;
                if (t.equip && t.equip !== moving)
                    return false;
                if (t.x === kx && t.y === ky)
                    return false;
            }
        // Try it, and check the keeper can still get to everything: every piece of furniture and every door.
        const trial = new World([...layout.filter((p) => p.uid !== moving), { uid: moving ?? "new", type, x, y }], this.inn);
        const seen = new Set();
        const start = trial.tile(kx, ky);
        if (!start)
            return false;
        const queue = [{ x: kx, y: ky }];
        seen.add(ky * trial.w + kx);
        while (queue.length) {
            const c = queue.shift();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const n = trial.tile(c.x + dx, c.y + dy);
                if (!n || !n.keeperWalk || seen.has(n.y * trial.w + n.x))
                    continue;
                seen.add(n.y * trial.w + n.x);
                queue.push({ x: n.x, y: n.y });
            }
        }
        const reached = (v) => seen.has(v.y * trial.w + v.x);
        for (const f of trial.furniture)
            if (!trial.approachTiles(f).some(reached))
                return false;
        for (const row of trial.tiles)
            for (const t of row)
                if ((t.def.kind === "door" || t.def.kind === "front") && !reached(t))
                    return false;
        return true;
    }
    /** The stove standing on this tile, if it has a free hot-drink slot (the gear being moved doesn't count). */
    stoveWithRoom(x, y, moving, layout) {
        const uid = this.tile(x, y)?.equip;
        const stove = layout.find((p) => p.uid === uid);
        const eq = stove && EQUIPMENT.find((e) => e.id === stove.type);
        if (!stove || !eq?.hotSlots)
            return undefined;
        const used = layout.filter((p) => p.on === stove.uid && p.uid !== moving).length;
        return used < eq.hotSlots ? stove : undefined;
    }
    tableAt(x, y) {
        const f = this.furniture.find((ff) => ff.kind === "table" && ff.tiles.some((t) => t.x === x && t.y === y));
        if (!f)
            return undefined;
        return this.tables.find((t) => t.key === `${f.tiles[0].x},${f.tiles[0].y}`);
    }
    tile(x, y) {
        return this.tiles[y]?.[x];
    }
    buildFurniture() {
        const seen = new Set();
        for (const row of this.tiles) {
            for (const t of row) {
                if (t.ch === "E")
                    this.frontDoor = { x: t.x, y: t.y };
                const kind = t.def.interact;
                if (!kind || seen.has(`${t.x},${t.y}`))
                    continue;
                // Flood-fill identical neighbouring letters into one piece of furniture.
                const group = [];
                const stack = [{ x: t.x, y: t.y }];
                while (stack.length) {
                    const p = stack.pop();
                    const key = `${p.x},${p.y}`;
                    if (seen.has(key))
                        continue;
                    const pt = this.tile(p.x, p.y);
                    if (!pt || pt.ch !== t.ch)
                        continue;
                    seen.add(key);
                    group.push(p);
                    stack.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
                }
                const cx = group.reduce((a, p) => a + p.x, 0) / group.length + 0.5;
                const cy = group.reduce((a, p) => a + p.y, 0) / group.length + 0.5;
                this.furniture.push({
                    id: `${t.ch}@${t.x},${t.y}`,
                    kind,
                    name: t.def.name ?? kind,
                    tiles: group,
                    center: { x: cx, y: cy },
                    tap: TAP_OF_TILE[t.ch],
                });
                if (t.ch === "B")
                    this.bedSide = { x: t.x + 1, y: t.y };
            }
        }
    }
    buildSeats() {
        let id = 1;
        for (const row of this.tiles) {
            for (const t of row) {
                if (t.def.kind === "bench")
                    this.seats.push({ id: id++, tile: { x: t.x, y: t.y }, kind: "bench", occupant: null });
                if (t.def.kind === "stool")
                    this.seats.push({ id: id++, tile: { x: t.x, y: t.y }, kind: "stool", occupant: null });
                if (t.def.kind === "chair") {
                    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]
                        .map(([dx, dy]) => this.tile(t.x + dx, t.y + dy))
                        .find((n) => n?.def.kind === "table");
                    this.seats.push({ id: id++, tile: { x: t.x, y: t.y }, kind: "chair", table: nb ? { x: nb.x, y: nb.y } : undefined, occupant: null });
                }
            }
        }
    }
    walkFn(who, tx, ty) {
        return (x, y) => {
            const t = this.tile(x, y);
            if (!t)
                return false;
            if (x === tx && y === ty)
                return who === "keeper" ? t.keeperWalk : t.patronWalk;
            if (who === "keeper")
                return t.keeperWalk;
            // Patrons walk around seats other than their own target.
            return t.patronWalk && t.def.kind !== "stool" && t.def.kind !== "chair" && t.def.kind !== "bench";
        };
    }
    /**
     * Path between two points. Searches the tile grid in 8 directions, then pulls the
     * string tight so people walk in straight, natural lines rather than along the grid.
     */
    /** `avoid`: tiles to route around if there's another way (where people are standing or sitting). */
    path(from, to, who, avoid) {
        const sx = Math.floor(from.x), sy = Math.floor(from.y);
        const tx = Math.floor(to.x), ty = Math.floor(to.y);
        const base = this.walkFn(who, tx, ty);
        const ok = avoid?.size
            ? (x, y) => base(x, y) && ((x === tx && y === ty) || (x === sx && y === sy) || !avoid.has(`${x},${y}`))
            : base;
        const key = (x, y) => y * this.w + x;
        const startK = key(sx, sy), goalK = key(tx, ty);
        const g = new Map([[startK, 0]]);
        const prev = new Map([[startK, -1]]);
        const open = [{ k: startK, f: 0 }];
        const h = (x, y) => Math.hypot(x - tx, y - ty);
        let found = false;
        while (open.length) {
            let bi = 0;
            for (let i = 1; i < open.length; i++)
                if (open[i].f < open[bi].f)
                    bi = i;
            const { k } = open.splice(bi, 1)[0];
            if (k === goalK) {
                found = true;
                break;
            }
            const x = k % this.w, y = Math.floor(k / this.w);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (!ok(nx, ny))
                    continue;
                if (dx && dy && (!ok(x + dx, y) || !ok(x, y + dy)))
                    continue; // no cutting corners
                const nk = key(nx, ny);
                const cost = (g.get(k) ?? 0) + (dx && dy ? Math.SQRT2 : 1);
                if (cost < (g.get(nk) ?? Infinity)) {
                    g.set(nk, cost);
                    prev.set(nk, k);
                    open.push({ k: nk, f: cost + h(nx, ny) });
                }
            }
        }
        if (!found)
            return sx === tx && sy === ty ? [] : null;
        const cells = [];
        let c = goalK;
        while (c !== startK) {
            cells.push({ x: (c % this.w) + 0.5, y: Math.floor(c / this.w) + 0.5 });
            c = prev.get(c);
        }
        cells.reverse();
        // String-pulling: from each point, jump to the furthest point in clear sight.
        const out = [];
        let cur = { x: from.x, y: from.y };
        let i = 0;
        while (i < cells.length) {
            let j = cells.length - 1;
            while (j > i && !this.clear(cur, cells[j], ok))
                j--;
            out.push(cells[j]);
            cur = cells[j];
            i = j + 1;
        }
        return out;
    }
    /** Is the straight line between a and b walkable, with a little clearance? */
    clear(a, b, ok) {
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.ceil(d / 0.1);
        const r = 0.28;
        for (let s = 0; s <= steps; s++) {
            const x = a.x + ((b.x - a.x) * s) / steps, y = a.y + ((b.y - a.y) * s) / steps;
            for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
                if (!ok(Math.floor(x + ox), Math.floor(y + oy)))
                    return false;
            }
        }
        return true;
    }
    /** Walkable tiles next to a piece of furniture, for walking up to it. */
    approachTiles(f) {
        const out = [];
        for (const p of f.tiles) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const t = this.tile(p.x + dx, p.y + dy);
                if (t?.keeperWalk)
                    out.push({ x: t.x, y: t.y });
            }
        }
        return out;
    }
}
/** The map with the equipment lifted off it: equipment is placed separately (see Game.layout). */
const baseMap = (map) => map.map((row) => [...row].map((ch) => UNDER_EQUIPMENT[ch] ?? ch).join(""));
/** Where the equipment stands on a new game: wherever the inn's map puts it. */
export function defaultLayout(inn = "medium") {
    const out = [];
    const gear = [];
    const seen = new Set();
    innOf(inn).map.forEach((row, y) => [...row].forEach((ch, x) => {
        const type = EQUIPMENT_OF_TILE[ch];
        if (!type || seen.has(`${x},${y}`))
            return;
        const eq = EQUIPMENT.find((e) => e.id === type);
        if (eq.gear) {
            gear.push({ uid: `eq-${ch}${x},${y}`, type, x, y });
            return;
        }
        for (let dy = 0; dy < eq.h; dy++)
            for (let dx = 0; dx < eq.w; dx++)
                seen.add(`${x + dx},${y + dy}`);
        out.push({ uid: `eq-${ch}${x},${y}`, type, x, y });
    }));
    for (const q of gear)
        setOnStove(q, out);
    return out;
}
export function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
/** Set a kettle or coffee pot on the first stove with a free hot-drink slot. False if there's none. */
export function setOnStove(q, layout) {
    for (const p of layout) {
        const eq = EQUIPMENT.find((e) => e.id === p.type);
        if (!eq?.hotSlots || layout.filter((x) => x.on === p.uid).length >= eq.hotSlots)
            continue;
        q.on = p.uid;
        q.x = p.x;
        q.y = p.y;
        if (!layout.includes(q))
            layout.push(q);
        return true;
    }
    return false;
}
