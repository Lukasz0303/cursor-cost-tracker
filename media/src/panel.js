import { PanelSession } from './session.js'

/** Webview entry. Edit media/src; media/history.js is generated. */
export function boot() {
  const session = new PanelSession()
  window.addEventListener('message', function (event) {
    session.onMessage(event && event.data)
  })
  session.start()
}
