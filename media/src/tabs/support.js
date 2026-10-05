/** Support tab. Edit here; media/history.js is generated. */
import { messageType } from '../messages.js'

export function createSupportView(session) {
  const supportViewEl = document.getElementById('supportView')
  const supportCommentsEl = document.getElementById('supportComments')
  const supportCommentsEmptyEl = document.getElementById('supportCommentsEmpty')
  const supportMessageFormEl = document.getElementById('supportMessageForm')
  const supportNicknameEl = document.getElementById('supportNickname')
  const supportEmailEl = document.getElementById('supportEmail')
  const supportReplyValueEl = document.getElementById('supportReplyValue')
  const supportConsentEl = document.getElementById('supportConsent')
  const supportCommentNoticeEl = document.getElementById('supportCommentNotice')
  const supportBodyEl = document.getElementById('supportBody')
  const supportSendEl = document.getElementById('supportSend')
  const supportMessageStatusEl = document.getElementById('supportMessageStatus')
  let supportNicknameDirty = false
  let supportEmailDirty = false
  let supportSending = false
  /** Mirrors parseUnlockRequest in src/unlock/leaderboardUnlock.ts; the host still decides. */
  const UNLOCK_BODY = /^\s*unlock\s*:\s*[0-9a-z\s-]{6,64}\s*$/i

  function selectedSupportTopic() {
    const picked = document.querySelector('input[name="supportTopic"]:checked')
    return picked ? picked.value : ''
  }

  function supportExpectsReply() {
    const picked = document.querySelector('input[name="supportReply"]:checked')
    return !picked || picked.value !== 'no'
  }

  function supportEmailOk(email, expectsReply) {
    if (/[\r\n]/.test(email) || email.length > 254) {
      return false
    }
    if (!expectsReply) {
      return true
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  function syncSupportComposer() {
    const topic = selectedSupportTopic()
    const isComment = topic === 'comment'
    if (supportCommentNoticeEl) {
      supportCommentNoticeEl.hidden = !isComment
    }
    const expectsReply = supportExpectsReply()
    if (supportEmailEl) {
      supportEmailEl.disabled = !expectsReply
    }
    if (supportReplyValueEl) {
      session.setText(
        supportReplyValueEl,
        expectsReply ? session.t('support.replyYes') : session.t('support.replyNo'),
      )
    }
    const nick = supportNicknameEl ? supportNicknameEl.value.trim() : ''
    const email = supportEmailEl ? supportEmailEl.value.trim() : ''
    const body = supportBodyEl ? supportBodyEl.value.trim() : ''
    const topicOk =
      topic === 'comment' ||
      topic === 'feature' ||
      topic === 'bug' ||
      topic === 'other'
    const consentOk =
      !isComment || (supportConsentEl !== null && supportConsentEl.checked)
    const ready =
      nick.length > 0 &&
      nick.length <= 40 &&
      !/[\r\n]/.test(nick) &&
      supportEmailOk(email, expectsReply) &&
      body.length > 0 &&
      body.length <= 2000 &&
      topicOk &&
      consentOk
    if (supportSendEl) {
      supportSendEl.disabled =
        supportSending || !(ready || UNLOCK_BODY.test(body))
    }
  }

  function renderSupportComments(comments) {
    if (!supportCommentsEl) {
      return
    }
    while (supportCommentsEl.firstChild) {
      supportCommentsEl.removeChild(supportCommentsEl.firstChild)
    }
    const rows = Array.isArray(comments) ? comments : []
    let shown = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row || typeof row !== 'object') {
        continue
      }
      const nickname = typeof row.nickname === 'string' ? row.nickname : ''
      const body = typeof row.body === 'string' ? row.body : ''
      const sentOn = typeof row.sentOn === 'string' ? row.sentOn : ''
      if (!nickname || !body) {
        continue
      }
      const item = document.createElement('li')
      item.className = 'support-comment'
      const head = document.createElement('p')
      head.className = 'support-comment-head'
      const name = document.createElement('span')
      name.className = 'support-comment-name'
      session.setText(name, nickname)
      const date = document.createElement('span')
      date.className = 'support-comment-date'
      session.setText(date, session.t('support.commentSentOn', { date: sentOn }))
      head.appendChild(name)
      head.appendChild(date)
      const text = document.createElement('p')
      text.className = 'support-comment-body'
      session.setText(text, body)
      item.appendChild(head)
      item.appendChild(text)
      supportCommentsEl.appendChild(item)
      shown += 1
    }
    supportCommentsEl.hidden = shown === 0
    if (supportCommentsEmptyEl) {
      supportCommentsEmptyEl.hidden = shown > 0
    }
  }

  function renderSupport(support) {
    if (!supportViewEl) {
      return
    }
    const ready = support && typeof support === 'object' ? support : {}
    const buttons = supportViewEl.querySelectorAll('[data-support-link]')
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i]
      const linkId = btn.getAttribute('data-support-link')
      const isReady = ready[linkId] === true
      btn.disabled = !isReady
      btn.title = isReady
        ? session.t('support.opensInBrowser')
        : session.t('support.comingSoonTitle')
      const card = btn.closest('.support-coffee-card, .support-tier')
      if (card) {
        card.classList.toggle('is-ready', isReady)
      }
    }
    const nick = typeof ready.nickname === 'string' ? ready.nickname : ''
    if (
      supportNicknameEl &&
      !supportNicknameDirty &&
      supportNicknameEl.value.trim() === '' &&
      nick
    ) {
      supportNicknameEl.value = nick
    }
    const email = typeof ready.email === 'string' ? ready.email : ''
    if (
      supportEmailEl &&
      !supportEmailDirty &&
      supportEmailEl.value.trim() === '' &&
      email
    ) {
      supportEmailEl.value = email
    }
    session.applyLeaderboardUnlock(ready.leaderboardUnlocked === true)
    renderSupportComments(ready.comments)
    syncSupportComposer()
  }


  function onResult(data) {
    supportSending = false
    const sendLabel = supportSendEl ? supportSendEl.querySelector('span') : null
    if (sendLabel) {
      session.setText(sendLabel, session.t('support.send'))
    }
    if (data.ok && supportBodyEl) {
      supportBodyEl.value = ''
    }
    if (supportMessageStatusEl) {
      supportMessageStatusEl.hidden = false
      supportMessageStatusEl.classList.toggle('is-error', data.ok !== true)
      session.setText(
        supportMessageStatusEl,
        typeof data.detail === 'string' && data.detail
          ? data.detail
          : data.ok
            ? session.t('support.sent')
            : session.t('support.mailFailed'),
      )
    }
    syncSupportComposer()
  }

  function wire() {
    if (supportViewEl) {
      supportViewEl.addEventListener('click', function (event) {
        const btn = event.target.closest('[data-support-link]')
        if (!btn || btn.disabled) {
          return
        }
        const linkId = btn.getAttribute('data-support-link')
        if (!linkId) {
          return
        }
        session.vscode.postMessage({ type: messageType.openSupportLink, id: linkId })
      })
    }
    if (supportNicknameEl) {
      supportNicknameEl.addEventListener('input', function () {
        supportNicknameDirty = true
        if (supportMessageStatusEl) {
          supportMessageStatusEl.hidden = true
        }
        syncSupportComposer()
      })
    }
    if (supportEmailEl) {
      supportEmailEl.addEventListener('input', function () {
        supportEmailDirty = true
        if (supportMessageStatusEl) {
          supportMessageStatusEl.hidden = true
        }
        syncSupportComposer()
      })
    }
    if (supportBodyEl) {
      supportBodyEl.addEventListener('input', function () {
        if (supportMessageStatusEl) {
          supportMessageStatusEl.hidden = true
        }
        syncSupportComposer()
      })
    }
    if (supportConsentEl) {
      supportConsentEl.addEventListener('change', function () {
        syncSupportComposer()
      })
    }
    if (supportMessageFormEl) {
      supportMessageFormEl.addEventListener('change', function () {
        syncSupportComposer()
      })
      supportMessageFormEl.addEventListener('submit', function (event) {
        event.preventDefault()
        syncSupportComposer()
        if (!supportSendEl || supportSendEl.disabled || supportSending || !supportNicknameEl || !supportBodyEl) {
          return
        }
        supportSending = true
        syncSupportComposer()
        const sendLabel = supportSendEl.querySelector('span')
        if (sendLabel) {
          session.setText(sendLabel, session.t('support.sending'))
        }
        if (supportMessageStatusEl) {
          supportMessageStatusEl.hidden = false
          supportMessageStatusEl.classList.remove('is-error')
          session.setText(supportMessageStatusEl, session.t('support.sending'))
        }
        session.vscode.postMessage({
          type: messageType.sendAuthorMessage,
          topic: selectedSupportTopic(),
          nickname: supportNicknameEl.value.trim(),
          body: supportBodyEl.value.trim(),
          consent: supportConsentEl ? supportConsentEl.checked === true : false,
          email: supportEmailEl ? supportEmailEl.value.trim() : '',
          expectsReply: supportExpectsReply(),
        })
      })
    }
  }

  return {
    render: renderSupport,
    onResult,
    wire,
  }
}
