// ===============================
// FIN & FEATHER FEEDING SYSTEM
// APP.JS - FULL UPDATED VERSION
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

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const dayName = days[now.getDay()];
    const weekOfMonth = Math.ceil(now.getDate() / 7);

    dateEl.textContent = `Today • ${dayName}, Week ${weekOfMonth}`;

    // Countdown
    if (window.nextFeedingDate) {
        let diffMs = window.nextFeedingDate - now;

        if (diffMs > 0) {
            let diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            let diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            let diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

            nextFeedingCountdownEl.textContent =
                `In ${diffHrs}h ${diffMins}m ${diffSecs}s`;
        } else {
            nextFeedingCountdownEl.textContent = 'Dispensing soon...';
        }
    }
}

setInterval(updateClock, 1000);
updateClock();

// ===============================
// SPA NAVIGATION
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

        if (window.innerWidth <= 992 &&
            sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    });
});

// ===============================
// MOBILE SIDEBAR
// ===============================
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('show');
}

mobileMenuBtn.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);

// ===============================
// FIREBASE
// ===============================
const auth = firebase.auth();

let userDeviceId = null;
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

        userDeviceId = snap.val().deviceId;

        feederRef = firebase.database().ref(
            'devices/' + userDeviceId
        );

        initializeRealtimeListeners();

    } else {

        let manualDevice = prompt(
            "Enter your Device ID:"
        );

        if (manualDevice) {

            manualDevice = manualDevice.trim();

            try {

                const devRef = firebase.database().ref(
                    'devices/' + manualDevice
                );

                const devSnap = await devRef.once('value');

                if (devSnap.exists()) {

                    await firebase.database()
                        .ref('users/' + user.uid)
                        .set({
                            deviceId: manualDevice
                        });

                    await devRef.child('owner')
                        .set(user.uid);

                    alert("Device linked successfully!");
                    window.location.reload();

                } else {
                    alert("Device ID not found.");
                }

            } catch (err) {
                alert(err.message);
            }
        }
    }
});

// ===============================
// REALTIME LISTENERS
// ===============================
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

            renderLogsGrouped(data);

        });

    // SETTINGS
    feederRef.child('settings').on('value', (snapshot) => {

        const data = snapshot.val();

        if (!data) return;

        document.getElementById('setting-phone').value =
            data.phoneNumber || '';

        document.getElementById('setting-sms-enable').checked =
            data.smsEnabled !== false;

        document.getElementById('setting-servo-open').value =
            data.servoOpenTime || '';

        document.getElementById('setting-servo-closed').value =
            data.servoClosedTime || '';

        document.getElementById('setting-hopper-height').value =
            data.hopperHeight || '';
    });
}

// ===============================
// SAVE SETTINGS
// ===============================
document.getElementById('btn-save-settings')
.addEventListener('click', () => {

    if (!feederRef) {
        alert("Device not connected.");
        return;
    }

    const phone =
        document.getElementById('setting-phone').value.trim();

    const smsEnabled =
        document.getElementById('setting-sms-enable').checked;

    const servoOpen =
        parseInt(document.getElementById('setting-servo-open').value) || 0;

    const servoClosed =
        parseInt(document.getElementById('setting-servo-closed').value) || 0;

    const hopperHeight =
        parseInt(document.getElementById('setting-hopper-height').value) || 0;

    feederRef.child('settings').update({

        phoneNumber: phone,
        smsEnabled: smsEnabled,
        servoOpenTime: servoOpen,
        servoClosedTime: servoClosed,
        hopperHeight: hopperHeight

    }).then(() => {

        alert('Settings saved successfully!');

    }).catch(err => {

        alert(err.message);

    });
});

// ===============================
// FEED NOW
// ===============================
btnFeedNow.addEventListener('click', () => {

    if (!feederRef) return;

    feederRef.child('control').update({
        dispense_now: true,
        trigger_time: Date.now()
    });

    alert('Dispense command sent!');
});

// ===============================
// MARK REFILLED
// ===============================
const btnMarkRefilled =
    document.getElementById('btn-mark-refilled');

if (btnMarkRefilled) {

    btnMarkRefilled.addEventListener('click', () => {

        if (!feederRef) return;

        feederRef.child('logs').push({

            message: "Stock manually marked as refilled",
            type: "success",
            isRefill: true,
            timestamp: Date.now()

        });

        alert('Inventory updated!');
    });
}

// ===============================
// LOGOUT
// ===============================
document.getElementById('btn-logout')
.addEventListener('click', () => {

    auth.signOut().then(() => {

        window.location.href = 'index.html';

    });
});

// ===============================
// DYNAMIC SCHEDULE INPUTS
// ===============================
const timesCountSelect =
    document.getElementById('schedule-times-count');

const dynamicTimeInputsContainer =
    document.getElementById('dynamic-time-inputs');

timesCountSelect.addEventListener('change', (e) => {

    const count = parseInt(e.target.value);

    dynamicTimeInputsContainer.innerHTML = '';

    for (let i = 1; i <= count; i++) {

        dynamicTimeInputsContainer.innerHTML += `
            <div>
                <label style="display:inline-block; width:60px;">
                    Time ${i}:
                </label>

                <input type="time"
                    class="schedule-time-input"
                    required
                    style="padding:8px;
                    border:1px solid #ccc;
                    border-radius:4px;">
            </div>
        `;
    }
});

// ===============================
// ADD SCHEDULE
// ===============================
document.getElementById('schedule-form')
.addEventListener('submit', (e) => {

    e.preventDefault();

    if (!feederRef) return;

    const checkboxes =
        document.querySelectorAll(
            'input[name="days"]:checked'
        );

    const timeInputs =
        document.querySelectorAll('.schedule-time-input');

    const amount =
        document.getElementById('schedule-amount').value;

    if (checkboxes.length === 0) {
        alert("Select at least one day.");
        return;
    }

    checkboxes.forEach(cb => {

        timeInputs.forEach(timeInput => {

            const time = timeInput.value;

            if (!time) return;

            let [h, m] = time.split(':');

            let ampm = h >= 12 ? 'PM' : 'AM';

            h = h % 12 || 12;

            const formattedTime =
                `${h}:${m} ${ampm}`;

            feederRef.child('schedule').push({

                day: cb.value,
                time: formattedTime,
                rawTime: time,
                amount: parseInt(amount)

            });
        });
    });

    alert("Schedule added!");

    e.target.reset();

    timesCountSelect.value = "1";
    timesCountSelect.dispatchEvent(new Event('change'));
});

// ===============================
// UPDATE STATUS CARDS
// ===============================
function updateStatusCards(data) {

    const level = data.feedLevel || 0;

    feedPercentageEl.textContent = level;

    feedProgressBar.style.width = `${level}%`;

    const invLevelEl = document.getElementById('inv-level');

    if (invLevelEl) {
        invLevelEl.textContent = level + '%';
    }

    if (level <= 20) {

        feedStatusText.textContent = 'Low';

        feedStatusText.style.color =
            'var(--color-feed-low)';

        feedProgressBar.classList.add('low');

    } else {

        feedStatusText.textContent = 'Healthy';

        feedStatusText.style.color =
            'var(--text-muted)';

        feedProgressBar.classList.remove('low');
    }

    lastFeedingTimeEl.textContent =
        data.lastFeedingTime || '--:-- --';

    if (data.lastFeedingAmount) {

        lastFeedingAmountEl.textContent =
            data.lastFeedingAmount + "g dispensed";

    } else {

        lastFeedingAmountEl.textContent =
            "--";
    }
}

// ===============================
// RENDER SCHEDULE
// ===============================
function renderSchedule(data) {

    scheduleListEl.innerHTML = '';

    const fullListEl =
        document.getElementById('full-schedule-list');

    fullListEl.innerHTML = '';

    if (!data) {

        scheduleListEl.innerHTML =
            '<li>No schedules found.</li>';

        fullListEl.innerHTML =
            '<li>No schedules found.</li>';

        return;
    }

    const grouped = {};

    for (const key in data) {

        const item = {
            ...data[key],
            _key: key
        };

        if (!grouped[item.day]) {
            grouped[item.day] = [];
        }

        grouped[item.day].push(item);
    }

    const dayOrder =
        ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    dayOrder.forEach(day => {

        if (!grouped[day]) return;

        grouped[day].forEach(item => {

            const html = `
                <li>
                    <i class="far fa-calendar-check schedule-icon"></i>

                    <span class="schedule-day">${day}</span>

                    <span class="schedule-time">
                        ${item.time} (${item.amount}g)
                    </span>

                    <button
                        onclick="deleteScheduleEntry('${item._key}')"
                        style="
                            border:none;
                            background:none;
                            color:red;
                            cursor:pointer;
                        ">
                        <i class="fas fa-trash"></i>
                    </button>
                </li>
            `;

            scheduleListEl.innerHTML += html;
            fullListEl.innerHTML += html;
        });
    });
}

// ===============================
// DELETE SCHEDULE
// ===============================
function deleteScheduleEntry(key) {

    if (!confirm('Delete this schedule?')) return;

    feederRef.child('schedule/' + key)
    .remove()
    .then(() => {

        alert('Schedule deleted.');

    }).catch(err => {

        alert(err.message);

    });
}

// ===============================
// NEXT FEEDING
// ===============================
function computeNextFeeding(schedules) {

    if (!schedules) return;

    const now = new Date();

    const dayNames =
        ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    let nextDate = null;

    for (const key in schedules) {

        let { day, rawTime } = schedules[key];

        if (!rawTime) continue;

        let [h, m] = rawTime.split(':').map(Number);

        let target = new Date(now);

        target.setHours(h, m, 0, 0);

        let currentDay =
            now.getDay() === 0 ? 6 : now.getDay() - 1;

        let targetDay =
            dayNames.indexOf(day);

        let diff = targetDay - currentDay;

        if (diff < 0 || (diff === 0 && target <= now)) {
            diff += 7;
        }

        target.setDate(target.getDate() + diff);

        if (!nextDate || target < nextDate) {
            nextDate = target;
        }
    }

    window.nextFeedingDate = nextDate;

    if (nextDate) {

        let h = nextDate.getHours();
        let m = nextDate.getMinutes();

        let ampm = h >= 12 ? 'PM' : 'AM';

        h = h % 12 || 12;

        m = m < 10 ? '0' + m : m;

        nextFeedingTimeEl.textContent =
            `${h}:${m} ${ampm}`;
    }
}

// ===============================
// RENDER LOGS
// ===============================
function renderLogsGrouped(data) {

    logsListEl.innerHTML = '';

    const fullLogsEl =
        document.getElementById('full-logs-list');

    const refillListEl =
        document.getElementById('refill-history-list');

    fullLogsEl.innerHTML = '';
    refillListEl.innerHTML = '';

    if (!data) {

        logsListEl.innerHTML =
            '<li>No logs found.</li>';

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

        const timeStr =
            new Date(log.timestamp)
            .toLocaleTimeString();

        const html = `
            <li>
                <i class="fas fa-check-circle log-icon completed"></i>

                <span class="log-time">${timeStr}</span>

                <span class="log-message">
                    ${log.message}
                </span>

                <button
                    onclick="deleteLogEntry('${log._key}')"
                    style="
                        border:none;
                        background:none;
                        color:red;
                        cursor:pointer;
                    ">
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

// ===============================
// DELETE LOG
// ===============================
function deleteLogEntry(key) {

    if (!confirm('Delete this log?')) return;

    feederRef.child('logs/' + key)
    .remove()
    .then(() => {

        alert('Log deleted.');

    }).catch(err => {

        alert(err.message);

    });
}

// ===============================
// CLEAR ALL LOGS
// ===============================
const btnClearAllLogs =
    document.getElementById('btn-clear-all-logs');

btnClearAllLogs.addEventListener('click', () => {

    if (!confirm('Delete ALL logs?')) return;

    feederRef.child('logs')
    .remove()
    .then(() => {

        alert('All logs cleared.');

    }).catch(err => {

        alert(err.message);

    });
});
