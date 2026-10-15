// js/store.js — Capa de datos estática para la demo de "Aurora Store".
// Reimplementa la API del antiguo db.js (SQLite) sobre localStorage del navegador.
// Todo el estado vive en el visitante: no hay servidor ni base de datos.
(function (root) {
  const KEY = 'aurora-crm-demo-v1'

  const empty = () => ({ contacts: {}, messages: [], settings: {}, nextId: 1 })

  let state = empty()

  const load = () => {
    try {
      const raw = root.localStorage.getItem(KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        state = Object.assign(empty(), parsed)
      }
    } catch (e) {
      state = empty()
    }
  }

  const persist = () => {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(state))
    } catch (e) {
      /* modo privado / cuota: la demo sigue funcionando en memoria */
    }
  }

  const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : null)

  const now = () => Date.now()

  // ---- Contactos ----
  const getContact = (jid) => clone(state.contacts[jid] || null) || undefined

  const upsertContact = (jid, fields = {}) => {
    const cur = state.contacts[jid] || null
    const next = {
      jid,
      name: fields.name !== undefined ? fields.name : (cur ? cur.name : null),
      phone: fields.phone !== undefined ? fields.phone : (cur ? cur.phone : null),
      step: fields.step !== undefined ? fields.step : (cur ? cur.step : 1),
      status: fields.status !== undefined ? fields.status : (cur ? cur.status : 'flujo'),
      appointment: fields.appointment !== undefined ? fields.appointment : (cur ? cur.appointment : null),
      reminder_sent: fields.reminder_sent !== undefined ? fields.reminder_sent : (cur ? cur.reminder_sent : 0),
      pname: fields.pname !== undefined ? fields.pname : (cur ? cur.pname : ''),
      pphone: fields.pphone !== undefined ? fields.pphone : (cur ? cur.pphone : ''),
      memory: fields.memory !== undefined ? fields.memory : (cur ? cur.memory || '' : ''),
      lid: fields.lid !== undefined ? fields.lid : (cur ? cur.lid || '' : ''),
      created_at: cur ? cur.created_at : now(),
      updated_at: now(),
    }
    state.contacts[jid] = next
    persist()
    return clone(next)
  }

  const getContacts = () =>
    Object.values(state.contacts)
      .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
      .map(clone)

  const deleteContact = (jid) => {
    delete state.contacts[jid]
    state.messages = state.messages.filter((m) => m.jid !== jid)
    persist()
  }

  // ---- Memoria de contexto por conversación (JSON en el campo memory) ----
  const getMemory = (jid) => {
    const c = state.contacts[jid]
    if (!c || !c.memory) return {}
    try {
      return JSON.parse(c.memory) || {}
    } catch (e) {
      return {}
    }
  }
  const setMemory = (jid, patch) => {
    const m = getMemory(jid)
    Object.assign(m, patch)
    return upsertContact(jid, { memory: JSON.stringify(m) })
  }

  // ---- Mensajes ----
  const getMessage = (id) => {
    const m = state.messages.find((x) => x.id === id)
    return m ? clone(m) : undefined
  }

  const saveMessage = ({ jid, fromMe, sentBy = 'client', body, ts = now(), status = 'sent' }) => {
    const msg = {
      id: state.nextId++,
      jid,
      from_me: fromMe ? 1 : 0,
      sent_by: sentBy,
      body,
      ts,
      read: 0,
      status,
    }
    state.messages.push(msg)
    persist()
    return clone(msg)
  }

  const updateMessage = (id, fields) => {
    const m = state.messages.find((x) => x.id === id)
    if (!m) return null
    const next = Object.assign({}, m, fields)
    m.body = next.body
    m.status = next.status
    m.read = next.read
    persist()
    return clone(m)
  }

  const getMessages = (jid, limit = 200) =>
    state.messages
      .filter((m) => m.jid === jid)
      .sort((a, b) => a.ts - b.ts)
      .slice(0, limit)
      .map(clone)

  const markRead = (jid) => {
    let changed = false
    for (const m of state.messages) {
      if (m.jid === jid && m.from_me === 0 && m.read === 0) {
        m.read = 1
        changed = true
      }
    }
    if (changed) persist()
  }

  const unreadCount = (jid) =>
    state.messages.filter((m) => m.jid === jid && m.from_me === 0 && m.read === 0).length

  const lastMessageOf = (jid) => {
    const list = state.messages.filter((m) => m.jid === jid).sort((a, b) => b.ts - a.ts)
    return list.length ? clone(list[0]) : undefined
  }

  // ---- Ajustes ----
  const getSetting = (key) => (key in state.settings ? state.settings[key] : null)
  const setSetting = (key, value) => {
    state.settings[key] = String(value)
    persist()
  }
  const botOn = () => getSetting('bot_on') === '1'

  // ---- Reset total (botón "Reiniciar demo") ----
  const reset = () => {
    state = empty()
    persist()
  }

  load()

  root.AuroraStore = {
    upsertContact,
    getContact,
    getContacts,
    deleteContact,
    getMemory,
    setMemory,
    getMessage,
    saveMessage,
    updateMessage,
    getMessages,
    markRead,
    unreadCount,
    lastMessageOf,
    getSetting,
    setSetting,
    botOn,
    reset,
  }
})(window)
