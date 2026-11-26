// The calendar: which date a day of play falls on, and how dates are written.
//
// `g.day` stays a plain count of days played (1, 2, 3…): freshness, unlocks and history use it.
// The date is worked out from it, the calendar season the save started in, and how long each
// calendar season runs where the inn stands (the starting location reshapes the year).

import { CALENDAR, type CalendarSeasonId } from "./data.js";

export interface GameDate {
  year: number; // from 1
  season: CalendarSeasonId;
  seasonName: string; // "Spring"
  dayOfSeason: number; // from 1
  weekday: string; // "Monday"
  /** Days since Spring 1 of year 1. Handy for weekly rhythms (offset % 7) and comparing dates. */
  offset: number;
}

/** Days in each calendar season, in order: the location's if it has its own, else the calendar's. */
function lengthsOf(lengths?: number[]): number[] {
  return CALENDAR.seasons.map((s, i) => lengths?.[i] ?? s.days);
}

/** The date of a day of play. `startSeason` is the index of the calendar season the save began in. */
export function dateOf(day: number, startSeason: number, lengths?: number[]): GameDate {
  const len = lengthsOf(lengths);
  const year = len.reduce((a, n) => a + n, 0);
  const offset = len.slice(0, startSeason).reduce((a, n) => a + n, 0) + Math.max(0, day - 1);
  let inYear = offset % year;
  let i = 0;
  while (inYear >= len[i]) { inYear -= len[i]; i++; }
  const s = CALENDAR.seasons[i];
  return {
    year: Math.floor(offset / year) + 1, season: s.id, seasonName: s.name, dayOfSeason: inYear + 1,
    weekday: CALENDAR.weekdays[offset % CALENDAR.weekdays.length], offset,
  };
}

/**
 * How far through the year a date is, 0..1, by calendar season: each season is a quarter of the year however
 * many days it runs, so 0.875 is always midwinter.
 */
export function yearFraction(date: GameDate, lengths?: number[]): number {
  const len = lengthsOf(lengths);
  const i = CALENDAR.seasons.findIndex((s) => s.id === date.season);
  return (i + (date.dayOfSeason - 0.5) / len[i]) / CALENDAR.seasons.length;
}

/** A random calendar season to start a new save in (until the starting location decides). */
export function randomStartSeason(): number {
  return Math.floor(Math.random() * CALENDAR.seasons.length);
}

/** Is this day the first of a new calendar season? (Not on the very first day of a save.) */
export function seasonTurned(day: number, startSeason: number, lengths?: number[]): boolean {
  return day > 1 && dateOf(day, startSeason, lengths).season !== dateOf(day - 1, startSeason, lengths).season;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** "Spring 27 · Year 2". */
export function shortDate(d: GameDate): string {
  return `${d.seasonName} ${d.dayOfSeason} · Year ${d.year}`;
}

/** "Spring 27", with the year only when it isn't `currentYear` (for the journal and past days). */
export function compactDate(d: GameDate, currentYear: number): string {
  return `${d.seasonName} ${d.dayOfSeason}${d.year !== currentYear ? `, year ${d.year}` : ""}`;
}

/** "Tuesday, the 27th of spring, year 2". */
export function longDate(d: GameDate): string {
  return `${d.weekday}, the ${ordinal(d.dayOfSeason)} of ${d.seasonName.toLowerCase()}, year ${d.year}`;
}
