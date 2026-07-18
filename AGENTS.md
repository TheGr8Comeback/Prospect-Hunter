# Prospect OS — Intelligence de prospection commerciale

## Vision

Outil de prospection commerciale personnel, conçu SaaS-ready dès le départ.
Construit pour Rayan, itéré jusqu'à devenir potentiellement un business.

> "Prospects Hunter te donne une liste de businesses.
>  Prospect OS te dit lesquels contacter, pourquoi, avec quoi, et quand."

---

## Périmètre — projet 100% standalone

Prospect OS est un projet greenfield, sans dépendance sur aucun outil existant.
Il remplace et dépasse tout ce qui existait avant :
- ❌ `outreach-admin` → abandonné, toutes ses features sont absorbées ici
- ❌ Prospects Hunter (collègue) → remplacé, on fait mieux en solo
- ✅ Sites Netlify (`HVAC-master-template-V2`, futur template dental) → restent
  séparés. Prospect OS écrit dans Supabase, les sites Netlify lisent depuis Supabase.

---

## Décisions techniques finales

### Stack
- **Next.js 15** App Router, TypeScript, Tailwind — interface admin
- **Node.js standalone** — worker scraping + enrichissement
- **Supabase** — db + storage + realtime (free tier suffisant)
- **Playwright** + `playwright-extra` + `puppeteer-extra-plugin-stealth`
- **Cheerio** — parsing HTML (fetch-based, pas de browser)

### Pas d'IA, pas d'envoi d'email dans l'app — 100% gratuit
- Les pitchs sont générés par rotation de templates ("angles"), pas par un LLM
  (`app/api/pitch/generate`) — instantané, sans coût ; la rotation sert de
  split A/B entre angles.
- L'envoi se fait hors app : export CSV (`app/api/leads/export`) → Instantly
  ou un autre outil externe. `lib/mailer.ts` et les types `EmailAccount` /
  `Campaign` existent encore dans le code mais sont dormants (aucune route
  active ne les appelle).

---

## Architecture — deux programmes, un seul dossier

```
prospect-os/
├── app/        → Next.js  (interface, CRUD, pitch)    → npm run dev
└── scraper/    → Node.js  (Playwright, enrichissement) → node scraper/worker.js
```

**Règle absolue :** le scraper n'est JAMAIS appelé depuis une API route Next.js.
Les deux programmes communiquent uniquement via Supabase.

```
UI          → crée un job dans Supabase
Worker      → surveille Supabase → exécute → écrit les résultats
UI          → voit les résultats via Supabase Realtime
```

### Au quotidien
```
Terminal 1 → npm run dev              (dashboard, port 3000)
Terminal 2 → node scraper/worker.js   (surveille Supabase)
```

---

## Structure détaillée

```
prospect-os/
├── app/                          ← Next.js (port 3000)
│   ├── (dashboard)/
│   │   ├── page.tsx              ← stats pipeline
│   │   ├── leads/                ← liste + filtres
│   │   ├── leads/[slug]/         ← fiche complète
│   │   ├── map/                  ← Mapbox GL
│   │   └── templates/            ← templates de pitch (angles)
│   └── api/
│       ├── leads/                ← CRUD + export CSV (→ Instantly)
│       ├── jobs/                 ← créer un job de scraping
│       └── pitch/generate/       ← remplit subject/pitch_generated par rotation d'angles
│
├── scraper/                      ← Node.js worker
│   ├── worker.js                 ← surveille table jobs, dispatche
│   ├── sources/
│   │   ├── osm.js                ← Overpass API (HTTP pur)
│   │   ├── gmaps.js              ← Playwright stealth
│   │   └── pagesjaunes.js        ← Playwright stealth
│   ├── enrichment/
│   │   ├── website.js            ← fetch + cheerio (signals)
│   │   ├── screenshot.js         ← Playwright → Supabase Storage
│   │   ├── socials.js            ← détection réseaux
│   │   └── emails.js             ← extraction + filtrage strict
│   └── scoring/
│       └── score.js              ← score composite 0-100 (maths pures)
│
└── lib/                          ← partagé
    ├── supabase.ts
    ├── types.ts
    └── slugify.ts
```

---

## Pipeline de traitement

```
SCRAPING
  → données brutes reçues
  → filtrage emails (local ≥ 4 chars, sld ≥ 3 chars, tld ≤ 6 chars)
  → slugify(name)
  → normalisation phone
  → écriture Supabase (lead visible immédiatement dans l'UI)

ENRICHISSEMENT AUTO (fetch, rapide, gratuit)
  → website signals (https, mobile, copyright, meta, favicon, speed)
  → détection socials depuis le HTML
  → score composite 0-100 calculé
  → mise à jour Supabase → UI se rafraîchit

ENRICHISSEMENT MANUEL (à la demande, bouton dans l'UI)
  → screenshot Playwright → Supabase Storage

GÉNÉRATION DE PITCH (par lot, depuis l'UI)
  → rotation de templates ("angles") → subject + pitch_generated + pitch_angle
  → export CSV → envoi externe (Instantly)
```

---

## Score composite 0-100

```js
// Website (25pts)
https            → 5pts
mobile_friendly  → 8pts
copyright ≥ 2022 → 5pts
meta_description → 4pts
favicon          → 3pts

// Socials (25pts)
4pts par réseau présent (facebook, instagram, linkedin, twitter, tiktok, youtube)

// Réputation (25pts)
rating           → (rating / 5) * 15
review_count     → Math.min(count / 20, 1) * 10

// Contact (25pts)
email            → 10pts
phone            → 10pts
address          → 5pts
```

---

## Schéma Supabase

### Table `workspaces`
```sql
CREATE TABLE workspaces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### Table `leads`
```sql
CREATE TABLE leads (
  -- Identité
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  slug          text NOT NULL,
  UNIQUE(workspace_id, slug),

  -- Données scraping (issues du NDJSON Prospects Hunter)
  name          text NOT NULL,
  category      text,           -- clé anglaise : dentist, hvac...
  category_raw  text,
  country       text,
  city          text,
  region        text,
  address       text,
  postal_code   text,
  lat           numeric(9,6),
  lng           numeric(9,6),
  phone         text,
  phone_raw     text,
  website       text,
  has_website   boolean DEFAULT false,
  sources       text[],         -- ['osm', 'gmaps', ...]
  opening_hours text,
  rating        numeric(2,1),
  reviews_count integer,

  -- Enrichissement website (fetch + cheerio)
  https               boolean,
  mobile_friendly     boolean,
  copyright_year      smallint,
  tech_stack          text[],
  html_size_kb        numeric(8,1),
  title_present       boolean,
  meta_desc_present   boolean,
  favicon_present     boolean,
  response_time_ms    integer,
  status_code         smallint,
  website_score       smallint,

  -- Enrichissement socials
  facebook    text,
  instagram   text,
  linkedin    text,
  twitter     text,
  tiktok      text,
  youtube     text,

  -- Enrichissement contact
  email       text,             -- meilleur email filtré

  -- Enrichissement manuel (à la demande)
  screenshot_url  text,         -- Supabase Storage

  -- Intelligence
  score           smallint,     -- 0-100 composite
  score_detail    jsonb,        -- détail par dimension

  -- Outreach (géré dans l'UI)
  subject         text,
  pitch           text,         -- rédigé manuellement
  pitch_generated text,         -- généré par rotation de templates (angles)
  status          text NOT NULL DEFAULT 'draft',
  sent_at         timestamptz,
  notes           text,

  -- Tracking (mis à jour par les sites Netlify)
  visit_count         integer NOT NULL DEFAULT 0,
  first_visited_at    timestamptz,
  last_visited_at     timestamptz,

  -- Meta
  enrichment_status text DEFAULT 'pending',
  enriched_at       timestamptz,
  scraped_at        timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
```

### Table `jobs`
```sql
CREATE TABLE jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  type          text NOT NULL,    -- 'scrape', 'enrich', 'screenshot', 'pitch'
  status        text DEFAULT 'pending', -- pending → running → done / failed
  params        jsonb NOT NULL,   -- { category, city, country, sources[] }
  progress      jsonb,            -- { found: 12, enriched: 8 }
  error         text,
  created_at    timestamptz DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);
```

### Table `templates`
```sql
CREATE TABLE templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name          text NOT NULL,
  subject       text NOT NULL,
  body          text NOT NULL,
  language      text DEFAULT 'en',
  created_at    timestamptz DEFAULT now()
);
```

### Table `email_messages` (existe en base, non utilisée — l'envoi se fait hors app)
```sql
CREATE TABLE email_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id       uuid REFERENCES leads(id) ON DELETE CASCADE,
  subject       text NOT NULL,
  body          text NOT NULL,
  to_email      text NOT NULL,
  from_email    text NOT NULL,
  status        text DEFAULT 'sent',
  sent_at       timestamptz DEFAULT now()
);
```

---

## Format NDJSON réel (Prospects Hunter export)

```json
{
  "id": "158babc9ebfc0406",
  "name": "ClassicABC Heating & Air",
  "category": "hvac",
  "category_raw": "craft=hvac",
  "country": "US",
  "city": "Plano",
  "region": null,
  "address": "1209 N Avenue, 75074, Plano",
  "postal_code": "75074",
  "lat": 33.0160249,
  "lng": -96.6946628,
  "phone": "+19724232121",
  "phone_raw": "+1-972-423-2121",
  "website": "https://www.classicheatandair.com/",
  "has_website": true,
  "website_score": 100,
  "website_signals": {
    "https": true,
    "mobile_friendly": true,
    "copyright_year": 2026,
    "tech_stack": ["wordpress"],
    "html_size_kb": 335.8,
    "title_present": true,
    "meta_description_present": true,
    "favicon_present": true,
    "response_time_ms": 1346,
    "status_code": 200
  },
  "emails": ["service@classicheatandair.com"],
  "socials": {
    "facebook": "https://www.facebook.com/ClassicABC",
    "instagram": "https://www.instagram.com/classicheatingandair",
    "linkedin": "https://www.linkedin.com/company/classic-heating-air",
    "twitter": "https://x.com/ClassicABC",
    "tiktok": null,
    "youtube": null
  },
  "opening_hours": "Mo-Fr 00:00-24:00",
  "rating": null,
  "reviews_count": null,
  "sources": ["osm"],
  "scraped_at": "2026-05-07T22:43:21.139952Z",
  "enriched_at": "2026-05-07T22:43:59.856196Z",
  "enrichment_status": "ok",
  "lead_priority": "cold"
}
```

---

## Envoi — hors app

Pas d'envoi d'email intégré. Le pipeline s'arrête à l'export CSV
(`app/api/leads/export`) : email, subject, pitch_generated, pitch_angle +
colonnes de contexte — prêt à être importé dans Instantly (ou équivalent).

---

## Sites Netlify existants

```env
BASE_URL_HVAC=https://...netlify.app
BASE_URL_DENTAL=https://...netlify.app
```

Les sites lisent Supabase via le slug. Prospect OS écrit dans Supabase.
Le champ `visit_count` est mis à jour par les sites quand un prospect visite son URL.

---

## Règles de développement

- Ne jamais appeler Supabase directement depuis un composant client
- Toujours passer par les API routes Next.js
- `workspace_id` obligatoire sur chaque INSERT
- Le worker ne touche JAMAIS : `pitch`, `subject`, `status`, `sent_at`, `notes`
- Email filtering : local ≥ 4 chars ET sld ≥ 3 chars ET tld ≤ 6 chars
- Slugify : lowercase + NFD normalize + strip accents + spaces→hyphens
- Le score est calculé côté worker, jamais côté client

---

## Ordre de construction — MVP d'abord

```
Étape 1  → Init projet + schéma Supabase + types TypeScript
Étape 2  → Worker : lire table jobs + scraper OSM (Overpass API)
Étape 3  → UI : lancer un job depuis l'interface + voir résultats Realtime
Étape 4  → Enrichissement auto (fetch + cheerio)
Étape 5  → Score composite
Étape 6  → Interface leads : liste, filtres, fiche
Étape 7  → Export CSV pour envoi externe (Instantly)
Étape 8  → Scraping GMaps + Pages Jaunes (Playwright)
Étape 9  → Screenshot (à la demande) + génération de pitch par templates
Étape 10 → Map Mapbox GL
Étape 11 → Templates (angles) + rotation A/B
```
