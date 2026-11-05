export function chipSettingsMarkup(prefix) {
  return `<div class="chip-settings shared-create">
    <label>How are you settling?<select id="${prefix}Mode"><option value="cash">Cash results (+ / − SGD)</option><option value="poker">Poker — chips & buy-ins</option><option value="mahjong">Mahjong — equal starting chips</option></select></label>
    <div id="${prefix}ChipSettings" class="chip-config" hidden>
      <label>Chips per starting stack / buy-in<input id="${prefix}Stack" type="number" min="1" max="1000000" step="1" inputmode="numeric" value="300" disabled></label>
      <label>Buy-in per stack (SGD)<input id="${prefix}Price" type="number" min="0.01" step="0.01" inputmode="decimal" value="20" disabled></label>
      <p class="shared-disclosure">Poker: every extra buy-in adds the same chips at the same price. Include the first buy-in in each person’s count. Mahjong: one equal starting stack each. Enter final chips, including 0 if someone busts. All chips must tally. Fractional cents are allocated at settlement so SGD totals exactly $0.</p>
    </div>
  </div>`;
}
