"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Option {
  value: string;
  label: string;
}

const CATEGORIES: Option[] = [
  { value: "accountant", label: "Accountant" },
  { value: "auto_repair", label: "Auto Repair" },
  { value: "bakery", label: "Bakery" },
  { value: "barber", label: "Barber" },
  { value: "beauty_salon", label: "Beauty Salon" },
  { value: "carpenter", label: "Carpenter" },
  { value: "car_wash", label: "Car Wash" },
  { value: "chiropractor", label: "Chiropractor" },
  { value: "cleaning_service", label: "Cleaning Service" },
  { value: "contractor", label: "Contractor" },
  { value: "daycare", label: "Daycare" },
  { value: "dentist", label: "Dentist" },
  { value: "electrician", label: "Electrician" },
  { value: "florist", label: "Florist" },
  { value: "garage_door", label: "Garage Door" },
  { value: "gym", label: "Gym" },
  { value: "handyman", label: "Handyman" },
  { value: "hvac", label: "HVAC" },
  { value: "insurance_agent", label: "Insurance Agent" },
  { value: "landscaper", label: "Landscaper" },
  { value: "laundry", label: "Laundry" },
  { value: "lawyer", label: "Lawyer" },
  { value: "locksmith", label: "Locksmith" },
  { value: "mechanic", label: "Mechanic" },
  { value: "moving_company", label: "Moving Company" },
  { value: "optician", label: "Optician" },
  { value: "painter", label: "Painter" },
  { value: "pest_control", label: "Pest Control" },
  { value: "pet_grooming", label: "Pet Grooming" },
  { value: "photographer", label: "Photographer" },
  { value: "physiotherapist", label: "Physiotherapist" },
  { value: "plumber", label: "Plumber" },
  { value: "pool_service", label: "Pool Service" },
  { value: "real_estate_agent", label: "Real Estate Agent" },
  { value: "restaurant", label: "Restaurant" },
  { value: "roofer", label: "Roofer" },
  { value: "spa", label: "Spa" },
  { value: "towing", label: "Towing" },
  { value: "tree_service", label: "Tree Service" },
  { value: "vet", label: "Veterinarian" },
  { value: "yoga_studio", label: "Yoga Studio" },
];

const COUNTRIES: Option[] = [
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "NZ", label: "New Zealand" },
  { value: "IE", label: "Ireland" },
  { value: "ZA", label: "South Africa" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "ES", label: "Spain" },
  { value: "IT", label: "Italy" },
  { value: "NL", label: "Netherlands" },
  { value: "BE", label: "Belgium" },
  { value: "CH", label: "Switzerland" },
  { value: "AT", label: "Austria" },
  { value: "PT", label: "Portugal" },
  { value: "SE", label: "Sweden" },
  { value: "NO", label: "Norway" },
  { value: "DK", label: "Denmark" },
  { value: "FI", label: "Finland" },
  { value: "PL", label: "Poland" },
  { value: "CZ", label: "Czech Republic" },
  { value: "RO", label: "Romania" },
  { value: "HU", label: "Hungary" },
  { value: "GR", label: "Greece" },
  { value: "BR", label: "Brazil" },
  { value: "MX", label: "Mexico" },
  { value: "AR", label: "Argentina" },
  { value: "CL", label: "Chile" },
  { value: "CO", label: "Colombia" },
  { value: "IN", label: "India" },
  { value: "JP", label: "Japan" },
  { value: "KR", label: "South Korea" },
  { value: "SG", label: "Singapore" },
  { value: "MY", label: "Malaysia" },
  { value: "TH", label: "Thailand" },
  { value: "PH", label: "Philippines" },
  { value: "AE", label: "UAE" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "IL", label: "Israel" },
  { value: "EG", label: "Egypt" },
  { value: "NG", label: "Nigeria" },
  { value: "KE", label: "Kenya" },
  { value: "MA", label: "Morocco" },
];

const SOURCES = [
  { value: "osm", label: "OpenStreetMap" },
  { value: "gmaps", label: "Google Maps" },
  { value: "yelp", label: "Yelp" },
  { value: "yellowpages", label: "Yellow Pages" },
  { value: "bbb", label: "BBB" },
];

function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  allowCustom = false,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  allowCustom?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()) ||
    o.value.toLowerCase().includes(query.toLowerCase())
  );

  // Show "add custom" option if query doesn't match any existing option
  const queryNorm = query.trim().toLowerCase().replace(/\s+/g, "_");
  const showCustom = allowCustom && query.trim().length >= 2 &&
    !options.some((o) => o.value === queryNorm || o.label.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div>
      <label className="text-[11px] font-mono text-white/40 uppercase tracking-wider block mb-2">
        {label}
      </label>
      <div className="relative" ref={ref}>
        <input
          type="text"
          value={open ? query : selected?.label ?? (allowCustom ? value : "")}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(""); }}
          placeholder={placeholder}
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20"
        />
        {open && (
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-[#1a1a1a] border border-white/[0.1] rounded-lg shadow-xl">
            {showCustom && (
              <button
                type="button"
                onClick={() => { onChange(queryNorm); setOpen(false); setQuery(""); }}
                className="w-full text-left px-4 py-2 text-sm text-emerald-400 hover:bg-white/[0.06] transition-colors border-b border-white/[0.06]"
              >
                + Add &quot;{query.trim()}&quot;
                <span className="text-[10px] font-mono text-white/20 ml-2">{queryNorm}</span>
              </button>
            )}
            {filtered.length === 0 && !showCustom ? (
              <div className="px-4 py-3 text-sm text-white/20">No results</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    o.value === value
                      ? "bg-white/[0.08] text-white"
                      : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {o.label}
                  {o.value !== o.label.toLowerCase().replace(/\s+/g, "_") && (
                    <span className="text-[10px] font-mono text-white/20 ml-2">{o.value}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface CityResult {
  display_name: string;
}

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    category: "hvac",
    city: "",
    country: "US",
    sources: ["osm"] as string[],
    maxResults: 50,
    concurrency: 5,
    noWebsiteOnly: false,
    requireEmail: false,
  });

  const [cityQuery, setCityQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (cityQuery.length < 2) { setCitySuggestions([]); return; }

    const timeout = setTimeout(async () => {
      try {
        const countryLabel = COUNTRIES.find((c) => c.value === form.country)?.label ?? "";
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityQuery + " " + countryLabel)}&format=json&limit=6&featuretype=city`,
          { headers: { "Accept-Language": "en" } }
        );
        const data: CityResult[] = await res.json();
        setCitySuggestions(data.map((d) => d.display_name));
        setCityOpen(true);
      } catch {
        setCitySuggestions([]);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [cityQuery, form.country]);

  function selectCity(display: string) {
    const name = display.split(",")[0].trim();
    setForm((f) => ({ ...f, city: name }));
    setCityQuery(name);
    setCityOpen(false);
  }

  function toggleSource(src: string) {
    setForm((f) => {
      const has = f.sources.includes(src);
      const next = has ? f.sources.filter((s) => s !== src) : [...f.sources, src];
      return { ...f, sources: next.length > 0 ? next : f.sources };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.city.trim()) { setError("City is required"); return; }
    setLoading(true);
    setError("");

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "scrape",
        params: {
          category: form.category,
          city: form.city,
          country: form.country,
          sources: form.sources,
          maxResults: form.maxResults,
          concurrency: form.concurrency,
          noWebsiteOnly: form.noWebsiteOnly,
          requireEmail: form.requireEmail,
        },
      }),
    });

    if (res.ok) {
      router.push("/jobs");
    } else {
      const { error: msg } = await res.json();
      setError(msg ?? "Unknown error");
      setLoading(false);
    }
  }

  return (
    <div className="p-10 max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">New scrape</h1>
        <p className="text-sm text-white/40 mt-1">
          Configure and launch a scraping job
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <SearchableSelect
          label="Category"
          options={CATEGORIES}
          value={form.category}
          onChange={(v) => setForm((f) => ({ ...f, category: v }))}
          placeholder="Search or add a category..."
          allowCustom
        />

        <SearchableSelect
          label="Country"
          options={COUNTRIES}
          value={form.country}
          onChange={(v) => setForm((f) => ({ ...f, country: v }))}
          placeholder="Search country..."
        />

        {/* City with Nominatim autocomplete */}
        <div>
          <label className="text-[11px] font-mono text-white/40 uppercase tracking-wider block mb-2">
            City
          </label>
          <div className="relative" ref={cityRef}>
            <input
              type="text"
              value={cityQuery || form.city}
              onChange={(e) => {
                setCityQuery(e.target.value);
                setForm((f) => ({ ...f, city: e.target.value }));
              }}
              onFocus={() => { if (citySuggestions.length > 0) setCityOpen(true); }}
              placeholder="e.g. Houston"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20"
            />
            {cityOpen && citySuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-[#1a1a1a] border border-white/[0.1] rounded-lg shadow-xl">
                {citySuggestions.map((s, i) => {
                  const cityName = s.split(",")[0].trim();
                  const rest = s.split(",").slice(1).join(",").trim();
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectCity(s)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-white/[0.06] transition-colors truncate"
                    >
                      <span className="text-white/80 font-medium">{cityName}</span>
                      {rest && <span className="text-white/25 text-xs"> · {rest}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-[10px] text-white/30 mt-1.5 leading-relaxed">
            Just type the city and hit Start — e.g. <span className="text-white/50 font-mono">Houston</span>. Suggestions are optional; only the city name is used (county/state are ignored).
          </p>
        </div>

        {/* Targeting filters */}
        <div>
          <label className="text-[11px] font-mono text-white/40 uppercase tracking-wider block mb-2">
            Targeting
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, noWebsiteOnly: !f.noWebsiteOnly }))}
              aria-pressed={form.noWebsiteOnly}
              className={`px-4 py-2 rounded-lg text-sm font-mono border transition-colors ${
                form.noWebsiteOnly
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-white/[0.08] bg-white/[0.03] text-white/30 hover:text-white/50"
              }`}
            >
              No website only
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, requireEmail: !f.requireEmail }))}
              aria-pressed={form.requireEmail}
              className={`px-4 py-2 rounded-lg text-sm font-mono border transition-colors ${
                form.requireEmail
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-white/[0.08] bg-white/[0.03] text-white/30 hover:text-white/50"
              }`}
            >
              Has email
            </button>
          </div>
          {(form.noWebsiteOnly || form.requireEmail) && (
            <p className="text-[10px] text-white/30 mt-1.5 leading-relaxed">
              {form.noWebsiteOnly && form.requireEmail
                ? "Businesses with no website AND an email. Best yield via OSM & Google Maps — other sources expose no email at scrape time."
                : form.noWebsiteOnly
                ? "Only businesses without a website (top instant-value prospects)."
                : "Only leads that already expose an email at scrape time (mainly OSM & Google Maps)."}
            </p>
          )}
        </div>

        {/* Max results */}
        <div>
          <label className="text-[11px] font-mono text-white/40 uppercase tracking-wider block mb-2">
            Max prospects
          </label>
          <div className="flex items-center gap-3">
            {[20, 50, 100, 200].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm((f) => ({ ...f, maxResults: n }))}
                className={`px-4 py-2 rounded-lg text-sm font-mono border transition-colors ${
                  form.maxResults === n
                    ? "border-white/20 bg-white/[0.08] text-white"
                    : "border-white/[0.08] bg-white/[0.03] text-white/30 hover:text-white/50"
                }`}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              min={5}
              max={500}
              value={form.maxResults}
              onChange={(e) => setForm((f) => ({ ...f, maxResults: Number(e.target.value) }))}
              className="w-20 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white text-center font-mono focus:outline-none focus:border-white/20"
            />
          </div>
        </div>

        {/* Concurrency */}
        <div>
          <label className="text-[11px] font-mono text-white/40 uppercase tracking-wider block mb-2">
            Concurrency
          </label>
          <div className="flex items-center gap-3">
            {[1, 3, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm((f) => ({ ...f, concurrency: n }))}
                className={`px-4 py-2 rounded-lg text-sm font-mono border transition-colors ${
                  form.concurrency === n
                    ? "border-white/20 bg-white/[0.08] text-white"
                    : "border-white/[0.08] bg-white/[0.03] text-white/30 hover:text-white/50"
                }`}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={20}
              value={form.concurrency}
              onChange={(e) => setForm((f) => ({ ...f, concurrency: Number(e.target.value) }))}
              className="w-20 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white text-center font-mono focus:outline-none focus:border-white/20"
            />
          </div>
          <p className="text-[10px] text-white/20 mt-1.5">Number of leads processed simultaneously during enrichment</p>
        </div>

        {/* Sources */}
        <div>
          <label className="text-[11px] font-mono text-white/40 uppercase tracking-wider block mb-2">
            Sources
          </label>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleSource(s.value)}
                className={`px-4 py-2 rounded-lg text-sm font-mono border transition-colors ${
                  form.sources.includes(s.value)
                    ? "border-white/20 bg-white/[0.08] text-white"
                    : "border-white/[0.08] bg-white/[0.03] text-white/30 hover:text-white/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-white/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Launching..." : "Start scraping"}
        </button>
      </form>
    </div>
  );
}
