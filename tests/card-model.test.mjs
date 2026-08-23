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

test("scryfallSearchCommand sends required headers and an encoded name-only query", () => {
  assert.deepEqual(CardModel.scryfallSearchCommand("Æther Vial"), [
    "curl",
    "-sS",
    "--compressed",
    "--max-time",
    "8",
    "-A",
    "wico216-tcg-player-plugin/0.2 (omarchy shell plugin)",
    "-H",
    "Accept: application/json;q=0.9,*/*;q=0.8",
    "https://api.scryfall.com/cards/search?unique=prints&order=name&dir=asc&q=name%3Aaether%20name%3Avial"
  ])
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
