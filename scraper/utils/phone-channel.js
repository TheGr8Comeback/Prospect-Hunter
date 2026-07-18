// Classify a phone number by which channel can actually reach it.
//
// Focus: the Philippines, where the campaign runs on WhatsApp.
//   • mobile   (09xx / +639xx)  → WhatsApp-reachable
//   • landline (area code 02/032/…) → NOT WhatsApp (needs a call or Messenger)
//
// For other countries we can't tell mobile from landline by prefix, so
// `whatsappable` stays false — the war-machine only claims WhatsApp when sure.
// (US leads are reached by email, not WhatsApp, so this is fine.)

function phoneChannel(raw) {
  const none = { kind: "none", isMobile: false, whatsappable: false };
  if (!raw) return none;

  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 7) return none;

  // Reduce to the national number (drop +63 country code or 0 trunk prefix).
  let national;
  if (digits.startsWith("63")) national = digits.slice(2);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;

  // PH mobile numbers are 10 digits starting with 9 (9XXXXXXXXX).
  if (/^9\d{9}$/.test(national)) {
    return { kind: "mobile", isMobile: true, whatsappable: true };
  }

  // Looks Philippine (had +63 or a leading 0) but isn't a mobile → landline.
  const looksPH = digits.startsWith("63") || String(raw).trim().startsWith("0") || String(raw).includes("+63");
  return { kind: looksPH ? "landline" : "unknown", isMobile: false, whatsappable: false };
}

// wa.me deep link for a WhatsApp-reachable number (else null).
function whatsappLink(raw) {
  const { whatsappable } = phoneChannel(raw);
  if (!whatsappable) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "63" + digits.slice(1); // 09xx → 639xx
  return `https://wa.me/${digits}`;
}

module.exports = { phoneChannel, whatsappLink };
