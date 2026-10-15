// js/engine.js — "Servidor" embebido para la demo estática de "Aurora Store".
// Une store (localStorage), flow y bot detrás de un socket compatible con la UI:
// la página sigue haciendo socket.on(...) / socket.emit(...), pero todo ocurre en el navegador.
(function (root) {
  const store = root.AuroraStore
  const flow = root.AuroraFlow
  const seed = root.AuroraSeed

  // ---- Eventos hacia la UI (socket "servidor → cliente") ----
  const handlers = {}
  const fire = (ev, payload) => {
    const list = handlers[ev] || []
    for (const fn of list) {
      try {
        fn(payload)
      } catch (e) {
        console.error('[engine] handler', ev, e)
      }
    }
  }

  // ---- Envío de mensajes (lo que antes hacía whatsapp.js) ----
  // En la demo no hay red: se guarda el mensaje y se avisa a la UI.
  // El bot "piensa y escribe": antes de cada respuesta se avisa a la UI (typing…) y se
  // espera un tiempo proporcional a la longitud del texto, como una persona real.
  const randBetween = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
  const typingDelay = (text) => {
    const base = 700 + String(text || '').length * 22 // ~22 ms por carácter
    return Math.min(3200, Math.max(1100, randBetween(Math.round(base * 0.7), Math.round(base * 1.2))))
  }

  const sendText = async (jid, text, sentBy = 'bot') => {
    if (sentBy === 'bot') {
      fire('typing', { jid, on: true })
      await new Promise((r) => setTimeout(r, typingDelay(text)))
    }
    const row = store.saveMessage({ jid, fromMe: true, sentBy, body: text, status: 'sent' })
    fire('new-message', row)
    fire('contacts-updated', contactsPayload())
    return row
  }

  const ensureLabel = null // las etiquetas de WhatsApp no existen en la demo

  const bot = root.AuroraBot.createBot({ db: store, flow, send: sendText, ensureLabel })

  // Normaliza el jid: cualquier cadena sin '@' se trata como número de WhatsApp.
  const toJid = (jid) => {
    if (typeof jid !== 'string' || !jid.trim()) return null
    const j = jid.trim()
    return j.includes('@') ? j : j + '@c.us'
  }

  const contactsPayload = () =>
    store.getContacts().map((c) => Object.assign({}, c, {
      unread: store.unreadCount(c.jid),
      last: store.lastMessageOf(c.jid),
    }))

  // ---- Estadísticas del panel (agregados sobre la BD local) ----
  const statsPayload = () => {
    const now = Date.now()
    const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }
    const today0 = startOfToday()
    const week0 = today0 - 6 * 86400000

    const all = []
    for (const c of store.getContacts()) all.push.apply(all, store.getMessages(c.jid, 100000))

    const week = all.filter((m) => m.ts >= week0)
    const totals = {
      total: week.length,
      in_total: week.filter((m) => m.from_me === 0).length,
      out_total: week.filter((m) => m.from_me === 1).length,
      bot: week.filter((m) => m.sent_by === 'bot').length,
    }

    const days = Array.from({ length: 7 }, (_, i) => {
      const d0 = today0 - (6 - i) * 86400000
      const key = new Date(d0)
      return {
        label: key.getDate(),
        day: key.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''),
        total: 0,
        in: 0,
        out: 0,
      }
    })
    const hoursAgg = Array.from({ length: 24 }, (_, h) => ({ h, total: 0, in: 0 }))
    for (const m of week) {
      const idx = Math.floor((m.ts - (today0 - 6 * 86400000)) / 86400000)
      if (idx >= 0 && idx < 7) {
        days[idx].total++
        if (m.from_me) days[idx].out++
        else days[idx].in++
      }
      const h = new Date(m.ts).getHours()
      hoursAgg[h].total++
      if (m.from_me === 0) hoursAgg[h].in++
    }

    const statusCount = { flujo: 0, pausa_humano: 0, agendado: 0, en_recordatorio: 0, confirmado: 0, existente: 0, revision: 0 }
    const stepCount = {}
    let apptsTotal = 0
    let apptsToday = 0
    let apptsWeek = 0
    let apptsLate = 0
    let apptsConfirmed = 0
    const contacts = store.getContacts()
    for (const c of contacts) {
      if (c.status in statusCount) statusCount[c.status]++
      if (c.status === 'flujo' && c.step) stepCount[c.step] = (stepCount[c.step] || 0) + 1
      if (c.appointment) {
        apptsTotal++
        const t = new Date(c.appointment).getTime()
        if (t >= today0 && t < today0 + 86400000) apptsToday++
        if (t >= today0 && t < week0 + 7 * 86400000) apptsWeek++
        if (t < now) apptsLate++
        if (c.status === 'confirmado') apptsConfirmed++
      }
    }

    return {
      generatedAt: now,
      contacts: contacts.length,
      messages: {
        total: totals.total || 0,
        in: totals.in_total || 0,
        out: totals.out_total || 0,
        bot: totals.bot || 0,
        human: (totals.out_total || 0) - (totals.bot || 0),
      },
      maxDay: Math.max(1, ...days.map((d) => d.total)),
      days,
      hours: hoursAgg.filter((h) => h.total > 0).sort((a, b) => b.total - a.total).slice(0, 6),
      status: statusCount,
      steps: stepCount,
      appts: {
        total: apptsTotal,
        today: apptsToday,
        week: apptsWeek,
        late: apptsLate,
        confirmed: apptsConfirmed,
        pending: apptsTotal - apptsConfirmed,
      },
    }
  }

  // ---- Recordatorio manual de una cita ----
  const sendReminderTo = (to) => {
    const c = store.getContact(to)
    if (!c || !c.appointment) return { ok: false, error: 'Aún no hay cita asignada. Asigna primero la fecha y hora.' }
    if (c.status === 'confirmado') return { ok: false, error: 'El cliente ya confirmó la cita.' }
    const iso = c.appointment
    const text = flow.messageForStep(6, bot.formatearCita(iso))
    store.upsertContact(to, { reminder_sent: 1, status: 'en_recordatorio', step: 6 })
    sendText(to, text, 'bot')
    return { ok: true }
  }

  // ---- Cola de pasos forzados (evita duplicar envíos seguidos) ----
  const forcing = new Set()

  const reduce = {
    'get-contacts': (payload, cb) => cb && cb(contactsPayload()),
    'get-stats': (payload, cb) => cb && cb(statsPayload()),

    'open-chat': (payload) => {
      const jid = typeof payload === 'string' ? payload : payload && payload.jid
      if (typeof jid !== 'string') return
      store.markRead(jid)
      fire('contacts-updated', contactsPayload())
      fire('read-confirmed', jid)
    },

    'chat-messages': (payload, cb) => {
      const jid = payload && payload.jid ? payload.jid : payload
      cb && cb(typeof jid === 'string' ? store.getMessages(jid, 500) : [])
    },

    send: (payload, cb) => {
      const { jid, body } = payload || {}
      const to = toJid(jid)
      if (!to || typeof body !== 'string' || !body.trim()) {
        cb && cb({ ok: false, error: 'Datos inválidos' })
        return
      }
      store.saveMessage({ jid: to, fromMe: true, sentBy: 'human', body, status: 'sent' })
      fire('new-message', store.lastMessageOf(to))
      const extra = bot.handleHumanSend(to, body) || {}
      fire('contacts-updated', contactsPayload())
      cb && cb(Object.assign({ ok: true }, extra))
    },

    'assign-appointment': (payload, cb) => {
      const { jid, iso } = payload || {}
      const to = toJid(jid)
      const d = new Date(iso)
      if (!to || isNaN(d)) {
        cb && cb({ ok: false, error: 'Fecha inválida' })
        return
      }
      const before = store.getContact(to)
      if (before && before.appointment && new Date(before.appointment).getTime() === d.getTime()) {
        cb && cb({ ok: true, unchanged: true })
        return
      }
      store.upsertContact(to, { appointment: d.toISOString(), reminder_sent: 0 })
      const contact = store.getContact(to)
      if (contact && contact.status === 'pausa_humano') {
        store.upsertContact(to, { step: 5, status: 'agendado' })
        sendText(to, flow.messageForStep(5), 'bot')
      } else if (contact && contact.status !== 'confirmado') {
        sendText(to, flow.messageForStep(9, bot.formatearCita(d)), 'bot')
      }
      fire('contacts-updated', contactsPayload())
      cb && cb({ ok: true })
    },

    'clear-appointment': (payload, cb) => {
      const to = toJid(payload && payload.jid)
      if (!to) return cb && cb({ ok: false, error: 'Contacto inválido' })
      const contact = store.getContact(to)
      if (!contact) return cb && cb({ ok: false, error: 'Contacto no encontrado' })
      store.upsertContact(to, Object.assign({ appointment: null, reminder_sent: 0 }, flow.STEP_STATE[3]))
      fire('contacts-updated', contactsPayload())
      cb && cb({ ok: true })
    },

    'send-reminder': (payload, cb) => {
      const to = toJid(payload && payload.jid)
      if (!to) return cb && cb({ ok: false, error: 'Contacto inválido' })
      const r = sendReminderTo(to)
      fire('contacts-updated', contactsPayload())
      cb && cb(r)
    },

    'force-step': (payload, cb) => {
      const { jid, step } = payload || {}
      const to = toJid(jid)
      if (!to) return cb && cb({ ok: false, error: 'Contacto inválido' })
      const key = String(step)
      const def = flow.FLOW.steps[key]
      if (!def) return cb && cb({ ok: false, error: 'Ese paso no existe en el flujo.' })
      if (forcing.has(to)) return cb && cb({ ok: false, error: 'Ya se está enviando un paso a este chat, espera unos segundos.' })

      const c = store.getContact(to)
      let arg
      if (def.needsAppointment) {
        if (!c || !c.appointment) return cb && cb({ ok: false, error: 'Este paso usa la fecha de la cita y el contacto todavía no tiene cita. Fíjala primero.' })
        arg = bot.formatearCita(c.appointment)
      } else if (key === '2' || key === '3') {
        const mem = store.getMemory(to)
        const fullName = (c && c.name) || ''
        arg = {
          PEDIDO: mem.order || 'tus piezas seleccionadas',
          NOMBRE: fullName.split(' ')[0] || '',
          DIRECCION: mem.address || '(dirección de envío)',
        }
      }
      const text = flow.messageForStep(Number.isNaN(Number(key)) ? key : Number(key), arg)
      if (!text) return cb && cb({ ok: false, error: 'Ese paso no tiene mensaje para enviar.' })

      forcing.add(to)
      Promise.resolve(sendText(to, text, 'bot'))
        .then(() => {
          if (flow.STEP_STATE[key]) store.upsertContact(to, flow.STEP_STATE[key])
          fire('contacts-updated', contactsPayload())
        })
        .finally(() => forcing.delete(to))
      cb && cb({ ok: true, info: `Paso ${key} en cola: saldrá en unos segundos.` })
    },

    'toggle-bot': (on) => {
      store.setSetting('bot_on', on ? '1' : '0')
      if (on) bot.applyGreetingCutoff()
      fire('settings-updated', { bot_on: store.botOn() })
      fire('contacts-updated', contactsPayload())
    },

    'review-decision': (payload, cb) => {
      const { jid, decision } = payload || {}
      const to = toJid(jid)
      if (!to || !['start', 'archive'].includes(decision)) return cb && cb({ ok: false, error: 'Datos inválidos' })
      const c = store.getContact(to)
      if (!c || c.status !== 'revision') return cb && cb({ ok: false, error: 'Este contacto ya no está en la cola de revisión.' })
      if (decision === 'archive') {
        store.upsertContact(to, { step: 0, status: 'existente' })
      } else {
        store.upsertContact(to, { step: 1, status: 'flujo' })
        sendText(to, flow.messageForStep(1), 'bot')
      }
      fire('contacts-updated', contactsPayload())
      cb && cb({ ok: true })
    },

    simulate: (payload, cb) => {
      const { jid, body, name } = payload || {}
      if (typeof body !== 'string') return cb && cb({ ok: false, error: 'Mensaje inválido' })
      const to = jid && jid.endsWith('@c.us') ? jid : 'test@c.us'
      const cur = store.getContact(to)
      if (!cur) store.upsertContact(to, { name: name || 'Cliente de prueba', step: 1, status: 'flujo', phone: to.split('@')[0] })
      else if (name && !cur.name) store.upsertContact(to, { name })
      const row = store.saveMessage({ jid: to, fromMe: false, sentBy: 'client', body, status: 'sent' })
      fire('new-message', row)
      Promise.resolve(bot.handleIncoming(to, body)).then(() => fire('contacts-updated', contactsPayload()))
      cb && cb({ ok: true })
    },

    'reset-conversation': (payload, cb) => {
      const to = payload && payload.jid && payload.jid.endsWith('@c.us') ? payload.jid : 'test@c.us'
      store.deleteContact(to)
      fire('contacts-updated', contactsPayload())
      cb && cb({ ok: true })
    },

    'reset-demo': (payload, cb) => {
      try {
        seed.resetDemo()
        fire('settings-updated', { bot_on: store.botOn() })
        fire('contacts-updated', contactsPayload())
        cb && cb({ ok: true })
      } catch (err) {
        console.error('[seed] reset-demo falló:', err)
        cb && cb({ ok: false, error: 'No se pudo reiniciar la demo' })
      }
    },
  }

  // ---- Socket embebido (misma API que usaba socket.io en la UI) ----
  const socket = {
    on(ev, fn) {
      ;(handlers[ev] = handlers[ev] || []).push(fn)
      return socket
    },
    off(ev, fn) {
      handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn)
      return socket
    },
    emit(ev, a, b) {
      let payload
      let cb
      if (typeof a === 'function') cb = a
      else {
        payload = a
        cb = b
      }
      const fn = reduce[ev]
      if (fn) {
        try {
          fn(payload, cb)
        } catch (e) {
          console.error('[engine]', ev, e)
          cb && cb({ ok: false, error: 'Error interno de la demo' })
        }
      }
      return socket
    },
  }

  // Siembra inicial y arranque diferido (para que la UI registre sus .on primero).
  try {
    seed.seedIfEmpty()
  } catch (e) {
    console.error('[engine] seed:', e)
  }

  setTimeout(() => {
    fire('connect')
    fire('bootstrap', {
      simulator: true,
      settings: { bot_on: store.botOn() },
      flow: {
        steps: Object.fromEntries(
          Object.entries(flow.FLOW.steps).map(([k, v]) => [k, { label: v.label, text: v.text || v.template, needsAppointment: !!v.needsAppointment }])
        ),
        faq: flow.FAQ,
        stepNames: flow.FLOW.stepNames,
        confirmReply: flow.CONFIRM_REPLY,
      },
    })
    fire('wa-status', { state: 'ready' })
    fire('contacts-updated', contactsPayload())
  }, 0)

  root.AuroraEngine = { socket }
})(window)
