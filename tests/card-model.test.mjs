import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test from "node:test"

const require = createRequire(import.meta.url)
const CardModel = require("../CardModel.js")

function card({
  id,
  name,
  releasedAt,
  usd = null,
  usdFoil = null,
  usdEtched = null,
  finishes = ["nonfoil", "foil"],
  promoTypes = [],
  frameEffects = null,
  setCode = "tst",
  collectorNumber = id
}) {
  return {
    id,
    name,
    set_name: "Test Set",
    set: setCode,
    collector_number: collectorNumber,
    released_at: releasedAt,
    finishes,
    promo_types: promoTypes,
    frame_effects: frameEffects,
    prices: {
      usd,
      usd_foil: usdFoil,
      usd_etched: usdEtched,
      eur: null,
      eur_foil: null,
      tix: null
    },
    image_uris: {
      small: `https://cards.scryfall.io/small/${id}.jpg`,
      normal: `https://cards.scryfall.io/normal/${id}.jpg`
    },
    purchase_uris: {
      tcgplayer: `https://www.tcgplayer.com/product/${id}`
    }
  }
}

test("printingLabel uses only the compact set code and collector number", () => {
  const printing = card({
    id: "abaddon",
    name: "Abaddon the Despoiler",
    releasedAt: "2022-10-07",
    setCode: "40k",
    collectorNumber: "2"
  })

  assert.equal(CardModel.printingLabel(printing), "40K #2")
})

test("finishRows distinguishes regular, special, and etched foil prices", () => {
  const regular = card({
    id: "regular-finishes",
    name: "Regular",
    releasedAt: "2025-01-01",
    usd: "2.00",
    usdFoil: "4.50"
  })
  const surge = card({
    id: "surge",
    name: "Surge",
    releasedAt: "2025-01-01",
    usdFoil: "10.86",
    finishes: ["foil"],
    promoTypes: ["surgefoil", "universesbeyond"]
  })
  const etched = card({
    id: "etched",
    name: "Etched",
    releasedAt: "2025-01-01",
    usdEtched: "8.25",
    finishes: ["etched"],
    frameEffects: ["etched"]
  })

  assert.deepEqual(CardModel.finishRows(regular), [
    { id: "nonfoil", label: "Non-foil", price: "2.00" },
    { id: "foil", label: "Regular foil", price: "4.50" }
  ])
  assert.deepEqual(CardModel.finishRows(surge), [
    { id: "foil", label: "Surge foil", price: "10.86" }
  ])
  assert.deepEqual(CardModel.finishRows(etched), [
    { id: "etched", label: "Etched foil", price: "8.25" }
  ])
})

test("finishRows names Scryfall special foil treatments precisely", () => {
  const treatments = [
    ["galaxyfoil", "Galaxy foil"],
    ["textured", "Textured foil"],
    ["rainbowfoil", "Rainbow foil"],
    ["stepandcompleat", "Step-and-compleat foil"],
    ["confettifoil", "Confetti foil"],
    ["halofoil", "Halo foil"],
    ["raisedfoil", "Raised foil"],
    ["fracturefoil", "Fracture foil"],
    ["oilslick", "Oil slick raised foil"],
    ["gilded", "Gilded foil"],
    ["neonink", "Neon ink foil"],
    ["doublerainbow", "Double rainbow foil"]
  ]

  for (const [promoType, expectedLabel] of treatments) {
    const treatmentCard = card({
      id: promoType,
      name: promoType,
      releasedAt: "2025-01-01",
      usdFoil: "3.00",
      finishes: ["foil"],
      promoTypes: [promoType, "boosterfun"]
    })
    assert.equal(CardModel.finishRows(treatmentCard)[0].label, expectedLabel)
  }
})

test("finishRows prioritizes actual compound Scryfall treatment data", () => {
  const oilSlick = card({
    id: "oil-slick",
    name: "All Will Be One",
    releasedAt: "2023-02-03",
    usdFoil: "53.18",
    finishes: ["foil"],
    promoTypes: ["oilslick", "raisedfoil"]
  })
  const serializedRainbow = card({
    id: "double-rainbow",
    name: "Adaptive Automaton",
    releasedAt: "2022-11-18",
    usdFoil: "177.12",
    finishes: ["foil"],
    promoTypes: ["serialized", "doublerainbow"]
  })

  assert.equal(CardModel.finishRows(oilSlick)[0].label, "Oil slick raised foil")
  assert.equal(CardModel.finishRows(serializedRainbow)[0].label, "Serialized double rainbow foil")
})

test("finishRows accepts QML array-like finish and promo-type values", () => {
  const wrapped = card({
    id: "qml-wrapped",
    name: "QML Wrapped",
    releasedAt: "2025-01-01",
    usdFoil: "10.86",
    finishes: { 0: "foil", length: 1 },
    promoTypes: { 0: "surgefoil", 1: "universesbeyond", length: 2 }
  })

  assert.deepEqual(CardModel.finishRows(wrapped), [
    { id: "foil", label: "Surge foil", price: "10.86" }
  ])
})

const fixtures = [
  card({ id: "regular", name: "Alpha", releasedAt: "2023-01-01", usd: "18.50", usdFoil: "25.00" }),
  card({ id: "foil-high", name: "Beta", releasedAt: "2022-01-01", usd: null, usdFoil: "110.00" }),
  card({ id: "etched-high", name: "Epsilon", releasedAt: "2021-01-01", usdEtched: "250.00", finishes: ["etched"] }),
  card({ id: "newest", name: "Gamma", releasedAt: "2025-05-20", usd: "6.00", usdFoil: "8.00" }),
  card({ id: "missing", name: "Delta", releasedAt: "2024-03-10" })
]

test("barIcon returns one visible glyph", () => {
  const icon = CardModel.barIcon()

  assert.equal(Array.from(icon).length, 1)
  assert.notEqual(icon.trim(), "")
})

test("scaledScrollDelta triples every touchpad event without accumulation", () => {
  assert.equal(CardModel.scaledScrollDelta(20, 0), 60)
  assert.equal(CardModel.scaledScrollDelta(20, 0), 60)
  assert.equal(CardModel.scaledScrollDelta(-20, 0), -60)
  assert.equal(CardModel.scaledScrollDelta(0, -120), -360)
})

test("nextScrollPosition applies the scaled delta and clamps to content bounds", () => {
  assert.equal(CardModel.nextScrollPosition(100, -20, 0, 1000, 300), 160)
  assert.equal(CardModel.nextScrollPosition(0, 20, 0, 1000, 300), 0)
  assert.equal(CardModel.nextScrollPosition(700, -20, 0, 1000, 300), 700)
})

test("searchQuery builds punctuation-tolerant name-only terms", () => {
  assert.equal(CardModel.searchQuery("  one   ring  "), "name:one name:ring")
  assert.equal(CardModel.searchQuery("urza's saga"), "name:urzas name:saga")
  assert.equal(CardModel.searchQuery('jace "the mind sculptor"'), "name:jace name:the name:mind name:sculptor")
})

test("boundedQuery caps user and IPC input before it reaches curl", () => {
  assert.equal(CardModel.boundedQuery("x".repeat(121)), "x".repeat(120))
  assert.equal(CardModel.boundedQuery(null), "")
})

test("scryfallSearchCommand bounds the transfer and permits HTTPS only", () => {
  assert.deepEqual(CardModel.scryfallSearchCommand("Æther Vial"), [
    "curl",
    "-sS",
    "--compressed",
    "--max-time",
    "8",
    "--max-filesize",
    "2M",
    "--proto",
    "=https",
    "-A",
    "wico216-tcg-player-plugin/0.2.1 (omarchy shell plugin)",
    "-H",
    "Accept: application/json",
    "https://api.scryfall.com/cards/search?unique=prints&order=name&dir=asc&q=name%3Aaether%20name%3Avial"
  ])
})

test("safeScryfallImageUrl accepts only credential-free HTTPS cards.scryfall.io URLs", () => {
  const valid = "https://cards.scryfall.io/small/front/a/b/abcdef.jpg?123"
  assert.equal(CardModel.safeScryfallImageUrl(valid), valid)

  const rejected = [
    "http://cards.scryfall.io/small/card.jpg",
    "file:///etc/passwd",
    "data:image/png;base64,AAAA",
    "https://cards.scryfall.io.evil.example/card.jpg",
    "https://attacker.example/cards.scryfall.io/card.jpg",
    "https://user@cards.scryfall.io/card.jpg",
    "https://cards.scryfall.io:444/card.jpg"
  ]
  for (const candidate of rejected) assert.equal(CardModel.safeScryfallImageUrl(candidate), "")
})

test("decodedQueryParameter decodes a nested URL exactly once without URLSearchParams", () => {
  const partner = "https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F487805%3Fpage%3D1"
  assert.equal(
    CardModel.decodedQueryParameter(partner, "u"),
    "https://www.tcgplayer.com/product/487805?page=1"
  )
  assert.equal(CardModel.decodedQueryParameter(partner, "missing"), "")
  assert.equal(CardModel.decodedQueryParameter("https://example.com/?u=%ZZ", "u"), "")
})

test("safeTcgplayerUrl accepts exact TCGplayer product and validated partner URLs", () => {
  const validProduct = "https://www.tcgplayer.com/product/282800/the-one-ring?Language=English"
  const validPartner = "https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F487805%3Fpage%3D1"
  assert.equal(CardModel.safeTcgplayerUrl(validProduct), validProduct)
  assert.equal(CardModel.safeTcgplayerUrl(validPartner), validPartner)

  const rejected = [
    "http://www.tcgplayer.com/product/282800",
    "https://tcgplayer.com/product/282800",
    "https://www.tcgplayer.com.evil.example/product/282800",
    "https://user@www.tcgplayer.com/product/282800",
    "https://www.tcgplayer.com:444/product/282800",
    "https://www.tcgplayer.com/search/all/product?q=ring",
    "https://partner.tcgplayer.com/c/4931599/1830156/21018",
    "https://partner.tcgplayer.com/c/4931599/1830156/21018?u=https%3A%2F%2Fevil.example%2Fproduct%2F1",
    "https://partner.tcgplayer.com/c/4931599/1830156/21018?u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F1&%75=https%3A%2F%2Fevil.example%2Fproduct%2F1",
    "https://partner.tcgplayer.com.evil.example/c/4931599?u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F1",
    "javascript:alert(1)",
    "file:///tmp/card"
  ]
  for (const candidate of rejected) assert.equal(CardModel.safeTcgplayerUrl(candidate), "")
})

test("safeTcgplayerUrl rejects a duplicate destination after many padding parameters", () => {
  const padding = Array.from({ length: 31 }, (_, index) => `p${index}=x`).join("&")
  const candidate = "https://partner.tcgplayer.com/c/4931599/1830156/21018?"
    + padding
    + "&u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F1"
    + "&%75=https%3A%2F%2Fevil.example%2Fproduct%2F1"

  assert.equal(CardModel.safeTcgplayerUrl(candidate), "")
})

test("sanitizeSearchPayload caps cards and retains only display fields", () => {
  const rawCards = Array.from({ length: 180 }, (_, index) => ({
    ...card({
      id: String(index),
      name: `Card ${index}`,
      releasedAt: "2026-08-23",
      usd: "12.34",
      setCode: "tst",
      collectorNumber: String(index)
    }),
    oracle_text: "This field must not be retained.",
    purchase_uris: { tcgplayer: `https://www.tcgplayer.com/product/${1000 + index}` }
  }))

  const sanitized = CardModel.sanitizeSearchPayload({ object: "list", data: rawCards })

  assert.equal(sanitized.data.length, 175)
  assert.deepEqual(sanitized.data[0], {
    name: "Card 0",
    set: "tst",
    collector_number: "0",
    released_at: "2026-08-23",
    finishes: ["nonfoil", "foil"],
    promo_types: [],
    prices: { usd: "12.34", usd_foil: null, usd_etched: null },
    image_uris: { small: "https://cards.scryfall.io/small/0.jpg" },
    purchase_uris: { tcgplayer: "https://www.tcgplayer.com/product/1000" }
  })
  assert.equal("oracle_text" in sanitized.data[0], false)
})

test("sanitizeSearchPayload bounds remote fields and rejects invalid prices and URLs", () => {
  const raw = card({ id: "bounded", name: "N".repeat(300), releasedAt: "2026-08-23-extra" })
  raw.set = "s".repeat(40)
  raw.collector_number = "c".repeat(100)
  raw.finishes = ["nonfoil", "foil", "etched", "invalid"]
  raw.promo_types = Array.from({ length: 20 }, (_, index) => `treatment${index}`.repeat(5))
  raw.prices = { usd: "9".repeat(100), usd_foil: "12.34", usd_etched: "not-a-price" }
  raw.image_uris.small = "file:///etc/passwd"
  raw.purchase_uris.tcgplayer = "javascript:alert(1)"

  const sanitized = CardModel.sanitizeSearchPayload({ object: "list", data: [raw] }).data[0]

  assert.equal(sanitized.name.length, 200)
  assert.equal(sanitized.set.length, 16)
  assert.equal(sanitized.collector_number.length, 64)
  assert.equal(sanitized.released_at, "2026-08-23")
  assert.deepEqual(sanitized.finishes, ["nonfoil", "foil", "etched"])
  assert.equal(sanitized.promo_types.length, 16)
  assert.equal(sanitized.promo_types.every(value => value.length <= 32), true)
  assert.deepEqual(sanitized.prices, { usd: null, usd_foil: "12.34", usd_etched: null })
  assert.equal(sanitized.image_uris.small, "")
  assert.equal(sanitized.purchase_uris.tcgplayer, "")
})

test("sanitizeSearchPayload converts malformed responses into bounded errors", () => {
  assert.deepEqual(
    CardModel.sanitizeSearchPayload({ object: "error", details: "E".repeat(300) }),
    { object: "error", details: "E".repeat(240) }
  )
  assert.deepEqual(
    CardModel.sanitizeSearchPayload({ object: "list", data: "not-an-array" }),
    { object: "error", details: "Invalid Scryfall response" }
  )
})

test("searchProcessPayload rejects failed and malformed curl output before use", () => {
  assert.deepEqual(
    CardModel.searchProcessPayload(63, '{"object":"list","data":['),
    { object: "error", details: "Scryfall unreachable" }
  )
  assert.deepEqual(
    CardModel.searchProcessPayload(0, "not json"),
    { object: "error", details: "Could not read Scryfall response" }
  )
})

test("searchProcessPayload returns a sanitized successful response", () => {
  const raw = card({ id: "process", name: "Process Card", releasedAt: "2026-08-23", usd: "4.25" })
  raw.purchase_uris.tcgplayer = "https://www.tcgplayer.com/product/12345"
  raw.oracle_text = "must be dropped"

  const payload = CardModel.searchProcessPayload(0, JSON.stringify({ object: "list", data: [raw] }))

  assert.equal(payload.object, "list")
  assert.equal(payload.data.length, 1)
  assert.equal(payload.data[0].name, "Process Card")
  assert.equal("oracle_text" in payload.data[0], false)
})

test("filterCardsByName matches omitted punctuation without admitting oracle-text hits", () => {
  const broadResults = [
    card({ id: "urzas-saga", name: "Urza's Saga", releasedAt: "2021-06-18", usd: "39.50" }),
    card({ id: "urzas-blast", name: "Urza's Ruinous Blast", releasedAt: "2018-04-27", usd: "0.20" }),
    card({ id: "one-ring", name: "The One Ring", releasedAt: "2023-06-23", usd: "61.00" }),
    card({ id: "gemstone", name: "Gemstone Caverns", releasedAt: "2006-10-06", usd: "58.00" })
  ]

  assert.deepEqual(
    CardModel.filterCardsByName(broadResults, "urzas saga").map(item => item.id),
    ["urzas-saga"]
  )
  assert.deepEqual(
    CardModel.filterCardsByName(broadResults, "one ring").map(item => item.id),
    ["one-ring"]
  )
})

test("search normalization transliterates non-decomposing card-name letters", () => {
  const candidates = [
    card({ id: "aether-vial", name: "Æther Vial", releasedAt: "2004-02-06", usd: "18.00" }),
    card({ id: "aetherize", name: "Aetherize", releasedAt: "2013-02-01", usd: "0.20" })
  ]

  assert.equal(CardModel.searchQuery("Æther Vial"), "name:aether name:vial")
  assert.deepEqual(
    CardModel.filterCardsByName(candidates, "aether vial").map(item => item.id),
    ["aether-vial"]
  )
})

test("searchResponsePlan never applies or mis-caches an older query", () => {
  assert.deepEqual(
    CardModel.searchResponsePlan("alpha", "beta", "beta"),
    { cacheKey: "alpha", apply: false, fetchPending: true }
  )
  assert.deepEqual(
    CardModel.searchResponsePlan("alpha", "alpha", "beta"),
    { cacheKey: "alpha", apply: false, fetchPending: false }
  )
})

test("searchResponsePlan drops cleared searches and applies matching ones", () => {
  assert.deepEqual(
    CardModel.searchResponsePlan("alpha", "", ""),
    { cacheKey: "alpha", apply: false, fetchPending: false }
  )
  assert.deepEqual(
    CardModel.searchResponsePlan(" Alpha ", "alpha", "ALPHA"),
    { cacheKey: "alpha", apply: true, fetchPending: false }
  )
  assert.deepEqual(
    CardModel.searchResponsePlan("One   Ring", "one ring", " one ring "),
    { cacheKey: "one ring", apply: true, fetchPending: false }
  )
})

test("queryKey gives equivalent whitespace and case one cache identity", () => {
  assert.equal(CardModel.queryKey(" One   RING "), "one ring")
  assert.equal(CardModel.queryKey("Urza's Saga"), "urzas saga")
  assert.equal(CardModel.queryKey("urzas saga"), "urzas saga")
  assert.equal(CardModel.queryKey("Æther Vial"), "aether vial")
})

test("highest value sorts printings by their best available USD price", () => {
  const sorted = CardModel.sortCards(fixtures, "high")

  assert.deepEqual(sorted.map(item => item.id), ["etched-high", "foil-high", "regular", "newest", "missing"])
})

test("lowest value keeps unpriced printings at the end", () => {
  const sorted = CardModel.sortCards(fixtures, "low")

  assert.deepEqual(sorted.map(item => item.id), ["newest", "regular", "foil-high", "etched-high", "missing"])
})

test("lowest value treats etched-only printings as priced", () => {
  const unpriced = card({ id: "unpriced-first", name: "Unpriced", releasedAt: "2025-01-01" })
  const etched = card({
    id: "etched-second",
    name: "Etched",
    releasedAt: "2025-01-01",
    usdEtched: "7.00",
    finishes: ["etched"]
  })

  assert.deepEqual(CardModel.sortCards([unpriced, etched], "low").map(item => item.id), ["etched-second", "unpriced-first"])
})

test("newest and name sorts are deterministic without mutating API results", () => {
  const originalOrder = fixtures.map(item => item.id)

  assert.deepEqual(
    CardModel.sortCards(fixtures, "newest").map(item => item.id),
    ["newest", "missing", "regular", "foil-high", "etched-high"]
  )
  assert.deepEqual(
    CardModel.sortCards(fixtures, "name").map(item => item.id),
    ["regular", "foil-high", "missing", "etched-high", "newest"]
  )
  assert.deepEqual(fixtures.map(item => item.id), originalOrder)
})
