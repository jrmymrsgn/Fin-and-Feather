// ===============================
// FIN & FEATHER FEEDING SYSTEM
// APP.JS - FULL FIXED VERSION
// ===============================

// DOM Elements
const timeEl = document.getElementById('clock-time');
const ampmEl = document.getElementById('clock-ampm');
const dateEl = document.getElementById('clock-date');

const feedPercentageEl = document.getElementById('feed-percentage');
const feedStatusText = document.getElementById('feed-status-text');
const feedProgressBar = document.getElementById('feed-progress-bar');

const lastFeedingTimeEl = document.getElementById('last-feeding-time');
const lastFeedingAmountEl = document.getElementById('last-feeding-amount');
const nextFeedingTimeEl = document.getElementById('next-feeding-time');
const nextFeedingCountdownEl = document.getElementById('next-feeding-countdown');

const scheduleListEl = document.getElementById('schedule-list');
const logsListEl = document.getElementById('logs-list');
const btnFeedNow = document.getElementById('btn-manual-feed');

// ===============================
// LIVE CLOCK
// ===============================
function updateClock() {
    const now = new Date();

    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();

    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12;

    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    timeEl.textContent = `${hours}:${minutes}:${seconds}`;
    ampmEl.textContent = ampm;

    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    const dayName = days[now.getDay()];
    const weekOfMonth = Math.ceil(now.getDate() / 7);

    dateEl.textContent = `Today • ${dayName}, Week ${weekOfMonth}`;

    if (window.nextFeedingDate) {
        let diffMs = window.nextFeedingDate - now;

        if (diffMs > 0) {
            let h = Math.floor(diffMs / (1000 * 60 * 60));
            let m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            let s = Math.floor((diffMs % (1000 * 60)) / 1000);

            nextFeedingCountdownEl.textContent = `In ${h}h ${m}m ${s}s`;
        } else {
            nextFeedingCountdownEl.textContent = 'Dispensing soon...';
        }
    }
}

setInterval(updateClock, 1000);
updateClock();

// ===============================
// NAVIGATION
// ===============================
const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
const pageSections = document.querySelectorAll('.page-section');
const pageTitleEl = document.getElementById('page-title');

const sectionTitles = {
    dashboard: 'Admin Dashboard',
    schedule: 'Schedule Management',
    logs: 'System Logs',
    inventory: 'Inventory',
    settings: 'Settings'
};

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();

        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        pageSections.forEach(s => s.style.display = 'none');

        const targetId = item.getAttribute('data-target');
        const section = document.getElementById('section-' + targetId);

        if (section) section.style.display = 'block';

        pageTitleEl.textContent = sectionTitles[targetId] || 'Dashboard';
    });
});

// ===============================
// SIDEBAR
// ===============================
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('show');
}

if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

// ===============================
// FIREBASE
// ===============================
const auth = firebase.auth();
let feederRef = null;

// ===============================
// AUTH STATE
// ===============================
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    const userRef = firebase.database().ref('users/' + user.uid);
    const snap = await userRef.once('value');

    if (snap.exists() && snap.val().deviceId) {
        const deviceId = snap.val().deviceId;
        feederRef = firebase.database().ref('devices/' + deviceId);
        initializeRealtimeListeners();
    }
});

// ===============================
// REALTIME LISTENERS
// ===============================
function initializeRealtimeListeners() {

    feederRef.child('status').on('value', snap => {
        updateStatusCards(snap.val() || {});
    });

    feederRef.child('schedule').on('value', snap => {
        renderSchedule(snap.val());
        computeNextFeeding(snap.val());
    });

    feederRef.child('logs')
        .orderByChild('timestamp')
        .limitToLast(50)
        .on('value', snap => {
            renderLogsGrouped(snap.val());
        });
}

// ===============================
// STATUS
// ===============================
function updateStatusCards(data) {

    const level = data.feedLevel || 0;

    feedPercentageEl.textContent = level;
    feedProgressBar.style.width = level + '%';

    feedStatusText.textContent = level <= 20 ? 'Low' : 'Healthy';
    feedStatusText.style.color = level <= 20 ? 'red' : 'green';

    lastFeedingTimeEl.textContent = data.lastFeedingTime || '--';
    lastFeedingAmountEl.textContent = data.lastFeedingAmount
        ? data.lastFeedingAmount + 'g'
        : '--';
}

// ===============================
// SCHEDULE
// ===============================
function renderSchedule(data) {

    scheduleListEl.innerHTML = '';

    if (!data) {
        scheduleListEl.innerHTML = '<li>No schedules</li>';
        return;
    }

    for (const key in data) {
        const item = data[key];

        scheduleListEl.innerHTML += `
            <li>
                <span>${item.day}</span>
                <span>${item.time} (${item.amount}g)</span>
            </li>
        `;
    }
}

function computeNextFeeding(data) {
    if (!data) return;

    const now = new Date();
    let next = null;

    for (const k in data) {
        const item = data[k];
        if (!item.rawTime) continue;

        const [h, m] = item.rawTime.split(':').map(Number);
        const d = new Date(now);
        d.setHours(h, m, 0, 0);

        if (!next || d < next) next = d;
    }

    window.nextFeedingDate = next;
}

// ===============================
// FIXED LOGS FUNCTION (IMPORTANT)
// ===============================
function renderLogsGrouped(data) {

    logsListEl.innerHTML = '';

    const fullLogsEl = document.getElementById('full-logs-list');
    const refillListEl = document.getElementById('refill-history-list');

    if (fullLogsEl) fullLogsEl.innerHTML = '';
    if (refillListEl) refillListEl.innerHTML = '';

    if (!data) {
        logsListEl.innerHTML = '<li>No logs</li>';
        return;
    }

    const logsArray = Object.keys(data)
        .map(k => ({ ...data[k], _key: k }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const grouped = {};

    logsArray.forEach(log => {
        const ts = new Date(log.timestamp || Date.now());

        const dateKey = ts.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push({ ...log, _time: ts });
    });

    for (const date in grouped) {

        fullLogsEl.innerHTML += `
            <div style="padding:8px; font-weight:bold; background:#f4f4f4;">
                ${date}
            </div>
        `;

        grouped[date].forEach(log => {

            const timeStr = log._time.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            const html = `
                <li style="display:flex; gap:10px;">
                    <span style="width:80px;">${timeStr}</span>
                    <span style="flex:1;">${log.message}</span>
                </li>
            `;

            if (logsListEl.children.length < 5) {
                logsListEl.innerHTML += html;
            }

            fullLogsEl.innerHTML += html;

            if (log.isRefill && refillListEl) {
                refillListEl.innerHTML += html;
            }
        });
    }
}
