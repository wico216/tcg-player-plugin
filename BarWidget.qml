import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

// MTG card search bar widget. Type a card name, get every printing
// (photo, set, collector number), pick foil or non-foil, and read the
// TCGplayer market price (served by the free Scryfall API).
BarWidget {
  id: root
  moduleName: "wico216.tcg-player"

  property var results: []
  property bool searching: false
  property string errorText: ""
  property bool popupOpen: false
  property var selectedCard: null
  property string selectedFinish: "nonfoil"
  property int totalCards: 0
  property string pendingQuery: ""

  readonly property color fgColor: root.bar ? root.bar.foreground : Color.foreground
  readonly property string fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
  readonly property int resultCount: results ? results.length : 0

  function requestSearch() {
    var query = searchField.text.trim()
    if (query.length < 2) {
      root.results = []
      root.totalCards = 0
      root.errorText = ""
      root.searching = false
      return
    }
    root.pendingQuery = query
    root.searching = true
    if (!searchProc.running) startSearch()
  }

  // Only one curl runs at a time; if the query moved on while a fetch was in
  // flight, the latest query is fetched right after (same pattern as weather).
  function startSearch() {
    searchProc.activeQuery = root.pendingQuery
    var url = "https://api.scryfall.com/cards/search?unique=prints&order=name&dir=asc&q="
      + encodeURIComponent(root.pendingQuery)
    searchProc.command = ["curl", "-sS", "--max-time", "8",
      "-A", "wico216-tcg-player-plugin/0.1 (omarchy shell plugin)", url]
    searchProc.running = true
  }

  function applySearch(payload) {
    if (!payload || payload.object === "error") {
      root.results = []
      root.totalCards = 0
      root.errorText = payload && payload.details ? payload.details : "Search failed"
      return
    }
    root.errorText = ""
    root.totalCards = Number(payload.total_cards || 0)
    var cards = Array.isArray(payload.data) ? payload.data : []
    root.results = cards
    if (root.selectedCard) root.syncSelection()
  }

  function syncSelection() {
    for (var i = 0; i < root.results.length; i++) {
      if (root.results[i].id === root.selectedCard.id) {
        root.selectedCard = root.results[i]
        return
      }
    }
    root.selectCard(null)
  }

  function selectCard(card) {
    root.selectedCard = card
    if (!card) return
    var finishes = card.finishes || []
    root.selectedFinish = finishes.indexOf("nonfoil") >= 0 ? "nonfoil" : "foil"
  }

  function hasFinish(card, finish) {
    return card && card.finishes && card.finishes.indexOf(finish) >= 0
  }

  function priceFor(card, finish) {
    if (!card || !card.prices) return null
    return finish === "foil" ? card.prices.usd_foil : card.prices.usd
  }

  function formatPrice(value) {
    return value === null || value === undefined ? "—" : "$" + value
  }

  function thumbFor(card) {
    if (!card) return ""
    if (card.image_uris && card.image_uris.small) return card.image_uris.small
    if (card.card_faces && card.card_faces.length > 0
        && card.card_faces[0].image_uris) return card.card_faces[0].image_uris.small || ""
    return ""
  }

  function artFor(card) {
    if (!card) return ""
    if (card.image_uris && card.image_uris.normal) return card.image_uris.normal
    if (card.card_faces && card.card_faces.length > 0
        && card.card_faces[0].image_uris) return card.card_faces[0].image_uris.normal || ""
    return ""
  }

  function setLabel(card) {
    if (!card) return ""
    var setPart = String(card.set_name || "") + " [" + String(card.set || "").toUpperCase() + "]"
    return setPart + " #" + String(card.collector_number || "?")
  }

  function openTcgplayer() {
    if (!root.selectedCard) return
    var uri = root.selectedCard.purchase_uris && root.selectedCard.purchase_uris.tcgplayer
      ? root.selectedCard.purchase_uris.tcgplayer : ""
    if (uri === "") return
    openProc.command = ["xdg-open", uri]
    openProc.running = true
  }

  function open() { root.popupOpen = true }

  function close() { root.popupOpen = false }

  function togglePanel() { root.popupOpen = !root.popupOpen }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onPopupOpenChanged: {
    if (popupOpen) {
      // The popup realizes content a frame after opening; defer and retry
      // until the field truly owns focus so typing works immediately.
      Qt.callLater(focusSearchField)
      focusRetry.restart()
    } else {
      focusRetry.stop()
    }
  }

  function focusSearchField() {
    if (root.popupOpen && !searchField.activeFocus) searchField.forceActiveFocus()
  }

  Timer {
    id: searchDebounce
    interval: 350
    repeat: false
    onTriggered: root.requestSearch()
  }

  Timer {
    id: focusRetry
    interval: 120
    repeat: true
    onTriggered: {
      if (!root.popupOpen || searchField.activeFocus) stop()
      else searchField.forceActiveFocus()
    }
  }

  Process {
    id: searchProc

    property string activeQuery: ""

    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          root.applySearch(JSON.parse(String(text || "{}")))
        } catch (error) {
          root.results = []
          root.totalCards = 0
          root.errorText = "Could not reach Scryfall"
        }
        if (String(searchProc.activeQuery) !== String(root.pendingQuery)) startSearchTimer.restart()
        else root.searching = false
      }
    }

    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: if (text.trim() !== "" && root.resultCount === 0) root.errorText = "Scryfall unreachable"
    }
  }

  Timer {
    id: startSearchTimer
    interval: 1
    onTriggered: root.startSearch()
  }

  Process {
    id: openProc
    running: false
  }

  IpcHandler {
    target: "wico216.tcg-player"

    function open(): void { root.open() }
    function show(): void { root.open() }
    function close(): void { root.close() }
    function hide(): void { root.close() }
    function toggle(): void { root.togglePanel() }
    function search(query: string): string {
      searchField.text = String(query)
      root.open()
      root.requestSearch()
      return "ok"
    }
  }

  Item {
    id: button
    anchors.fill: parent
    implicitWidth: Style.bar.statusSlot
    implicitHeight: root.barSize

    Text {
      anchors.centerIn: parent
      text: ""
      color: root.fgColor
      font.family: root.fontFamily
      font.pixelSize: Style.font.icon
    }

    MouseArea {
      anchors.fill: parent
      acceptedButtons: Qt.LeftButton
      hoverEnabled: false
      onClicked: root.togglePanel()
    }
  }

  PopupCard {
    id: popup
    anchorItem: button
    bar: root.bar
    owner: root
    open: root.popupOpen
    triggerMode: "click"
    contentWidth: popup.fittedContentWidth(Style.space(470))
    contentHeight: popup.fittedContentHeight(panelColumn.implicitHeight, Style.space(640))

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      // While the search field owns focus, hand ALL keys straight to it;
      // otherwise the catcher drives Esc/arrows for the panel itself.
      blocked: searchField.activeFocus
      onCloseRequested: root.close()

      Flickable {
      id: panelScroll
      anchors.fill: parent
      contentWidth: width
      contentHeight: panelColumn.implicitHeight
      clip: true
      boundsBehavior: Flickable.StopAtBounds

      Column {
        id: panelColumn
        width: panelScroll.width
        spacing: Style.space(8)

        TextField {
          id: searchField
          width: parent.width
          placeholderText: "Search Magic cards… (e.g. one ring)"
          foreground: root.fgColor
          font.family: root.fontFamily

          onTextChanged: {
            root.errorText = ""
            searchDebounce.restart()
          }

          Keys.onPressed: function(event) {
            if (event.key === Qt.Key_Escape) {
              root.close()
              event.accepted = true
            } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
              searchDebounce.stop()
              root.requestSearch()
              event.accepted = true
            }
          }
        }

        Text {
          visible: root.searching
          text: "Searching Scryfall…"
          color: Qt.darker(root.fgColor, 1.3)
          font.family: root.fontFamily
          font.pixelSize: Style.font.bodySmall
        }

        Text {
          visible: !root.searching && root.errorText !== ""
          text: root.errorText
          color: Qt.darker(root.fgColor, 1.3)
          font.family: root.fontFamily
          font.pixelSize: Style.font.bodySmall
          wrapMode: Text.WordWrap
          width: parent.width
        }

        // Selected version detail: photo, finish picker, TCGplayer price.
        Row {
          visible: root.selectedCard !== null
          width: parent.width
          spacing: Style.space(10)

          Rectangle {
            width: Style.space(96)
            height: Style.space(134)
            radius: Style.cornerRadius
            color: Qt.darker(root.fgColor, 2.5)

            Image {
              anchors.centerIn: parent
              width: parent.width - Style.space(8)
              height: parent.height - Style.space(8)
              asynchronous: true
              fillMode: Image.PreserveAspectFit
              source: root.artFor(root.selectedCard)
              visible: status === Image.Ready
            }
          }

          Column {
            width: parent.width - Style.space(106)
            spacing: Style.space(4)

            Text {
              width: parent.width
              text: root.selectedCard ? String(root.selectedCard.name) : ""
              color: root.fgColor
              font.family: root.fontFamily
              font.pixelSize: Style.font.body
              font.bold: true
              elide: Text.ElideRight
            }

            Text {
              width: parent.width
              text: root.setLabel(root.selectedCard)
                + (root.selectedCard && root.selectedCard.rarity
                   ? " · " + String(root.selectedCard.rarity) : "")
              color: Qt.darker(root.fgColor, 1.3)
              font.family: root.fontFamily
              font.pixelSize: Style.font.bodySmall
              elide: Text.ElideRight
            }

            Row {
              spacing: Style.space(6)

              Button {
                text: "Non-foil"
                leftAlign: false
                bordered: root.selectedFinish === "nonfoil"
                foreground: root.hasFinish(root.selectedCard, "nonfoil") ? root.fgColor : Qt.darker(root.fgColor, 2.0)
                enabled: root.hasFinish(root.selectedCard, "nonfoil")
                opacity: enabled ? 1.0 : 0.5
                onClicked: root.selectedFinish = "nonfoil"
              }

              Button {
                text: "Foil"
                leftAlign: false
                bordered: root.selectedFinish === "foil"
                foreground: root.hasFinish(root.selectedCard, "foil") ? root.fgColor : Qt.darker(root.fgColor, 2.0)
                enabled: root.hasFinish(root.selectedCard, "foil")
                opacity: enabled ? 1.0 : 0.5
                onClicked: root.selectedFinish = "foil"
              }
            }

            Text {
              text: root.selectedCard
                ? formatPrice(priceFor(root.selectedCard, root.selectedFinish))
                  + " · TCGplayer market (" + (root.selectedFinish === "foil" ? "foil" : "non-foil") + ")"
                : ""
              color: root.fgColor
              font.family: root.fontFamily
              font.pixelSize: Style.font.subtitle
              font.bold: true
            }

            Button {
              text: "Open on TCGplayer"
              iconText: "󰍃"
              leftAlign: true
              bordered: true
              foreground: root.fgColor
              onClicked: root.openTcgplayer()
            }
          }
        }

        PanelSeparator {
          visible: root.resultCount > 0
          foreground: root.fgColor
        }

        Text {
          visible: root.totalCards > 0
          text: root.totalCards > root.resultCount
            ? "Versions — " + root.resultCount + " shown of " + root.totalCards
            : "Versions — " + root.resultCount
          color: root.fgColor
          font.family: root.fontFamily
          font.pixelSize: Style.font.bodySmall
          font.bold: true
        }

        Repeater {
          model: root.results

          BorderSurface {
            id: resultRow
            required property var modelData

            width: panelColumn.width
            height: Math.max(Style.space(50), rowText.implicitHeight) + Style.space(12)
            radius: Style.cornerRadius
            color: root.selectedCard && root.selectedCard.id === modelData.id
              ? Style.selectedFillFor(root.fgColor, Color.accent) : "transparent"
            borderSpec: Border.controlSpec("normal", root.fgColor, Color.accent)

            Row {
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              anchors.leftMargin: resultRow.borderLeft + Style.space(8)
              anchors.rightMargin: resultRow.borderRight + Style.space(8)
              spacing: Style.space(8)

              Rectangle {
                width: Style.space(36)
                height: Style.space(50)
                radius: Style.space(3)
                color: Qt.darker(root.fgColor, 2.5)

                Image {
                  anchors.centerIn: parent
                  width: parent.width - 2
                  height: parent.height - 2
                  asynchronous: true
                  fillMode: Image.PreserveAspectFit
                  source: root.thumbFor(resultRow.modelData)
                  visible: status === Image.Ready
                }
              }

              Column {
                id: rowText
                width: parent.width - Style.space(44)
                spacing: Style.space(1)
                anchors.verticalCenter: parent.verticalCenter

                Text {
                  width: parent.width
                  text: String(resultRow.modelData.name)
                  color: root.fgColor
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.body
                  elide: Text.ElideRight
                }

                Text {
                  width: parent.width
                  text: root.setLabel(resultRow.modelData)
                    + "   NF " + formatPrice(priceFor(resultRow.modelData, "nonfoil"))
                    + " · F " + formatPrice(priceFor(resultRow.modelData, "foil"))
                  color: Qt.darker(root.fgColor, 1.3)
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                  elide: Text.ElideRight
                }
              }
            }

            MouseArea {
              anchors.fill: parent
              cursorShape: Qt.PointingHandCursor
              onClicked: root.selectCard(resultRow.modelData)
            }
          }
        }

        Text {
          visible: !root.searching && root.errorText === "" && searchField.text.trim().length >= 2 && root.resultCount === 0
          text: "No versions found"
          color: Qt.darker(root.fgColor, 1.3)
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
        }
      }
      }
    }
  }
}
