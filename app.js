const $ = (sel) => document.querySelector(sel)

const socket = AuroraEngine.socket

let selected = null
let contacts = []
let current = null
let simulator = false
let flow = { steps: {}, faq: [], confirmReply: '' }
let tab = 'simulador'
let chatFilter = 'all'
let apptFilter = 'proximas'
let searchTerm = ''
let dbBotOn = true
let stepPick = null
const msgEls = new Map() // id de mensaje -> elemento del DOM (se actualiza en vez de duplicar)

const SIM_JID = 'test@c.us'

// Devuelve un svg de la librería de iconos (sprite definido en index.html).
const icon = (name, size) => '<svg class="i i-' + (size || 16) + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'

const STATUS_TEXT = {
  connecting: 'Escanea el código QR para vincular',
  authenticated: 'Sesión autenticada, conectando…',
  ready: 'Conectado y respondiendo',
  disconnected: 'Desconectado — reconectando…',
  reconnecting: 'Reconectando — intentos automáticos…',
  needs_qr: 'La sesión se cerró: escanea el QR para volver a vincular',
  auth_failure: 'Error de autenticación',
  error: 'Error al iniciar WhatsApp — revisa la consola del servidor',
}

const STATUS_MARK = {
  pending: ['clock', ''],
  sent: ['check', ''],
  delivered: ['check2', ''],
  read: ['check2', 'leído'],
  play: ['check2', 'leído'],
  played: ['check2', 'leído'],
  error: ['alert', 'no enviado'],
}
// Marca de estado de los mensajes enviados: icono + etiqueta breve.
function statusMark(m) {
  const md = STATUS_MARK[m.status]
  if (!md) return ''
  return ' · ' + icon(md[0], 11) + (md[1] ? ' ' + md[1] : '')
}

// ---------- utilidades ----------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))
}
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
const fmtAppt = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + fmtTime(d)
}
const fmtShort = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' ' + fmtTime(d)
}
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function dayLabel(d) {
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000)
  const base = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  if (diff === 0) return 'Hoy · ' + base
  if (diff === 1) return 'Mañana · ' + base
  if (diff === -1) return 'Ayer · ' + base
  return base
}
const contactName = (c) => (c && (c.name || c.phone)) || (c && c.jid) || ''

let toastTimer = null
function toast(msg, ok = true) {
  const el = $('#toast')
  el.textContent = msg
  el.classList.toggle('err', !ok)
  el.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200)
}

const openModal = (sel) => $(sel).classList.remove('hidden')
const closeModal = (sel) => $(sel).classList.add('hidden')

function setStatus(state) {
  const el = $('#wa-status')
  if (simulator && state === 'ready') {
    el.innerHTML = '<span class="dot"></span>Modo simulador — sin WhatsApp real'
    el.classList.remove('online')
    return
  }
  el.innerHTML = '<span class="dot"></span>' + esc(STATUS_TEXT[state] || state)
  const online = state === 'ready' || state === 'authenticated'
  el.classList.toggle('online', online)
}

// ---------- estado del contacto ----------
function statusInfo(c) {
  switch (c && c.status) {
    case 'flujo': return { text: 'En flujo · paso ' + (c.step || 1), cls: 'st-flujo' }
    case 'pausa_humano': return { text: 'Atención humana', cls: 'st-humano' }
    case 'agendado': return { text: 'Agendado', cls: 'st-agendado' }
    case 'en_recordatorio': return { text: 'Recordatorio enviado', cls: 'st-record' }
    case 'confirmado': return { text: 'Confirmado', cls: 'st-conf' }
    case 'existente': return { text: 'Existente', cls: 'st-exist' }
    case 'revision': return { text: 'Revisión pendiente', cls: 'st-revision' }
    default: return { text: (c && c.status) || '', cls: 'p-mute' }
  }
}

function apptState(c, t) {
  if (c.status === 'confirmado') return { key: 'ok', text: 'Confirmada', cls: 'p-ok' }
  if (t < Date.now()) return { key: 'late', text: 'Vencida', cls: 'p-late' }
  if (c.reminder_sent || c.status === 'en_recordatorio') return { key: 'warn', text: 'Recordatorio enviado · sin confirmar', cls: 'p-warn' }
  return { key: 'none', text: 'Sin recordatorio', cls: 'p-mute' }
}

// ---------- chips genéricos ----------
function renderChips(box, defs, active, countFn, onPick) {
  box.innerHTML = ''
  for (const [key, label] of defs) {
    const b = document.createElement('button')
    b.className = 'chip' + (key === active ? ' active' : '')
    const n = countFn(key)
    b.innerHTML = esc(label) + (n ? '<span class="n">' + n + '</span>' : '')
    b.addEventListener('click', () => onPick(key))
    box.appendChild(b)
  }
}

// ---------- Chats ----------
const CHAT_FILTERS = [['all', 'Todos'], ['unread', 'No leídos'], ['flujo', 'En flujo'], ['humano', 'Atención humana'], ['cita', 'Con cita'], ['revision', 'Revisión'], ['existente', 'Existentes']]

function matchesFilter(c, f) {
  switch (f) {
    case 'unread': return c.unread > 0
    case 'flujo': return c.status === 'flujo'
    case 'humano': return c.status === 'pausa_humano'
    case 'cita': return !!c.appointment
    case 'revision': return c.status === 'revision'
    case 'existente': return c.status === 'existente'
    default: return true
  }
}
function matchesSearch(c) {
  if (!searchTerm) return true
  const hay = norm([c.name, c.phone, c.jid, c.last && c.last.body].filter(Boolean).join(' '))
  return hay.includes(norm(searchTerm))
}

function renderChatChips() {
  renderChips($('#chat-chips'), CHAT_FILTERS, chatFilter, (k) => (k === 'all' ? 0 : contacts.filter((c) => matchesFilter(c, k)).length), (k) => {
    chatFilter = k
    renderChatChips()
    renderContactList()
  })
}

function renderContactList() {
  const box = $('#contact-list')
  box.innerHTML = ''
  if (!contacts.length) {
    box.innerHTML = '<div class="empty">No hay conversaciones todavía.<br/>Cuando alguien escriba al número, aparecerá aquí.</div>'
    return
  }
  const list = contacts.filter((c) => matchesFilter(c, chatFilter) && matchesSearch(c))
  if (!list.length) {
    box.innerHTML = '<div class="empty">Ninguna conversación coincide con el filtro o la búsqueda</div>'
    return
  }
  for (const c of list) {
    const name = contactName(c)
    const st = statusInfo(c)
    const row = document.createElement('div')
    row.className = 'contact' + (c.jid === selected ? ' sel' : '')
    const last = c.last ? esc(String(c.last.body || '').slice(0, 60)) : ''
    const time = c.last ? fmtTime(c.last.ts) : ''
    const appt = c.appointment ? '<span class="pill p-mute">' + icon('cal', 11) + ' ' + esc(fmtShort(c.appointment)) + '</span>' : ''
    row.innerHTML = `
      <div class="avatar">${esc(initials(name))}</div>
      <div class="c-body">
        <div class="c-top"><span class="c-name">${esc(name)}</span><span class="c-time">${time}</span></div>
        <div class="c-prev">${last}</div>
        <div class="c-meta">${st.text ? `<span class="pill ${st.cls}">${esc(st.text)}</span>` : ''}${appt}</div>
        ${c.status === 'revision' ? '<div class="c-actions">' +
          '<button class="mini primary" data-a="start">' + icon('send', 11) + ' Iniciar</button>' +
          '<button class="mini" data-a="archive">Archivar</button>' +
          '</div>' : ''}
      </div>
      ${c.unread ? `<div class="badge">${c.unread}</div>` : ''}`
    row.addEventListener('click', () => openChat(c.jid))
    const actBox = row.querySelector('.c-actions')
    if (actBox) {
      actBox.addEventListener('click', (e) => {
        e.stopPropagation()
        const a = e.target.closest('button')
        if (!a) return
        socket.emit('review-decision', { jid: c.jid, decision: a.dataset.a }, (r) => {
          if (r && r.ok) toast(a.dataset.a === 'start' ? 'Flujo iniciado: el bot escribirá el primer mensaje' : 'Contacto archivado como existente')
          else toast((r && r.error) || 'No se pudo procesar', false)
        })
      })
    }
    box.appendChild(row)
  }
}

$('#search').addEventListener('input', (e) => {
  searchTerm = e.target.value.trim()
  renderContactList()
})

// ---------- Citas ----------
const APPT_FILTERS = [['proximas', 'Próximas'], ['sinconf', 'Sin confirmar'], ['conf', 'Confirmadas'], ['pasadas', 'Pasadas']]

const apptItems = () =>
  contacts.filter((c) => c.appointment).map((c) => ({ c, t: new Date(c.appointment).getTime() })).filter((x) => !isNaN(x.t))

function apptMatch(x, f, now, today0) {
  switch (f) {
    case 'sinconf': return x.t >= now && x.c.status !== 'confirmado'
    case 'conf': return x.c.status === 'confirmado' && x.t >= today0
    case 'pasadas': return x.t < today0
    default: return x.t >= now // 'Próximas': solo citas que aún no han pasado
  }
}

function renderAgenda() {
  const now = Date.now()
  const today0 = startOfDay(new Date()).getTime()
  const items = apptItems()

  const hoy = items.filter((x) => x.t >= today0 && x.t < today0 + 86400000).length
  const semana = items.filter((x) => x.t >= now && x.t < today0 + 7 * 86400000).length
  const sinconf = items.filter((x) => x.t >= now && x.c.status !== 'confirmado').length
  $('#appt-summary').innerHTML =
    `<div class="tile"><b>${hoy}</b><span>Hoy</span></div>` +
    `<div class="tile"><b>${semana}</b><span>Próx. 7 días</span></div>` +
    `<div class="tile ${sinconf ? 'warn' : ''}"><b>${sinconf}</b><span>Sin confirmar</span></div>`

  renderChips($('#appt-chips'), APPT_FILTERS, apptFilter, (k) => items.filter((x) => apptMatch(x, k, now, today0)).length, (k) => {
    apptFilter = k
    renderAgenda()
  })

  const box = $('#appt-list')
  box.innerHTML = ''
  const list = items.filter((x) => apptMatch(x, apptFilter, now, today0)).sort((a, b) => (apptFilter === 'pasadas' ? b.t - a.t : a.t - b.t))
  if (!list.length) {
    const msg = items.length
      ? 'No hay citas en esta vista'
      : 'Todavía no hay citas programadas.<br/>Puede asignarlas desde cualquier conversación con el botón de agenda.'
    box.innerHTML = '<div class="empty">' + msg + '</div>'
    return
  }

  let lastDay = null
  for (const { c, t } of list) {
    const d = new Date(t)
    const dayKey = startOfDay(d).getTime()
    if (dayKey !== lastDay) {
      lastDay = dayKey
      const h = document.createElement('div')
      h.className = 'day' + (dayKey === today0 ? ' today' : '')
      h.textContent = dayLabel(d)
      box.appendChild(h)
    }
    const s = apptState(c, t)
    const card = document.createElement('div')
    card.className = 'appt' + (s.key === 'late' ? ' past' : '')
    card.innerHTML = `
      <div class="appt-time">${esc(fmtTime(t))}</div>
      <div class="appt-body">
        <div class="appt-name">${esc(contactName(c))}</div>
        <div class="appt-sub">${esc(c.phone || '')}</div>
        <span class="pill ${s.cls}">${esc(s.text)}</span>
        <div class="appt-actions"></div>
      </div>`
    const actions = card.querySelector('.appt-actions')
    const mk = (label, cls, fn) => {
      const b = document.createElement('button')
      b.className = 'mini' + (cls ? ' ' + cls : '')
      b.innerHTML = label
      b.addEventListener('click', (e) => { e.stopPropagation(); fn() })
      actions.appendChild(b)
    }
    mk(icon('msg', 12) + ' Abrir', 'primary', () => openChat(c.jid))
    if (s.key !== 'ok' && s.key !== 'late') mk(icon('bell', 12) + (c.reminder_sent ? ' Reenviar' : ' Recordar'), '', () => sendReminder(c.jid))
    mk(icon('pencil', 12) + ' Cambiar', '', () => { openChat(c.jid); openApptModal() })
    card.addEventListener('click', () => openChat(c.jid))
    box.appendChild(card)
  }
}

function sendReminder(jid) {
  const c = contacts.find((x) => x.jid === jid)
  if (!confirm('¿Enviar el recordatorio de la cita a ' + contactName(c) + '?')) return
  socket.emit('send-reminder', { jid }, (r) => {
    toast((r && r.ok) ? 'Recordatorio enviado' : (r && r.error) || 'No se pudo enviar', !!(r && r.ok))
  })
}

// ---------- Flujo (solo lectura) + simulador ----------
const stepKeys = () => Object.keys(flow.steps || {}).sort((a, b) => Number(a) - Number(b))
function stepLabel(k) {
  const st = (flow.steps || {})[k] || {}
  return 'Paso ' + k + (st.label ? ' · ' + st.label : '')
}

function faqParts(item) {
  if (typeof item === 'string') return { q: '', a: item }
  const q = item.q || item.question || item.title || item.name || (Array.isArray(item.keywords) && item.keywords.join(', ')) || (Array.isArray(item.patterns) && item.patterns.join(', ')) || ''
  const a = item.answer || item.a || item.text || item.reply || ''
  return { q, a: a || JSON.stringify(item) }
}

function renderFlow() {
  const box = $('#flow-content')
  box.innerHTML = ''
  const keys = stepKeys()
  const add = (html) => box.insertAdjacentHTML('beforeend', html)

  add('<div class="sec-title">Pasos del flujo</div>')
  if (!keys.length) add('<div class="empty">El servidor no envió los pasos del flujo.</div>')
  for (const k of keys) {
    const st = flow.steps[k]
    add(`<div class="card"><h4><span class="num">${esc(k)}</span>${esc(st.label || 'Paso ' + k)}${st.needsAppointment ? ' <span class="pill p-mute">usa la cita</span>' : ''}</h4><pre>${esc(st.text || '')}</pre></div>`)
  }
  if (flow.confirmReply) {
    add('<div class="sec-title">Al confirmar la cita</div>')
    add(`<div class="card"><pre>${esc(flow.confirmReply)}</pre></div>`)
  }
  if (Array.isArray(flow.faq) && flow.faq.length) {
    add('<div class="sec-title">Preguntas frecuentes que el bot responde</div>')
    for (const item of flow.faq) {
      const { q, a } = faqParts(item)
      add(`<div class="card">${q ? `<h4>${esc(q)}</h4>` : ''}<pre>${esc(a)}</pre></div>`)
    }
  }
}

// ---------- Simulador (sección propia con chat de prueba) ----------
// Sugerencias según la etapa del pedido: acompañan el flujo real (pedido → datos → confirmación).
const SIM_QUICK_BY_STEP = {
  1: ['Hola', '¿Qué tienen?', 'Quiero una pulsera tejida y unos aretes', '¿Cuánto vale?', '¿Hacen envíos?'],
  2: ['Ana Gómez, Calle 10 #25-30, barrio Centro, Medellín', 'Mi nombre es Ana Gómez', 'Calle 10 #25-30, barrio Centro, Medellín'],
  3: ['SÍ', '¿Cuánto es el anticipo?', '¿Hacen envíos a otra ciudad?'],
}
const SIM_QUICK_FALLBACK = ['Muchas gracias', '¿Cuándo llega mi pedido?', '¿Puedo cambiar la dirección?']
const simEls = new Map() // id de mensaje -> elemento (evita duplicar)
let simTypingEl = null
let simTypingTimer = null
let simTypingMax = null

function simQuickChips() {
  const c = contacts.find((x) => x.jid === SIM_JID)
  const step = c ? Number(c.step) || 1 : 1
  return SIM_QUICK_BY_STEP[step] || SIM_QUICK_FALLBACK
}

// Burbuja de "escribiendo…" del bot.
// - Mientras esperamos la respuesta (settle=false) el indicador se mantiene visible.
// - Cuando ya llegó una respuesta (settle=true) se oculta poco después, por si el bot
//   manda varios mensajes seguidos.
function simSetTyping(on, settle) {
  clearTimeout(simTypingTimer)
  clearTimeout(simTypingMax)
  const box = $('#sim-messages')
  if (on) {
    if (!simTypingEl) {
      simTypingEl = document.createElement('div')
      simTypingEl.className = 'typing'
      simTypingEl.innerHTML = '<i></i><i></i><i></i>'
      box.appendChild(simTypingEl)
    }
    box.scrollTop = box.scrollHeight
    if (settle) simTypingTimer = setTimeout(() => simSetTyping(false), 800)
    simTypingMax = setTimeout(() => simSetTyping(false), 15000)
    return
  }
  if (simTypingEl) { simTypingEl.remove(); simTypingEl = null }
}

function renderSimMsg(el, m) {
  renderMsg(el, m)
}

function addSimMsg(m, silent) {
  const box = $('#sim-messages')
  const hint = $('#sim-hint')
  if (hint) hint.remove()
  let el = m.id != null ? simEls.get(m.id) : null
  const isNew = !el
  if (isNew) {
    el = document.createElement('div')
    if (m.id != null) simEls.set(m.id, el)
    box.insertBefore(el, simTypingEl)
  }
  renderSimMsg(el, m)
  if (isNew) box.scrollTop = box.scrollHeight
  // El bot acaba de escribir: mantén el indicador un momento por si envía varios seguidos.
  if (!silent && m.from_me && m.sent_by === 'bot') simSetTyping(true, true)
}

function renderSimQuick() {
  const box = $('#sim-quick')
  box.innerHTML = ''
  for (const q of simQuickChips()) {
    const b = document.createElement('button')
    b.className = 'chip'
    b.textContent = q
    b.addEventListener('click', () => simSend(q))
    box.appendChild(b)
  }
}

function loadSimMessages() {
  socket.emit('chat-messages', SIM_JID, (msgs) => {
    const box = $('#sim-messages')
    box.innerHTML = ''
    simEls.clear()
    clearTimeout(simTypingTimer)
    clearTimeout(simTypingMax)
    simTypingEl = null
    if (!msgs || !msgs.length) {
      box.innerHTML = '<div class="sim-hint" id="sim-hint">Escribe un mensaje como si fueras un cliente y observa cómo responde el bot. Es una simulación: no se envía nada a WhatsApp.</div>'
      return
    }
    for (const m of msgs) addSimMsg(m, true)
  })
}

function simSend(text) {
  const input = $('#sim-input')
  const body = (text != null ? text : input.value).trim()
  if (!body) { toast('Escribe un mensaje', false); return }
  if (!simulator) { toast('El simulador no está disponible', false); return }
  const name = $('#sim-name').value.trim()
  input.value = ''
  simSetTyping(true, false)
  socket.emit('simulate', { jid: SIM_JID, body, name: name || undefined })
}

$('#sim-send').addEventListener('click', () => simSend())
$('#sim-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); simSend() } })
$('#sim-reset').addEventListener('click', () => {
  socket.emit('reset-conversation', { jid: SIM_JID }, () => {
    simSetTyping(false)
    loadSimMessages()
    toast('Conversación de prueba reiniciada')
  })
})
renderSimQuick()

// Reinicia TODA la demo: borra la base y vuelve a sembrar los datos ficticios.
$('#btn-reset-demo').addEventListener('click', () => {
  if (!confirm('¿Reiniciar la demo? Se borrarán los cambios y volverán los datos de ejemplo.')) return
  const btn = $('#btn-reset-demo')
  btn.disabled = true
  socket.emit('reset-demo', {}, (r) => {
    btn.disabled = false
    if (selected) closeChat()
    loadSimMessages()
    toast((r && r.ok) ? 'Demo reiniciada con datos de ejemplo' : (r && r.error) || 'No se pudo reiniciar', !!(r && r.ok))
  })
})

// ---------- Inicio (dashboard) ----------
function renderInicio() {
  const now = Date.now()
  const today0 = startOfDay(new Date()).getTime()
  const unread = contacts.reduce((n, c) => n + (c.unread || 0), 0)
  const flujo = contacts.filter((c) => c.status === 'flujo').length
  const humano = contacts.filter((c) => c.status === 'pausa_humano').length
  const hoy = apptItems().filter((x) => x.t >= today0 && x.t < today0 + 86400000).length

  $('#dash-stats').innerHTML = [
    ['Sin leer', unread],
    ['En flujo', flujo],
    ['Atención humana', humano],
    ['Citas hoy', hoy],
  ]
    .map(([t, n]) => '<div class="stat"><b>' + n + '</b><span>' + t + '</span></div>')
    .join('')

  const recents = contacts.slice(0, 4)
  $('#dash-recent').innerHTML = recents.length
    ? recents
        .map((c) => {
          const st = statusInfo(c)
          const last = c.last ? esc(String(c.last.body || '').slice(0, 60)) : ''
          return `<button class="drow" data-j="${esc(c.jid)}">
            <div class="avatar">${esc(initials(contactName(c)))}</div>
            <div class="dbody"><span class="nm">${esc(contactName(c))}</span><span class="pr">${last || 'Sin mensajes todavía'}</span></div>
            ${st.text ? `<span class="pill ${st.cls}">${esc(st.text)}</span>` : ''}
          </button>`
        })
        .join('')
    : '<div class="empty">Todavía no hay conversaciones.</div>'

  const appts = apptItems()
    .filter((x) => x.t >= now)
    .sort((a, b) => a.t - b.t)
    .slice(0, 4)
  $('#dash-appts').innerHTML = appts.length
    ? appts
        .map(({ c, t }) => {
          const s = apptState(c, t)
          return `<button class="drow" data-j="${esc(c.jid)}">
            <div class="dtime">${esc(fmtTime(t))}</div>
            <div class="dbody"><span class="nm">${esc(contactName(c))}</span><span class="pr">${esc(fmtShort(t))}</span></div>
            <span class="pill ${s.cls}">${esc(s.text)}</span>
          </button>`
        })
        .join('')
    : '<div class="empty">No hay citas próximas.</div>'
}

document.addEventListener('click', (e) => {
  const row = e.target.closest('#dash-recent .drow, #dash-appts .drow')
  if (row) openChat(row.dataset.j)
})

// ---------- Estadísticas ----------
function renderStats() {
  socket.emit('get-stats', (stats) => {
    if (!stats) return
    const cards = [
      ['Conversaciones', stats.contacts],
      ['Mensajes 7 días', stats.messages.total],
      ['Recibidos', stats.messages.in],
      ['Enviados', stats.messages.out],
    ]
    $('#stats-cards').innerHTML = cards
      .map(([t, n]) => '<div class="stat"><b>' + n + '</b><span>' + t + '</span></div>')
      .join('')

    // Barras semanales
    $('#stats-week').innerHTML = stats.days
      .map(
        (d) => `
      <div class="col">
        <span class="val">${d.total}</span>
        <div class="bar${d.total === stats.maxDay ? ' today' : ''}" style="height:${Math.round((d.total / stats.maxDay) * 72)}px"></div>
        <span class="lbl">${esc(d.day)} ${d.label}</span>
      </div>`
      )
      .join('')

    // Volumen por tipo (recibidos / bot / humano)
    const rows = [
      ['Cliente → tú', stats.messages.in, stats.messages.in, 'var(--blue)'],
      ['Bot → cliente', stats.messages.bot, stats.messages.total, 'var(--ok)'],
      ['Tú → cliente', stats.messages.human, stats.messages.total, 'var(--warn)'],
    ]
    $('#stats-type').innerHTML = rows
      .map(
        ([lab, n, maxBase, color]) => `
      <div class="srow">
        <span class="lab">${esc(lab)}</span>
        <span class="track"><i style="width:${Math.round((n / Math.max(1, maxBase)) * 100)}%;background:${color}"></i></span>
        <span class="num">${n}</span>
      </div>`
      )
      .join('')

    // Contactos por estado
    const ST_LABEL = {
      flujo: 'En flujo',
      pausa_humano: 'Atención humana',
      agendado: 'Agendado',
      en_recordatorio: 'Recordatorio',
      confirmado: 'Confirmado',
      existente: 'Existente',
      revision: 'Revisión pendiente',
    }
    const stEntries = Object.entries(stats.status).filter(([, n]) => n > 0)
    const stMax = Math.max(1, ...stEntries.map(([, n]) => n))
    $('#stats-status').innerHTML = stEntries.length
      ? stEntries
          .map(
            ([k, n]) => `
      <div class="srow">
        <span class="lab">${esc(ST_LABEL[k] || k)}</span>
        <span class="track"><i style="width:${Math.round((n / stMax) * 100)}%"></i></span>
        <span class="num">${n}</span>
      </div>`
          )
          .join('')
      : '<div class="empty">Sin contactos todavía.</div>'

    // Pasos del flujo
    const stepEntries = Object.entries(stats.steps).sort((a, b) => Number(a[0]) - Number(b[0]))
    const stpMax = Math.max(1, ...stepEntries.map(([, n]) => n))
    $('#stats-steps').innerHTML = stepEntries.length
      ? stepEntries
          .map(
            ([k, n]) => `
      <div class="srow">
        <span class="lab">Paso ${esc(k)}</span>
        <span class="track"><i style="width:${Math.round((n / stpMax) * 100)}%"></i></span>
        <span class="num">${n}</span>
      </div>`
          )
          .join('')
      : '<div class="empty">Nadie en flujo.</div>'

    // Citas
    const a = stats.appts
    $('#stats-appts').innerHTML = [
      ['Hoy', a.today],
      ['7 días', a.week],
      ['Confirmadas', a.confirmed],
      ['Pendientes', a.pending],
      ['Vencidas', a.late],
    ]
      .map(([t, n]) => '<div class="stat"><b>' + n + '</b><span>' + t + '</span></div>')
      .join('')

    // Horas más activas
    $('#stats-hours').innerHTML = stats.hours.length
      ? stats.hours
          .map(
            ({ h, total }) => `
      <div class="srow">
        <span class="lab">${h}:00 – ${h}:59</span>
        <span class="track"><i style="width:${Math.round((total / stats.hours[0].total) * 100)}%"></i></span>
        <span class="num">${total}</span>
      </div>`
          )
          .join('')
      : '<div class="empty">Sin mensajes en los últimos 7 días.</div>'
  })
}

// ---------- secciones ----------
const TAB_TITLES = { simulador: 'Simulador', inicio: 'Inicio', chats: 'Conversaciones', citas: 'Citas', flujo: 'Flujo del bot', estadisticas: 'Métricas' }
function setTab(name) {
  tab = name
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name))
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.id === 'pane-' + name))
  const title = $('#page-title')
  if (title) title.textContent = TAB_TITLES[name] || ''
  if (name === 'simulador') { if (simulator) loadSimMessages() }
  if (name === 'inicio') renderInicio()
  if (name === 'citas') renderAgenda()
  if (name === 'flujo') renderFlow()
  if (name === 'estadisticas') renderStats()
}
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)))

function updateBadges() {
  const unread = contacts.reduce((n, c) => n + (c.unread || 0), 0)
  const tb = $('#tab-chats-badge')
  tb.textContent = unread > 99 ? '99+' : unread
  tb.classList.toggle('hidden', !unread)

  const today0 = startOfDay(new Date()).getTime()
  const now = Date.now()
  const hoy = apptItems().filter((x) => x.t >= today0 && x.t < today0 + 86400000 && x.c.status !== 'confirmado' && x.t >= now - 3600000).length
  const cb = $('#tab-citas-badge')
  cb.textContent = hoy
  cb.classList.toggle('hidden', !hoy)

  document.title = (unread ? '(' + unread + ') ' : '') + 'Aurora Store · CRM'
}

// ---------- chat abierto ----------
function fillChatHeader() {
  if (!selected) return
  const name = (current && contactName(current)) || selected
  $('#chat-name').textContent = name
  $('#chat-avatar').textContent = initials(name)
  const parts = []
  const st = current ? statusInfo(current) : null
  if (st && st.text) parts.push(esc(st.text))
  if (current && current.appointment) parts.push(icon('cal', 11) + ' ' + esc(fmtAppt(current.appointment)))
  $('#chat-sub').innerHTML = parts.join(' · ')
}

function renderApptBar() {
  const bar = $('#appt-bar')
  if (!selected || !current) { bar.classList.add('hidden'); return }
  bar.classList.remove('hidden')
  bar.innerHTML = ''
  const info = document.createElement('span')
  info.className = current.appointment ? 'info' : 'info no'
  if (current.appointment) {
    const s = apptState(current, new Date(current.appointment).getTime())
    info.innerHTML = icon('cal', 13) + ' ' + esc(fmtAppt(current.appointment)) + ' · ' + esc(s.text)
  } else {
    info.innerHTML = icon('cal', 13) + ' Sin cita programada'
  }
  const edit = document.createElement('button')
  edit.textContent = current.appointment ? 'Cambiar' : 'Fijar cita'
  edit.addEventListener('click', openApptModal)
  bar.appendChild(info)
  bar.appendChild(edit)
  // Si el contacto quedó "agendado" (el bot guarda silencio tras un mensaje del humano),
  // el botón permite quitarle ese estado para que el bot vuelva a responderle las dudas.
  // Ya no se usan citas ni recordatorios: el estado lo marca el humano al escribir y se
  // quita con este botón, independiente de si hay cita.
  const silentStates = ['agendado', 'confirmado', 'en_recordatorio']
  if (silentStates.includes(current.status)) {
    const clear = document.createElement('button')
    clear.className = 'danger'
    clear.textContent = 'Quitar agendado'
    clear.addEventListener('click', () => {
      const who = contactName(current) || selected
      if (!confirm('¿Quitar el estado "agendado" de ' + who + '? El bot volverá a responderle desde el paso 3.')) return
      socket.emit('clear-appointment', { jid: selected }, (r) => {
        if (r && r.ok) {
          if (current) Object.assign(current, { appointment: null, reminder_sent: 0, step: 3, status: 'flujo' })
          toast('Agendado quitado · bot reactivado')
          renderApptBar()
          fillChatHeader()
          renderContactList()
          if (tab === 'citas') renderAgenda()
        } else {
          toast((r && r.error) || 'No se pudo quitar el agendado', false)
        }
      })
    })
    bar.appendChild(clear)
  }
}

function renderMsg(el, m) {
  el.className = 'msg ' + (m.from_me ? 'me' : 'them')
  const who = m.from_me ? (m.sent_by === 'bot' ? 'Bot · ' : 'Tú · ') : ''
  const mark = m.from_me ? statusMark(m) : ''
  el.innerHTML = `${esc(m.body)}<span class="meta">${who}${fmtTime(m.ts)}${mark}</span>`
}

function addMsg(m) {
  const box = $('#messages')
  let el = m.id != null ? msgEls.get(m.id) : null
  const isNew = !el
  if (isNew) {
    el = document.createElement('div')
    if (m.id != null) msgEls.set(m.id, el)
    box.appendChild(el)
  }
  renderMsg(el, m)
  if (isNew) box.scrollTop = box.scrollHeight
}

function loadMessages(jid) {
  socket.emit('chat-messages', jid, (msgs) => {
    if (selected !== jid) return // el usuario ya cambió de chat
    if (jid !== SIM_JID && msgs && msgs.length) {
      replayMessages(msgs)
      return
    }
    stopReplay()
    $('#messages').innerHTML = ''
    msgEls.clear()
    for (const m of msgs || []) addMsg(m)
  })
}

// ---------- Reproducción lenta de una conversación al abrirla ----------
// Al entrar a un chat, los mensajes aparecen uno a uno (el bot "escribe" antes de
// responder) para que se vea el desarrollo de la conversación. Tocar la zona de
// mensajes (o Esc/Enter) salta directo al final.
let replay = null // { token, timers, msgs }

function stopReplay() {
  if (!replay) return
  replay.token = 0
  for (const t of replay.timers) clearTimeout(t)
  replay = null
  const hint = $('#chat-replay-hint')
  if (hint) hint.remove()
  const t = $('#messages .typing')
  if (t) t.remove()
}

function skipReplay() {
  if (!replay) return
  const msgs = replay.msgs
  stopReplay()
  const box = $('#messages')
  box.innerHTML = ''
  msgEls.clear()
  for (const m of msgs) addMsg(m)
}

function replayMessages(msgs) {
  stopReplay()
  const box = $('#messages')
  box.innerHTML = ''
  msgEls.clear()
  const state = { token: 1, timers: [], msgs }
  replay = state
  box.insertAdjacentHTML(
    'afterbegin',
    '<div class="replay-hint" id="chat-replay-hint">Reproduciendo la conversación… <b>toca para saltar</b></div>'
  )

  const alive = (fn) => () => { if (replay === state) fn() }
  const addTyping = () => {
    const t = document.createElement('div')
    t.className = 'typing'
    t.innerHTML = '<i></i><i></i><i></i>'
    box.appendChild(t)
    box.scrollTop = box.scrollHeight
  }
  const dropTyping = () => {
    const t = box.querySelector('.typing')
    if (t) t.remove()
  }

  let delay = 600
  for (const m of msgs) {
    const isBot = !!m.from_me && m.sent_by === 'bot'
    if (isBot) {
      state.timers.push(setTimeout(alive(addTyping), delay))
      delay += 1500
      state.timers.push(setTimeout(alive(() => { dropTyping(); addMsg(m) }), delay))
      delay += 1000
    } else {
      state.timers.push(setTimeout(alive(() => addMsg(m)), delay))
      delay += 800
    }
  }
  state.timers.push(setTimeout(alive(stopReplay), delay + 150))
}

$('#messages').addEventListener('click', () => { if (replay) skipReplay() })
document.addEventListener('keydown', (e) => {
  if (!replay) return
  if (e.target && /^(input|textarea)$/i.test(e.target.tagName)) return
  if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skipReplay() }
})

function renderSimHeader() {
  const c = contacts.find((x) => x.jid === SIM_JID)
  const name = (c && c.name) || ''
  if (!name) {
    $('#sim-title').textContent = 'Cliente de prueba'
    $('#sim-avatar').innerHTML = icon('bot', 18)
    return
  }
  $('#sim-title').textContent = name
  $('#sim-avatar').textContent = initials(name)
}

function applyContacts(list) {
  contacts = Array.isArray(list) ? list.slice() : []
  contacts.sort((a, b) => ((b.last && b.last.ts) || 0) - ((a.last && a.last.ts) || 0))
  if (selected) current = contacts.find((c) => c.jid === selected) || null
  renderSimHeader()
  renderSimQuick()
  renderChatChips()
  renderContactList()
  renderApptBar()
  fillChatHeader()
  updateBadges()
  if (tab === 'inicio') renderInicio()
  if (tab === 'citas') renderAgenda()
  if (tab === 'estadisticas') renderStats()
}

// Con debounce: varios eventos seguidos generan una sola petición
let refreshTimer = null
function refreshContacts() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => socket.emit('get-contacts', applyContacts), 120)
}

function openChat(jid) {
  selected = jid
  current = contacts.find((c) => c.jid === selected) || null
  fillChatHeader()
  stopReplay()
  $('#messages').innerHTML = ''
  msgEls.clear()
  $('#chat-empty').classList.add('hidden')
  $('#chat-main').classList.remove('hidden')
  document.body.classList.add('chat-open')
  socket.emit('open-chat', jid)
  loadMessages(jid)
  renderContactList()
  renderApptBar()
}

function closeChat() {
  document.body.classList.remove('chat-open')
  // Sin chat abierto, los mensajes nuevos no deben marcarse como leídos
  selected = null
  current = null
  stopReplay()
  $('#chat-main').classList.add('hidden')
  $('#chat-empty').classList.remove('hidden')
  renderContactList()
  renderApptBar()
}

// ---------- Modal cita (hora en formato de 12 horas) ----------
const pad2 = (n) => String(n).padStart(2, '0')

;(function buildTimeSelects() {
  const hh = $('#appt-hour')
  for (let h = 1; h <= 12; h++) hh.insertAdjacentHTML('beforeend', '<option value="' + h + '">' + h + '</option>')
  const mm = $('#appt-min')
  for (let m = 0; m < 60; m += 5) mm.insertAdjacentHTML('beforeend', '<option value="' + m + '">' + pad2(m) + '</option>')
})()

function fillApptPicker(iso) {
  const hour = $('#appt-hour'), min = $('#appt-min'), ampm = $('#appt-ampm'), date = $('#appt-date')
  min.querySelectorAll('.extra').forEach((o) => o.remove())
  if (!iso) {
    date.value = ''
    hour.value = '10'; min.value = '0'; ampm.value = 'am'
  } else {
    const d = new Date(iso)
    date.value = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
    const h24 = d.getHours(), m = d.getMinutes()
    hour.value = String(h24 % 12 || 12)
    ampm.value = h24 >= 12 ? 'pm' : 'am'
    if (![...min.options].some((o) => Number(o.value) === m)) {
      // minuto que no es múltiplo de 5 (por ejemplo, detectado desde un mensaje): se agrega para no perderlo
      const o = document.createElement('option')
      o.value = String(m); o.textContent = pad2(m); o.className = 'extra'
      const next = [...min.options].find((x) => Number(x.value) > m)
      min.insertBefore(o, next || null)
    }
    min.value = String(m)
  }
  updateApptPreview()
}

function readApptPicker() {
  const v = $('#appt-date').value
  if (!v) return null
  const [y, mo, da] = v.split('-').map(Number)
  let h = Number($('#appt-hour').value) % 12
  if ($('#appt-ampm').value === 'pm') h += 12
  const d = new Date(y, mo - 1, da, h, Number($('#appt-min').value), 0, 0)
  return isNaN(d) ? null : d
}

// Muestra en letras lo que se va a guardar, para detectar de un vistazo un error de a. m. / p. m.
function updateApptPreview() {
  const box = $('#appt-preview')
  const d = readApptPicker()
  box.classList.remove('warn')
  if (!d) { box.textContent = ''; return }
  box.textContent = fmtAppt(d.toISOString())
  if (d.getTime() < Date.now()) {
    box.textContent = 'Esa fecha y hora ya pasaron: ' + fmtAppt(d.toISOString())
    box.classList.add('warn')
  }
}
;['#appt-date', '#appt-hour', '#appt-min', '#appt-ampm'].forEach((s) => {
  $(s).addEventListener('input', updateApptPreview)
  $(s).addEventListener('change', updateApptPreview)
})

function openApptModal() {
  if (!selected) return
  fillApptPicker(current && current.appointment ? current.appointment : null)
  openModal('#appt-modal')
}
$('#appt-cancel').addEventListener('click', () => closeModal('#appt-modal'))
$('#appt-modal').addEventListener('click', (e) => { if (e.target === '#appt-modal') closeModal('#appt-modal') })

let savingAppt = false
$('#appt-save').addEventListener('click', () => {
  if (savingAppt) return // evita guardar dos veces por doble clic
  const d = readApptPicker()
  if (!d) { toast('Elige el día de la cita', false); return }
  if (d.getTime() < Date.now() && !confirm('Esa fecha y hora ya pasaron:\n' + fmtAppt(d.toISOString()) + '\n\n¿Guardarla de todos modos?')) return
  savingAppt = true
  const btn = $('#appt-save')
  btn.disabled = true
  socket.emit('assign-appointment', { jid: selected, iso: d.toISOString() }, (r) => {
    savingAppt = false
    btn.disabled = false
    if (r && r.ok) {
      closeModal('#appt-modal')
      if (r.unchanged) { toast('La cita ya tenía esa fecha y hora'); return }
      if (current) current.appointment = d.toISOString()
      toast('Cita asignada para ' + fmtAppt(d.toISOString()))
      renderApptBar()
      fillChatHeader()
      renderContactList()
      if (tab === 'citas') renderAgenda()
    } else {
      toast((r && r.error) || 'No se pudo asignar la cita', false)
    }
  })
})

// ---------- Modal forzar paso ----------
// Paso sugerido: el siguiente al actual (o el 2 si es un contacto nuevo o 'existente')
function defaultStep() {
  const keys = stepKeys()
  if (!keys.length) return null
  const cur = current ? Number(current.step) : 0
  if (!current || current.status === 'existente' || !cur) return keys.includes('2') ? '2' : keys[0]
  const next = String(cur + 1)
  if (keys.includes(next)) return next
  return keys.includes(String(cur)) ? String(cur) : keys[0]
}

function openStepModal() {
  if (!selected) return
  const keys = stepKeys()
  if (!keys.length) { toast('El servidor no envió los pasos del flujo', false); return }
  const st = current ? statusInfo(current) : { text: 'sin ficha todavía' }
  $('#step-now').textContent = contactName(current) + ' · ahora: ' + (st.text || '—')

  const curStep = current && current.status !== 'existente' ? String(current.step || '') : ''
  const suggested = defaultStep()
  const hasAppt = !!(current && current.appointment)
  stepPick = null
  const box = $('#step-list')
  box.innerHTML = ''

  for (const k of keys) {
    const def = flow.steps[k]
    const blocked = def.needsAppointment && !hasAppt
    const item = document.createElement('label')
    item.className = 'step-item' + (blocked ? ' dis' : '')
    const tags = []
    if (k === curStep) tags.push('<span class="pill p-mute">actual</span>')
    if (k === suggested) tags.push('<span class="pill st-flujo">sugerido</span>')
    if (blocked) tags.push('<span class="pill p-late">necesita cita</span>')
    item.innerHTML = `<input type="radio" name="step" value="${esc(k)}" ${blocked ? 'disabled' : ''} />
      <div><b>${esc(stepLabel(k))}</b><span class="tags">${tags.join('')}</span><small>${esc(String(def.text || '').slice(0, 220))}</small></div>`
    const radio = item.querySelector('input')
    radio.addEventListener('change', () => {
      stepPick = k
      box.querySelectorAll('.step-item').forEach((el) => el.classList.remove('sel'))
      item.classList.add('sel')
      $('#step-send').disabled = false
    })
    box.appendChild(item)
    if (k === suggested && !blocked) { radio.checked = true; stepPick = k; item.classList.add('sel') }
  }
  $('#step-send').disabled = !stepPick
  openModal('#step-modal')
}

$('#step-cancel').addEventListener('click', () => closeModal('#step-modal'))
$('#step-modal').addEventListener('click', (e) => { if (e.target === $('#step-modal')) closeModal('#step-modal') })
$('#step-send').addEventListener('click', () => {
  if (!selected || !stepPick) return
  const btn = $('#step-send')
  btn.disabled = true
  socket.emit('force-step', { jid: selected, step: stepPick }, (r) => {
    btn.disabled = false
    if (r && r.ok) closeModal('#step-modal')
    toast((r && r.ok) ? (r.info || 'Paso en cola') : (r && r.error) || 'No se pudo forzar el paso', !!(r && r.ok))
  })
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not(.hidden)').forEach((m) => m.classList.add('hidden'))
    if (document.body.classList.contains('chat-open')) closeChat()
  }
})

// ---------- Acciones del chat ----------
$('#btn-send').addEventListener('click', sendMessage)
$('#msg-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
})

function sendMessage() {
  const input = $('#msg-input')
  const body = input.value.trim()
  if (!body) return
  if (!selected) { toast('Selecciona un chat', false); return }
  input.value = ''
  socket.emit('send', { jid: selected, body }, (r) => {
    if (r && r.ok) {
      if (r.needsTime) toast('Enviado · Se mencionó un día sin hora, no se creó una cita. Asígnela desde la agenda de la conversación.')
      else toast(r.autoParsed ? 'Enviado · Cita detectada: ' + r.text : 'Enviado')
      if (r.appointment) { if (current) current.appointment = r.appointment; renderApptBar(); fillChatHeader(); renderContactList() }
    } else {
      if (!input.value) input.value = body // devuelve el texto para no perderlo
      toast((r && r.error) || 'No se pudo enviar el mensaje', false)
    }
  })
}

$('#btn-appt').addEventListener('click', openApptModal)
$('#btn-reminder').addEventListener('click', () => { if (selected) sendReminder(selected) })
$('#btn-step').addEventListener('click', openStepModal)
$('#btn-back').addEventListener('click', closeChat)

// ---------- Bot global on/off ----------
function renderBotBtn() {
  const b = $('#btn-bot')
  b.classList.toggle('off', !dbBotOn)
  b.innerHTML = icon('bot', 15) + '<span>' + (dbBotOn ? 'Bot activo' : 'Bot en pausa') + '</span>'
}
$('#btn-bot').addEventListener('click', () => {
  dbBotOn = !dbBotOn
  socket.emit('toggle-bot', dbBotOn)
  renderBotBtn()
  toast(dbBotOn ? 'Bot activado · responde automáticamente' : 'Bot en pausa · las respuestas pasan a gestionarse manualmente', dbBotOn)
})

// ---------- Socket ----------
socket.on('connect', () => console.log('Conectado al servidor'))

socket.on('bootstrap', (data) => {
  simulator = !!data.simulator
  flow = Object.assign({ steps: {}, faq: [], confirmReply: '' }, data.flow || {})
  dbBotOn = !!(data.settings && data.settings.bot_on)
  const simTab = document.querySelector('.tab[data-tab="simulador"]')
  if (simTab) simTab.classList.toggle('hidden', !simulator)
  if (!simulator && tab === 'simulador') setTab('inicio')
  renderBotBtn()
  refreshContacts()
  if (tab === 'simulador' && simulator) loadSimMessages()
  if (tab === 'flujo') renderFlow()
  if (selected) loadMessages(selected) // por si se reabre sobre un chat ya cargado
})

socket.on('settings-updated', (s) => {
  dbBotOn = !!(s && s.bot_on)
  renderBotBtn()
})

socket.on('wa-status', (d) => setStatus(d.state))

// El bot avisa que está "escribiendo" antes de responder: muestra los puntos suspensivos.
socket.on('typing', (d) => {
  if (!d || !d.on) return
  if (d.jid === SIM_JID) simSetTyping(true, false)
})

// El servidor ya manda la lista completa: úsala directamente
socket.on('contacts-updated', (list) => {
  if (Array.isArray(list)) applyContacts(list)
  else refreshContacts()
})

socket.on('new-message', (m) => {
  refreshContacts()
  if (m.jid === SIM_JID) addSimMsg(m)
  if (selected && m.jid === selected) {
    if (replay) skipReplay() // un mensaje en vivo corta la reproducción
    addMsg(m)
    // Solo marcar como leído si el mensaje es del cliente, no en cada cambio de estado
    if (!m.from_me) socket.emit('open-chat', selected)
  }
})

// La agenda marca "Ya pasó" con la hora: se refresca cada minuto si está a la vista
setInterval(() => {
  if (tab === 'inicio') renderInicio()
  if (tab === 'citas') renderAgenda()
  if (tab === 'estadisticas') renderStats()
  updateBadges()
}, 60000)

renderInicio()
renderChatChips()
renderBotBtn()

// Aviso de demo estática: se puede cerrar
$('#demo-banner-close').addEventListener('click', () => $('#demo-banner').classList.add('hidden'))