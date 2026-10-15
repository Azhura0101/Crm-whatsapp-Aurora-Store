# CRM de WhatsApp · Toma de Pedidos — Aurora Store (Demo estática)

> **⚠️ Versión Demo**: proyecto de portafolio. Es una copia **sanitizada y 100% estática** de un CRM real desarrollado como proyecto comisionado. La marca, el flujo, los precios y **todos los datos son ficticios**. No se conecta a WhatsApp ni usa ningún backend.

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Sin build](https://img.shields.io/badge/build-none-16a34a?style=flat)
![Licencia MIT](https://img.shields.io/badge/licencia-MIT-3b82f6?style=flat)

## 📋 Descripción

**Aurora Store** es un CRM de WhatsApp que **atiende y toma pedidos de forma automática** y, cuando hace falta, cede el control a un asesor humano. El bot conduce al cliente por un flujo (catálogo → datos de envío → condiciones → atención humana → entrega → recordatorio de confirmación) y todo se sigue en vivo desde un panel web tipo *inbox*.

Esta es la **versión de exhibición**: una reimplementación **100% estática** (solo HTML, CSS y JavaScript en el navegador) del mismo producto. No hay servidor, ni Socket.IO, ni WhatsApp, ni base de datos. El "backend" vive en el propio navegador:

*   `js/store.js` — capa de datos sobre **`localStorage`** (contactos, mensajes y ajustes).
*   `js/bot.js` — el cerebro conversacional, con **inyección de dependencias** (`createBot({ db, flow, send, ensureLabel })`).
*   `js/flow.js` — la fuente única de textos y del encaje de preguntas (FAQ con *matching* difuso).
*   `js/seed.js` — siembra las conversaciones ficticias.
*   `js/engine.js` — un "servidor" embebido con un **shim de socket** compatible con la UI.

## ✨ Características

*   **Automatización conversacional**: máquina de estados por contacto, Base de Conocimiento (FAQ) con *matching* difuso (distancia de Levenshtein, raíces y frases) y *anclaje* de la pregunta del paso actual.
*   **Pedido realista**: el bot toma el pedido, pide **nombre y dirección de envío** y confirma antes de pasar a un asesor.
*   **Inbox humano**: bandeja en tiempo real, toma de control, agendado de entregas y recordatorios manuales.
*   **Métricas**: tablero de estadísticas agregadas (mensajes por día, tráfico por tipo, estados, pasos y citas).
*   **Simulador**: un chat para escribir "como si fueras el cliente" y ver responder al bot.
*   **Datos de ejemplo**: 5 conversaciones, una por etapa del pedido, que se **reproducen una a una** al abrirlas (toca para saltar).
*   **Todo privado**: el estado vive **solo en tu navegador** (`localStorage`); cada visitante tiene su propia copia y nada se envía a ningún lado.

## 🚀 Uso

No requiere instalación, build ni dependencias. Como usa peticiones locales, ábrelo con un servidor estático simple:

```bash
# opción 1: Python (ya viene en casi cualquier equipo)
python3 -m http.server 8080
# Abre http://localhost:8080

# o cualquier servidor estático, por ejemplo:
npx serve .
```

> También funciona abriendo `index.html` directamente, pero algunos navegadores restringen `localStorage` en `file://`. Servirlo por HTTP lo evita.

### Despliegue

Es un sitio estático, así que va a cualquier hosting estático:

*   **Vercel**: importa el repositorio y publica (incluye `vercel.json` con `cleanUrls`). O sube la carpeta por *drag & drop*.
*   **GitHub Pages / Netlify / Cloudflare Pages**: apunta al directorio raíz; no hace falta *build*.

## 🔒 Privacidad

Repositorio *sanitizado* y empaquetado solo con fines de exhibición pública. No contiene datos reales, credenciales ni la sesión de WhatsApp del proyecto original: **todos los nombres, teléfonos, direcciones y montos son inventados**. El estado de la demo se guarda únicamente en el `localStorage` de cada visitante (botón **"Reiniciar demo"** para volver al estado inicial).

## 📄 Licencia

[MIT](LICENSE) © 2026 azhura0101.

---

*Código de [azhura0101](https://github.com/azhura0101). Versión estática y sanitizada para portafolio.*
