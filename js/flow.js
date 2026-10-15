// js/flow.js — Definición del flujo conversacional de "Aurora Store" (demo).
// Módulo de navegador: expone todo como window.AuroraFlow.
// Es la fuente única de los textos y del encaje de preguntas (FAQ).
(function (root) {
  const FLOW = {
    steps: {
      1: {
        label: 'Paso 1 · Bienvenida',
        text:
          '¡Hola! 👋 Soy Sofía, de Aurora Store.\n\n' +
          'Hacemos accesorios artesanales y piezas hechas a mano, con envío a todo el país. 🛍️\n\n' +
          'Este es nuestro catálogo:\n' +
          '• Pulseras tejidas — $25.000\n' +
          '• Collares con piedra — $45.000\n' +
          '• Aretes artesanales — $18.000\n' +
          '• Combos para regalo — desde $60.000\n\n' +
          'Cuéntame: ¿qué te gustaría pedir? Dime el o los productos que quieres y armamos tu pedido juntos. ✨',
        anchor:
          '¿Qué te gustaría pedir? Elige del catálogo y con gusto te armo el pedido. 😊',
      },
      2: {
        label: 'Paso 2 · Datos de envío',
        template:
          '¡Muy buena elección! 🎉\n\n' +
          'Ya anoté tu pedido:\n' +
          '🛍️ {PEDIDO}\n\n' +
          'Para dejarlo a tu nombre y coordinar la entrega, envíame en un solo mensaje:\n' +
          '1. Tu nombre completo\n' +
          '2. Tu dirección de envío con la ciudad\n\n' +
          'Sepáralos con una coma. Ejemplo:\n' +
          'Ana Pérez, Calle 10 #25-30, barrio Centro, Medellín',
        text:
          '¡Muy buena elección! 🎉\n\n' +
          'Ya anoté tu pedido:\n' +
          '🛍️ Pulsera tejida y aretes artesanales\n\n' +
          'Para dejarlo a tu nombre y coordinar la entrega, envíame en un solo mensaje:\n' +
          '1. Tu nombre completo\n' +
          '2. Tu dirección de envío con la ciudad\n\n' +
          'Sepáralos con una coma. Ejemplo:\n' +
          'Ana Pérez, Calle 10 #25-30, barrio Centro, Medellín',
        anchor:
          'Cuando puedas, envíame tu nombre completo y tu dirección de envío (con la ciudad) en un solo mensaje y te dejo el pedido listo. 😊',
      },
      3: {
        label: 'Paso 3 · Confirmación del pedido',
        template:
          '¡Gracias, {NOMBRE}! ✨ Este es el resumen de tu pedido:\n\n' +
          '🛍️ {PEDIDO}\n' +
          '📍 Envío a: {DIRECCION}\n\n' +
          '💳 Para apartar tus piezas pedimos un anticipo del 30% y el saldo lo pagas contra entrega, al recibir el paquete.\n' +
          '📦 En el Área Metropolitana entregamos el mismo día; a otras ciudades llega en 2 a 4 días hábiles.\n\n' +
          '¿Confirmas tu pedido? Responde SÍ y un asesor lo revisa para coordinar el pago y la entrega. 😊',
        text:
          '¡Gracias, Ana! ✨ Este es el resumen de tu pedido:\n\n' +
          '🛍️ Pulsera tejida y aretes artesanales\n' +
          '📍 Envío a: Calle 10 #25-30, barrio Centro, Medellín\n\n' +
          '💳 Para apartar tus piezas pedimos un anticipo del 30% y el saldo lo pagas contra entrega, al recibir el paquete.\n' +
          '📦 En el Área Metropolitana entregamos el mismo día; a otras ciudades llega en 2 a 4 días hábiles.\n\n' +
          '¿Confirmas tu pedido? Responde SÍ y un asesor lo revisa para coordinar el pago y la entrega. 😊',
        anchor:
          '¿Confirmas tu pedido? Responde SÍ para continuar y un asesor te contacta por aquí. 😊',
      },
      4: {
        label: 'Paso 4 · Atención humana',
        text:
          '¡Pedido registrado! 🎉 Un asesor de Aurora Store ya está revisando la disponibilidad de tus piezas. ' +
          'Te escribirá por este mismo chat para confirmar el valor, el anticipo y la fecha de entrega. En un momento te contacta. 🛍️✨',
      },
      5: {
        label: 'Paso 5 · Entrega',
        text:
          '📍 ENTREGA DE TU PEDIDO – AURORA STORE\n\n' +
          '¡Tus piezas ya están apartadas! 🎉 Estas son las formas de recibirlas:\n\n' +
          '🚚 Envío a domicilio: despachamos con guía de rastreo y te la compartimos por este medio.\n' +
          '🏬 Punto de retiro: Calle 10 #25-30, Local 3 (ficticio). Al llegar, pregunta por la asesora Sofía.\n\n' +
          '⏰ Horario de atención:\n' +
          'Lunes a sábado, de 9:00 a. m. a 7:00 p. m.\n\n' +
          'Te avisaremos el día anterior a la entrega con un recordatorio. ¡Gracias por tu compra! 🛍️✨',
      },
      6: {
        label: 'Paso 6 · Recordatorio de entrega',
        needsAppointment: true,
        template:
          '¡Hola! 🌟 Te recordamos que tu pedido de Aurora Store tiene entrega programada para el {FECHA_HORA}.\n\n' +
          'Antes de ese día, ten en cuenta:\n\n' +
          '📦 Revisa tu dirección de envío para que la transportadora no tenga problemas al entregar.\n' +
          '💳 Ten listo el saldo: el 70% restante se paga contra entrega (en efectivo o por transferencia).\n' +
          '⏰ Que alguien pueda recibir el pedido a la hora acordada.\n\n' +
          '⚠️ Para mantener tu pedido apartado, responde ÚNICAMENTE con la palabra CONFIRMO y validamos el despacho. Si no recibimos tu confirmación, liberaremos las piezas para otra persona.\n\n' +
          '¡Gracias por elegir Aurora Store! 🛍️',
        text:
          'Recordatorio: tu pedido tiene entrega programada para el {FECHA_HORA}. Te pediremos confirmar con la palabra CONFIRMO para mantener tus piezas apartadas. 🛍️',
      },
      9: {
        label: 'Paso 9 · Pedido agendado',
        needsAppointment: true,
        template:
          '📦 ¡Tu pedido quedó agendado!\n\n' +
          'Programamos la entrega para el {FECHA_HORA}.\n\n' +
          'Por este medio te enviaremos las indicaciones de envío o retiro, y un recordatorio el día anterior. ' +
          'Si necesitas cambiar la fecha o algo del pedido, escríbenos por aquí. ¡Gracias por elegir Aurora Store! 🛍️✨',
        text:
          'Aviso de pedido agendado: la entrega quedó programada para el {FECHA_HORA}, con recordatorio el día anterior. 🛍️✨',
      },
    },
    stepNames: ['—', 'Bienvenida', 'Datos de envío', 'Confirmación', 'Atención humana', 'Entrega', 'Recordatorio'],
  }

  const CONFIRM_REPLY =
    '¡Perfecto! ✅ Tu pedido quedó confirmado para despacho. Un asesor coordinará contigo la entrega. ¡Gracias por elegir Aurora Store! 🛍️✨'

  const NO_KB_REPLY =
    '¡Buena pregunta! Con gusto te la resuelve un asesor cuando confirmes tu pedido. Mientras tanto, ¿seguimos armándolo? 😊'

  // Re-aviso por silencio en la confirmación (paso 3): si la persona deja de responder,
  // el sistema le recuerda una vez.
  const STEP3_NUDGE =
    'Hola, ¿seguimos con tu pedido? Aún te tengo las piezas apartadas. 😊\n' +
    'Si tienes alguna duda sobre el anticipo o el envío, escríbeme y te la resuelvo.\n' +
    'Responde SÍ para confirmar tu pedido.'

  // Cómo queda la ficha del contacto al avanzar a cada paso (o al forzarlo desde el panel).
  const STEP_STATE = {
    1: { step: 1, status: 'flujo' },
    2: { step: 2, status: 'flujo' },
    3: { step: 3, status: 'flujo' },
    4: { step: 4, status: 'pausa_humano' },
    5: { step: 5, status: 'agendado' },
    6: { step: 6, status: 'en_recordatorio', reminder_sent: 1 },
  }

  const NO_MONEY_REPLY =
    'Te entiendo. 🙏 El anticipo del 30% se usa para apartar tus piezas y cubrir la preparación y el despacho del pedido.\n\n' +
    'Queremos que compres con calma: seguimos apartando tus piezas y coordinamos el pago cuando puedas, o un asesor te cuenta las alternativas por este mismo medio.\n\n' +
    'Nuestro objetivo es que compres con total tranquilidad y transparencia. ¡Que tengas un lindo día! ✨'

  const ASK_ADDRESS_ONLY = (name) =>
    `¡Gracias, ${name}! 😊 ¿A qué dirección te enviamos el pedido? Incluye ciudad, barrio y dirección.`
  const ASK_NAME_ONLY = '¡Perfecto! 🚚 ¿A nombre de quién registramos el pedido?'
  const DATA_REMINDER =
    'Quedo atenta 😊: envíame tu nombre completo y tu dirección de envío (con la ciudad) en un solo mensaje y dejo tu pedido listo.'

  const N = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  // Requiere DOS señales para no robarse otros temas ("no tengo experiencia", "no tengo tiempo").
  const matchNoMoney = (text) => {
    const t = N(String(text || ''))
    const lacker = /no (tengo|tengo con que|tengo con qué|cuento con|me alcanza|consigo|dispongo de|puedo pagar)/
    const moneyish = /(plata|dinero|anticipo|abono|seña|senas|deposito|depósito|respaldo|garant|cuota|pag|transferencia|efectivo)/
    return lacker.test(t) && moneyish.test(t)
  }

  const FAQ = [
    {
      topic: 'producto',
      keywords: ['producto', 'productos', 'venden', 'vende', 'pulsera', 'pulseras', 'collar', 'collares', 'arete', 'aretes', 'accesorio', 'accesorios', 'joyeria', 'bisuteria', 'pieza', 'piezas', 'que tienen', 'catalogo'],
      answer: 'En Aurora Store hacemos accesorios artesanales: pulseras tejidas, collares con piedra, aretes y combos para regalo. Todo hecho a mano y con envío a todo el país. Cuéntame qué te gustaría pedir y lo armamos. 🛍️',
    },
    {
      topic: 'precio',
      keywords: ['precio', 'precios', 'cuesta', 'cuestan', 'vale', 'valen', 'cuanto cuesta', 'cuanto vale', 'valor', 'cuanto sale', 'costaria'],
      answer: 'Las pulseras están desde $25.000, los aretes desde $18.000, los collares desde $45.000 y los combos de regalo desde $60.000. Dime qué te gusta y te armo el total con el envío.',
    },
    {
      topic: 'pago',
      keywords: ['pagar', 'pago', 'anticipo', 'abono', 'seña', 'cuenta', 'consignar', 'transferencia', 'nequi', 'daviplata', 'efectivo', 'contra entrega', 'forma de pago', 'como pago', 'medios de pago'],
      answer: 'Para apartar tu pedido pedimos un anticipo del 30%; el 70% restante lo pagas contra entrega, en efectivo o por transferencia. Todo queda registrado por este mismo medio.',
    },
    {
      topic: 'envio',
      keywords: ['envio', 'envios', 'domicilio', 'enviar', 'despacho', 'transportadora', 'guia', 'todo el pais', 'fuera de la ciudad'],
      answer: 'Hacemos envíos a todo el país con guía de rastreo. En el Área Metropolitana entregamos el mismo día; a otras ciudades el pedido llega en 2 a 4 días hábiles.',
    },
    {
      topic: 'tiempo',
      keywords: ['demora', 'tiempo de entrega', 'cuanto tarda', 'cuando llega', 'cuanto demora', 'dias', 'cuanto tiempo', 'llega'],
      answer: 'En el Área Metropolitana la entrega es el mismo día; a otras ciudades llega en 2 a 4 días hábiles después del despacho. Te compartimos la guía de rastreo.',
    },
    {
      topic: 'personalizado',
      keywords: ['personalizado', 'personalizada', 'grabado', 'a medida', 'con nombre', 'inicial', 'especial'],
      answer: '¡Sí! Hacemos piezas personalizadas con nombre o inicial. Cuéntame tu idea y te decimos disponibilidad y valor; suelen tardar un día adicional de preparación.',
    },
    {
      topic: 'promociones',
      keywords: ['promo', 'promocion', 'promociones', 'descuento', 'descuentos', 'oferta', 'ofertas', 'combo', 'combos', '2x1'],
      answer: 'Tenemos combos para regalo desde $60.000 y descuentos por compras de varias piezas. Escríbeme qué te interesa y te armo la mejor opción.',
    },
    {
      topic: 'catalogo',
      keywords: ['instagram', 'redes', 'catalogo', 'fotos', 'muestras', 'modelos', 'disenos', 'ver el trabajo', 'pagina'],
      answer: 'Puedes ver todo nuestro catálogo y novedades en nuestras redes: @AuroraStore (ficticio). Con gusto te ayudo a elegir tus piezas.',
    },
    {
      topic: 'stock',
      keywords: ['disponible', 'disponibles', 'disponibilidad', 'stock', 'hay', 'tienen', 'queda', 'quedan'],
      answer: 'Manejamos piezas hechas a mano, varias por diseño. Cuéntame qué te gustó y te confirmo disponibilidad de inmediato; si está agotada, te la fabricamos.',
    },
    {
      topic: 'comprar',
      keywords: ['como compro', 'como comprar', 'como pido', 'como pedir', 'hacer un pedido', 'quiero comprar', 'quiero pedir', 'como aparto', 'apartar'],
      answer: 'Comprar es muy fácil: elige tus productos y envíame tu nombre completo y tu dirección de envío. Un asesor te confirma el total y coordina la entrega.',
    },
    {
      topic: 'minimo',
      keywords: ['minimo', 'pedido minimo', 'compra minima', 'cuanto es lo minimo'],
      answer: 'No exigimos compra mínima: puedes pedir desde una sola pieza. Aunque si llevas un combo o varias, te damos mejor precio.',
    },
  ]

  // ---- Encaje de preguntas por puntuación ----
  const tokens = (text) => N(text).split(/[^a-z0-9]+/).filter((w) => w.length > 1)

  const leven = (a, b) => {
    if (a === b) return 0
    if (!a.length) return b.length
    if (!b.length) return a.length
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
    for (let i = 0; i <= a.length; i++) dp[i][0] = i
    for (let j = 0; j <= b.length; j++) dp[0][j] = j
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        )
    return dp[a.length][b.length]
  }

  const scoreFaqItem = (item, text, tks) => {
    const ntext = N(text)
    let score = 0
    for (const kwRaw of item.keywords) {
      const kw = N(kwRaw)
      if (kw.includes(' ')) {
        if (ntext.includes(kw)) score += 3
        continue
      }
      for (let i = 0; i < tks.length; i++) {
        const tok = tks[i]
        if (tok === kw) score += 2
        else if (kw.length >= 4 && leven(tok, kw) <= 1) score += 1.5
        else if (kw.length >= 3 && tok.startsWith(kw) && tok.length - kw.length <= 3) score += 1.5
        else if (kw.length >= 5 && tok.length >= 3 && kw.startsWith(tok) && kw.length - tok.length <= 3) score += 1.5
      }
    }
    return score
  }

  const matchTopic = (topic, text) => {
    const item = FAQ.find((f) => f.topic === topic)
    if (!item) return false
    return scoreFaqItem(item, text, tokens(text)) >= 2
  }

  const answerForTopic = (topic) => {
    const item = FAQ.find((f) => f.topic === topic)
    return item ? item.answer : null
  }

  const matchFaq = (text, preferTopic) => {
    const tks = tokens(text)
    const hits = []
    for (const item of FAQ) {
      const score = scoreFaqItem(item, text, tks)
      if (score >= 2) hits.push({ item, score })
    }
    if (!hits.length) return null
    const prefer = preferTopic ? FAQ.find((f) => f.topic === preferTopic) : null
    hits.sort(
      (a, b) =>
        (b.score + (prefer && b.item === prefer ? 0.9 : 0)) -
        (a.score + (prefer && a.item === prefer ? 0.9 : 0))
    )
    const top = hits[0]
    return Object.assign({}, top.item, { _score: Math.round(top.score * 10) / 10 })
  }

  const matchContinuar = (text) => /\bcontinuar\b|\bcontinuemos\b|\bcontinúar\b|adelante|\bpedido\b|\bpedir\b|\bcatalogo\b|\bcatálogo\b/i.test(text)
  const matchConfirmo = (text) => /^\s*confirmo\s*[.!]?\s*$/i.test(text)

  const matchAffirmative = (text) => {
    const t = N(text || '').trim()
    if (!t) return false
    if (/^(no|no+\b|nop|ni modo|para nada|que no|no estoy de acuerdo|no puedo|no quiero|no me interesa|no gracias|jamas|nunca)/.test(t)) return false
    if (/no\s+(gracias|puedo|quiero|me interesa|estoy de acuerdo|puede ser)/.test(t)) return false
    if (/de\s+acuerd\w*/.test(t)) return true
    if (/(^|\s)(si+[pst]?|claro|vale|ok|okay|okey|dale|listo|bueno|perfecto|acepto|confirmo|confirmado|de una|vamos|va|sure|yes|ya+\b)(\s|$)/.test(t)) return true
    if (/(me parece|parece bien|puede ser|cuando quiera|de acuerdo|no hay problema|si claro|claro que)/.test(t)) return true
    if (/^(👍|🙌|✅|😊|\u{1F44D})+$/u.test(t)) return true
    return /(^|\s)si+\s+pero/.test(t)
  }

  const matchNegative = (text) => /(^|\s)(no|nop|nunca|jamás|jamas)([.,!\s]|$)/i.test(text)

  // Reemplaza tokens {FECHA_HORA}, {PEDIDO}, {NOMBRE}, {DIRECCION}, {TOTAL}…
  const messageForStep = (step, data) => {
    const s = FLOW.steps[step]
    if (!s) return ''
    const raw = s.template || s.text || ''
    const vars = typeof data === 'string' ? { FECHA_HORA: data } : (data || {})
    return raw.replace(/\{(\w+)\}/g, (_m, k) => (vars[k] != null ? String(vars[k]) : ''))
  }

  const anchorForStep = (step) => {
    const s = FLOW.steps[step]
    if (!s) return ''
    return s.anchor || s.text || ''
  }

  root.AuroraFlow = {
    FLOW,
    FAQ,
    CONFIRM_REPLY,
    NO_KB_REPLY,
    NO_MONEY_REPLY,
    STEP3_NUDGE,
    ASK_ADDRESS_ONLY,
    ASK_NAME_ONLY,
    DATA_REMINDER,
    STEP_STATE,
    matchFaq,
    matchTopic,
    answerForTopic,
    matchContinuar,
    matchConfirmo,
    matchAffirmative,
    matchNegative,
    matchNoMoney,
    messageForStep,
    anchorForStep,
  }
})(window)
