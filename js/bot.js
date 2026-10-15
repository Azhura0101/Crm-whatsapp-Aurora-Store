// js/bot.js — Cerebro conversacional de la demo de "Aurora Store".
// Puerto fiel del antiguo bot.js (Node) a un módulo de navegador con inyección de
// dependencias: createBot({ db, flow, send, ensureLabel }). No accede a la red; los
// envíos y las etiquetas llegan como funciones desde el engine (o son no-op en la demo).
(function (root) {
  function createBot({ db, flow, send = () => Promise.resolve(null), ensureLabel = null }) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

    // El flujo ya no pide el teléfono: se toma del propio chat (el número de WhatsApp del cliente).
    const phoneFromJid = (jid) => String(jid || '').split('@')[0]

    // ¿Ya se le escribió antes a este contacto? Sirve para no repetir el primer mensaje.
    const alreadyGreeted = (jid) => (db.getMessages(jid, 500) || []).some((r) => r.from_me && r.sent_by === 'bot')

    // No repetir la misma respuesta al mismo contacto si se la acabas de mandar (90 s).
    const justSentSame = (jid, text, ms = 90000) => {
      const from = Date.now() - ms
      return (db.getMessages(jid, 100) || []).some(
        (r) => r.from_me && r.sent_by === 'bot' && r.ts >= from && r.body === text
      )
    }
    const botReply = async (jid, text) => {
      if (justSentSame(jid, text)) return
      await send(jid, text, 'bot')
    }

    const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    const DAYS_SEARCH = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] // sin tildes: el texto se normaliza
    const DAY_INDEX = { domingo: 0, lunes: 1, martes: 2, 'miercoles': 3, 'miércoles': 3, jueves: 4, viernes: 5, 'sábado': 6, sabado: 6 }
    const MONTHS_INDEX = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 }
    const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

    const isQuestion = (text) => {
      const t = normalize(text.toLowerCase().trim())
      return /\?|¿/.test(t) || /(qué|que tipo|cuál|cual|cuáles|cuales|cómo|como|cuándo|cuando|dónde|donde|por qué|por que|porque|cuesta|costaría|funciona|puedo|tengo que|hay que|es gratis)/.test(t)
    }

    const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    const STOP = ['mi', 'mis', 'es', 'y', 'el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'nombre', 'numero', 'telefono', 'celular', 'contacto', 'completo', 'soy', 'que', 'se', 'llama', 'llamo', 'me', 'te', 'hola', 'buenas', 'buenos', 'buen', 'dia', 'dias', 'listo', 'ok', 'okey', 'holi', 'por', 'favor', 'aqui', 'aqui', 'allá']

    // Limpia texto y deja un "nombre" plausible (sin números, sin muletillas).
    const cleanName = (text) => {
      let name = text
        .replace(/3\d[\d\s.\-()]{8,}/g, ' ')
        .replace(/\b(n[úu]mero|tel[ée]fono|celular|contacto|nombre|completo|datos)\b[\s:]*/gi, ' ')
        .replace(/\bmi\b\s*\b(nombre|numero|telefono|celular|numero|datos)\b/gi, ' ')
        .replace(/\d/g, ' ')
        .replace(/[.,;:()"+*#@]/g, ' ')
        .split(/\s+/)
        .filter((w) => w && w.length > 1 && !STOP.includes(normalize(w.toLowerCase())))
        .join(' ')
        .trim()

      if (name.length < 2) {
        const m = text.match(/[A-Za-zÁÉÍÓÚáéíóúÑñü][A-Za-zÁÉÍÓÚáéíóúÑñü .'-]{2,}/)
        if (m) {
          name = m[0]
            .replace(/3\d[\d\s.\-()]{8,}/g, ' ')
            .replace(/\d/g, ' ')
            .split(/\s+/)
            .filter((w) => w && !STOP.includes(normalize(w.toLowerCase())))
            .join(' ')
            .trim()
        }
      }
      if (name.length < 2) return null
      return name
    }

    // Teléfono colombiano (3 + 9 dígitos) sin importar cómo venga escrito.
    const extractPhone = (text) => {
      const raw = String(text || '')
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] !== '3') continue
        let digits = '3'
        for (let j = i + 1; j < raw.length; j++) {
          const ch = raw[j]
          if (/\d/.test(ch)) digits += ch
          else if (/[\s().]|-/.test(ch)) continue
          else break // letra u otro carácter: aquí termina el bloque
        }
        if (/^3\d{9}$/.test(digits)) return digits
      }
      return null
    }

    const parseContact = (text) => {
      const phone = extractPhone(text)
      const name = cleanName(text)
      if (!phone || !name) return null
      return { name, phone }
    }

    // ¿El nombre es plausible como nombre (no dirección)?
    const ADDR_KW = /(calle|cll|cra|carrera|kr|avenida|av\b|diagonal|dg|transversal|tr\b|manzana|mz|torre|bloque|apto|apartamento|aparta|interior|int\b|casa|vereda|conjunto|urbanizaci|barrio|sector|etapa|localidad|municipio|km|n[°º]|#)/
    const looksAddress = (s) => {
      const t = normalize(String(s || '').toLowerCase())
      return ADDR_KW.test(t) || /\d/.test(t)
    }
    const isNameish = (s) => !!s && !looksAddress(s) && /[a-záéíóúñ]/i.test(s)

    // "Ana Pérez, Calle 10 #25-30, barrio Centro, Medellín"
    //   -> { name: 'Ana Pérez', address: 'Calle 10 #25-30, barrio Centro, Medellín' }
    const parseNameAddress = (text) => {
      const raw = String(text || '').trim()
      if (!raw) return null
      const parts = raw.split(/[,\n;]+/).map((p) => p.trim()).filter(Boolean)
      let name = null
      let address = null
      if (parts.length >= 2) {
        const cand = cleanName(parts[0])
        if (cand && isNameish(cand)) {
          name = cand
          address = parts.slice(1).join(', ')
        } else {
          address = parts.join(', ')
        }
      } else {
        name = cleanName(raw)
        if (name && !isNameish(name)) name = null
        if (looksAddress(raw)) {
          if (name) {
            const at = raw.toLowerCase().indexOf(name.toLowerCase())
            const rest = raw.slice(at + name.length).replace(/^[\s,;.-]+/, '')
            address = rest || null
          } else {
            address = raw
          }
        }
      }
      if (!name && !address) return null
      return { name: name || null, address: address || null }
    }

    const nextDateWithTime = (date, hour, min) => {
      const d = new Date(date)
      d.setHours(hour, min, 0, 0)
      return d
    }

    const parseCita = (text) => {
      const lower = normalize(text.toLowerCase())

      let hour = null
      let min = 0
      const timeMatch =
        lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.\s*m|p\.\s*m|de la mañana|de la tarde|de la noche)/) ||
        lower.match(/(?:a las|las)\s+(\d{1,2})(?::(\d{2}))?/)
      if (timeMatch || /(\d{1,2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)/.test(lower)) {
        const m = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?\s*m\.?|p\.?\s*m\.?|de la mañana|de la tarde|de la noche)/) || lower.match(/(?:a las|las)\s+(\d{1,2})(?::(\d{2}))?/)
        if (m) {
          hour = parseInt(m[1], 10)
          min = m[2] ? parseInt(m[2], 10) : 0
          const period = m[3]
          if (period === 'pm' || period === 'p.m' || period === 'p. m' || period === 'de la tarde' || period === 'de la noche') {
            if (hour < 12) hour += 12
          }
          if ((period === 'am' || period === 'a.m') && hour === 12) hour = 0
          if (!period && hour < 12 && /(por|en)\s+la\s+(tarde|noche)/.test(lower)) hour += 12
          if (hour > 23 || min > 59) hour = null
        }
      }

      let date = null
      if (/\bpasado\s*manana\b/.test(lower)) {
        date = new Date(Date.now() + 2 * 86400000)
      } else if (/\bhoy\b/.test(lower)) {
        date = new Date()
      } else if (/(?<!de la )(?<!por la )(?<!en la )\bmanana\b/.test(lower)) {
        date = new Date(Date.now() + 86400000)
      }

      const numeric = lower.match(/(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?/)
      if (!date && numeric) {
        const day = parseInt(numeric[1], 10)
        const month = parseInt(numeric[2], 10) - 1
        let year = numeric[3] ? parseInt(numeric[3], 10) : new Date().getFullYear()
        if (year < 100) year += 2000
        const d = new Date(year, month, day)
        if (!isNaN(d)) {
          if (d < new Date()) d.setFullYear(d.getFullYear() + 1)
          date = d
        }
      }

      const monthWord = lower.match(/(\d{1,2})\s*(?:de|del)\s+([a-záéíóúñ]+)(?:\s*de\s*(\d{2,4}))?/)
      if (!date && monthWord) {
        const day = parseInt(monthWord[1], 10)
        const mon = MONTHS_INDEX[normalize(monthWord[2].toLowerCase())]
        if (mon !== undefined) {
          let year = monthWord[3] ? parseInt(monthWord[3], 10) : new Date().getFullYear()
          if (year < 100) year += 2000
          const d = new Date(year, mon, day)
          if (!isNaN(d)) {
            if (d < new Date()) d.setFullYear(d.getFullYear() + 1)
            date = d
          }
        }
      }

      if (!date) {
        const wd = DAYS_SEARCH.find((day) => new RegExp(`\\b${day}\\b`).test(lower))
        if (wd) {
          const target = DAY_INDEX[wd]
          const d = new Date()
          const diff = (target - d.getDay() + 7) % 7 || 7
          date = new Date(Date.now() + diff * 86400000)
        }
      }

      // "el 25" (solo el día del mes): el próximo día 25, saltando al mes siguiente si ya pasó
      if (!date) {
        const bare = lower.match(/\bel\s+(\d{1,2})\b/)
        if (bare) {
          const day = parseInt(bare[1], 10)
          if (day >= 1 && day <= 31) {
            const d = new Date()
            d.setDate(day)
            if (d < Date.now()) d.setMonth(d.getMonth() + 1)
            date = d
          }
        }
      }

      if (!date) return null

      const hasTime = hour !== null // false si solo se mencionó el día ("el martes 22")
      if (hour === null) hour = 12
      const result = nextDateWithTime(date, hour, min)
      if (isNaN(result)) return null
      return { date: result, iso: result.toISOString(), text: formatearCita(result), hasTime }
    }

    const formatearCita = (d) => {
      if (!(d instanceof Date) || isNaN(d)) d = new Date(d)
      const h24 = d.getHours()
      const h12 = h24 % 12 || 12
      const mm = String(d.getMinutes()).padStart(2, '0')
      const suf = h24 >= 12 ? 'p. m.' : 'a. m.'
      return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()} a las ${h12}:${mm} ${suf}`
    }

    const greetingOnly = (text) => {
      const t = normalize(String(text || '').toLowerCase().trim())
      if (!t) return false
      return /^(hola+|buenas+|buenos d[ií]as?|buenas tardes?|buenas noches?|hey+|holi+|qu[eé] tal|c[oó]mo est[aá]s?|saludos|buen d[ií]a)[\s!.,]*$/i.test(t)
    }

    const hasContent = (text) => normalize(String(text || '')).replace(/[^a-z0-9]/g, '').length >= 2

    // "hacer un pedido", "quiero pedir", "continuar", "comprar"… sin producto concreto.
    const GENERIC_ORDER = /^(hacer\s+|quiero\s+hacer\s+)?(un\s+|una\s+)?(pedido|pedir|comprar|compra|orden|continuar|seguir|informaci[oó]n|info)\.?$/i

    const orderFromText = (text) => {
      let s = String(text || '').trim()
      s = s.replace(/^(hola+|buenas+|buenos d[ií]as?|hey+|holi+)[\s,.:!]*/i, '')
      s = s.replace(/^(quisiera|quiero|quer[ií]a|me gustar[ií]a|me interesa|necesito|busco|dame|me llevo|deseo|pedir|comprar)\s+/i, '')
      s = s.replace(/^(un|una|unos|unas)\s+/i, '')
      s = s.replace(/[.!]+$/, '').trim()
      if (!s || GENERIC_ORDER.test(s)) return null
      return s.charAt(0).toUpperCase() + s.slice(1)
    }

    const faqAnchor = async (jid, step, text) => {
      const mem = db.getMemory(jid)
      // Objeción "no tengo los $100 mil": prioridad sobre cualquier FAQ genérica de pago/garantía.
      if (flow.matchNoMoney(text)) {
        await botReply(jid, flow.NO_MONEY_REPLY)
        db.setMemory(jid, { lastTopic: 'respaldo', lastAnswerAt: Date.now() })
        return true
      }
      // El tema previo de la conversación desempata si dos temas encajan igual.
      let item = flow.matchFaq(text, mem.lastTopic)
      let prefix = null
      if (item) {
        prefix = item.answer
        db.setMemory(jid, { lastTopic: item.topic, lastAnswerAt: Date.now() })
      } else if (isQuestion(text)) {
        prefix = flow.NO_KB_REPLY
      } else {
        return false
      }
      await botReply(jid, prefix)
      // Con contexto no se insiste: el ancla del paso se repite como máximo 2 veces (o 1 vez cada 30 min).
      const anchor = flow.anchorForStep(step)
      if (anchor && anchor !== prefix) {
        const now = Date.now()
        const fresh = mem.anchorOfStep === step && now - (mem.anchorAt || 0) < 30 * 60000
        const n = fresh ? (mem.anchorN || 0) : 0
        if (n < 2) {
          await botReply(jid, anchor)
          db.setMemory(jid, { anchorOfStep: step, anchorAt: now, anchorN: n + 1 })
        }
      }
      return true
    }

    // ---- Línea de corte al reactivar el bot ----
    const applyGreetingCutoff = (now = Date.now()) => {
      const GRACE_MS = 30000 // margen: no corta un mensaje que se está escribiendo justo ahora
      let n = 0
      for (const c of db.getContacts()) {
        if (c.status !== 'flujo' || Number(c.step) !== 1) continue
        const everBot = (db.getMessages(c.jid, 500) || []).some((r) => r.from_me && r.sent_by === 'bot')
        if (everBot) continue
        const last = db.lastMessageOf(c.jid)
        if (!last) continue
        // Humano del panel que contestó mientras el bot estaba apagado, o silencio durante la espera.
        const human = last.from_me && last.sent_by === 'human'
        if (human || now - last.ts > GRACE_MS) {
          db.upsertContact(c.jid, { step: 1, status: 'revision' })
          n++
        }
      }
      return n
    }

    const processIncoming = async (jid, text, force = false) => {
      let contact = db.getContact(jid)
      if (!contact) contact = db.upsertContact(jid, { step: 1, status: 'flujo', phone: phoneFromJid(jid) })

      if (!(flow && db)) return
      if (!db.getSetting) return
      if (db.getSetting('bot_on') !== '1') return
      if (contact.status === 'existente') return
      if (contact.status === 'revision') {
        // Llegó con el bot apagado y espera en la cola de revisión: solo "continuar" lo reactiva
        // y lo lleva al paso 2.
        if (flow.matchContinuar(text)) {
          const order = orderFromText(text) || 'tus piezas seleccionadas'
          db.upsertContact(jid, Object.assign({}, flow.STEP_STATE[2]))
          db.setMemory(jid, { order, dataRequests: 0, anchorN: 0, lastTopic: null })
          await sleep(900)
          await botReply(jid, flow.messageForStep(2, { PEDIDO: order }))
        }
        return
      }

      if (['pausa_humano', 'agendado', 'confirmado'].includes(contact.status)) return

      if (Number(contact.step) === 1) {
        // Preguntas (precio, envío, materiales…) se responden y el bot sigue esperando el pedido.
        const isGreeting = greetingOnly(text)
        const wantsOrder = hasContent(text) && !isGreeting && !isQuestion(text)

        if (wantsOrder || flow.matchContinuar(text)) {
          const order = orderFromText(text) || 'tus piezas seleccionadas'
          db.upsertContact(jid, Object.assign({}, flow.STEP_STATE[2]))
          db.setMemory(jid, { order, dataRequests: 0, anchorN: 0, lastTopic: null })
          await sleep(900)
          await botReply(jid, flow.messageForStep(2, { PEDIDO: order }))
          return
        }
        const answered = await faqAnchor(jid, 1, text)
        if (!answered) {
          if (!alreadyGreeted(jid)) await botReply(jid, flow.messageForStep(1))
        }
        return
      }

      if (Number(contact.step) === 2) {
        const parsed = parseNameAddress(text) || {}
        const mem = db.getMemory(jid)
        const name = parsed.name || contact.pname || ''
        const address = parsed.address || mem.address || ''
        if (name && address) {
          db.upsertContact(jid, { pname: name, pphone: phoneFromJid(jid), step: 3, status: 'flujo' })
          db.setMemory(jid, { address, order: mem.order, dataRequests: 0, anchorN: 0, lastTopic: null })
          await sleep(900)
          await botReply(jid, flow.messageForStep(3, {
            NOMBRE: name.split(' ')[0],
            PEDIDO: mem.order || '',
            DIRECCION: address,
          }))
          return
        }
        if (parsed.name) db.upsertContact(jid, { pname: parsed.name })
        if (parsed.address) db.setMemory(jid, { address: parsed.address })

        if (name && !address) {
          await botReply(jid, flow.ASK_ADDRESS_ONLY(name.split(' ')[0]))
        } else if (address && !name) {
          await botReply(jid, flow.ASK_NAME_ONLY)
        } else {
          const answered = await faqAnchor(jid, 2, text)
          if (!answered) {
            if ((mem.dataRequests || 0) >= 2) await botReply(jid, flow.DATA_REMINDER)
            else {
              await botReply(jid, flow.anchorForStep(2))
              db.setMemory(jid, { dataRequests: (mem.dataRequests || 0) + 1 })
            }
          }
        }
        return
      }

      if (Number(contact.step) === 3) {
        if (flow.matchAffirmative(text)) {
          db.upsertContact(jid, Object.assign({}, flow.STEP_STATE[4]))
          db.setMemory(jid, { dataRequests: 0, anchorN: 0, lastTopic: null })
          if (ensureLabel) {
            try {
              await ensureLabel(jid, 'Seguimiento')
            } catch (e) { /* la etiqueta es opcional */ }
          }
          await sleep(900)
          await botReply(jid, flow.messageForStep(4))
        } else {
          const answered = await faqAnchor(jid, 3, text)
          if (!answered) await botReply(jid, flow.anchorForStep(3))
        }
        return
      }

      if (Number(contact.step) === 6) {
        if (flow.matchConfirmo(text)) {
          db.upsertContact(jid, { status: 'confirmado', reminder_sent: 1 })
          await botReply(jid, flow.CONFIRM_REPLY)
          return
        }
        await botReply(jid, flow.anchorForStep(6))
        return
      }
    }

    const handleIncoming = async (jid, text, force = false) => {
      try {
        return await processIncoming(jid, text, force)
      } catch (e) {
        console.error('[bot] handleIncoming:', e)
      }
    }

    const handleHumanSend = async (jid, text) => {
      let contact = db.getContact(jid)
      if (!contact) contact = db.upsertContact(jid, { step: 1, status: 'flujo', phone: phoneFromJid(jid) })
      if (contact.status === 'existente') return {}

      const extra = {}
      if (contact.status === 'flujo' || contact.status === 'pausa_humano') {
        const c = db.getContact(jid)
        if (c && c.step >= 3) db.upsertContact(jid, { status: 'agendado' })
      }
      return extra
    }

    return {
      handleIncoming,
      handleHumanSend,
      parseCita,
      formatearCita,
      parseContact,
      parseNameAddress,
      orderFromText,
      looksAddress,
      phoneFromJid,
      isQuestion,
      greetingOnly,
      applyGreetingCutoff,
    }
  }

  root.AuroraBot = { createBot }
})(window)
