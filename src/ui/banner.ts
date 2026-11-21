// A banner: a card under the status card with a kicker, a line or two and, for objectives, a reward.
// The objective card (quest.ts) is one; the warning card (warnings.ts) is another, in red.

import { moneyHtml } from "../money.js";

export interface BannerSpec { kicker: string; text: string; reward?: number }

export const bannerHtml = (b: BannerSpec): string =>
  `<div class="b-kicker">${b.kicker}</div><div class="b-text">${b.text}</div>${b.reward ? `<div class="b-reward">+${moneyHtml(b.reward)}</div>` : ""}`;

/** Fill the card and slide it in. */
export function showBanner(el: HTMLElement, b: BannerSpec): void {
  el.innerHTML = bannerHtml(b);
  el.classList.remove("hidden", "enter");
  void el.offsetWidth;
  el.classList.add("enter");
}

export const hideBanner = (el: HTMLElement): void => el.classList.add("hidden");
