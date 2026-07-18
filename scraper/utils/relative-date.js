// Parse Google Maps' relative review dates ("2 months ago", "il y a 3 mois",
// "a week ago", "un an") into an approximate age in MONTHS. Coarse by design —
// used only to count how many recent reviews are visible, as a conservative
// floor on recent activity.

function monthsAgo(str) {
  if (!str) return 99;
  const s = str.toLowerCase();
  const num = s.match(/(\d+)/);
  const n = num ? parseInt(num[1], 10) : 1; // "a week"/"un mois" → 1

  // Anything under a month → treat as 0 (very recent)
  if (/hour|minute|second|day|week|today|yesterday|heure|minute|seconde|jour|semaine|aujourd|hier/.test(s)) {
    return 0;
  }
  if (/month|mois/.test(s)) return n;
  if (/year|an\b|ans|année/.test(s)) return n * 12;
  return 99;
}

// Count reviews within `withinMonths` from an array of relative-date strings.
function countRecent(dates, withinMonths = 3) {
  if (!Array.isArray(dates)) return 0;
  return dates.filter((d) => monthsAgo(d) <= withinMonths).length;
}

module.exports = { monthsAgo, countRecent };
