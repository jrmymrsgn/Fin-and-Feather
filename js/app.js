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

// Live Clock Function
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

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const dayName = days[now.getDay()];
    const weekOfMonth = Math.ceil((now.getDate() - 1) / 7) + 1;

    dateEl.textContent = `Today • ${dayName}, Week ${weekOfMonth}`;

    if (window.nextFeedingDate) {
        let diffMs = window.nextFeedingDate - now;

        if (diffMs > 0) {
            let diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            let diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            let diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

            nextFeedingCountdownEl.textContent =
                `In ${diffHrs}h ${diffMins}m ${diffSecs}s`;
        } else {
            nextFeedingCountdownEl.textContent = `Dispensing soon...`;
        }
    }
}

setInterval(updateClock, 1000);
updateClock();

// SPA Navigation Logic
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

        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        pageSections.forEach(section => {
            section.style.display = 'none';
        });

        const targetId = item.getAttribute('data-target');
        const targetSection = document.getElementById('section-' + targetId);

        if (targetSection) {
            targetSection.style.display = 'block';
        }

        if (sectionTitles[targetId]) {
            pageTitleEl.textContent = sectionTitles[targetId];
        }
    });
});

// Mobile Sidebar
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('show');
}

mobileMenuBtn.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);

// Firebase
const auth = firebase.auth();

let userDeviceId = null;
let feederRef = null;

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    const userRef = firebase.database().ref('users/' + user.uid);
    const snap = await userRef.once('value');

    if (snap.exists() && snap.val().deviceId) {
        userDeviceId = snap.val().deviceId;
        feederRef = firebase.database().ref('devices/' + userDeviceId);
        initializeRealtimeListeners();
    }
});

// LISTENERS
function initializeRealtimeListeners() {

    feederRef.child('status').on('value', (snapshot) => {
        updateStatusCards(snapshot.val() || {});
    });

    feederRef.child('schedule').on('value', (snapshot) => {
        renderSchedule(snapshot.val());
        computeNextFeeding(snapshot.val());
    });

    feederRef.child('logs')
        .orderByChild('timestamp')
        .limitToLast(50)
        .on('value', (snapshot) => {
            renderLogsGrouped(snapshot.val());
        });
}

// STATUS
function updateStatusCards(data) {
    const level = data.feedLevel || 0;

    feedPercentageEl.textContent = level;
    feedProgressBar.style.width = `${level}%`;

    const invLevelEl = document.getElementById('inv-level');
    if (invLevelEl) invLevelEl.textContent = level + '%';

    feedStatusText.textContent = level <= 20 ? 'Low' : 'Healthy';
    feedStatusText.style.color = level <= 20 ? 'red' : 'green';

    lastFeedingTimeEl.textContent = data.lastFeedingTime || '--:-- --';
    lastFeedingAmountEl.textContent = data.lastFeedingAmount
        ? data.lastFeedingAmount + "g"
        : "--";
}

/* ===========================
   🔥 FIXED LOG FUNCTION
   =========================== */
function renderLogsGrouped(data) {

    logsListEl.innerHTML = '';

    const fullLogsEl =
        document.getElementById('full-logs-list');

    const refillListEl =
        document.getElementById('refill-history-list');

    fullLogsEl.innerHTML = '';
    refillListEl.innerHTML = '';

    if (!data) {

        logsListEl.innerHTML = '<li>No logs found.</li>';
        return;
    }

    const logsArray =
        Object.keys(data)
            .map(key => ({
                ...data[key],
                _key: key
            }))
            .reverse();

    logsArray.forEach(log => {

        const date = new Date(log.timestamp);

        // ✅ FIXED: now includes full date + year + time
        const timeStr = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const html = `
            <li>
                <i class="fas fa-check-circle log-icon completed"></i>

                <span class="log-time">${timeStr}</span>

                <span class="log-message">
                    ${log.message}
                </span>

                <button
                    onclick="deleteLogEntry('${log._key}')"
                    style="border:none;background:none;color:red;cursor:pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </li>
        `;

        if (logsListEl.children.length < 5) {
            logsListEl.innerHTML += html;
        }

        fullLogsEl.innerHTML += html;

        if (log.isRefill) {
            refillListEl.innerHTML += html;
        }
    });
}
