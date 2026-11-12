// Core helpers shared by every system: organic randomness and the event bus.
export function organic([centre, spread]) {
    // Triangular-ish distribution: average of two uniforms, centred on `centre`.
    const r = (Math.random() + Math.random()) / 2; // 0..1, peaks at 0.5
    return Math.max(0, centre + (r - 0.5) * 2 * spread);
}
export function chance(p) {
    return Math.random() < p;
}
export function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}
export function weightedPick(items, weight) {
    const ws = items.map((i) => Math.max(0, weight(i)));
    const total = ws.reduce((a, b) => a + b, 0);
    if (total <= 0)
        return undefined;
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= ws[i];
        if (r <= 0)
            return items[i];
    }
    return items[items.length - 1];
}
let nextId = 1;
export function uid() {
    return nextId++;
}
export class EventBus {
    handlers = [];
    on(h) {
        this.handlers.push(h);
    }
    emit(e) {
        for (const h of this.handlers)
            h(e);
    }
}
