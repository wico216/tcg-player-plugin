function barIcon() {
  return "\uf002"
}

var MAX_QUERY_LENGTH = 120
var MAX_URL_LENGTH = 2048
var MAX_RESPONSE_CARDS = 175

function boundedQuery(value) {
  return String(value === null || value === undefined ? "" : value)
    .slice(0, MAX_QUERY_LENGTH)
}

function safeHttpsUrl(value, expectedHost, requiredPathPrefix) {
  var text = String(value === null || value === undefined ? "" : value)
  if (text === "" || text.length > MAX_URL_LENGTH || text.trim() !== text) return ""
  try {
    var parsed = new URL(text)
    if (parsed.protocol !== "https:"
        || parsed.hostname.toLowerCase() !== expectedHost
        || parsed.username !== ""
        || parsed.password !== ""
        || parsed.port !== "") return ""
    if (requiredPathPrefix && parsed.pathname.indexOf(requiredPathPrefix) !== 0) return ""
    return parsed.href
  } catch (error) {
    return ""
  }
}

function safeScryfallImageUrl(value) {
  return safeHttpsUrl(value, "cards.scryfall.io", "")
}

function decodedQueryParameter(value, parameterName) {
  var text = String(value === null || value === undefined ? "" : value)
  if (text === "" || text.length > MAX_URL_LENGTH) return ""
  var queryStart = text.indexOf("?")
  if (queryStart < 0) return ""
  var queryEnd = text.indexOf("#", queryStart)
  var query = text.slice(queryStart + 1, queryEnd < 0 ? text.length : queryEnd)
  var pairs = query.split("&")
  var decodedValue = ""
  var matches = 0
  for (var i = 0; i < pairs.length; i++) {
    var separator = pairs[i].indexOf("=")
    var rawKey = separator < 0 ? pairs[i] : pairs[i].slice(0, separator)
    var rawValue = separator < 0 ? "" : pairs[i].slice(separator + 1)
    try {
      var key = decodeURIComponent(rawKey.replace(/\+/g, " "))
      if (key === parameterName) {
        matches++
        if (matches > 1) return ""
        decodedValue = decodeURIComponent(rawValue.replace(/\+/g, " "))
      }
    } catch (error) {
      return ""
    }
  }
  return matches === 1 ? decodedValue : ""
}

function safeTcgplayerUrl(value) {
  var directProduct = safeHttpsUrl(value, "www.tcgplayer.com", "/product/")
  if (directProduct !== "") return directProduct

  var partnerUrl = safeHttpsUrl(value, "partner.tcgplayer.com", "/c/")
  if (partnerUrl === "") return ""
  try {
    var destination = decodedQueryParameter(partnerUrl, "u")
    var productDestination = safeHttpsUrl(destination, "www.tcgplayer.com", "/product/")
    var searchDestination = safeHttpsUrl(destination, "www.tcgplayer.com", "/search/")
    return productDestination !== "" || searchDestination !== "" ? partnerUrl : ""
  } catch (error) {
    return ""
  }
}

function boundedString(value, maximumLength) {
  return String(value === null || value === undefined ? "" : value)
    .slice(0, maximumLength)
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

function asArray(value, maximumLength) {
  var limit = Number(maximumLength)
  if (!Number.isFinite(limit) || limit < 0) limit = 32
  limit = Math.floor(limit)
  if (Array.isArray(value)) return value.slice(0, limit)
  if (!value) return []
  var length = Number(value.length !== undefined ? value.length : value.count)
  if (!Number.isFinite(length) || length < 0) return []
  length = Math.min(Math.floor(length), limit)
  var items = []
  for (var i = 0; i < length; i++) {
    var item = value[i]
    if (item === undefined && typeof value.at === "function") item = value.at(i)
    items.push(item)
  }
  return items
}

function sanitizePrice(value) {
  var price = boundedString(value, 32)
  return /^\d{1,12}(?:\.\d{1,4})?$/.test(price) ? price : null
}

function sanitizeFinishes(value) {
  var allowed = ["nonfoil", "foil", "etched"]
  var sanitized = []
  var source = asArray(value, 16)
  for (var i = 0; i < source.length; i++) {
    var finish = boundedString(source[i], 16).toLowerCase()
    if (allowed.indexOf(finish) >= 0 && sanitized.indexOf(finish) < 0)
      sanitized.push(finish)
    if (sanitized.length === 3) break
  }
  return sanitized
}

function sanitizePromoTypes(value) {
  return asArray(value, 16)
    .map(function(item) { return boundedString(item, 32).toLowerCase() })
    .filter(function(item) { return item !== "" })
}

function sanitizeCard(card) {
  if (!card || typeof card !== "object" || Array.isArray(card)) return null

  var imageUrl = card.image_uris && card.image_uris.small
    ? card.image_uris.small : ""
  if (imageUrl === "") {
    var faces = asArray(card.card_faces, 1)
    if (faces.length > 0 && faces[0] && faces[0].image_uris)
      imageUrl = faces[0].image_uris.small || ""
  }

  return {
    name: boundedString(card.name, 200),
    set: boundedString(card.set, 16),
    collector_number: boundedString(card.collector_number, 64),
    released_at: boundedString(card.released_at, 10),
    finishes: sanitizeFinishes(card.finishes),
    promo_types: sanitizePromoTypes(card.promo_types),
    prices: {
      usd: sanitizePrice(card.prices && card.prices.usd),
      usd_foil: sanitizePrice(card.prices && card.prices.usd_foil),
      usd_etched: sanitizePrice(card.prices && card.prices.usd_etched)
    },
    image_uris: { small: safeScryfallImageUrl(imageUrl) },
    purchase_uris: {
      tcgplayer: safeTcgplayerUrl(card.purchase_uris && card.purchase_uris.tcgplayer)
    }
  }
}

function sanitizeSearchPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return { object: "error", details: "Invalid Scryfall response" }
  if (payload.object === "error") {
    var details = boundedString(payload.details, 240)
    return { object: "error", details: details || "Search failed" }
  }
  if (!Array.isArray(payload.data))
    return { object: "error", details: "Invalid Scryfall response" }

  return {
    object: "list",
    data: asArray(payload.data, MAX_RESPONSE_CARDS)
      .map(sanitizeCard)
      .filter(function(card) { return card !== null })
  }
}

function searchProcessPayload(exitCode, stdoutText) {
  if (Number(exitCode) !== 0)
    return { object: "error", details: "Scryfall unreachable" }
  try {
    return sanitizeSearchPayload(JSON.parse(String(stdoutText || "")))
  } catch (error) {
    return { object: "error", details: "Could not read Scryfall response" }
  }
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
  return transliteratedText(boundedQuery(query)).trim().split(/\s+/)
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
    "--max-filesize", "2M", "--proto", "=https",
    "-A", "wico216-tcg-player-plugin/0.2.1 (omarchy shell plugin)",
    "-H", "Accept: application/json",
    url
  ]
}

function normalizedCardName(value) {
  return transliteratedText(value).replace(/[^a-z0-9]+/g, "")
}

function filterCardsByName(cards, query) {
  var queryName = normalizedCardName(boundedQuery(query))
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
  module.exports = { barIcon, boundedQuery, decodedQueryParameter, filterCardsByName, finishRows, nextScrollPosition, printingLabel, queryKey, safeScryfallImageUrl, safeTcgplayerUrl, sanitizeSearchPayload, scaledScrollDelta, scryfallSearchCommand, searchProcessPayload, searchQuery, searchResponsePlan, sortCards }
}
