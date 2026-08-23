import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "CardModel.js" as CardModel

// Search Magic printings, compare Scryfall's daily TCGplayer snapshots,
// then jump to the live TCGplayer product page for the current marketplace.
BarWidget {
  id: root
  moduleName: "wico216.tcg-player"

  property var results: []
  property bool searching: false
  property string errorText: ""
  property bool popupOpen: false
  property int totalCards: 0
  property string pendingQuery: ""
  property var searchCache: ({})
  property string sortMode: "high"
  property bool popoutSwitchClosing: false

  readonly property color fgColor: root.bar ? root.bar.foreground : Color.foreground
  readonly property string fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
  readonly property int resultCount: results ? results.length : 0
  readonly property var sortedResults: CardModel.sortCards(root.results || [], root.sortMode)
  readonly property var visibleResults: root.sortedResults.slice(0, 40)
  readonly property bool opened: root.popupOpen

  function requestSearch() {
    var query = searchField.text.trim()
    root.pendingQuery = query
    if (query.length < 2) {
      root.results = []
      root.totalCards = 0
      root.errorText = ""
      root.searching = false
      return
    }

    var key = CardModel.queryKey(query)
    if (root.searchCache[key]) {
      root.searching = false
      root.errorText = ""
      root.applySearch(root.searchCache[key], query)
      return
    }

    root.searching = true
    if (!searchProc.running) root.startSearch()
  }

  // Serialize requests so fast typing never floods Scryfall. If the query
  // changes during a request, only the newest pending query runs next.
  function startSearch() {
    if (String(root.pendingQuery || "").trim().length < 2) {
      root.searching = false
      return
    }
    searchProc.activeQuery = root.pendingQuery
    searchProc.command = CardModel.scryfallSearchCommand(root.pendingQuery)
    searchProc.running = true
  }

  function applySearch(payload, requestQuery) {
    var plan = CardModel.searchResponsePlan(requestQuery, root.pendingQuery, searchField.text)
    if (!payload || payload.object === "error") {
      if (!plan.apply) return
      root.results = []
      root.totalCards = 0
      root.errorText = payload && payload.details ? payload.details : "Search failed"
      return
    }

    if (plan.cacheKey !== "") {
      if (Object.keys(root.searchCache).length > 60) root.searchCache = {}
      root.searchCache[plan.cacheKey] = payload
    }
    if (!plan.apply) return

    root.errorText = ""
    root.results = CardModel.filterCardsByName(payload.data, requestQuery)
    root.totalCards = root.results.length
    Qt.callLater(root.resetResultsViewport)
  }

  function formatPrice(value) {
    return value === null || value === undefined || value === "" ? "—" : "$" + value
  }

  function thumbFor(card) {
    if (!card) return ""
    if (card.image_uris && card.image_uris.small) return card.image_uris.small
    if (card.card_faces && card.card_faces.length > 0
        && card.card_faces[0].image_uris) return card.card_faces[0].image_uris.small || ""
    return ""
  }

  function tcgplayerUri(card) {
    return card && card.purchase_uris && card.purchase_uris.tcgplayer
      ? String(card.purchase_uris.tcgplayer) : ""
  }

  function openTcgplayer(card) {
    var uri = root.tcgplayerUri(card)
    if (uri === "" || openProc.running) return
    openProc.command = ["xdg-open", uri]
    openProc.running = true
  }

  function open() {
    root.popupOpen = true
    Qt.callLater(root.resetResultsViewport)
  }

  function close() {
    root.popupOpen = false
    root.clearSearchSession()
  }

  function togglePanel() {
    if (root.popupOpen) root.close()
    else root.open()
  }

  function closeForPopoutSwitch() {
    root.popoutSwitchClosing = true
    root.close()
    Qt.callLater(function() { root.popoutSwitchClosing = false })
  }

  function resetResultsViewport() {
    panelScroll.contentY = 0
  }

  function clearSearchSession() {
    searchField.text = ""
    searchDebounce.stop()
    root.pendingQuery = ""
    root.results = []
    root.totalCards = 0
    root.errorText = ""
    root.searching = false
    root.resetResultsViewport()
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onSortModeChanged: Qt.callLater(root.resetResultsViewport)

  Timer {
    id: searchDebounce
    interval: 250
    repeat: false
    onTriggered: root.requestSearch()
  }

  Process {
    id: searchProc

    property string activeQuery: ""

    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var plan = CardModel.searchResponsePlan(searchProc.activeQuery, root.pendingQuery, searchField.text)
        try {
          root.applySearch(JSON.parse(String(text || "{}")), searchProc.activeQuery)
        } catch (error) {
          root.applySearch({ object: "error", details: "Could not reach Scryfall" }, searchProc.activeQuery)
        }
        if (plan.fetchPending) startSearchTimer.restart()
        else root.searching = false
      }
    }

    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var plan = CardModel.searchResponsePlan(searchProc.activeQuery, root.pendingQuery, searchField.text)
        if (text.trim() !== "" && plan.apply && root.resultCount === 0)
          root.errorText = "Scryfall unreachable"
      }
    }
  }

  Timer {
    id: startSearchTimer
    interval: 1
    onTriggered: root.requestSearch()
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
    function query(): string { return searchField.text }
    function search(query: string): string {
      searchField.text = String(query)
      root.open()
      root.requestSearch()
      return "ok"
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: CardModel.barIcon()
    slotSize: Style.bar.statusSlot
    tooltipText: "Search Magic cards"

    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton) root.togglePanel()
    }
  }

  KeyboardPanel {
    id: popup
    anchorItem: button
    bar: root.bar
    owner: root
    open: root.popupOpen
    focusTarget: searchField
    contentWidth: popup.fittedContentWidth(Style.space(600))
    contentHeight: popup.fittedContentHeight(panelColumn.implicitHeight, Style.space(680))

    PanelKeyCatcher {
      anchors.fill: parent
      blocked: searchField.activeFocus
      onCloseRequested: root.close()

      Flickable {
        id: panelScroll
        anchors.fill: parent
        contentWidth: width
        contentHeight: panelColumn.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds

        WheelHandler {
          target: null
          orientation: Qt.Vertical
          acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
          blocking: true

          onWheel: function(event) {
            var delta = CardModel.scaledScrollDelta(event.pixelDelta.y, event.angleDelta.y)
            if (delta === 0) return
            panelScroll.contentY = CardModel.nextScrollPosition(
              panelScroll.contentY,
              event.pixelDelta.y,
              event.angleDelta.y,
              panelScroll.contentHeight,
              panelScroll.height
            )
            event.accepted = true
          }
        }

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
              root.pendingQuery = text.trim()
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

          Row {
            width: parent.width
            spacing: Style.space(5)

            Text {
              text: "Sort"
              color: root.fgColor
              font.family: root.fontFamily
              font.pixelSize: Style.font.bodySmall
              font.bold: true
              anchors.verticalCenter: parent.verticalCenter
            }

            Button {
              text: "Highest price"
              leftAlign: false
              bordered: root.sortMode === "high"
              foreground: root.fgColor
              onClicked: root.sortMode = "high"
            }

            Button {
              text: "Lowest price"
              leftAlign: false
              bordered: root.sortMode === "low"
              foreground: root.fgColor
              onClicked: root.sortMode = "low"
            }

            Button {
              text: "Newest"
              leftAlign: false
              bordered: root.sortMode === "newest"
              foreground: root.fgColor
              onClicked: root.sortMode = "newest"
            }

            Button {
              text: "Name"
              leftAlign: false
              bordered: root.sortMode === "name"
              foreground: root.fgColor
              onClicked: root.sortMode = "name"
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

          Text {
            visible: root.totalCards > 0
            text: root.totalCards > root.visibleResults.length
              ? root.visibleResults.length + " of " + root.totalCards + " printings · narrow the search for more"
              : root.visibleResults.length + (root.visibleResults.length === 1 ? " printing" : " printings")
            color: root.fgColor
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
            font.bold: true
          }

          Grid {
            id: resultsGrid
            width: parent.width
            columns: 2
            columnSpacing: Style.space(8)
            rowSpacing: Style.space(8)
            height: childrenRect.height

            Repeater {
              model: root.visibleResults

              BorderSurface {
                id: cardTile
                required property var modelData
                readonly property var finishData: CardModel.finishRows(cardTile.modelData)

                width: (resultsGrid.width - resultsGrid.columnSpacing) / 2
                height: tileContent.implicitHeight + Style.space(18)
                radius: Style.cornerRadius
                color: "transparent"
                borderSpec: Border.controlSpec("normal", root.fgColor, Color.accent)

                Column {
                  id: tileContent
                  anchors.left: parent.left
                  anchors.right: parent.right
                  anchors.top: parent.top
                  anchors.margins: Style.space(9)
                  spacing: Style.space(4)

                  Rectangle {
                    width: Style.space(128)
                    height: Style.space(179)
                    anchors.horizontalCenter: parent.horizontalCenter
                    radius: Style.space(5)
                    color: Qt.darker(root.fgColor, 2.5)
                    clip: true

                    Image {
                      anchors.fill: parent
                      asynchronous: true
                      cache: true
                      fillMode: Image.PreserveAspectFit
                      source: root.thumbFor(cardTile.modelData)
                    }
                  }

                  Text {
                    width: parent.width
                    text: String(cardTile.modelData.name || "Unknown card")
                    color: root.fgColor
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.body
                    font.bold: true
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    maximumLineCount: 2
                    elide: Text.ElideRight
                  }

                  Text {
                    width: parent.width
                    text: CardModel.printingLabel(cardTile.modelData)
                    color: Qt.darker(root.fgColor, 1.3)
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.caption
                    horizontalAlignment: Text.AlignHCenter
                    elide: Text.ElideRight
                  }

                  Repeater {
                    model: cardTile.finishData.length

                    Text {
                      required property int index
                      readonly property var finish: cardTile.finishData[index]
                      width: tileContent.width
                      text: String(finish.label) + "  " + root.formatPrice(finish.price)
                      color: root.fgColor
                      font.family: root.fontFamily
                      font.pixelSize: Style.font.bodySmall
                      font.bold: true
                      horizontalAlignment: Text.AlignHCenter
                      elide: Text.ElideRight
                    }
                  }

                  Button {
                    width: parent.width
                    text: "Check live on TCGplayer"
                    iconText: "󰍃"
                    leftAlign: false
                    bordered: true
                    foreground: root.fgColor
                    enabled: root.tcgplayerUri(cardTile.modelData) !== ""
                    opacity: enabled ? 1.0 : 0.45
                    onClicked: root.openTcgplayer(cardTile.modelData)
                  }
                }
              }
            }
          }

          Text {
            visible: !root.searching && root.errorText === ""
              && searchField.text.trim().length >= 2 && root.resultCount === 0
            text: "No printings found"
            color: Qt.darker(root.fgColor, 1.3)
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
          }
        }
      }
    }
  }
}
