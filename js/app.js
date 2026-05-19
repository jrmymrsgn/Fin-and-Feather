// ─────────────────────────────────────────────
//  DOM Elements
// ─────────────────────────────────────────────
const timeEl                 = document.getElementById('clock-time');
const ampmEl                 = document.getElementById('clock-ampm');
const dateEl                 = document.getElementById('clock-date');
const feedPercentageEl       = document.getElementById('feed-percentage');
const feedStatusText         = document.getElementById('feed-status-text');
const feedProgressBar        = document.getElementById('feed-progress-bar');
const lastFeedingTimeEl      = document.getElementById('last-feeding-time');
const lastFeedingAmountEl    = document.getElementById('last-feeding-amount');
const nextFeedingTimeEl      = document.getElementById('next-feeding-time');
const nextFeedingCountdownEl = document.getElementById('next-feeding-countdown');
const scheduleListEl         = document.getElementById('schedule-list');
const logsListEl             = document.getElementById('logs-list');
const btnFeedNow             = document.getElementById('btn-manual-feed');

// ─────────────────────────────────────────────
//  Apply safe defaults immediately so the
//  dashboard is never blank while Firebase loads
// ─────────────────────────────────────────────
function applyDefaults() {
    if (feedPercentageEl)       feedPercentageEl.textContent       = '0';
    if (feedProgressBar)        feedProgressBar.style.width        = '0%';
    if (feedStatusText)         feedStatusText.textContent         = '--';
    if (lastFeedingTimeEl)      lastFeedingTimeEl.textContent      = '--:-- --';
    if (lastFeedingAmountEl)    lastFeedingAmountEl.textContent    = '--';
    if (nextFeedingTimeEl)      nextFeedingTimeEl.textContent      = '--:-- --';
    if (nextFeedingCountdownEl) nextFeedingCountdownEl.textContent = 'In --h --m';
    if (scheduleListEl)         scheduleListEl.innerHTML           = '<li>Loading schedules…</li>';
    if (logsListEl)             logsListEl.innerHTML               = '<li>Loading logs…</li>';
}
applyDefaults();

// ─────────────────────────────────────────────
//  Live Clock
// ─────────────────────────────────────────────
function updateClock() {
    const now = new Date();

    let hours   = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
    const ampm  = hours >= 12 ? 'PM' : 'AM';

    hours   = hours % 12 || 12;
    minutes = String(minutes).padStart(2, '0');
    seconds = String(seconds).padStart(2, '0');

    if (timeEl) timeEl.textContent = `${hours}:${minutes}:${seconds}`;
    if (ampmEl) ampmEl.textContent = ampm;

    const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const date        = now.getDate();
    const weekOfMonth = Math.ceil((date - 1 - now.getDay()) / 7) + 1;

    if (dateEl) dateEl.textContent = `Today • ${days[now.getDay()]}, Week ${weekOfMonth}`;

    // Countdown to next feeding
    if (window.nextFeedingDate && nextFeedingCountdownEl) {
        const diffMs = window.nextFeedingDate - now;
        if (diffMs > 0) {
            const diffHrs  = Math.floor(diffMs / 3600000);
            const diffMins = Math.floor((diffMs % 3600000) / 60000);
            const diffSecs = Math.floor((diffMs % 60000) / 1000);
            nextFeedingCountdownEl.textContent = `In ${diffHrs}h ${diffMins}m ${diffSecs}s`;
        } else {
            nextFeedingCountdownEl.textContent = 'Dispensing soon…';
        }
    }
}
setInterval(updateClock, 1000);
updateClock();

// ─────────────────────────────────────────────
//  SPA Navigation
// ─────────────────────────────────────────────
const navItems     = document.querySelectorAll('.sidebar-nav .nav-item');
const pageSections = document.querySelectorAll('.page-section');
const pageTitleEl  = document.getElementById('page-title');

const sectionTitles = {
    'dashboard'    : 'Admin Dashboard',
    'live-monitor' : 'Live Monitor',
    'schedule'     : 'Schedule Management',
    'logs'         : 'System Logs',
    'inventory'    : 'Inventory',
    'settings'     : 'Settings',
    'analysis'     : 'Analytics'
};

navItems.forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();

        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        pageSections.forEach(s => s.style.display = 'none');

        const targetId      = item.getAttribute('data-target');
        const targetSection = document.getElementById('section-' + targetId);
        if (targetSection) targetSection.style.display = 'block';
        if (pageTitleEl && sectionTitles[targetId]) pageTitleEl.textContent = sectionTitles[targetId];

        // Init analytics tab listeners when switching to analysis
        if (targetId === 'analysis') initAnalyticsTabs();

        // Auto-close sidebar on mobile
        if (window.innerWidth <= 992 && sidebar?.classList.contains('open')) {
            toggleSidebar();
        }
    });
});

// ─────────────────────────────────────────────
//  Mobile Sidebar
// ─────────────────────────────────────────────
const mobileMenuBtn  = document.getElementById('mobile-menu-btn');
const sidebar        = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
    sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('show');
}

mobileMenuBtn?.addEventListener('click', toggleSidebar);
sidebarOverlay?.addEventListener('click', toggleSidebar);

// ─────────────────────────────────────────────
//  Firebase — Auth & Device Binding
// ─────────────────────────────────────────────
const auth = firebase.auth();
let userDeviceId = null;
let feederRef    = null;

const connectedRef = firebase.database().ref('.info/connected');
connectedRef.on('value', snap => {
    if (snap.val() === false) {
        showError('⚠️ Lost connection to Firebase. Attempting to reconnect…');
    } else {
        clearError();
    }
});

auth.onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const userSnap = await firebase.database().ref('users/' + user.uid).once('value');

        if (userSnap.exists() && userSnap.val().deviceId) {
            userDeviceId = userSnap.val().deviceId;
            feederRef    = firebase.database().ref('devices/' + userDeviceId);
            initializeRealtimeListeners();
        } else {
            await handleMissingDevice(user);
        }
    } catch (err) {
        console.error('Auth/device error:', err);
        showError('Could not connect to your device. Please refresh and try again.');
    }
});

async function handleMissingDevice(user) {
    const manualId = prompt(
        'No device linked to this account.\n' +
        'This sometimes happens after an interrupted sign-up.\n' +
        'Enter your Device ID to link it now:'
    );

    if (!manualId?.trim()) {
        showError('No device linked. Some features will be unavailable.');
        return;
    }

    const id     = manualId.trim();
    const devRef = firebase.database().ref('devices/' + id);

    try {
        const devSnap = await devRef.once('value');

        if (!devSnap.exists()) {
            return alert('Device ID not found in the database.');
        }

        const owner = devSnap.child('owner').val();
        if (owner && owner !== user.uid) {
            return alert('This Device ID is already registered to another account.');
        }

        await firebase.database().ref('users/' + user.uid).set({ deviceId: id });
        await devRef.child('owner').set(user.uid);
        alert('Device linked successfully!');
        window.location.reload();
    } catch (err) {
        alert('Error linking device: ' + err.message);
    }
}

// ─────────────────────────────────────────────
//  Realtime Listeners
// ─────────────────────────────────────────────
function initializeRealtimeListeners() {
    feederRef.child('status').on('value', snap => {
        updateStatusCards(snap.val() || {});
    }, err => console.error('Status listener error:', err));

    feederRef.child('schedule').on('value', snap => {
        const data = snap.val();
        renderSchedule(data);
        computeNextFeeding(data);
    }, err => console.error('Schedule listener error:', err));

    // Fetch ALL logs (no limit) so analytics has complete history
    feederRef.child('logs').on('value', snap => {
        renderLogsGrouped(snap.val());
    }, err => {
        console.error('Logs listener error:', err);
        if (logsListEl) logsListEl.innerHTML = '<li>Failed to load logs. Please refresh.</li>';
        const fullLogsEl = document.getElementById('full-logs-list');
        if (fullLogsEl) fullLogsEl.innerHTML = '<li>Failed to load logs. Please refresh.</li>';
    });

    feederRef.child('settings').on('value', snap => {
        const data = snap.val();
        if (!data) return;
        const set = id => document.getElementById(id);
        if (set('setting-phone'))         set('setting-phone').value         = data.phoneNumber    || '';
        if (set('setting-sms-enable'))    set('setting-sms-enable').checked  = data.smsEnabled     !== false;
        if (set('setting-servo-open'))    set('setting-servo-open').value    = data.servoOpenTime  || '';
        if (set('setting-servo-closed'))  set('setting-servo-closed').value  = data.servoClosedTime || '';
        if (set('setting-hopper-height')) set('setting-hopper-height').value = data.hopperHeight   || '';
    }, err => console.error('Settings listener error:', err));

    feederRef.child('inventory').on('value', snap => {
        updateInventorySection(snap.val() || {});
    }, err => console.error('Inventory listener error:', err));
}

// ─────────────────────────────────────────────
//  Settings — Save
// ─────────────────────────────────────────────
document.getElementById('btn-save-settings')?.addEventListener('click', () => {
    if (!feederRef) return alert('Device not connected yet.');

    const phone        = document.getElementById('setting-phone').value.trim();
    const smsEnabled   = document.getElementById('setting-sms-enable').checked;
    const servoOpen    = parseInt(document.getElementById('setting-servo-open').value)    || 0;
    const servoClosed  = parseInt(document.getElementById('setting-servo-closed').value)  || 0;
    const hopperHeight = parseInt(document.getElementById('setting-hopper-height').value) || 0;

    if (hopperHeight > 0 && hopperHeight < 5) {
        return alert('Hopper height must be at least 5 cm.');
    }

    feederRef.child('settings').update({
        phoneNumber    : phone,
        smsEnabled,
        servoOpenTime  : servoOpen,
        servoClosedTime: servoClosed,
        hopperHeight   : hopperHeight || null
    })
    .then(()  => alert('Settings saved successfully!'))
    .catch(err => alert('Error saving settings: ' + err.message));
});

// ─────────────────────────────────────────────
//  Feed Now
// ─────────────────────────────────────────────
btnFeedNow?.addEventListener('click', () => {
    if (!feederRef) return alert('Device not connected yet.');

    const now     = new Date();
    const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    feederRef.child('control').update({ dispense_now: true, trigger_time: Date.now() });

    feederRef.child('logs').push({
        message  : 'Manual Feed Completed (250g)',
        type     : 'success',
        time     : timeStr,
        timestamp: Date.now()
    });

    alert('Dispense command sent to device!');
});

// ─────────────────────────────────────────────
//  Mark Refilled
// ─────────────────────────────────────────────
document.getElementById('btn-mark-refilled')?.addEventListener('click', () => {
    if (!feederRef) return alert('Device not connected yet.');
    if (!confirm('Mark the hopper as refilled?')) return;

    feederRef.child('logs').push({
        message  : 'Stock manually marked as refilled',
        type     : 'success',
        isRefill : true,
        timestamp: Date.now()
    })
    .then(()  => alert('Inventory marked as refilled!'))
    .catch(err => alert('Error: ' + err.message));
});

// ─────────────────────────────────────────────
//  Logout
// ─────────────────────────────────────────────
document.getElementById('btn-logout')?.addEventListener('click', () => {
    auth.signOut().then(() => window.location.href = 'index.html');
});

// ─────────────────────────────────────────────
//  Schedule Form — Dynamic Time Inputs
// ─────────────────────────────────────────────
const timesCountSelect           = document.getElementById('schedule-times-count');
const dynamicTimeInputsContainer = document.getElementById('dynamic-time-inputs');

timesCountSelect?.addEventListener('change', e => {
    const count = parseInt(e.target.value);
    dynamicTimeInputsContainer.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        dynamicTimeInputsContainer.innerHTML += `
            <div>
                <label style="display:inline-block; width:60px;">Time ${i}:</label>
                <input type="time" class="schedule-time-input" required
                       style="padding:8px; border:1px solid #ccc; border-radius:4px;">
            </div>`;
    }
});

// ─────────────────────────────────────────────
//  Schedule Form — Submit
// ─────────────────────────────────────────────
document.getElementById('schedule-form')?.addEventListener('submit', e => {
    e.preventDefault();
    if (!feederRef) return alert('Device not connected yet.');

    const checked    = [...document.querySelectorAll('input[name="days"]:checked')];
    const timeInputs = [...document.querySelectorAll('.schedule-time-input')];
    const amount     = document.getElementById('schedule-amount').value;

    if (checked.length === 0)    return alert('Please select at least one day.');
    if (timeInputs.length === 0) return;

    checked.forEach(cb => {
        timeInputs.forEach(input => {
            const time = input.value;
            if (!time) return;
            feederRef.child('schedule').push({
                day    : cb.value,
                time   : formatTime12h(time),
                rawTime: time,
                amount : parseInt(amount)
            });
        });
    });

    alert('Schedules successfully added!');
    e.target.reset();
    if (timesCountSelect) {
        timesCountSelect.value = '1';
        timesCountSelect.dispatchEvent(new Event('change'));
    }
});

// ─────────────────────────────────────────────
//  Edit Schedule Modal
// ─────────────────────────────────────────────
function openEditSchedule(key, day, rawTime, amount) {
    document.getElementById('edit-schedule-key').value    = key;
    document.getElementById('edit-schedule-day').value    = day;
    document.getElementById('edit-schedule-time').value   = rawTime;
    document.getElementById('edit-schedule-amount').value = amount;
    document.getElementById('edit-schedule-modal').style.display = 'flex';
}

document.getElementById('btn-edit-schedule-cancel')?.addEventListener('click', () => {
    document.getElementById('edit-schedule-modal').style.display = 'none';
});

document.getElementById('btn-edit-schedule-save')?.addEventListener('click', () => {
    if (!feederRef) return alert('Device not connected.');

    const key     = document.getElementById('edit-schedule-key').value;
    const day     = document.getElementById('edit-schedule-day').value;
    const rawTime = document.getElementById('edit-schedule-time').value;
    const amount  = parseInt(document.getElementById('edit-schedule-amount').value);

    if (!rawTime) return alert('Please select a time.');

    feederRef.child('schedule/' + key).update({
        day, rawTime, time: formatTime12h(rawTime), amount
    })
    .then(() => {
        document.getElementById('edit-schedule-modal').style.display = 'none';
        alert('Schedule updated successfully!');
    })
    .catch(err => alert('Error: ' + err.message));
});

// ─────────────────────────────────────────────
//  Delete Schedule Entry
// ─────────────────────────────────────────────
function deleteScheduleEntry(key) {
    if (!feederRef) return;
    if (!confirm('Delete this schedule entry?')) return;
    feederRef.child('schedule/' + key).remove()
        .catch(err => alert('Error: ' + err.message));
}

// ─────────────────────────────────────────────
//  Delete Log Entry
// ─────────────────────────────────────────────
function deleteLogEntry(key) {
    if (!feederRef) return;
    if (!confirm('Delete this log entry?')) return;
    feederRef.child('logs/' + key).remove()
        .catch(err => alert('Error deleting log: ' + err.message));
}

// ─────────────────────────────────────────────
//  Clear All Logs
// ─────────────────────────────────────────────
document.getElementById('btn-clear-all-logs')?.addEventListener('click', () => {
    if (!feederRef) return alert('Device not connected yet.');
    if (!confirm('Delete ALL logs? This cannot be undone.')) return;
    feederRef.child('logs').remove()
        .then(()  => alert('All logs cleared.'))
        .catch(err => alert('Error clearing logs: ' + err.message));
});

// ─────────────────────────────────────────────
//  Helper — Update Status Cards
// ─────────────────────────────────────────────
function updateStatusCards(data) {
    const level = data.feedLevel || 0;

    if (feedPercentageEl) feedPercentageEl.textContent  = level;
    if (feedProgressBar)  feedProgressBar.style.width   = `${level}%`;

    const invLevelEl = document.getElementById('inv-level');
    if (invLevelEl) invLevelEl.textContent = level + '%';

    if (feedStatusText) {
        if (level <= 20) {
            feedStatusText.textContent = 'Low';
            feedStatusText.style.color = 'var(--color-feed-low)';
            feedProgressBar?.classList.add('low');
        } else {
            feedStatusText.textContent = 'Healthy';
            feedStatusText.style.color = 'var(--text-muted)';
            feedProgressBar?.classList.remove('low');
        }
    }

    if (lastFeedingTimeEl) lastFeedingTimeEl.textContent = data.lastFeedingTime || '--:-- --';

    if (lastFeedingAmountEl) {
        lastFeedingAmountEl.textContent = data.lastFeedingAmount
            ? data.lastFeedingAmount + ' dispensed'
            : data.lastFeedingTime
                ? 'Feed cycle completed'
                : '--';
    }
}

// ─────────────────────────────────────────────
//  Inventory Section
// ─────────────────────────────────────────────
function updateInventorySection(data) {
    const invLevelEl       = document.getElementById('inv-level');
    const invWeightEl      = document.getElementById('inv-weight');
    const invLastRefillEl  = document.getElementById('inv-last-refill');
    const invStatusEl      = document.getElementById('inv-status');
    const invProgressEl    = document.getElementById('inv-progress-bar');

    const level      = data.feedLevel ?? data.level ?? 0;
    const weight     = data.weightGrams ?? null;
    const lastRefill = data.lastRefillTime ?? null;

    if (invLevelEl)      invLevelEl.textContent      = level + '%';
    if (invProgressEl)   invProgressEl.style.width   = level + '%';
    if (invWeightEl)     invWeightEl.textContent      = weight != null ? weight + 'g' : '--';
    if (invLastRefillEl) invLastRefillEl.textContent  = lastRefill || '--';

    if (invStatusEl) {
        if (level <= 10) {
            invStatusEl.textContent = '🔴 Critical — Refill Immediately';
            invStatusEl.style.color = '#E74C3C';
        } else if (level <= 25) {
            invStatusEl.textContent = '🟠 Low — Refill Soon';
            invStatusEl.style.color = '#F39C12';
        } else {
            invStatusEl.textContent = '🟢 Healthy';
            invStatusEl.style.color = '#2EBA8A';
        }
    }
}

// ─────────────────────────────────────────────
//  Helper — Render Schedule
// ─────────────────────────────────────────────
function renderSchedule(data) {
    const fullListEl = document.getElementById('full-schedule-list');

    if (!data) {
        const msg = '<li>No schedules found.</li>';
        if (scheduleListEl) scheduleListEl.innerHTML = msg;
        if (fullListEl)     fullListEl.innerHTML     = msg;
        return;
    }

    const grouped = {};
    for (const key in data) {
        const item = { ...data[key], _key: key };
        if (!grouped[item.day]) grouped[item.day] = [];
        grouped[item.day].push(item);
    }

    const dayOrder = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    if (scheduleListEl) scheduleListEl.innerHTML = '';
    if (fullListEl)     fullListEl.innerHTML     = '';

    dayOrder.forEach(day => {
        if (!grouped[day]?.length) return;

        grouped[day].sort((a, b) => (a.rawTime || '').localeCompare(b.rawTime || ''));

        let dashPills = '';
        let fullPills = '';

        grouped[day].forEach(item => {
            dashPills += `
                <span style="background:var(--color-bg);padding:6px 10px;border-radius:6px;
                    font-size:13px;font-weight:500;border:1px solid #e1e4e8;
                    display:inline-flex;align-items:center;gap:5px;">
                    <i class="far fa-clock" style="color:#666;"></i>
                    ${item.time}
                    <span style="color:#888;font-size:11px;">(${item.amount}g)</span>
                </span>`;

            fullPills += `
                <span style="background:var(--color-bg);padding:6px 10px;border-radius:6px;
                    font-size:13px;font-weight:500;border:1px solid #e1e4e8;
                    display:inline-flex;align-items:center;gap:6px;">
                    <i class="far fa-clock" style="color:#666;"></i>
                    ${item.time}
                    <span style="color:#888;font-size:11px;">(${item.amount}g)</span>
                    <button onclick="openEditSchedule('${item._key}','${item.day}','${item.rawTime}',${item.amount})"
                        title="Edit" style="border:none;background:transparent;cursor:pointer;color:#2980B9;padding:0;">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button onclick="deleteScheduleEntry('${item._key}')"
                        title="Delete" style="border:none;background:transparent;cursor:pointer;color:#E74C3C;padding:0;">
                        <i class="fas fa-times"></i>
                    </button>
                </span>`;
        });

        const rowStyle = 'display:flex;align-items:flex-start;border-bottom:1px solid #eee;padding:15px 20px;';
        const dayLabel = `
            <div style="display:flex;align-items:center;width:80px;margin-top:6px;">
                <i class="far fa-calendar-check schedule-icon" style="color:#F39C12;margin-right:10px;"></i>
                <span class="schedule-day" style="font-weight:bold;">${day}</span>
            </div>`;

        if (scheduleListEl) {
            scheduleListEl.innerHTML += `<li style="${rowStyle}">${dayLabel}
                <div class="schedule-times" style="flex:1;display:flex;flex-wrap:wrap;gap:10px;">${dashPills}</div>
            </li>`;
        }
        if (fullListEl) {
            fullListEl.innerHTML += `<li style="${rowStyle}">${dayLabel}
                <div class="schedule-times" style="flex:1;display:flex;flex-wrap:wrap;gap:10px;">${fullPills}</div>
            </li>`;
        }
    });

    if (scheduleListEl && !scheduleListEl.innerHTML.trim()) {
        scheduleListEl.innerHTML = '<li>No schedules found.</li>';
    }
}

// ─────────────────────────────────────────────
//  Helper — Compute Next Feeding
// ─────────────────────────────────────────────
function computeNextFeeding(schedules) {
    if (!schedules) {
        window.nextFeedingDate = null;
        if (nextFeedingTimeEl)      nextFeedingTimeEl.textContent      = '--:-- --';
        if (nextFeedingCountdownEl) nextFeedingCountdownEl.textContent = 'In --h --m';
        return;
    }

    const now           = new Date();
    const dayNames      = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const currentDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
    let nextDate        = null;

    for (const key in schedules) {
        const { day, rawTime } = schedules[key];
        if (!day || !rawTime) continue;

        const [h, m]       = rawTime.split(':').map(Number);
        const targetDayIdx = dayNames.indexOf(day);
        if (targetDayIdx === -1) continue;

        const candidate = new Date(now);
        candidate.setHours(h, m, 0, 0);

        let dayDiff = targetDayIdx - currentDayIdx;
        if (dayDiff < 0 || (dayDiff === 0 && candidate <= now)) dayDiff += 7;
        candidate.setDate(candidate.getDate() + dayDiff);

        if (!nextDate || candidate < nextDate) nextDate = candidate;
    }

    window.nextFeedingDate = nextDate;

    if (!nextDate) {
        if (nextFeedingTimeEl) nextFeedingTimeEl.textContent = '--:-- --';
        return;
    }

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dayLabel;
    if (nextDate.toDateString() === now.toDateString()) {
        dayLabel = 'Today';
    } else if (nextDate.toDateString() === tomorrow.toDateString()) {
        dayLabel = 'Tomorrow';
    } else {
        dayLabel = dayNames[nextDate.getDay() === 0 ? 6 : nextDate.getDay() - 1];
    }

    if (nextFeedingTimeEl) {
        nextFeedingTimeEl.textContent = `${dayLabel}, ${formatTime12h(
            `${String(nextDate.getHours()).padStart(2,'0')}:${String(nextDate.getMinutes()).padStart(2,'0')}`
        )}`;
    }
}

// ─────────────────────────────────────────────
//  Helper — Render Logs (grouped by date)
// ─────────────────────────────────────────────
function renderLogsGrouped(data) {
    const fullLogsEl   = document.getElementById('full-logs-list');
    const refillListEl = document.getElementById('refill-history-list');

    const emptyLogsMsg   = '<li>No recent logs.</li>';
    const emptyRefillMsg = '<li style="color:#888;font-size:14px;">No recent manual refills logged.</li>';

    if (!data) {
        if (logsListEl)   logsListEl.innerHTML   = emptyLogsMsg;
        if (fullLogsEl)   fullLogsEl.innerHTML   = emptyLogsMsg;
        if (refillListEl) refillListEl.innerHTML = emptyRefillMsg;
        // Still render analytics with empty data so summary cards show zeros
        renderAnalytics([]);
        return;
    }

    // Sort all logs newest first — no limitToLast so analytics sees full history
    const logsArray = Object.entries(data)
        .map(([key, val]) => ({ ...val, _key: key }))
        .filter(log => log.timestamp)
        .sort((a, b) => b.timestamp - a.timestamp);

    // Group by date label for display
    const grouped = {};
    logsArray.forEach(log => {
        const d     = new Date(log.timestamp);
        const label = d.toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(log);
    });

    if (logsListEl)   logsListEl.innerHTML   = '';
    if (fullLogsEl)   fullLogsEl.innerHTML   = '';
    if (refillListEl) refillListEl.innerHTML = '';

    let dashCount   = 0;
    let refillCount = 0;

    for (const date in grouped) {
        if (fullLogsEl) {
            fullLogsEl.innerHTML += `
                <div style="background:#f9f9f9;padding:8px;font-weight:bold;
                    margin-top:10px;color:#555;">${date}</div>`;
        }

        grouped[date].forEach(log => {
            const iconColor = log.type === 'warning' ? '#F39C12'
                            : log.type === 'error'   ? '#E74C3C'
                            : '#2EBA8A';
            const iconClass = log.type === 'warning' ? 'fas fa-exclamation-triangle'
                            : log.type === 'error'   ? 'fas fa-times-circle'
                            : 'fas fa-check-circle';
            const timeStr = log.time || new Date(log.timestamp).toLocaleTimeString();

            const dashLi = `
                <li style="display:flex;align-items:center;border-bottom:1px solid #eee;padding:10px;">
                    <i class="${iconClass} log-icon" style="margin-right:15px;color:${iconColor}"></i>
                    <span class="log-time" style="width:100px;font-size:12px;flex-shrink:0;">${timeStr}</span>
                    <span class="log-message" style="flex:1;color:#666;">${log.message}</span>
                </li>`;

            const fullLi = `
                <li style="display:flex;align-items:center;border-bottom:1px solid #eee;padding:10px;">
                    <i class="${iconClass} log-icon" style="margin-right:15px;color:${iconColor}"></i>
                    <span class="log-time" style="width:100px;font-size:12px;flex-shrink:0;">${timeStr}</span>
                    <span class="log-message" style="flex:1;color:#666;">${log.message}</span>
                    <button onclick="deleteLogEntry('${log._key}')" title="Delete log"
                        style="border:none;background:transparent;cursor:pointer;
                               color:#E74C3C;font-size:14px;padding:4px 8px;flex-shrink:0;">
                        <i class="fas fa-trash"></i>
                    </button>
                </li>`;

            if (dashCount < 5 && logsListEl) {
                logsListEl.innerHTML += dashLi;
                dashCount++;
            }
            if (fullLogsEl) fullLogsEl.innerHTML += fullLi;

            const isRefill = log.isRefill || log.message?.toLowerCase().includes('refill');
            if (isRefill && refillListEl) {
                refillListEl.innerHTML += dashLi;
                refillCount++;
            }
        });
    }

    if (refillCount === 0 && refillListEl) {
        refillListEl.innerHTML = emptyRefillMsg;
    }

    // Always re-render analytics with the full logs array
    renderAnalytics(logsArray);
}

// ─────────────────────────────────────────────
//  Helper — Format 24h → 12h AM/PM string
// ─────────────────────────────────────────────
function formatTime12h(raw) {
    let [h, m] = raw.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
}

// ─────────────────────────────────────────────
//  Helper — Show / Clear error banner
// ─────────────────────────────────────────────
function showError(msg) {
    const banner = document.getElementById('error-banner');
    if (banner) {
        banner.textContent   = msg;
        banner.style.display = 'block';
    } else {
        console.warn('Dashboard error:', msg);
    }
}

function clearError() {
    const banner = document.getElementById('error-banner');
    if (banner) banner.style.display = 'none';
}

// ─────────────────────────────────────────────
//  Analytics — Extract grams from a log message
//
//  Handles all known message formats:
//    "Manual Feed Completed (250g)"   → 250
//    "Feed Dispensed: 150g"           → 150
//    "Scheduled Feed Done 100 g"      → 100
//    "Feed Completed (75.5g)"         → 75.5
//    "Stock manually marked..."       → 0  (skip)
//    "Low stock warning"              → 0  (skip)
// ─────────────────────────────────────────────
function extractGrams(log) {
    // Priority 1: dedicated grams field written by firmware or Feed Now button
    if (log.grams && parseFloat(log.grams) > 0) return parseFloat(log.grams);

    const msg = log.message || '';

    // Priority 2: regex — matches "250g", "(250g)", "250 g", "250.5g" anywhere in the string
    const match = msg.match(/(\d+(\.\d+)?)\s*g\b/i);
    if (match) return parseFloat(match[1]);

    // Priority 3: message is clearly a feed event but has no gram value
    // (e.g. old hardware logs that just say "Feed Dispensed")
    // Use 250g as the default portion size so old data still shows up.
    const isFeedEvent = /feed\s*(completed|dispensed|done|cycle)/i.test(msg)
                     || /dispens(ed|ing)/i.test(msg)
                     || /scheduled\s*feed/i.test(msg)
                     || /manual\s*feed/i.test(msg);
    if (isFeedEvent) return 250;

    // Not a feed event (refill notice, warning, error, etc.) — skip
    return 0;
}

// ─────────────────────────────────────────────
//  Analytics — week key helper (ISO week)
// ─────────────────────────────────────────────
function getWeekKey(date) {
    const d   = new Date(date);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const week      = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
//  Analytics — state
// ─────────────────────────────────────────────
let feedChartInstance = null;
let analyticsView     = 'week';
let analyticsMonth    = new Date().getMonth();
let analyticsYear     = new Date().getFullYear();
let analyticsTabsInit = false;

// ─────────────────────────────────────────────
//  Analytics — init tabs (safe, called on nav)
// ─────────────────────────────────────────────
function initAnalyticsTabs() {
    if (analyticsTabsInit) {
        if (window._lastLogsArray) renderAnalytics(window._lastLogsArray);
        return;
    }
    analyticsTabsInit = true;

    const tabs = document.querySelectorAll('.an-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('an-tab-active'));
            tab.classList.add('an-tab-active');
            analyticsView = tab.getAttribute('data-view');
            if (window._lastLogsArray) renderAnalytics(window._lastLogsArray);
        });
    });

    document.getElementById('an-cal-prev')?.addEventListener('click', () => {
        analyticsMonth--;
        if (analyticsMonth < 0) { analyticsMonth = 11; analyticsYear--; }
        if (window._lastLogsArray) renderAnalytics(window._lastLogsArray);
    });

    document.getElementById('an-cal-next')?.addEventListener('click', () => {
        analyticsMonth++;
        if (analyticsMonth > 11) { analyticsMonth = 0; analyticsYear++; }
        if (window._lastLogsArray) renderAnalytics(window._lastLogsArray);
    });

    if (window._lastLogsArray) renderAnalytics(window._lastLogsArray);
}

// ─────────────────────────────────────────────
//  Analytics — main render
// ─────────────────────────────────────────────
function renderAnalytics(logsArray) {
    // Cache so tabs/nav can re-render without refetching Firebase
    window._lastLogsArray = logsArray || [];

    const container = document.getElementById('analytics-container');
    if (!container) return;

    // ── Aggregate by day / week / month ────────
    const byDay   = {};
    const byWeek  = {};
    const byMonth = {};

    (logsArray || []).forEach(log => {
        // Must have a timestamp to be placed on the timeline
        if (!log.timestamp) return;

        const grams = extractGrams(log);
        // Skip non-feed entries (0g means it's a refill notice, warning, etc.)
        if (grams <= 0) return;

        const d        = new Date(log.timestamp);
        const dayKey   = d.toISOString().slice(0, 10);                       // "2026-05-20"
        const weekKey  = getWeekKey(d);                                       // "2026-W21"
        const monthKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); // "2026-05"

        if (!byDay[dayKey])     byDay[dayKey]     = { count: 0, grams: 0 };
        if (!byWeek[weekKey])   byWeek[weekKey]   = { count: 0, grams: 0 };
        if (!byMonth[monthKey]) byMonth[monthKey] = { count: 0, grams: 0 };

        byDay[dayKey].count++;     byDay[dayKey].grams     += grams;
        byWeek[weekKey].count++;   byWeek[weekKey].grams   += grams;
        byMonth[monthKey].count++; byMonth[monthKey].grams += grams;
    });

    // ── Summary card values ─────────────────────
    const todayKey    = new Date().toISOString().slice(0, 10);
    const thisWeekKey = getWeekKey(new Date());
    const nowMonth    = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');

    const todayCount  = (byDay[todayKey]     || {}).count || 0;
    const todayGrams  = (byDay[todayKey]     || {}).grams || 0;
    const weekCount   = (byWeek[thisWeekKey] || {}).count || 0;
    const weekGrams   = (byWeek[thisWeekKey] || {}).grams || 0;
    const monthCount  = (byMonth[nowMonth]   || {}).count || 0;
    const monthGrams  = (byMonth[nowMonth]   || {}).grams || 0;
    const totalCount  = Object.values(byDay).reduce((s, v) => s + v.count, 0);
    const totalGrams  = Object.values(byDay).reduce((s, v) => s + v.grams, 0);

    const fmt   = g  => (g % 1 === 0) ? g + 'g' : g.toFixed(1) + 'g';
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setEl('an-today-count',       todayCount);
    setEl('an-today-grams',       fmt(todayGrams));
    setEl('an-week-count',        weekCount);
    setEl('an-week-grams',        fmt(weekGrams));
    setEl('an-month-count',       monthCount);
    setEl('an-month-grams',       fmt(monthGrams));
    setEl('an-total-count',       totalCount);
    setEl('total-feed-dispensed', fmt(totalGrams));

    // ── Render active tab view ──────────────────
    if (analyticsView === 'day')   renderDayView(byDay, todayKey);
    if (analyticsView === 'week')  renderWeekView(byWeek, thisWeekKey);
    if (analyticsView === 'month') renderMonthCalendar(byDay);
}

// ─────────────────────────────────────────────
//  Analytics — Day View (last 30 days)
// ─────────────────────────────────────────────
function renderDayView(byDay, todayKey) {
    const entries = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
    const labels  = entries.map(e => {
        const d = new Date(e[0] + 'T00:00:00');
        return e[0] === todayKey ? 'Today' : d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
    });
    const counts = entries.map(e => e[1].count);
    const grams  = entries.map(e => e[1].grams);
    const colors = entries.map(e => e[0] === todayKey ? '#00C896' : 'rgba(99,179,237,0.8)');

    buildChart(labels, counts, grams, colors, 'Daily Feeds — Last 30 Days');
    renderDetailTable(entries, 'Date', key => {
        const d = new Date(key + 'T00:00:00');
        return key === todayKey ? 'Today' : d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    });
}

// ─────────────────────────────────────────────
//  Analytics — Week View (last 12 weeks)
// ─────────────────────────────────────────────
function renderWeekView(byWeek, thisWeekKey) {
    const entries = Object.entries(byWeek).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
    const labels  = entries.map(e => {
        const parts = e[0].split('-W');
        return e[0] === thisWeekKey ? 'This Week' : `W${parts[1]} '${parts[0].slice(2)}`;
    });
    const counts = entries.map(e => e[1].count);
    const grams  = entries.map(e => e[1].grams);
    const colors = entries.map(e => e[0] === thisWeekKey ? '#00C896' : 'rgba(99,179,237,0.8)');

    buildChart(labels, counts, grams, colors, 'Weekly Feeds — Last 12 Weeks');
    renderDetailTable(entries, 'Week', key => {
        const parts = key.split('-W');
        return key === getWeekKey(new Date())
            ? `<strong>Week ${parts[1]}, ${parts[0]}</strong> <span style="color:#00C896;font-size:11px;">(current)</span>`
            : `Week ${parts[1]}, ${parts[0]}`;
    });
}

// ─────────────────────────────────────────────
//  Analytics — Month Calendar View
// ─────────────────────────────────────────────
function renderMonthCalendar(byDay) {
    const chartArea = document.getElementById('an-chart-area');
    const tableArea = document.getElementById('an-table-area');
    const calNav    = document.getElementById('an-cal-nav');
    if (!chartArea) return;

    if (calNav) calNav.style.display = 'flex';

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    const label = document.getElementById('an-cal-label');
    if (label) label.textContent = `${monthNames[analyticsMonth]} ${analyticsYear}`;

    const firstDay     = new Date(analyticsYear, analyticsMonth, 1).getDay();
    const daysInMonth  = new Date(analyticsYear, analyticsMonth + 1, 0).getDate();
    const todayKey     = new Date().toISOString().slice(0, 10);

    let monthMax = 1;
    for (let d = 1; d <= daysInMonth; d++) {
        const k = `${analyticsYear}-${String(analyticsMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        if (byDay[k] && byDay[k].count > monthMax) monthMax = byDay[k].count;
    }

    let html = '<div style="font-family:\'DM Sans\',sans-serif;">';

    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px;">';
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
        html += `<div style="text-align:center;font-size:11px;font-weight:600;color:#94A3B8;padding:4px 0;">${d}</div>`;
    });
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">';

    for (let i = 0; i < firstDay; i++) {
        html += '<div style="aspect-ratio:1;"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayKey   = `${analyticsYear}-${String(analyticsMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const data     = byDay[dayKey] || { count: 0, grams: 0 };
        const isToday  = dayKey === todayKey;
        const intensity = data.count > 0 ? Math.max(0.15, data.count / monthMax) : 0;

        let bg, textColor, border;
        if (isToday) {
            bg = '#00C896'; textColor = '#fff'; border = '2px solid #00C896';
        } else if (data.count > 0) {
            const r = Math.round(99  + (0   - 99)  * intensity);
            const g = Math.round(179 + (200 - 179) * intensity);
            const b = Math.round(237 + (150 - 237) * intensity);
            bg        = `rgba(${r},${g},${b},${0.2 + intensity * 0.8})`;
            textColor = intensity > 0.5 ? '#fff' : '#1E293B';
            border    = '1px solid rgba(99,179,237,0.3)';
        } else {
            bg = '#F8FAFC'; textColor = '#CBD5E1'; border = '1px solid #E2E8F0';
        }

        const gramsLabel = data.grams % 1 === 0 ? data.grams : data.grams.toFixed(1);
        const tooltip = data.count > 0
            ? `title="${data.count} feed${data.count !== 1 ? 's' : ''} · ${gramsLabel}g"`
            : 'title="No feeds"';

        html += `<div ${tooltip} style="aspect-ratio:1;background:${bg};border:${border};border-radius:8px;
            display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:default;
            transition:transform .15s;position:relative;padding:2px;"
            onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
            <span style="font-size:12px;font-weight:${isToday ? '700' : '500'};color:${textColor};">${day}</span>
            ${data.count > 0 ? `<span style="font-size:9px;color:${textColor};opacity:0.85;line-height:1;">${data.count}x</span>` : ''}
            </div>`;
    }
    html += '</div>';

    html += '<div style="display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap;">';
    html += '<span style="font-size:11px;color:#94A3B8;">Less</span>';
    ['rgba(99,179,237,0.2)','rgba(99,179,237,0.4)','rgba(80,190,180,0.6)','rgba(40,200,150,0.8)','#00C896'].forEach(c => {
        html += `<div style="width:16px;height:16px;background:${c};border-radius:3px;border:1px solid rgba(0,0,0,0.05);"></div>`;
    });
    html += '<span style="font-size:11px;color:#94A3B8;">More</span>';
    html += '<div style="width:16px;height:16px;background:#00C896;border-radius:3px;border:2px solid #00C896;"></div>';
    html += '<span style="font-size:11px;color:#94A3B8;">Today</span>';
    html += '</div></div>';

    chartArea.style.height = 'auto';
    chartArea.innerHTML    = html;
    if (feedChartInstance) { feedChartInstance.destroy(); feedChartInstance = null; }

    if (tableArea) {
        const monthKey = `${analyticsYear}-${String(analyticsMonth + 1).padStart(2,'0')}`;
        let mCount = 0; let mGrams = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const k = `${monthKey}-${String(d).padStart(2,'0')}`;
            if (byDay[k]) { mCount += byDay[k].count; mGrams += byDay[k].grams; }
        }
        const mName = monthNames[analyticsMonth];
        const avgG  = mCount > 0
            ? ((mGrams / mCount) % 1 === 0 ? (mGrams / mCount) : (mGrams / mCount).toFixed(1)) + 'g'
            : '--';
        tableArea.innerHTML = `
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:4px;">
                <div style="flex:1;min-width:120px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:22px;font-weight:700;color:#00C896;">${mCount}</div>
                    <div style="font-size:12px;color:#555;margin-top:2px;">Total Feeds in ${mName}</div>
                </div>
                <div style="flex:1;min-width:120px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:22px;font-weight:700;color:#F39C12;">${mGrams % 1 === 0 ? mGrams : mGrams.toFixed(1)}g</div>
                    <div style="font-size:12px;color:#555;margin-top:2px;">Total Grams in ${mName}</div>
                </div>
                <div style="flex:1;min-width:120px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:14px;text-align:center;">
                    <div style="font-size:22px;font-weight:700;color:#3498DB;">${avgG}</div>
                    <div style="font-size:12px;color:#555;margin-top:2px;">Avg Grams per Feed</div>
                </div>
            </div>`;
    }
}

// ─────────────────────────────────────────────
//  Analytics — Chart builder
// ─────────────────────────────────────────────
function buildChart(labels, counts, grams, colors, title) {
    const chartArea = document.getElementById('an-chart-area');
    const calNav    = document.getElementById('an-cal-nav');
    if (!chartArea) return;
    if (calNav) calNav.style.display = 'none';

    chartArea.style.height = '280px';
    chartArea.innerHTML    = '<canvas id="feedChart"></canvas>';

    const canvas = document.getElementById('feedChart');
    if (!canvas) return;

    if (feedChartInstance) { feedChartInstance.destroy(); feedChartInstance = null; }

    // Show a friendly empty state if there is no data yet
    if (labels.length === 0) {
        chartArea.style.height = 'auto';
        chartArea.innerHTML = `
            <div style="text-align:center;padding:48px 16px;color:#94A3B8;">
                <div style="font-size:40px;margin-bottom:12px;">🍽️</div>
                <div style="font-size:15px;font-weight:600;margin-bottom:6px;">No feed data yet</div>
                <div style="font-size:13px;">Use the Feed Now button or let a scheduled feed run,<br>then come back here to see your analytics.</div>
            </div>`;
        return;
    }

    feedChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label          : 'Feeds Dispensed',
                    data           : counts,
                    backgroundColor: colors,
                    borderRadius   : 8,
                    borderSkipped  : false,
                    yAxisID        : 'yCount',
                    order          : 1
                },
                {
                    label               : 'Grams',
                    data                : grams,
                    type                : 'line',
                    borderColor         : '#F39C12',
                    backgroundColor     : 'rgba(243,156,18,0.06)',
                    borderWidth         : 2.5,
                    pointBackgroundColor: '#F39C12',
                    pointRadius         : 4,
                    pointHoverRadius    : 6,
                    tension             : 0.4,
                    fill                : true,
                    yAxisID             : 'yGrams',
                    order               : 0
                }
            ]
        },
        options: {
            responsive         : true,
            maintainAspectRatio: false,
            interaction        : { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels  : { usePointStyle: true, padding: 20, font: { size: 12, family: 'DM Sans' } }
                },
                tooltip: {
                    backgroundColor: '#1E293B',
                    titleColor     : '#94A3B8',
                    bodyColor      : '#F8FAFC',
                    padding        : 12,
                    cornerRadius   : 8,
                    callbacks      : {
                        label: ctx => ctx.dataset.label === 'Feeds Dispensed'
                            ? `  ${ctx.parsed.y} feed${ctx.parsed.y !== 1 ? 's' : ''}`
                            : `  ${ctx.parsed.y}g dispensed`
                    }
                }
            },
            scales: {
                yCount: {
                    type      : 'linear', position: 'left', beginAtZero: true,
                    ticks     : { stepSize: 1, precision: 0, color: '#63B3ED', font: { size: 11 } },
                    grid      : { color: '#F1F5F9' },
                    title     : { display: true, text: 'Feeds', color: '#63B3ED', font: { size: 11 } }
                },
                yGrams: {
                    type      : 'linear', position: 'right', beginAtZero: true,
                    ticks     : { color: '#F39C12', font: { size: 11 }, callback: v => v + 'g' },
                    grid      : { drawOnChartArea: false },
                    title     : { display: true, text: 'Grams', color: '#F39C12', font: { size: 11 } }
                },
                x: {
                    ticks: { color: '#64748B', font: { size: 11 }, maxRotation: 45 },
                    grid : { display: false }
                }
            }
        }
    });
}

// ─────────────────────────────────────────────
//  Analytics — Detail Table
// ─────────────────────────────────────────────
function renderDetailTable(entries, colLabel, labelFn) {
    const tableArea = document.getElementById('an-table-area');
    if (!tableArea) return;

    if (entries.length === 0) {
        tableArea.innerHTML = '<p style="color:#94A3B8;font-size:13px;padding:16px 0;">No feed data yet.</p>';
        return;
    }

    const fmt  = g => (g % 1 === 0) ? g + 'g' : g.toFixed(1) + 'g';
    const rows = entries.slice().reverse().slice(0, 10).map(e => {
        const [key, v] = e;
        return `<tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:10px 14px;font-size:13px;color:#475569;">${labelFn(key)}</td>
            <td style="padding:10px 14px;text-align:center;font-size:15px;font-weight:700;color:#00C896;">${v.count}</td>
            <td style="padding:10px 14px;text-align:center;font-size:13px;color:#94A3B8;">${fmt(v.grams)}</td>
        </tr>`;
    }).join('');

    tableArea.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
                <tr style="background:#F8FAFC;border-bottom:2px solid #E2E8F0;">
                    <th style="padding:10px 14px;text-align:left;color:#64748B;font-weight:600;">${colLabel}</th>
                    <th style="padding:10px 14px;text-align:center;color:#00C896;font-weight:600;">Feeds</th>
                    <th style="padding:10px 14px;text-align:center;color:#F39C12;font-weight:600;">Grams</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}
