// The physical inn: tiles, furniture, seats, and pathfinding.
import { MAP, TILE_LEGEND, STATION_OF_TILE, TAP_OF_TILE } from "./data.js";
export class World {
    w;
    h;
    tiles;
    furniture = [];
    seats = [];
    tables = [];
    frontDoor = { x: 0, y: 0 };
    bedSide = { x: 2, y: 2 };
    constructor() {
        this.h = MAP.length;
        this.w = MAP[0].length;
        this.tiles = MAP.map((row, y) => [...row].map((ch, x) => {
            const def = TILE_LEGEND[ch] ?? TILE_LEGEND["."];
            const k = def.kind;
            const keeperWalk = ["floor", "staff", "door", "front", "stool", "chair", "bench"].includes(k);
            const patronWalk = ["floor", "front", "stool", "chair", "bench"].includes(k);
            return { x, y, ch, def, keeperWalk, patronWalk };
        }));
        this.buildFurniture();
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
                    station: STATION_OF_TILE[t.ch],
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
    path(from, to, who) {
        const sx = Math.floor(from.x), sy = Math.floor(from.y);
        const tx = Math.floor(to.x), ty = Math.floor(to.y);
        const ok = this.walkFn(who, tx, ty);
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
export function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
