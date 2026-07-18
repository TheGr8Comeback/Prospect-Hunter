function computeScore(lead) {
  let website = 0;
  if (lead.https) website += 5;
  if (lead.mobile_friendly) website += 8;
  if (lead.copyright_year && lead.copyright_year >= 2022) website += 5;
  if (lead.meta_desc_present) website += 4;
  if (lead.favicon_present) website += 3;

  let socials = 0;
  for (const key of ["facebook", "instagram", "linkedin", "twitter", "tiktok", "youtube"]) {
    if (lead[key]) socials += 4;
  }
  socials = Math.min(socials, 25);

  let reputation = 0;
  if (lead.rating) reputation += (lead.rating / 5) * 15;
  if (lead.reviews_count) reputation += Math.min(lead.reviews_count / 20, 1) * 10;

  let contact = 0;
  if (lead.email && lead.email_status !== "invalid") contact += 10;
  if (lead.phone) contact += 10;
  if (lead.address) contact += 5;

  const total = Math.round(website + socials + reputation + contact);
  const detail = {
    website: Math.round(website),
    socials: Math.round(socials),
    reputation: Math.round(reputation),
    contact: Math.round(contact),
  };

  return { score: total, score_detail: detail };
}

module.exports = { computeScore };
