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
const totalFeedDispensedEl = document.getElementById('total-feed-dispensed');

let feedChart = null;

// CLOCK
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

    const weekOfMonth = Math.ceil((now.getDate() - 1 - now.getDay()) / 7) + 1;
    dateEl.textContent = `Today • ${dayName}, Week ${weekOfMonth}`;

    if (window.nextFeedingDate) {
        let diffMs = window.nextFeedingDate - now;

        if (diffMs > 0) {
            let h = Math.floor(diffMs / 3600000);
            let m = Math.floor((diffMs % 3600000) / 60000);
            let s = Math.floor((diffMs % 60000) / 1000);

            nextFeedingCountdownEl.textContent = `In ${h}h ${m}m ${s}s`;
        } else {
            nextFeedingCountdownEl.textContent = "Dispensing soon...";
        }
    }
}

setInterval(updateClock, 1000);
updateClock();

// NAVIGATION
const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
const pageSections = document.querySelectorAll('.page-section');
const pageTitleEl = document.getElementById('page-title');

const sectionTitles = {
    dashboard: 'Admin Dashboard',
    'live-monitor': 'Live Monitor',
    schedule: 'Schedule Management',
    logs: 'System Logs',
    inventory: 'Inventory',
    analysis: 'Feed Analysis',
    settings: 'Settings'
};

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();

        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        pageSections.forEach(s => s.style.display = 'none');

        const targetId = item.getAttribute('data-target');
        const targetSection = document.getElementById('section-' + targetId);

        if (targetSection) targetSection.style.display = 'block';
        if (sectionTitles[targetId]) pageTitleEl.textContent = sectionTitles[targetId];

        if (window.innerWidth <= 992 && sidebar && sidebarOverlay && sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    });
});

// SIDEBAR
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
    sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('show');
}

mobileMenuBtn?.addEventListener('click', toggleSidebar);
sidebarOverlay?.addEventListener('click', toggleSidebar);

// FIREBASE
const auth = firebase.auth();
let userDeviceId = null;
let feederRef = null;

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const userRef = firebase.database().ref('users/' + user.uid);
        const snap = await userRef.once('value');

        if (!snap.exists() || !snap.val().deviceId) {
            alert("No device linked to this account.");
            window.location.href = "index.html";
            return;
        }

        userDeviceId = snap.val().deviceId;
        feederRef = firebase.database().ref('devices/' + userDeviceId);

        initializeRealtimeListeners();

    } catch (err) {
        alert("Error linking device: " + err.message);
        window.location.href = "index.html";
    }
});

// REALTIME
function initializeRealtimeListeners() {

    feederRef.child('status').on('value', (snap) => {
        updateStatusCards(snap.val() || {});
    });

    feederRef.child('schedule').on('value', (snap) => {
        renderSchedule(snap.val());
        computeNextFeeding(snap.val());
    });

    feederRef.child('logs')
        .orderByChild('timestamp')
        .limitToLast(50)
        .on('value', (snap) => {

            const data = snap.val();
            if (!data) {
                renderLogsGrouped({});
                return;
            }

            renderLogsGrouped(data);
        });
}

// STATUS UI
function updateStatusCards(data) {
    const level = data.feedLevel || 0;

    feedPercentageEl.textContent = level;
    feedProgressBar.style.width = level + '%';

    feedStatusText.textContent = level <= 20 ? "Low" : "Healthy";
    lastFeedingTimeEl.textContent = data.lastFeedingTime || '--';
}

// SCHEDULE + NEXT FEED
function computeNextFeeding(schedules) {
    if (!schedules) return;

    const now = new Date();
    let nextDate = null;

    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    for (const key in schedules) {
        const s = schedules[key];
        if (!s.rawTime || !s.day) continue;

        let [h, m] = s.rawTime.split(':').map(Number);
        let target = new Date(now);
        target.setHours(h, m, 0, 0);

        let diff = days.indexOf(s.day) - (now.getDay() - 1);
        if (diff < 0) diff += 7;

        target.setDate(target.getDate() + diff);

        if (!nextDate || target < nextDate) nextDate = target;
    }

    window.nextFeedingDate = nextDate;
}

// LOGS (FIXED - NO CRASH)
function renderLogsGrouped(data) {

    logsListEl.innerHTML = '';

    const logsArray = Object.keys(data).map(k => ({
        ...data[k],
        _key: k
    }));

    logsArray.reverse();

    logsArray.slice(0, 5).forEach(log => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${new Date(log.timestamp).toLocaleTimeString()}</span>
            <span>${log.message}</span>
        `;
        logsListEl.appendChild(li);
    });
}

// HELPERS
function deleteLogEntry(key) {
    feederRef?.child('logs/' + key).remove();
}

function deleteScheduleEntry(key) {
    feederRef?.child('schedule/' + key).remove();
}
