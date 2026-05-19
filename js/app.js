// ======================================================
// SMART FEEDING SYSTEM — FULL APP.JS
// ======================================================

// ======================================================
// DOM ELEMENTS
// ======================================================
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

const sidebar = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');

const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
const pageSections = document.querySelectorAll('.page-section');
const pageTitleEl = document.getElementById('page-title');

// ======================================================
// DEFAULT VALUES
// ======================================================
function applyDefaults() {
    if (feedPercentageEl) feedPercentageEl.textContent = '0';
    if (feedProgressBar) feedProgressBar.style.width = '0%';
    if (feedStatusText) feedStatusText.textContent = '--';

    if (lastFeedingTimeEl) lastFeedingTimeEl.textContent = '--';
    if (lastFeedingAmountEl) lastFeedingAmountEl.textContent = '--';

    if (nextFeedingTimeEl) nextFeedingTimeEl.textContent = '--';
    if (nextFeedingCountdownEl) nextFeedingCountdownEl.textContent = '--';

    if (scheduleListEl) scheduleListEl.innerHTML = '<li>No schedules yet.</li>';
    if (logsListEl) logsListEl.innerHTML = '<li>No logs yet.</li>';
}

applyDefaults();

// ======================================================
// LIVE CLOCK
// ======================================================
function updateClock() {
    const now = new Date();

    let h = now.getHours();
    let m = String(now.getMinutes()).padStart(2, '0');
    let s = String(now.getSeconds()).padStart(2, '0');

    const ampm = h >= 12 ? 'PM' : 'AM';

    h = h % 12 || 12;

    if (timeEl) timeEl.textContent = `${h}:${m}:${s}`;
    if (ampmEl) ampmEl.textContent = ampm;

    const days = [
        'Sunday','Monday','Tuesday','Wednesday',
        'Thursday','Friday','Saturday'
    ];

    if (dateEl) {
        dateEl.textContent = days[now.getDay()];
    }

    // countdown
    if (window.nextFeedingDate && nextFeedingCountdownEl) {

        const diff = window.nextFeedingDate - now;

        if (diff > 0) {

            const hrs = Math.floor(diff / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            const secs = Math.floor((diff % 60000) / 1000);

            nextFeedingCountdownEl.textContent =
                `In ${hrs}h ${mins}m ${secs}s`;

        } else {
            nextFeedingCountdownEl.textContent = 'Dispensing soon...';
        }
    }
}

setInterval(updateClock, 1000);
updateClock();

// ======================================================
// MOBILE SIDEBAR
// ======================================================
function toggleSidebar() {
    sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('show');
}

mobileMenuBtn?.addEventListener('click', toggleSidebar);
sidebarOverlay?.addEventListener('click', toggleSidebar);

// ======================================================
// NAVIGATION
// ======================================================
const sectionTitles = {
    dashboard: 'Dashboard',
    schedule: 'Schedule',
    logs: 'Logs',
    inventory: 'Inventory',
    settings: 'Settings',
    analysis: 'Analytics'
};

navItems.forEach(item => {

    item.addEventListener('click', e => {

        e.preventDefault();

        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        pageSections.forEach(sec => {
            sec.style.display = 'none';
        });

        const target = item.dataset.target;

        const section = document.getElementById('section-' + target);

        if (section) {
            section.style.display = 'block';
        }

        if (pageTitleEl && sectionTitles[target]) {
            pageTitleEl.textContent = sectionTitles[target];
        }

        if (window.innerWidth <= 992) {
            toggleSidebar();
        }
    });
});

// ======================================================
// FIREBASE
// ======================================================
const auth = firebase.auth();

let feederRef = null;
let userDeviceId = null;

// ======================================================
// AUTH
// ======================================================
auth.onAuthStateChanged(async user => {

    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    try {

        const snap = await firebase
            .database()
            .ref('users/' + user.uid)
            .once('value');

        if (snap.exists() && snap.val().deviceId) {

            userDeviceId = snap.val().deviceId;

            feederRef = firebase.database().ref(
                'devices/' + userDeviceId
            );

            initializeRealtimeListeners();

        } else {
            alert('No linked device.');
        }

    } catch (err) {
        console.error(err);
    }
});

// ======================================================
// REALTIME LISTENERS
// ======================================================
function initializeRealtimeListeners() {

    // STATUS
    feederRef.child('status').on('value', snap => {
        updateStatusCards(snap.val() || {});
    });

    // SCHEDULE
    feederRef.child('schedule').on('value', snap => {

        const data = snap.val();

        renderSchedule(data);
        computeNextFeeding(data);

    });

    // LOGS
    feederRef.child('logs').limitToLast(50).on('value', snap => {

        renderLogsGrouped(snap.val());

    });

    // SETTINGS
    feederRef.child('settings').on('value', snap => {

        const data = snap.val();

        if (!data) return;

        const setVal = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        };

        setVal('setting-phone', data.phoneNumber);
        setVal('setting-servo-open', data.servoOpenTime);
        setVal('setting-servo-closed', data.servoClosedTime);

    });
}

// ======================================================
// STATUS CARDS
// ======================================================
function updateStatusCards(data) {

    const level = data.feedLevel || 0;

    if (feedPercentageEl) {
        feedPercentageEl.textContent = level;
    }

    if (feedProgressBar) {
        feedProgressBar.style.width = `${level}%`;
    }

    if (feedStatusText) {

        if (level <= 20) {
            feedStatusText.textContent = 'Low';
            feedStatusText.style.color = '#E74C3C';
        }
        else {
            feedStatusText.textContent = 'Healthy';
            feedStatusText.style.color = '#00C896';
        }
    }

    if (lastFeedingTimeEl) {
        lastFeedingTimeEl.textContent =
            data.lastFeedingTime || '--';
    }

    if (lastFeedingAmountEl) {

        lastFeedingAmountEl.textContent =
            data.lastFeedingAmount
            ? data.lastFeedingAmount + 'g'
            : '--';
    }
}

// ======================================================
// FORMAT TIME
// ======================================================
function formatTime12h(raw) {

    let [h, m] = raw.split(':').map(Number);

    const ampm = h >= 12 ? 'PM' : 'AM';

    h = h % 12 || 12;

    return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ======================================================
// RENDER SCHEDULE
// ======================================================
function renderSchedule(data) {

    const fullListEl =
        document.getElementById('full-schedule-list');

    if (!data) {

        if (scheduleListEl) {
            scheduleListEl.innerHTML =
                '<li>No schedules.</li>';
        }

        return;
    }

    if (scheduleListEl) scheduleListEl.innerHTML = '';
    if (fullListEl) fullListEl.innerHTML = '';

    Object.keys(data).forEach(key => {

        const item = data[key];

        const html = `
            <li style="padding:10px;border-bottom:1px solid #eee;">
                <strong>${item.day}</strong>
                • ${item.time}
                • ${item.amount}g
            </li>
        `;

        if (scheduleListEl) {
            scheduleListEl.innerHTML += html;
        }

        if (fullListEl) {
            fullListEl.innerHTML += html;
        }
    });
}

// ======================================================
// COMPUTE NEXT FEEDING
// ======================================================
function computeNextFeeding(schedules) {

    if (!schedules) return;

    const now = new Date();

    const dayNames = [
        'Sun','Mon','Tue',
        'Wed','Thu','Fri','Sat'
    ];

    let nextDate = null;

    Object.values(schedules).forEach(item => {

        const [h, m] = item.rawTime.split(':');

        const candidate = new Date();

        candidate.setHours(h);
        candidate.setMinutes(m);
        candidate.setSeconds(0);

        if (candidate < now) {
            candidate.setDate(candidate.getDate() + 1);
        }

        if (!nextDate || candidate < nextDate) {
            nextDate = candidate;
        }
    });

    window.nextFeedingDate = nextDate;

    if (nextDate && nextFeedingTimeEl) {

        nextFeedingTimeEl.textContent =
            `${dayNames[nextDate.getDay()]},
            ${formatTime12h(
                `${String(nextDate.getHours()).padStart(2,'0')}:${String(nextDate.getMinutes()).padStart(2,'0')}`
            )}`;
    }
}

// ======================================================
// MANUAL FEED
// ======================================================
btnFeedNow?.addEventListener('click', () => {

    if (!feederRef) {
        return alert('Device not connected.');
    }

    feederRef.child('control').update({
        dispense_now: true,
        trigger_time: Date.now()
    });

    feederRef.child('logs').push({
        message: 'Manual Feed Completed (250g)',
        type: 'success',
        timestamp: Date.now()
    });

    alert('Dispense command sent!');
});

// ======================================================
// SAVE SETTINGS
// ======================================================
document.getElementById('btn-save-settings')
?.addEventListener('click', () => {

    if (!feederRef) return;

    const phone =
        document.getElementById('setting-phone').value;

    const servoOpen =
        parseInt(document.getElementById('setting-servo-open').value);

    const servoClosed =
        parseInt(document.getElementById('setting-servo-closed').value);

    feederRef.child('settings').update({

        phoneNumber: phone,
        servoOpenTime: servoOpen,
        servoClosedTime: servoClosed

    })
    .then(() => {
        alert('Settings saved.');
    });
});

// ======================================================
// LOGS
// ======================================================
function renderLogsGrouped(data) {

    const fullLogsEl =
        document.getElementById('full-logs-list');

    if (!data) {

        if (logsListEl) {
            logsListEl.innerHTML =
                '<li>No logs.</li>';
        }

        return;
    }

    const logsArray = Object.entries(data)
        .map(([key, val]) => ({
            ...val,
            _key: key
        }))
        .sort((a, b) =>
            b.timestamp - a.timestamp
        );

    if (logsListEl) logsListEl.innerHTML = '';
    if (fullLogsEl) fullLogsEl.innerHTML = '';

    logsArray.forEach(log => {

        const time =
            new Date(log.timestamp)
            .toLocaleTimeString();

        const html = `
            <li style="padding:10px;border-bottom:1px solid #eee;">
                <strong>${time}</strong>
                • ${log.message}
            </li>
        `;

        if (logsListEl) {
            logsListEl.innerHTML += html;
        }

        if (fullLogsEl) {
            fullLogsEl.innerHTML += html;
        }
    });

    renderAnalytics(logsArray);
}

// ======================================================
// ANALYTICS
// ======================================================
let feedChartInstance = null;

function extractGrams(message) {

    if (!message) return 0;

    const match =
        message.match(/(\d+(\.\d+)?)\s*g/i);

    return match
        ? parseFloat(match[1])
        : 0;
}

function renderAnalytics(logsArray) {

    const chartArea =
        document.getElementById('an-chart-area');

    if (!chartArea) return;

    const byDay = {};

    logsArray.forEach(log => {

        const grams =
            extractGrams(log.message);

        if (grams <= 0) return;

        const date =
            new Date(log.timestamp)
            .toISOString()
            .slice(0, 10);

        if (!byDay[date]) {
            byDay[date] = 0;
        }

        byDay[date] += grams;
    });

    const labels = Object.keys(byDay);
    const data = Object.values(byDay);

    chartArea.innerHTML =
        '<canvas id="feedChart"></canvas>';

    const canvas =
        document.getElementById('feedChart');

    if (feedChartInstance) {
        feedChartInstance.destroy();
    }

    feedChartInstance = new Chart(canvas, {

        type: 'bar',

        data: {

            labels,

            datasets: [{
                label: 'Grams Dispensed',
                data,
                backgroundColor: '#00C896'
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// ======================================================
// SCHEDULE FORM
// ======================================================
const timesCountSelect =
    document.getElementById('schedule-times-count');

const dynamicTimeInputsContainer =
    document.getElementById('dynamic-time-inputs');

timesCountSelect?.addEventListener('change', e => {

    const count = parseInt(e.target.value);

    dynamicTimeInputsContainer.innerHTML = '';

    for (let i = 1; i <= count; i++) {

        dynamicTimeInputsContainer.innerHTML += `
            <div>
                <label>Time ${i}</label>
                <input type="time"
                    class="schedule-time-input"
                    required>
            </div>
        `;
    }
});

// ======================================================
// ADD SCHEDULE
// ======================================================
document.getElementById('schedule-form')
?.addEventListener('submit', e => {

    e.preventDefault();

    if (!feederRef) return;

    const checked =
        [...document.querySelectorAll(
            'input[name="days"]:checked'
        )];

    const timeInputs =
        [...document.querySelectorAll(
            '.schedule-time-input'
        )];

    const amount =
        parseInt(
            document.getElementById(
                'schedule-amount'
            ).value
        );

    checked.forEach(cb => {

        timeInputs.forEach(input => {

            if (!input.value) return;

            feederRef.child('schedule').push({

                day: cb.value,
                rawTime: input.value,
                time: formatTime12h(input.value),
                amount

            });
        });
    });

    alert('Schedule added.');

    e.target.reset();
});

// ======================================================
// LOGOUT
// ======================================================
document.getElementById('btn-logout')
?.addEventListener('click', () => {

    auth.signOut()
        .then(() => {
            window.location.href = 'index.html';
        });
});

// ======================================================
// CONNECTION STATUS
// ======================================================
firebase.database()
.ref(".info/connected")
.on("value", snap => {

    const el =
        document.getElementById('connection-status');

    if (!el) return;

    if (snap.val()) {

        el.textContent = 'Connected';
        el.style.color = '#00C896';

    } else {

        el.textContent = 'Disconnected';
        el.style.color = '#E74C3C';
    }
});

// ======================================================
// FINISH
// ======================================================
console.log("Smart Feeding System Loaded");
