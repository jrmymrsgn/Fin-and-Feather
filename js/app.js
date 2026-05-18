// ==========================
// DOM ELEMENTS
// ==========================
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

// ==========================
// GLOBAL STATE
// ==========================
let feedChart = null;
let userDeviceId = null;
let feederRef = null;

const auth = firebase.auth();

// ==========================
// CLOCK
// ==========================
function updateClock() {
    const now = new Date();

    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12 || 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    timeEl.textContent = `${hours}:${minutes}:${seconds}`;
    ampmEl.textContent = ampm;

    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName = days[now.getDay()];

    const weekOfMonth = Math.ceil(now.getDate() / 7);

    dateEl.textContent = `Today • ${dayName}, Week ${weekOfMonth}`;
}

setInterval(updateClock, 1000);
updateClock();

// ==========================
// AUTH + DEVICE LINK
// ==========================
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const userRef = firebase.database().ref('users/' + user.uid);
        const snap = await userRef.once('value');

        if (snap.exists() && snap.val().deviceId) {
            userDeviceId = snap.val().deviceId;
            feederRef = firebase.database().ref('devices/' + userDeviceId);

            initializeRealtimeListeners();
        } else {
            alert("No device linked to this account.");
            window.location.href = "index.html";
        }
    } catch (err) {
        alert("Error linking device: " + err.message);
        window.location.href = "index.html";
    }
});

// ==========================
// REALTIME LISTENERS
// ==========================
function initializeRealtimeListeners() {

    // STATUS
    feederRef.child('status').on('value', (snapshot) => {
        const data = snapshot.val() || {};
        updateStatusCards(data);
    });

    // SCHEDULE
    feederRef.child('schedule').on('value', (snapshot) => {
        const data = snapshot.val();
        renderSchedule(data);
        computeNextFeeding(data);
    });

    // LOGS
    feederRef.child('logs')
        .orderByChild('timestamp')
        .limitToLast(50)
        .on('value', (snapshot) => {

            const data = snapshot.val();

            if (!data) {
                renderLogsGrouped({});
                renderFeedAnalysis({});
                return;
            }

            renderLogsGrouped(data);
            renderFeedAnalysis(data);
        });

    // SETTINGS
    feederRef.child('settings').on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        document.getElementById('setting-phone').value = data.phoneNumber || '';
        document.getElementById('setting-sms-enable').checked = data.smsEnabled !== false;
        document.getElementById('setting-servo-open').value = data.servoOpenTime || '';
        document.getElementById('setting-servo-closed').value = data.servoClosedTime || '';
        document.getElementById('setting-hopper-height').value = data.hopperHeight || '';
    });
}

// ==========================
// STATUS CARDS
// ==========================
function updateStatusCards(data) {
    const level = data.feedLevel || 0;

    feedPercentageEl.textContent = level;
    feedProgressBar.style.width = level + '%';

    feedStatusText.textContent = level <= 20 ? "Low" : "Healthy";
    feedStatusText.style.color = level <= 20 ? "red" : "green";

    lastFeedingTimeEl.textContent = data.lastFeedingTime || '--';
}

// ==========================
// SCHEDULE
// ==========================
function renderSchedule(data) {
    scheduleListEl.innerHTML = '';

    if (!data) {
        scheduleListEl.innerHTML = '<li>No schedules</li>';
        return;
    }

    Object.values(data).forEach(item => {
        scheduleListEl.innerHTML += `
            <li>${item.day} - ${item.time} (${item.amount}g)</li>
        `;
    });
}

function computeNextFeeding(data) {
    nextFeedingTimeEl.textContent = "--";
}

// ==========================
// LOGS (FIXED)
// ==========================
function renderLogsGrouped(data) {
    logsListEl.innerHTML = '';

    if (!data) {
        logsListEl.innerHTML = '<li>No logs</li>';
        return;
    }

    Object.values(data).forEach(log => {
        logsListEl.innerHTML += `
            <li>${log.message || "No message"}</li>
        `;
    });
}

// ==========================
// FEED ANALYSIS (FIXED)
// ==========================
function renderFeedAnalysis(logs) {
    let total = 0;

    Object.values(logs || {}).forEach(log => {
        total += extractGrams(log.message);
    });

    if (totalFeedDispensedEl) {
        totalFeedDispensedEl.textContent = total;
    }
}

// ==========================
// HELPERS
// ==========================
function extractGrams(message) {
    if (!message) return 0;
    const match = message.match(/\((\d+)\s*g\)/i);
    return match ? parseInt(match[1]) : 0;
}
