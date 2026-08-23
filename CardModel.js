function barIcon() {
  return "\uf002"
}

function scaledScrollDelta(pixelDeltaY, angleDeltaY) {
  var pixelDelta = Number(pixelDeltaY)
  var angleDelta = Number(angleDeltaY)
  var rawDelta = Number.isFinite(pixelDelta) && pixelDelta !== 0 ? pixelDelta : angleDelta
  return Number.isFinite(rawDelta) ? rawDelta * 3 : 0
}

function nextScrollPosition(currentY, pixelDeltaY, angleDeltaY, contentHeight, viewportHeight) {
  var current = Number(currentY) || 0
  var maximum = Math.max(0, (Number(contentHeight) || 0) - (Number(viewportHeight) || 0))
  return Math.max(0, Math.min(maximum, current - scaledScrollDelta(pixelDeltaY, angleDeltaY)))
}

var specialFoilLabels = {
  surgefoil: "Surge foil",
  galaxyfoil: "Galaxy foil",
  textured: "Textured foil",
  rainbowfoil: "Rainbow foil",
  stepandcompleat: "Step-and-compleat foil",
  confettifoil: "Confetti foil",
  halofoil: "Halo foil",
  oilslick: "Oil slick raised foil",
  raisedfoil: "Raised foil",
  fracturefoil: "Fracture foil",
  gilded: "Gilded foil",
  neonink: "Neon ink foil",
  singularityfoil: "Singularity foil",
  shatterfoil: "Shatter foil",
  cosmicfoil: "Cosmic foil",
  doublerainbow: "Double rainbow foil",
  serialized: "Serialized foil"
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  var length = Number(value.length !== undefined ? value.length : value.count)
  if (!Number.isFinite(length) || length < 0) return []
  var items = []
  for (var i = 0; i < length; i++) {
    var item = value[i]
    if (item === undefined && typeof value.at === "function") item = value.at(i)
    items.push(item)
  }
  return items
}

function specialFoilLabel(card) {
  var promoTypes = asArray(card && card.promo_types)
  if (promoTypes.indexOf("serialized") >= 0 && promoTypes.indexOf("doublerainbow") >= 0)
    return "Serialized double rainbow foil"
  var knownTypes = Object.keys(specialFoilLabels)
  for (var i = 0; i < knownTypes.length; i++) {
    if (promoTypes.indexOf(knownTypes[i]) >= 0) return specialFoilLabels[knownTypes[i]]
  }
  for (var j = 0; j < promoTypes.length; j++) {
    var match = String(promoTypes[j]).match(/^([a-z0-9]+)foil$/)
    if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1) + " foil"
  }
  return "Regular foil"
}

function finishRows(card) {
  if (!card) return []
  var finishes = asArray(card.finishes)
  var prices = card.prices || {}
  var rows = []
  if (finishes.indexOf("nonfoil") >= 0)
    rows.push({ id: "nonfoil", label: "Non-foil", price: prices.usd })
  if (finishes.indexOf("foil") >= 0)
    rows.push({ id: "foil", label: specialFoilLabel(card), price: prices.usd_foil })
  if (finishes.indexOf("etched") >= 0)
    rows.push({ id: "etched", label: "Etched foil", price: prices.usd_etched })
  return rows
}

function printingLabel(card) {
  if (!card) return ""
  return String(card.set || "").toUpperCase() + " #" + String(card.collector_number || "?")
}

function transliteratedText(value) {
  var text = String(value || "").toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ł/g, "l")
    .replace(/ß/g, "ss")
    .replace(/ø/g, "o")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
  if (typeof text.normalize === "function") text = text.normalize("NFKD")
  return text.replace(/[\u0300-\u036f]/g, "")
}

function searchTerms(query) {
  return transliteratedText(query).trim().split(/\s+/)
    .map(function(term) { return term.replace(/[^a-z0-9]/gi, "") })
    .filter(function(term) { return term !== "" })
}

function searchQuery(query) {
  return searchTerms(query)
    .map(function(term) { return "name:" + term })
    .join(" ")
}

function scryfallSearchCommand(query) {
  var url = "https://api.scryfall.com/cards/search?unique=prints&order=name&dir=asc&q="
    + encodeURIComponent(searchQuery(query))
  return [
    "curl", "-sS", "--compressed", "--max-time", "8",
    "-A", "wico216-tcg-player-plugin/0.2 (omarchy shell plugin)",
    "-H", "Accept: application/json;q=0.9,*/*;q=0.8",
    url
  ]
}

function normalizedCardName(value) {
  return transliteratedText(value).replace(/[^a-z0-9]+/g, "")
}

function filterCardsByName(cards, query) {
  var queryName = normalizedCardName(query)
  if (!Array.isArray(cards) || queryName === "") return []
  return cards.filter(function(card) {
    return normalizedCardName(card && card.name).indexOf(queryName) >= 0
  })
}

function queryKey(query) {
  return searchTerms(query).join(" ")
}

function searchResponsePlan(activeQuery, pendingQuery, inputQuery) {
  var activeKey = queryKey(activeQuery)
  var pendingKey = queryKey(pendingQuery)
  var inputKey = queryKey(inputQuery)
  return {
    cacheKey: activeKey,
    apply: activeKey.length >= 2 && activeKey === inputKey,
    fetchPending: pendingKey.length >= 2 && pendingKey !== activeKey
  }
}

function cardValue(card) {
  if (!card || !card.prices) return null
  var values = [card.prices.usd, card.prices.usd_foil, card.prices.usd_etched]
    .map(function(value) { return Number(value) })
    .filter(function(value) { return Number.isFinite(value) && value > 0 })
  return values.length > 0 ? Math.max.apply(null, values) : null
}

function compareName(left, right) {
  var leftKey = String(left && left.name || "").toLowerCase()
    + "\u0000" + String(left && left.set || "")
    + "\u0000" + String(left && left.collector_number || "")
  var rightKey = String(right && right.name || "").toLowerCase()
    + "\u0000" + String(right && right.set || "")
    + "\u0000" + String(right && right.collector_number || "")
  return leftKey.localeCompare(rightKey)
}

function sortCards(cards, mode) {
  var sorted = Array.isArray(cards) ? cards.slice() : []
  if (mode === "high") {
    sorted.sort(function(left, right) {
      var leftValue = cardValue(left)
      var rightValue = cardValue(right)
      if (leftValue === null) return rightValue === null ? 0 : 1
      if (rightValue === null) return -1
      return rightValue - leftValue || compareName(left, right)
    })
  } else if (mode === "low") {
    sorted.sort(function(left, right) {
      var leftValue = cardValue(left)
      var rightValue = cardValue(right)
      if (leftValue === null) return rightValue === null ? 0 : 1
      if (rightValue === null) return -1
      return leftValue - rightValue || compareName(left, right)
    })
  } else if (mode === "newest") {
    sorted.sort(function(left, right) {
      var leftDate = String(left && left.released_at || "")
      var rightDate = String(right && right.released_at || "")
      return rightDate.localeCompare(leftDate) || compareName(left, right)
    })
  } else {
    sorted.sort(compareName)
  }
  return sorted
}

if (typeof module !== "undefined") {
  module.exports = { barIcon, filterCardsByName, finishRows, nextScrollPosition, printingLabel, queryKey, scaledScrollDelta, scryfallSearchCommand, searchQuery, searchResponsePlan, sortCards }
}
