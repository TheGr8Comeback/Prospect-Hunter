// Detect an existing live-chat / chatbot widget in the page HTML (zero extra
// request). No widget + customer-service pain in the reviews = a chatbot
// opportunity — the exact angle a chatbot freelance pitches.

const CHAT_VENDORS = [
  ["intercom",  /widget\.intercom\.io|intercomcdn|intercomSettings/i],
  ["drift",     /js\.driftt\.com|drift\.com\/|window\.drift/i],
  ["tidio",     /code\.tidio\.co|tidiochat/i],
  ["crisp",     /client\.crisp\.chat|\$crisp/i],
  ["tawk",      /embed\.tawk\.to|Tawk_API/i],
  ["zendesk",   /static\.zdassets\.com|zopim|zEmbed/i],
  ["livechat",  /cdn\.livechatinc\.com|__lc\b/i],
  ["hubspot",   /js\.hs-scripts\.com|js\.usemessages\.com/i],
  ["freshchat", /wchat\.freshchat\.com|fcWidget/i],
  ["olark",     /static\.olark\.com/i],
  ["smartsupp", /smartsuppchat|smartsupp\.com/i],
  ["chatra",    /call\.chatra\.io|window\.ChatraID/i],
  ["messenger", /fb-customerchat|connect\.facebook\.net[^"']*customerchat/i],
  ["gorgias",   /config\.gorgias\.chat/i],
];

function detectChatbot(html) {
  for (const [vendor, re] of CHAT_VENDORS) {
    if (re.test(html)) return { has_chat: true, chat_vendor: vendor };
  }
  return { has_chat: false, chat_vendor: null };
}

// Opportunity = no chat widget AND the reviews show service pain.
function chatbotOpportunity(hasChat, reviewPain) {
  return !hasChat && (reviewPain || 0) >= 3;
}

module.exports = { detectChatbot, chatbotOpportunity };
