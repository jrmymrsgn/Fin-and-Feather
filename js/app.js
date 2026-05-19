// ─────────────────────────────────────────────
//  DOM Elements
// ─────────────────────────────────────────────
const timeEl               = document.getElementById('clock-time');
const ampmEl               = document.getElementById('clock-ampm');
const dateEl               = document.getElementById('clock-date');
const feedPercentageEl     = document.getElementById('feed-percentage');
const feedStatusText       = document.getElementById('feed-status-text');
const feedProgressBar      = document.getElementById('feed-progress-bar');
const lastFeedingTimeEl    = document.getElementById('last-feeding-time');
const lastFeedingAmountEl  = document.getElementById('last-feeding-amount');
const nextFeedingTimeEl    = document.getElementById('next-feeding-time');
const nextFeedingCountdownEl = document.getElementById('next-feeding-countdown');
const scheduleListEl       = document.getElementById('schedule-list');
const logsListEl           = document.getElementById('logs-list');
const btnFeedNow           = document.getElementById('btn-manual-feed');

// ─────────────────────────────────────────────
//  Apply safe defaults immediately so the
//  dashboard is never blank while Firebase loads
// ─────────────────────────────────────────────
function applyDefaults() {
    if (feedPercentageEl)    feedPercentageEl.textContent    = '0';
    if (feedProgressBar)     feedProgressBar.style.width     = '0%';
    if (feedStatusText)      feedStatusText.textContent      = '--';
    if (lastFeedingTimeEl)   lastFeedingTimeEl.textContent   = '--:-- --';
    if (lastFeedingAmountEl) lastFeedingAmountEl.textContent = '--';
    if (nextFeedingTimeEl)   nextFeedingTimeEl.textContent   = '--:-- --';
    if (nextFeedingCountdownEl) nextFeedingCountdownEl.textContent = 'In --h --m';
    if (scheduleListEl)      scheduleListEl.innerHTML        = '<li>Loading schedules…</li>';
    if (logsListEl)          logsListEl.innerHTML            = '<li>Loading logs…</li>';
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
    const date       = now.getDate();
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
const navItems      = document.querySelectorAll('.sidebar-nav .nav-item');
const pageSections  = document.querySelectorAll('.page-section');
const pageTitleEl   = document.getElementById('page-title');

const sectionTitles = {
    'dashboard'    : 'Admin Dashboard',
    'live-monitor' : 'Live Monitor',
    'schedule'     : 'Schedule Management',
    'logs'         : 'System Logs',
    'inventory'    : 'Inventory',
    'settings'     : 'Settings'
};

navItems.forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();

        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        pageSections.forEach(s => s.style.display = 'none');

        const targetId = item.getAttribute('data-target');
        const targetSection = document.getElementById('section-' + targetId);
        if (targetSection) targetSection.style.display = 'block';
        if (pageTitleEl && sectionTitles[targetId]) pageTitleEl.textContent = sectionTitles[targetId];

        // Init analytics tab listeners when switching to analysis
        if (targetId === "analysis") initAnalyticsTabs();

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
    // Status
    feederRef.child('status').on('value', snap => {
        updateStatusCards(snap.val() || {});
    }, err => console.error('Status listener error:', err));

    // Schedule
    feederRef.child('schedule').on('value', snap => {
        const data = snap.val();
        renderSchedule(data);
        computeNextFeeding(data);
    }, err => console.error('Schedule listener error:', err));

    // Logs — fetch latest 50, sort client-side (avoids requiring a Firebase index)
    feederRef.child('logs').limitToLast(50).on('value', snap => {
        renderLogsGrouped(snap.val());
    }, err => {
        console.error('Logs listener error:', err);
        if (logsListEl) logsListEl.innerHTML = '<li>Failed to load logs. Please refresh.</li>';
        const fullLogsEl = document.getElementById('full-logs-list');
        if (fullLogsEl) fullLogsEl.innerHTML = '<li>Failed to load logs. Please refresh.</li>';
    });

    // Settings
    feederRef.child('settings').on('value', snap => {
        const data = snap.val();
        if (!data) return;
        const set = id => document.getElementById(id);
        if (set('setting-phone'))        set('setting-phone').value        = data.phoneNumber   || '';
        if (set('setting-sms-enable'))   set('setting-sms-enable').checked = data.smsEnabled    !== false;
        if (set('setting-servo-open'))   set('setting-servo-open').value   = data.servoOpenTime || '';
        if (set('setting-servo-closed')) set('setting-servo-closed').value = data.servoClosedTime || '';
        if (set('setting-hopper-height')) set('setting-hopper-height').value = data.hopperHeight || '';
    }, err => console.error('Settings listener error:', err));
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

    // Send dispense command to hardware
    feederRef.child('control').update({ dispense_now: true, trigger_time: Date.now() });

    // Write log in the same format as hardware: "Manual Feed Completed (250g)"
    // so renderAnalytics picks it up exactly like a scheduled feed
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
const timesCountSelect             = document.getElementById('schedule-times-count');
const dynamicTimeInputsContainer   = document.getElementById('dynamic-time-inputs');

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
                day      : cb.value,
                time     : formatTime12h(time),
                rawTime  : time,
                amount   : parseInt(amount)
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

    if (feedPercentageEl) feedPercentageEl.textContent   = level;
    if (feedProgressBar)  feedProgressBar.style.width    = `${level}%`;

    const invLevelEl = document.getElementById('inv-level');
    if (invLevelEl) invLevelEl.textContent = level + '%';

    if (feedStatusText) {
        if (level <= 20) {
            feedStatusText.textContent  = 'Low';
            feedStatusText.style.color  = 'var(--color-feed-low)';
            feedProgressBar?.classList.add('low');
        } else {
            feedStatusText.textContent  = 'Healthy';
            feedStatusText.style.color  = 'var(--text-muted)';
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

    // Group by day
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
        if (nextFeedingTimeEl)     nextFeedingTimeEl.textContent     = '--:-- --';
        if (nextFeedingCountdownEl) nextFeedingCountdownEl.textContent = 'In --h --m';
        return;
    }

    const now          = new Date();
    const dayNames     = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const currentDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon … 6=Sun
    let nextDate       = null;

    for (const key in schedules) {
        const { day, rawTime } = schedules[key];
        if (!day || !rawTime) continue;

        const [h, m]     = rawTime.split(':').map(Number);
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

    const emptyLogsMsg  = '<li>No recent logs.</li>';
    const emptyRefillMsg = '<li style="color:#888;font-size:14px;">No recent manual refills logged.</li>';

    if (!data) {
        if (logsListEl)   logsListEl.innerHTML   = emptyLogsMsg;
        if (fullLogsEl)   fullLogsEl.innerHTML   = emptyLogsMsg;
        if (refillListEl) refillListEl.innerHTML = emptyRefillMsg;
        return;
    }

    // Sort client-side: newest first (no Firebase index required)
    const logsArray = Object.entries(data)
        .map(([key, val]) => ({ ...val, _key: key }))
        .filter(log => log.timestamp)                              // skip malformed entries
        .sort((a, b) => b.timestamp - a.timestamp);               // newest first

    // Group by date label
    const grouped = {};
    logsArray.forEach(log => {
        const d = new Date(log.timestamp || Date.now());
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

    // Re-render analytics whenever logs update
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
//  Helper — Show error in dashboard (non-blocking)
// ─────────────────────────────────────────────
function showError(msg) {
    const banner = document.getElementById('error-banner');
    if (banner) {
        banner.textContent = msg;
        banner.style.display = 'block';
    } else {
        console.warn('Dashboard error:', msg);
    }
}

// ─────────────────────────────────────────────
//  Analytics — Grams Dispensed per Day & Week
//  Reads grams from log messages, e.g.:
//  "Dispensed 50g", "Fed 30g", "50g dispensed"
// ─────────────────────────────────────────────
function extractGrams(message) {
    if (!message) return 0;
    const match = message.match(/(\d+(\.\d+)?)\s*g\b/i);
    return match ? parseFloat(match[1]) : 0;
}

function getWeekKey(date) {
    const d   = new Date(date);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}



// ─────────────────────────────────────────────
//  Analytics — full rewrite
//  Shows: Day / Week / Month views + calendar
// ─────────────────────────────────────────────
let feedChartInstance = null;
let analyticsView     = "week";   // "day" | "week" | "month"
let analyticsMonth    = new Date().getMonth();
let analyticsYear     = new Date().getFullYear();

// Called from nav click to init view buttons
function initAnalyticsTabs() {
    var tabs = document.querySelectorAll(".an-tab");
    tabs.forEach(function(tab) {
        tab.addEventListener("click", function() {
            tabs.forEach(function(t){ t.classList.remove("an-tab-active"); });
            tab.classList.add("an-tab-active");
            analyticsView = tab.getAttribute("data-view");
            if (window._lastLogsArray) renderAnalytics(window._lastLogsArray);
        });
    });

    var prevBtn = document.getElementById("an-cal-prev");
    var nextBtn = document.getElementById("an-cal-next");
    if (prevBtn) prevBtn.addEventListener("click", function() {
        analyticsMonth--;
        if (analyticsMonth < 0) { analyticsMonth = 11; analyticsYear--; }
        if (window._lastLogsArray) renderAnalytics(window._lastLogsArray);
    });
    if (nextBtn) nextBtn.addEventListener("click", function() {
        analyticsMonth++;
        if (analyticsMonth > 11) { analyticsMonth = 0; analyticsYear++; }
        if (window._lastLogsArray) renderAnalytics(window._lastLogsArray);
    });
}

function renderAnalytics(logsArray) {
    window._lastLogsArray = logsArray;

    var container = document.getElementById("analytics-container");
    if (!container) return;

    // ── Aggregate ALL logs ──────────────────────
    var byDay  = {};
    var byWeek = {};
    var byMonth = {};

    (logsArray || []).forEach(function(log) {
        var grams = extractGrams(log.message);
        if (grams <= 0) return;

        var d        = new Date(log.timestamp);
        var dayKey   = d.toISOString().slice(0, 10);
        var weekKey  = getWeekKey(d);
        var monthKey = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");

        if (!byDay[dayKey])     byDay[dayKey]     = { count: 0, grams: 0 };
        if (!byWeek[weekKey])   byWeek[weekKey]   = { count: 0, grams: 0 };
        if (!byMonth[monthKey]) byMonth[monthKey] = { count: 0, grams: 0 };

        byDay[dayKey].count++;     byDay[dayKey].grams     += grams;
        byWeek[weekKey].count++;   byWeek[weekKey].grams   += grams;
        byMonth[monthKey].count++; byMonth[monthKey].grams += grams;
    });

    var todayKey    = new Date().toISOString().slice(0, 10);
    var thisWeekKey = getWeekKey(new Date());
    var nowMonth    = new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0");

    var todayCount  = (byDay[todayKey]     || {}).count || 0;
    var todayGrams  = (byDay[todayKey]     || {}).grams || 0;
    var weekCount   = (byWeek[thisWeekKey] || {}).count || 0;
    var weekGrams   = (byWeek[thisWeekKey] || {}).grams || 0;
    var monthCount  = (byMonth[nowMonth]   || {}).count || 0;
    var monthGrams  = (byMonth[nowMonth]   || {}).grams || 0;
    var totalCount  = Object.values(byDay).reduce(function(s,v){ return s + v.count; }, 0);
    var totalGrams  = Object.values(byDay).reduce(function(s,v){ return s + v.grams; }, 0);

    function fmt(g) { return (g % 1 === 0) ? g + "g" : g.toFixed(1) + "g"; }
    function setEl(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

    // ── Update summary cards ────────────────────
    setEl("an-today-count",       todayCount);
    setEl("an-today-grams",       fmt(todayGrams));
    setEl("an-week-count",        weekCount);
    setEl("an-week-grams",        fmt(weekGrams));
    setEl("an-month-count",       monthCount);
    setEl("an-month-grams",       fmt(monthGrams));
    setEl("an-total-count",       totalCount);
    setEl("total-feed-dispensed", fmt(totalGrams));

    // ── Render based on active tab ──────────────
    if (analyticsView === "day")   renderDayView(byDay,  todayKey);
    if (analyticsView === "week")  renderWeekView(byWeek, thisWeekKey);
    if (analyticsView === "month") renderMonthCalendar(byDay);
}

// ── DAY VIEW ───────────────────────────────────
function renderDayView(byDay, todayKey) {
    var entries = Object.entries(byDay).sort(function(a,b){ return a[0].localeCompare(b[0]); }).slice(-30);
    var labels  = entries.map(function(e) {
        var d = new Date(e[0] + "T00:00:00");
        return e[0] === todayKey ? "Today" : d.toLocaleDateString(undefined, { month:"short", day:"numeric" });
    });
    var counts  = entries.map(function(e){ return e[1].count; });
    var grams   = entries.map(function(e){ return e[1].grams; });
    var colors  = entries.map(function(e){ return e[0] === todayKey ? "#00C896" : "rgba(99,179,237,0.8)"; });

    buildChart(labels, counts, grams, colors, "Daily Feeds — Last 30 Days");
    renderDetailTable(entries, "Date", function(key) {
        var d = new Date(key + "T00:00:00");
        return key === todayKey ? "Today" : d.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
    });
}

// ── WEEK VIEW ──────────────────────────────────
function renderWeekView(byWeek, thisWeekKey) {
    var entries = Object.entries(byWeek).sort(function(a,b){ return a[0].localeCompare(b[0]); }).slice(-12);
    var labels  = entries.map(function(e) {
        var parts = e[0].split("-W");
        return e[0] === thisWeekKey ? "This Week" : "W" + parts[1] + " '" + parts[0].slice(2);
    });
    var counts  = entries.map(function(e){ return e[1].count; });
    var grams   = entries.map(function(e){ return e[1].grams; });
    var colors  = entries.map(function(e){ return e[0] === thisWeekKey ? "#00C896" : "rgba(99,179,237,0.8)"; });

    buildChart(labels, counts, grams, colors, "Weekly Feeds — Last 12 Weeks");
    renderDetailTable(entries, "Week", function(key) {
        var parts = key.split("-W");
        return (key === GetWeekKeyNow()) ? "<strong>Week " + parts[1] + ", " + parts[0] + "</strong> <span style='color:#00C896;font-size:11px;'>(current)</span>"
            : "Week " + parts[1] + ", " + parts[0];
    });
}

function GetWeekKeyNow() { return getWeekKey(new Date()); }

// ── MONTH CALENDAR VIEW ────────────────────────
function renderMonthCalendar(byDay) {
    var chartArea  = document.getElementById("an-chart-area");
    var tableArea  = document.getElementById("an-table-area");
    var calNav     = document.getElementById("an-cal-nav");
    if (!chartArea) return;

    if (calNav) calNav.style.display = "flex";

    // Update month/year label
    var monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    var label = document.getElementById("an-cal-label");
    if (label) label.textContent = monthNames[analyticsMonth] + " " + analyticsYear;

    // Build calendar grid
    var firstDay = new Date(analyticsYear, analyticsMonth, 1).getDay(); // 0=Sun
    var daysInMonth = new Date(analyticsYear, analyticsMonth + 1, 0).getDate();
    var todayKey = new Date().toISOString().slice(0, 10);

    // Find max for heat scale
    var monthMax = 1;
    for (var d = 1; d <= daysInMonth; d++) {
        var k = analyticsYear + "-" + String(analyticsMonth+1).padStart(2,"0") + "-" + String(d).padStart(2,"0");
        if (byDay[k] && byDay[k].count > monthMax) monthMax = byDay[k].count;
    }

    var html = '<div style="font-family:\'DM Sans\',sans-serif;">';

    // Day headers
    var dayHeaders = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px;">';
    dayHeaders.forEach(function(d) {
        html += '<div style="text-align:center;font-size:11px;font-weight:600;color:#94A3B8;padding:4px 0;">' + d + '</div>';
    });
    html += '</div>';

    // Calendar cells
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">';

    // Empty cells before first day
    for (var i = 0; i < firstDay; i++) {
        html += '<div style="aspect-ratio:1;"></div>';
    }

    for (var day = 1; day <= daysInMonth; day++) {
        var dayKey = analyticsYear + "-" + String(analyticsMonth+1).padStart(2,"0") + "-" + String(day).padStart(2,"0");
        var data   = byDay[dayKey] || { count: 0, grams: 0 };
        var isToday = dayKey === todayKey;
        var intensity = data.count > 0 ? Math.max(0.15, data.count / monthMax) : 0;

        var bg, textColor, border;
        if (isToday) {
            bg = "#00C896"; textColor = "#fff"; border = "2px solid #00C896";
        } else if (data.count > 0) {
            var r = Math.round(99  + (0   - 99)  * intensity);
            var g = Math.round(179 + (200 - 179) * intensity);
            var b = Math.round(237 + (150 - 237) * intensity);
            bg = "rgba(" + r + "," + g + "," + b + "," + (0.2 + intensity * 0.8) + ")";
            textColor = intensity > 0.5 ? "#fff" : "#1E293B";
            border = "1px solid rgba(99,179,237,0.3)";
        } else {
            bg = "#F8FAFC"; textColor = "#CBD5E1"; border = "1px solid #E2E8F0";
        }

        var tooltip = data.count > 0
            ? 'title="' + data.count + ' feed' + (data.count !== 1 ? "s" : "") + ' · ' + (data.grams % 1 === 0 ? data.grams : data.grams.toFixed(1)) + 'g"'
            : 'title="No feeds"';

        html += '<div ' + tooltip + ' style="aspect-ratio:1;background:' + bg + ';border:' + border + ';border-radius:8px;' +
            'display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:default;' +
            'transition:transform .15s;position:relative;padding:2px;" ' +
            'onmouseover="this.style.transform=\'scale(1.08)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
            '<span style="font-size:12px;font-weight:' + (isToday ? "700" : "500") + ';color:' + textColor + ';">' + day + '</span>' +
            (data.count > 0 ? '<span style="font-size:9px;color:' + textColor + ';opacity:0.85;line-height:1;">' + data.count + 'x</span>' : '') +
            '</div>';
    }
    html += '</div>';

    // Legend
    html += '<div style="display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap;">';
    html += '<span style="font-size:11px;color:#94A3B8;">Less</span>';
    ["rgba(99,179,237,0.2)","rgba(99,179,237,0.4)","rgba(80,190,180,0.6)","rgba(40,200,150,0.8)","#00C896"].forEach(function(c) {
        html += '<div style="width:16px;height:16px;background:' + c + ';border-radius:3px;border:1px solid rgba(0,0,0,0.05);"></div>';
    });
    html += '<span style="font-size:11px;color:#94A3B8;">More</span>';
    html += '<div style="width:16px;height:16px;background:#00C896;border-radius:3px;border:2px solid #00C896;"></div>';
    html += '<span style="font-size:11px;color:#94A3B8;">Today</span>';
    html += '</div>';

    html += '</div>';

    chartArea.style.height = "auto";
    chartArea.innerHTML = html;
    if (feedChartInstance) { feedChartInstance.destroy(); feedChartInstance = null; }

    // Monthly summary table below calendar
    if (tableArea) {
        var monthName = monthNames[analyticsMonth];
        var monthKey  = analyticsYear + "-" + String(analyticsMonth+1).padStart(2,"0");
        var mCount = 0; var mGrams = 0;
        for (var d2 = 1; d2 <= daysInMonth; d2++) {
            var k2 = monthKey + "-" + String(d2).padStart(2,"0");
            if (byDay[k2]) { mCount += byDay[k2].count; mGrams += byDay[k2].grams; }
        }
        tableArea.innerHTML =
            '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:4px;">' +
            '<div style="flex:1;min-width:120px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:14px;text-align:center;">' +
            '<div style="font-size:22px;font-weight:700;color:#00C896;">' + mCount + '</div>' +
            '<div style="font-size:12px;color:#555;margin-top:2px;">Total Feeds in ' + monthName + '</div></div>' +
            '<div style="flex:1;min-width:120px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:14px;text-align:center;">' +
            '<div style="font-size:22px;font-weight:700;color:#F39C12;">' + (mGrams % 1 === 0 ? mGrams : mGrams.toFixed(1)) + 'g</div>' +
            '<div style="font-size:12px;color:#555;margin-top:2px;">Total Grams in ' + monthName + '</div></div>' +
            '<div style="flex:1;min-width:120px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:14px;text-align:center;">' +
            '<div style="font-size:22px;font-weight:700;color:#3498DB;">' + (mCount > 0 ? (mGrams / mCount % 1 === 0 ? mGrams/mCount : (mGrams/mCount).toFixed(1)) + 'g' : "--") + '</div>' +
            '<div style="font-size:12px;color:#555;margin-top:2px;">Avg Grams per Feed</div></div>' +
            '</div>';
    }
}

// ── Chart builder ──────────────────────────────
function buildChart(labels, counts, grams, colors, title) {
    var chartArea = document.getElementById("an-chart-area");
    var calNav    = document.getElementById("an-cal-nav");
    if (!chartArea) return;
    if (calNav) calNav.style.display = "none";

    chartArea.style.height = "280px";
    chartArea.innerHTML = '<canvas id="feedChart"></canvas>';

    var canvas = document.getElementById("feedChart");
    if (!canvas) return;

    if (feedChartInstance) { feedChartInstance.destroy(); feedChartInstance = null; }

    feedChartInstance = new Chart(canvas, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Feeds Dispensed",
                    data: counts,
                    backgroundColor: colors,
                    borderRadius: 8,
                    borderSkipped: false,
                    yAxisID: "yCount",
                    order: 1
                },
                {
                    label: "Grams",
                    data: grams,
                    type: "line",
                    borderColor: "#F39C12",
                    backgroundColor: "rgba(243,156,18,0.06)",
                    borderWidth: 2.5,
                    pointBackgroundColor: "#F39C12",
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.4,
                    fill: true,
                    yAxisID: "yGrams",
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: {
                    position: "top",
                    labels: { usePointStyle: true, padding: 20, font: { size: 12, family: "DM Sans" } }
                },
                tooltip: {
                    backgroundColor: "#1E293B",
                    titleColor: "#94A3B8",
                    bodyColor: "#F8FAFC",
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(ctx) {
                            return ctx.dataset.label === "Feeds Dispensed"
                                ? "  " + ctx.parsed.y + " feed" + (ctx.parsed.y !== 1 ? "s" : "")
                                : "  " + ctx.parsed.y + "g dispensed";
                        }
                    }
                }
            },
            scales: {
                yCount: {
                    type: "linear", position: "left", beginAtZero: true,
                    ticks: { stepSize: 1, precision: 0, color: "#63B3ED", font: { size: 11 } },
                    grid: { color: "#F1F5F9" },
                    title: { display: true, text: "Feeds", color: "#63B3ED", font: { size: 11 } }
                },
                yGrams: {
                    type: "linear", position: "right", beginAtZero: true,
                    ticks: { color: "#F39C12", font: { size: 11 }, callback: function(v){ return v + "g"; } },
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: "Grams", color: "#F39C12", font: { size: 11 } }
                },
                x: {
                    ticks: { color: "#64748B", font: { size: 11 }, maxRotation: 45 },
                    grid: { display: false }
                }
            }
        }
    });
}

// ── Detail Table ───────────────────────────────
function renderDetailTable(entries, colLabel, labelFn) {
    var tableArea = document.getElementById("an-table-area");
    if (!tableArea) return;

    if (entries.length === 0) {
        tableArea.innerHTML = '<p style="color:#94A3B8;font-size:13px;padding:16px 0;">No data yet.</p>';
        return;
    }

    var reversed = entries.slice().reverse();
    var rows = reversed.slice(0, 10).map(function(e) {
        var key = e[0]; var v = e[1];
        var fmt = function(g){ return (g % 1 === 0) ? g + "g" : g.toFixed(1) + "g"; };
        return '<tr style="border-bottom:1px solid #F1F5F9;">' +
            '<td style="padding:10px 14px;font-size:13px;color:#475569;">' + labelFn(key) + '</td>' +
            '<td style="padding:10px 14px;text-align:center;font-size:15px;font-weight:700;color:#00C896;">' + v.count + '</td>' +
            '<td style="padding:10px 14px;text-align:center;font-size:13px;color:#94A3B8;">' + fmt(v.grams) + '</td>' +
            '</tr>';
    }).join("");

    tableArea.innerHTML =
        '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
        '<thead><tr style="background:#F8FAFC;border-bottom:2px solid #E2E8F0;">' +
        '<th style="padding:10px 14px;text-align:left;color:#64748B;font-weight:600;">' + colLabel + '</th>' +
        '<th style="padding:10px 14px;text-align:center;color:#00C896;font-weight:600;">Feeds</th>' +
        '<th style="padding:10px 14px;text-align:center;color:#F39C12;font-weight:600;">Grams</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>';

    // ─────────────────────────────────────────────
//  Analytics — Initialize Once
// ─────────────────────────────────────────────
let analyticsInitialized = false;

function initializeAnalyticsSystem() {

    if (analyticsInitialized) return;
    analyticsInitialized = true;

    // Default active tab
    const defaultTab = document.querySelector('.an-tab[data-view="week"]');
    if (defaultTab) {
        defaultTab.classList.add('an-tab-active');
    }

    // Analytics tab switching
    const tabs = document.querySelectorAll('.an-tab');

    tabs.forEach(tab => {

        tab.addEventListener('click', () => {

            tabs.forEach(t => {
                t.classList.remove('an-tab-active');
            });

            tab.classList.add('an-tab-active');

            analyticsView = tab.getAttribute('data-view');

            if (window._lastLogsArray) {
                renderAnalytics(window._lastLogsArray);
            }
        });
    });

    // Calendar navigation
    const prevBtn = document.getElementById('an-cal-prev');
    const nextBtn = document.getElementById('an-cal-next');

    prevBtn?.addEventListener('click', () => {

        analyticsMonth--;

        if (analyticsMonth < 0) {
            analyticsMonth = 11;
            analyticsYear--;
        }

        if (window._lastLogsArray) {
            renderAnalytics(window._lastLogsArray);
        }
    });

    nextBtn?.addEventListener('click', () => {

        analyticsMonth++;

        if (analyticsMonth > 11) {
            analyticsMonth = 0;
            analyticsYear++;
        }

        if (window._lastLogsArray) {
            renderAnalytics(window._lastLogsArray);
        }
    });
}

// ─────────────────────────────────────────────
//  Toast Notification System
// ─────────────────────────────────────────────
function showToast(message, type = 'success') {

    const toast = document.createElement('div');

    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 18px';
    toast.style.borderRadius = '8px';
    toast.style.color = '#fff';
    toast.style.fontWeight = '500';
    toast.style.zIndex = '9999';
    toast.style.opacity = '0';
    toast.style.transition = 'all .3s ease';

    if (type === 'error') {
        toast.style.background = '#E74C3C';
    }
    else if (type === 'warning') {
        toast.style.background = '#F39C12';
    }
    else {
        toast.style.background = '#00C896';
    }

    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(-10px)';
    }, 50);

    setTimeout(() => {

        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';

        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);

    }, 3000);
}

// ─────────────────────────────────────────────
//  Connection Status Monitor
// ─────────────────────────────────────────────
function updateConnectionStatus(online) {

    const el = document.getElementById('connection-status');

    if (!el) return;

    if (online) {
        el.textContent = 'Connected';
        el.style.color = '#00C896';
    }
    else {
        el.textContent = 'Disconnected';
        el.style.color = '#E74C3C';
    }
}

window.addEventListener('online', () => {
    updateConnectionStatus(true);
});

window.addEventListener('offline', () => {
    updateConnectionStatus(false);
});

updateConnectionStatus(navigator.onLine);

// ─────────────────────────────────────────────
//  Firebase Realtime Connection
// ─────────────────────────────────────────────
firebase.database().ref(".info/connected")
.on("value", snap => {

    updateConnectionStatus(!!snap.val());

});

// ─────────────────────────────────────────────
//  Logs Search Filter
// ─────────────────────────────────────────────
const logsSearchInput = document.getElementById('logs-search');

logsSearchInput?.addEventListener('input', e => {

    const keyword = e.target.value.toLowerCase();

    const items = document.querySelectorAll('#full-logs-list li');

    items.forEach(item => {

        const text = item.textContent.toLowerCase();

        item.style.display =
            text.includes(keyword)
            ? 'flex'
            : 'none';
    });
});

// ─────────────────────────────────────────────
//  Export Logs
// ─────────────────────────────────────────────
document.getElementById('btn-export-logs')
?.addEventListener('click', () => {

    const items = document.querySelectorAll('#full-logs-list li');

    if (!items.length) {
        return showToast('No logs to export', 'warning');
    }

    let content = 'SMART FEEDING SYSTEM LOGS\n';
    content += '============================\n\n';

    items.forEach(item => {
        content += item.innerText + '\n';
    });

    const blob = new Blob([content], {
        type: 'text/plain'
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;
    a.download = 'feeding-system-logs.txt';

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    showToast('Logs exported successfully');
});

// ─────────────────────────────────────────────
//  Auto-close Sidebar on Resize
// ─────────────────────────────────────────────
window.addEventListener('resize', () => {

    if (window.innerWidth > 992) {

        sidebar?.classList.remove('open');
        sidebarOverlay?.classList.remove('show');
    }
});

// ─────────────────────────────────────────────
//  Close Edit Modal Outside Click
// ─────────────────────────────────────────────
window.addEventListener('click', e => {

    const modal = document.getElementById('edit-schedule-modal');

    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

// ─────────────────────────────────────────────
//  Inventory Warning
// ─────────────────────────────────────────────
function updateInventoryWarnings(level) {

    const warningEl =
        document.getElementById('inventory-warning');

    if (!warningEl) return;

    if (level <= 10) {

        warningEl.style.display = 'block';
        warningEl.style.color = '#E74C3C';
        warningEl.textContent =
            'Critical feed level! Refill immediately.';

    }
    else if (level <= 20) {

        warningEl.style.display = 'block';
        warningEl.style.color = '#F39C12';
        warningEl.textContent =
            'Low feed level. Please refill soon.';

    }
    else {

        warningEl.style.display = 'none';
    }
}

// ─────────────────────────────────────────────
//  Extend Status Updates
// ─────────────────────────────────────────────
const originalUpdateStatusCards = updateStatusCards;

updateStatusCards = function(data) {

    originalUpdateStatusCards(data);

    const level = data.feedLevel || 0;

    updateInventoryWarnings(level);
};

// ─────────────────────────────────────────────
//  Initialize App
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    initializeAnalyticsSystem();

    if (timesCountSelect) {
        timesCountSelect.dispatchEvent(new Event('change'));
    }

    console.log('Smart Feeding Dashboard Fully Loaded');
});
}
