// js/seed.js — Datos ficticios para la copia de exhibición del CRM "Aurora Store".
// No contiene información real de ningún cliente: nombres, teléfonos, direcciones y
// montos son inventados. Se siembra una sola vez (si la base está vacía) o al pulsar
// "Reiniciar demo" en el panel.
(function (root) {
  const store = root.AuroraStore
  const flow = root.AuroraFlow

  // Marca de tiempo en un día relativo a hoy (0 = hoy, -1 = ayer, 1 = mañana) a cierta hora.
  const at = (dayOffset, hour, min = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + dayOffset)
    d.setHours(hour, min, 0, 0)
    return d.getTime()
  }
  const iso = (dayOffset, hour, min = 0) => new Date(at(dayOffset, hour, min)).toISOString()
  const jidFor = (phone) => `${phone}@c.us` // mismo formato de jid que usa el resto de la app

  const step3 = (name, order, address) =>
    flow.messageForStep(3, { NOMBRE: name.split(' ')[0], PEDIDO: order, DIRECCION: address })

  const CONTACTS = [
    {
      name: 'Laura Restrepo',
      phone: '573001112233',
      step: 1,
      status: 'flujo',
      msgs: [
        [0, 'client', 'Hola, vi su catálogo y quiero pedir una pulsera tejida 🙌', at(-1, 18, 20)],
      ],
    },
    {
      name: 'Camila Torres',
      phone: '573002223344',
      step: 3,
      status: 'flujo',
      order: 'Pulsera tejida',
      address: 'Calle 10 #25-30, barrio Centro, Medellín',
      msgs: [
        [0, 'client', 'Hola, quiero una pulsera tejida', at(-1, 15, 10)],
        [1, 'bot', flow.messageForStep(2, { PEDIDO: 'Pulsera tejida' }), at(-1, 15, 11)],
        [0, 'client', 'Camila Torres, Calle 10 #25-30, barrio Centro, Medellín', at(-1, 15, 12)],
        [1, 'bot', step3('Camila Torres', 'Pulsera tejida', 'Calle 10 #25-30, barrio Centro, Medellín'), at(-1, 15, 13)],
        [0, 'client', 'y el envío a Medellín cuánto vale?', at(0, 8, 45)],
      ],
    },
    {
      name: 'Julián Pérez',
      phone: '573004445566',
      step: 4,
      status: 'pausa_humano',
      order: 'Collar con piedra y combo de regalo',
      address: 'Carrera 70 #5-10, apto 302, barrio Belén, Medellín',
      msgs: [
        [0, 'client', 'Buenas, quiero un collar con piedra y el combo de regalo', at(-2, 9, 10)],
        [1, 'bot', flow.messageForStep(2, { PEDIDO: 'Collar con piedra y combo de regalo' }), at(-2, 9, 11)],
        [0, 'client', 'Julián Pérez, Carrera 70 #5-10, apto 302, barrio Belén, Medellín', at(-2, 9, 12)],
        [1, 'bot', step3('Julián Pérez', 'Collar con piedra y combo de regalo', 'Carrera 70 #5-10, apto 302, barrio Belén, Medellín'), at(-2, 9, 13)],
        [0, 'client', 'SÍ, de acuerdo', at(-2, 9, 14)],
        [1, 'human', 'Hola Julián, soy Sofía 👋 Ya estoy revisando la disponibilidad de tus piezas y te confirmo el total en un momento.', at(-1, 10, 15)],
        [0, 'client', 'ok, quedo atento', at(-1, 10, 22)],
      ],
    },
    {
      name: 'Valentina López',
      phone: '573005556677',
      step: 5,
      status: 'agendado',
      order: 'Set de pulseras en acero y aretes',
      address: 'Calle 10 #25-30, barrio Centro, Medellín',
      appointment: iso(0, 15, 0),
      msgs: [
        [1, 'bot', flow.messageForStep(1), at(-3, 14, 0)],
        [0, 'client', 'Hola, me interesa un set de pulseras en acero y unos aretes', at(-3, 14, 8)],
        [1, 'bot', flow.messageForStep(2, { PEDIDO: 'Set de pulseras en acero y aretes' }), at(-3, 14, 9)],
        [0, 'client', 'Valentina López, Calle 10 #25-30, barrio Centro, Medellín', at(-3, 14, 18)],
        [1, 'bot', step3('Valentina López', 'Set de pulseras en acero y aretes', 'Calle 10 #25-30, barrio Centro, Medellín'), at(-3, 14, 19)],
        [0, 'client', 'SÍ', at(-3, 14, 25)],
        [1, 'bot', flow.messageForStep(4), at(-3, 14, 26)],
        [1, 'human', 'Hola Valentina, ya aparté tus piezas. La entrega queda para hoy.', at(-1, 16, 22)],
        [0, 'client', 'súper, muchas gracias 🙏', at(-1, 16, 25)],
        [1, 'bot', flow.messageForStep(9, 'hoy a las 3:00 p. m.'), at(-1, 16, 30)],
      ],
    },
    {
      name: 'Andrés Gómez',
      phone: '573006667788',
      step: 6,
      status: 'en_recordatorio',
      order: 'Aretes artesanales',
      address: 'Avenida 80 #45-12, barrio Robledo, Medellín',
      appointment: iso(1, 10, 0),
      reminder_sent: 1,
      msgs: [
        [1, 'bot', flow.messageForStep(1), at(-4, 11, 0)],
        [0, 'client', 'Hola, quiero unos aretes artesanales', at(-4, 11, 5)],
        [1, 'bot', flow.messageForStep(2, { PEDIDO: 'Aretes artesanales' }), at(-4, 11, 6)],
        [0, 'client', 'Andrés Gómez, Avenida 80 #45-12, barrio Robledo, Medellín', at(-4, 11, 10)],
        [1, 'bot', step3('Andrés Gómez', 'Aretes artesanales', 'Avenida 80 #45-12, barrio Robledo, Medellín'), at(-4, 11, 11)],
        [0, 'client', 'SÍ', at(-4, 11, 15)],
        [1, 'bot', flow.messageForStep(4), at(-4, 11, 16)],
        [1, 'human', 'Andrés, programé tu entrega para mañana a las 10:00 a. m. 🛍️', at(-1, 17, 0)],
        [1, 'bot', flow.messageForStep(6, 'mañana a las 10:00 a. m.'), at(-1, 17, 5)],
      ],
    },
  ]

  const insertAll = () => {
    for (const c of CONTACTS) {
      const jid = jidFor(c.phone)
      store.upsertContact(jid, {
        name: c.name,
        phone: c.phone,
        step: c.step,
        status: c.status,
        appointment: c.appointment || null,
        reminder_sent: c.reminder_sent || 0,
      })
      const mem = {}
      if (c.order) mem.order = c.order
      if (c.address) mem.address = c.address
      if (Object.keys(mem).length) store.setMemory(jid, mem)
      for (const [fromMe, sentBy, body, ts] of c.msgs) {
        store.saveMessage({ jid, fromMe: !!fromMe, sentBy, body, ts, status: 'sent' })
      }
    }
    store.setSetting('bot_on', '1')
    console.log(`[seed] ${CONTACTS.length} contactos ficticios sembrados (Aurora Store).`)
    return CONTACTS.length
  }

  // Siembra solo si la base está vacía (no pisa datos existentes).
  const seedIfEmpty = () => {
    if (store.getContacts().length > 0) return 0
    return insertAll()
  }

  // Borra todo y vuelve a sembrar (botón "Reiniciar demo").
  const resetDemo = () => {
    store.reset()
    return insertAll()
  }

  root.AuroraSeed = { seedIfEmpty, resetDemo, CONTACTS }
})(window)
