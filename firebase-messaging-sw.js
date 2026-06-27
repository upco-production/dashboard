// ============================================================
// firebase-messaging-sw.js  —  UP ERP v3.2
// Universal Packaging Pvt. Ltd.
//
// BACKGROUND push notifications (tab closed / not focused).
// Rich notification format:
//   Title:  ME/PT/26/06/015 | ROTO-01 | Printing
//   Body:   Description...
//           🟢 Priority: LOW   🔵 Status: OPEN
//           🏭 Dept: Printing   🔩 Machine: ROTO-01
//           👤 @BAQIR
//
// requestedBy = PERSON_NAME from PASSWORD_MASTER (header row 3)
//               OR login name — sent by Apps Script via getPersonName()
//
// Click: opens ERP -> session restored -> My Queue tab
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyCbJ8T53-qfez9x5xHgekoxV-GQtxfF-Jo",
  authDomain:        "up-erp-dashboard.firebaseapp.com",
  projectId:         "up-erp-dashboard",
  storageBucket:     "up-erp-dashboard.firebasestorage.app",
  messagingSenderId: "945586402394",
  appId:             "1:945586402394:web:1255da2622a1c9891b5463"
});

const messaging = firebase.messaging();

// Priority + Status dot characters (work in all notification renderers)
const PRIO_DOT = {
  CRITICAL : '\u{1F534}',   // 🔴
  HIGH     : '\u{1F7E0}',   // 🟠
  MEDIUM   : '\u{1F7E1}',   // 🟡
  LOW      : '\u{1F7E2}'    // 🟢
};
const STAT_DOT = {
  OPEN           : '\u{1F535}',   // 🔵
  ACCEPTED       : '\u{1F7E3}',   // 🟣
  IN_PROGRESS    : '\u{1F7E0}',   // 🟠
  PENDING_REVIEW : '\u{1F7E1}',   // 🟡
  CONFIRMED      : '\u{1F7E2}',   // 🟢
  LOCKED         : '\u26AB',      // ⚫
  REJECTED       : '\u{1F534}'    // 🔴
};

// ── Build notification body ───────────────────────────────────────────────────
function buildBody(d) {
  const lines = [];

  if (d.description) lines.push(d.description);

  const prio = String(d.priority || 'MEDIUM').toUpperCase();
  const stat = String(d.status   || 'OPEN').toUpperCase();
  lines.push(
    (PRIO_DOT[prio] || '\u{1F7E1}') + ' Priority: ' + prio +
    '   ' +
    (STAT_DOT[stat] || '\u{1F535}') + ' Status: ' + stat
  );

  const dept = d.dept || '', mach = d.machine || '';
  if (dept || mach) {
    lines.push(
      '\uD83C\uDFED Dept: ' + (dept || '-') +
      '   \uD83D\uDD29 Machine: ' + (mach || '-')
    );
  }

  // PERSON_NAME from PASSWORD_MASTER (header row 3) — sent as @name
  // Apps Script getPersonName() resolves login → PERSON_NAME before sending
  if (d.requestedBy) lines.push('\uD83D\uDC64 @' + d.requestedBy);

  return lines.join('\n');
}

// ── Background message handler ────────────────────────────────────────────────
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background push received', payload);

  const n = payload.notification || {};
  const d = payload.data         || {};

  // Title: notifNo | Machine | Dept
  const notif  = d.notifNo || d.reqId || '';
  const mach   = d.machine || '';
  const dept   = d.dept    || '';
  const parts  = [notif, mach, dept].filter(Boolean);
  const title  = n.title || (parts.length ? parts.join(' | ') : 'Maintenance Alert');

  const body   = n.body || buildBody(d);
  const isCrit = String(d.priority || '').toUpperCase() === 'CRITICAL';
  const tag    = 'maint-' + (d.reqId || d.notifNo || Date.now());

  return self.registration.showNotification(title, {
    body,
    icon              : '/favicon.ico',
    badge             : '/favicon.ico',
    tag,
    renotify          : true,
    requireInteraction: isCrit,
    vibrate           : isCrit ? [300, 100, 300, 100, 300] : [200, 100, 200],
    data: {
      url         : '/',
      reqId       : d.reqId       || d.notifNo    || '',
      notifNo     : d.notifNo     || d.reqId      || '',
      tab         : 'queue',
      dept        : d.dept        || '',
      machine     : d.machine     || '',
      priority    : d.priority    || 'MEDIUM',
      status      : d.status      || 'OPEN',
      requestedBy : d.requestedBy || '',   // PERSON_NAME resolved by Apps Script
      event       : d.event       || ''
    },
    actions: [
      { action: 'view_queue', title: 'My Queue'     },
      { action: 'view_req',   title: 'View Request' },
      { action: 'dismiss',    title: 'Dismiss'      }
    ]
  });
});

// ── Notification click handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const d     = event.notification.data || {};
  const reqId = d.reqId || d.notifNo || '';

  // view_req + reqId → open that request; everything else → My Queue
  const tab  = (event.action === 'view_req' && reqId) ? 'requests' : 'queue';
  const hash = tab === 'queue'
    ? '#maint-queue'
    : (reqId ? '#maint-req-' + encodeURIComponent(reqId) : '#maint-queue');
  const url  = (d.url || '/') + hash;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      // ERP tab already open — focus and send message
      for (const client of list) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type   : 'OPEN_MAINT_REQUEST',
            reqId  : reqId,
            tab    : tab,
            action : event.action
          });
          return;
        }
      }
      // No tab open — open new window (session restored via localStorage)
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Raw push fallback (data-only messages) ────────────────────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    if (payload.notification) return; // Firebase handles via onBackgroundMessage

    const d     = payload.data || {};
    const parts = [d.notifNo || d.reqId, d.machine, d.dept].filter(Boolean);

    event.waitUntil(
      self.registration.showNotification(
        parts.join(' | ') || 'Maintenance Alert',
        {
          body : buildBody(d),
          icon : '/favicon.ico',
          data : { url: '/', reqId: d.reqId || '', tab: 'queue' }
        }
      )
    );
  } catch(e) {
    console.log('[SW] Push parse error:', e.message);
  }
});

console.log('[SW] UP ERP firebase-messaging-sw.js v3.2 loaded');
