const title = "Messages"
const icon = "/icons/icon.svg"
const panel = "/src/devtools/panel/panel.html"
const MAX_PENDING_MESSAGES = 250


browser.devtools.panels.create(title, icon, panel).then(panel => {
  const port = browser.runtime.connect({ name: `devtools-${browser.devtools.inspectedWindow.tabId}` })
  const messageHistory = []
  let _window = null

  port.onMessage.addListener(msg => {
    if (_window) {
      _window.handleMessage(msg)
    } else {
      if (messageHistory.length === MAX_PENDING_MESSAGES) messageHistory.shift()
      messageHistory.push(msg)
    }
  })

  function handlePanelShown(panelWindow) {
    panel.onShown.removeListener(handlePanelShown)
    _window = panelWindow
    for (const message of messageHistory) {
      _window.handleMessage(message)
    }
    messageHistory.length = 0
  }

  panel.onShown.addListener(handlePanelShown)
})
