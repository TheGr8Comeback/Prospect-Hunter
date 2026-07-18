/**
 * normalizePhone — garde le format international si possible
 * Élimine les espaces, tirets, points superflus
 */
function normalizePhone(raw) {
  if (!raw || typeof raw !== "string") return null;
  // Supprimer tout sauf chiffres, +, espace
  const cleaned = raw.replace(/[^\d+\s()-]/g, "").trim();
  // Vérification minimale : au moins 7 chiffres
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return cleaned;
}

module.exports = { normalizePhone };
