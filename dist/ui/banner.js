// A banner: a card under the status card with a kicker, a line or two and, for objectives, a reward.
// The objective card (quest.ts) is one; the warning card (warnings.ts) is another, in red.
import { moneyHtml } from "../money.js";
export const bannerHtml = (b) => `<div class="b-kicker">${b.kicker}</div><div class="b-text">${b.text}</div>${b.reward ? `<div class="b-reward">+${moneyHtml(b.reward)}</div>` : ""}`;
/** Fill the card and slide it in. */
export function showBanner(el, b) {
    el.innerHTML = bannerHtml(b);
    el.classList.remove("hidden", "enter");
    void el.offsetWidth;
    el.classList.add("enter");
}
export const hideBanner = (el) => el.classList.add("hidden");
