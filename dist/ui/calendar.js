// The calendar: this calendar season at a glance. Today, the days gone by with the weather they had,
// market days, and when the next calendar season begins. Regulars' habits join it once schedules exist.
import { CALENDAR, WEATHER } from "../data.js";
import { compactDate } from "../calendar.js";
import { SUPPLIERS_DATA } from "../gamedata.gen.js";
import { back, openMenu, replaceMenu } from "./menu.js";
/** What the weather was on a day gone by, as one icon. */
function dayWeather(s) {
    const w = s?.weather;
    if (!w)
        return "";
    if (w.storm)
        return WEATHER.bands[2].icon;
    if (w.rainMinutes > 120)
        return WEATHER.bands[1].icon;
    if (w.rainMinutes > 0)
        return WEATHER.bands[0].icon;
    const sky = Object.entries(w.sky).sort((a, b) => b[1] - a[1])[0]?.[0];
    return sky ? WEATHER.skies[sky].icon : "";
}
export function openCalendar(g) {
    g.bus.emit({ type: "MenuSound", sound: "calendar" });
    const today = g.date;
    const seasonIndex = CALENDAR.seasons.findIndex((s) => s.id === today.season);
    const length = g.loc.days[seasonIndex];
    const first = g.day - (today.dayOfSeason - 1); // day of play on the season's first day (may be before the save began)
    const pad = (today.offset - (today.dayOfSeason - 1)) % 7; // the season's first weekday (offset 0 is a Monday)
    const byDay = new Map(g.history.map((s) => [s.day, s]));
    const next = CALENDAR.seasons[(seasonIndex + 1) % CALENDAR.seasons.length];
    const left = length - today.dayOfSeason + 1;
    const head = CALENDAR.weekdays.map((w) => `<div class="cw">${w.slice(0, 3)}</div>`).join("");
    /** What's on day n of the season: its weekday, the weather it had, market day, deliveries. */
    const about = (n) => {
        const day = first + n - 1;
        const weekday = CALENDAR.weekdays[(pad + n - 1) % 7];
        const market = g.loc.marketDay === weekday;
        const due = g.deliveries.filter((d) => d.day === day).map((d) => `${SUPPLIERS_DATA.suppliers.find((s) => s.id === d.supplierId)?.name ?? d.supplierId}${d.standing ? " (📌 standing)" : ""}`);
        const crates = day === g.day && g.crates.length > 0;
        const weather = day < g.day && day >= 1 ? weatherName(byDay.get(day)) : "";
        return { day, weekday, market, due, crates, weather };
    };
    const st = { focus: today.dayOfSeason };
    const build = () => {
        const cells = [];
        for (let i = 0; i < pad; i++)
            cells.push(`<div class="cd blank"></div>`);
        for (let n = 1; n <= length; n++) {
            const d = about(n);
            const cls = [d.day === g.day ? "today" : d.day < g.day ? "past" : "", n === st.focus ? "focus" : ""].filter(Boolean).join(" ");
            const icon = d.day < g.day && d.day >= 1 ? dayWeather(byDay.get(d.day)) : d.day === g.day ? "★" : "";
            cells.push(`<div class="cd ${cls}" data-pick="${n}"><b>${n}</b><span class="ci">${icon}${d.market ? "🧺" : ""}${d.due.length || d.crates ? "📦" : ""}</span></div>`);
        }
        const f = about(st.focus);
        const when = f.day === g.day ? "Today" : f.day === g.day + 1 ? "Tomorrow" : f.day === g.day - 1 ? "Yesterday" : "";
        const lines = [
            f.weather ? `${f.weather}.` : f.day < 1 ? "Before you came." : "",
            f.market ? "🧺 Market day." : "",
            f.due.length ? `📦 Your order from ${f.due.join(" and ")} comes.` : "",
            f.crates ? "📦 A delivery is waiting at the kitchen door." : "",
        ].filter(Boolean).join(" ");
        return {
            title: `📅 ${today.seasonName}, year ${today.year}`,
            holdsClock: true,
            subtitle: `Today is ${today.weekday}, ${compactDate(today, today.year)} of ${length}`,
            view: {
                html: `<div class="cal">${head}${cells.join("")}</div>
          <div class="cal-day"><b>${when ? `${when}, ` : ""}${f.weekday} ${st.focus}</b> ${lines || "Nothing on."}</div>
          <p class="muted">${next.name} begins in ${left} day${left === 1 ? "" : "s"}.${g.loc.marketDay ? ` 🧺 Market day: ${g.loc.marketDay}s.` : ""} Past days show the weather they had.</p>`,
                onPick: (v) => { st.focus = Number(v); replaceMenu(build()); },
                onKey: (e) => {
                    const by = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1, ArrowUp: -7, w: -7, W: -7, ArrowDown: 7, s: 7, S: 7 }[e.key];
                    if (!by)
                        return false;
                    const to = st.focus + by;
                    if (to >= 1 && to <= length) {
                        st.focus = to;
                        g.bus.emit({ type: "MenuSound", sound: "tick" });
                        replaceMenu(build());
                        return true;
                    }
                    return by !== 7; // down past the last week: to the Close button
                },
            },
            items: [{ label: "Close", button: "secondary", cancel: true, action: () => back() }],
        };
    };
    openMenu(build());
}
/** What the weather was on a day gone by, in a word or two. */
function weatherName(s) {
    const w = s?.weather;
    if (!w)
        return "";
    if (w.storm)
        return WEATHER.bands[2].name;
    if (w.rainMinutes > 120)
        return WEATHER.bands[1].name;
    if (w.rainMinutes > 0)
        return WEATHER.bands[0].name;
    const sky = Object.entries(w.sky).sort((a, b) => b[1] - a[1])[0]?.[0];
    return sky ? WEATHER.skies[sky].name : "";
}
