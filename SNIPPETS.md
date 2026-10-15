# Fragmentos de código · CRM de WhatsApp "Aurora Store" (demo estática)

Esta demo es una reimplementación **100% estática** del CRM: mismo producto, pero sin servidor. Aquí van los fragmentos que mejor muestran la lógica y la arquitectura, todo en JavaScript de navegador.

## 1. Cerebro con inyección de dependencias (`js/bot.js`)

El bot no depende de la red ni de una base de datos concretas: recibe `db`, `flow`, `send` y `ensureLabel`. Eso permite que el mismo bot corra sobre `localStorage` en la demo (y sobre SQLite + WhatsApp en el proyecto real).

```javascript
// js/bot.js — creación con inyección de dependencias
const bot = createBot({ db: store, flow, send: sendText, ensureLabel: null })
```

En el paso 2 ya no se pide teléfono: se capturan **nombre y dirección de envío** en un solo mensaje (o por separado) y solo se avanza cuando están ambos.

```javascript
// js/bot.js — paso 2 (extracto)
const parsed = parseNameAddress(text)          // "Ana Pérez, Calle 10 #25-30, barrio Centro, Medellín"
if (parsed && parsed.name && parsed.address) {
  db.upsertContact(jid, { pname: parsed.name, pphone: phoneFromJid(jid), step: 3, status: 'flujo' })
  db.setMemory(jid, { address: parsed.address, dataRequests: 0, anchorN: 0, lastTopic: null })
  await sleep(900)
  await botReply(jid, flow.messageForStep(3, {
    NOMBRE: parsed.name.split(' ')[0], PEDIDO: mem.order || '', DIRECCION: parsed.address,
  }))
  return
}
// Si lo dio por partes, se acumula y se pide lo que falta (ASK_ADDRESS_ONLY / ASK_NAME_ONLY).
```

## 2. FAQ con *matching* difuso (distancia de Levenshtein)

En lugar de un `includes` frágil, cada tema suma puntos por palabra exacta, misma raíz, casi-igual por *typo* o frase completa. El tema previo desempata.

```javascript
// js/flow.js — scoreFaqItem (extracto)
const scoreFaqItem = (item, text, tks) => {
  const ntext = N(text)
  let score = 0
  for (const kwRaw of item.keywords) {
    const kw = N(kwRaw)
    if (kw.includes(' ')) { if (ntext.includes(kw)) score += 3; continue }
    for (const tok of tks) {
      if (tok === kw) score += 2
      else if (kw.length >= 4 && leven(tok, kw) <= 1) score += 1.5          // typo
      else if (kw.length >= 3 && tok.startsWith(kw)) score += 1.5            // raíz
    }
  }
  return score
}
```

### Respuesta + anclaje

```javascript
// js/bot.js — faqAnchor (extracto)
if (flow.matchNoMoney(text)) { await botReply(jid, flow.NO_MONEY_REPLY); return true }
const item = flow.matchFaq(text, mem.lastTopic)
await botReply(jid, item ? item.answer : (isQuestion(text) ? flow.NO_KB_REPLY : null))
const anchor = flow.anchorForStep(step)   // re-ancla la pregunta del paso actual (con tope)
if (anchor && mem.anchorN < 2) await botReply(jid, anchor)
```

## 3. Capa de datos sobre `localStorage` (antes SQLite)

`js/store.js` reproduce la misma API que usaba el backend (`getContacts`, `saveMessage`, `getMemory`, `setSetting`…), pero sobre `localStorage`. Todo el estado de la demo vive en el navegador del visitante.

```javascript
// js/store.js — guardado con persistencia
const saveMessage = ({ jid, fromMe, sentBy = 'client', body, ts = now(), status = 'sent' }) => {
  const msg = { id: state.nextId++, jid, from_me: fromMe ? 1 : 0, sent_by: sentBy, body, ts, read: 0, status }
  state.messages.push(msg)
  persist()            // localStorage.setItem(...)
  return clone(msg)
}
```

## 4. "Servidor" embebido con un shim de socket

`js/engine.js` escucha los mismos `socket.emit(...)` que usaba la UI contra Socket.IO, pero todo ocurre en el navegador. La UI no cambió su forma de hablar: solo cambió el objeto `socket`.

```javascript
// index.html
const socket = AuroraEngine.socket
```

```javascript
// js/engine.js — un handler de ejemplo (get-stats)
const reduce = {
  'get-stats': (payload, cb) => cb && cb(statsPayload()),
  // ...simulate, send, force-step, review-decision, reset-demo, etc.
}
```

## 5. Estadísticas agregadas en el cliente

El tablero agrega sobre los mensajes en memoria/localStorage (mensajes por día, tráfico por tipo, estados, pasos, citas y horas más activas).

```javascript
// js/engine.js — statsPayload (extracto)
const week = all.filter((m) => m.ts >= week0)
const totals = {
  total: week.length,
  in_total: week.filter((m) => m.from_me === 0).length,
  out_total: week.filter((m) => m.from_me === 1).length,
  bot: week.filter((m) => m.sent_by === 'bot').length,
}
```

---

*Código de [azhura0101](https://github.com/azhura0101). Versión estática y sanitizada para portafolio.*
