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

// ─────────────────────────────────────────────
//  Analysis — Tab switcher
// ─────────────────────────────────────────────
var currentAnalysisTab = 'day';

function switchAnalysisTab(tab) {
    currentAnalysisTab = tab;
    var views = ['day', 'week', 'month', 'calendar'];

    var gradients = {
        day:      'linear-gradient(135deg,#3498DB,#2980b9)',
        week:     'linear-gradient(135deg,#2EBA8A,#27a376)',
        month:    'linear-gradient(135deg,#9B59B6,#8e44ad)',
        calendar: 'linear-gradient(135deg,#E74C3C,#c0392b)'
    };
    var shadows = {
        day:      'rgba(52,152,219,0.35)',
        week:     'rgba(46,186,138,0.35)',
        month:    'rgba(155,89,182,0.35)',
        calendar: 'rgba(231,76,60,0.35)'
    };

    views.forEach(function(v) {
        var el  = document.getElementById('an-view-' + v);
        var btn = document.getElementById('tab-' + v);
        if (!el || !btn) return;
        if (v === tab) {
            el.style.display = 'block';
            btn.style.background  = gradients[tab];
            btn.style.color       = '#fff';
            btn.style.boxShadow   = '0 2px 8px ' + shadows[tab];
        } else {
            el.style.display      = 'none';
            btn.style.background  = 'transparent';
            btn.style.color       = '#888';
            btn.style.boxShadow   = 'none';
        }
    });

    if (tab === 'calendar') renderCalendar();
}

// ─────────────────────────────────────────────
//  Analysis — Calendar state
// ─────────────────────────────────────────────
var calYear  = new Date().getFullYear();
var calMonth = new Date().getMonth(); // 0-indexed
var calDayData = {};  // populated by renderAnalytics

function calPrev()    { calMonth--; if (calMonth < 0)  { calMonth = 11; calYear--; } renderCalendar(); }
function calNext()    { calMonth++; if (calMonth > 11) { calMonth = 0;  calYear++; } renderCalendar(); }
function calGoToday() { calYear = new Date().getFullYear(); calMonth = new Date().getMonth(); renderCalendar(); }

function renderCalendar() {
    var labelEl = document.getElementById('cal-month-label');
    var grid    = document.getElementById('cal-grid');
    var detail  = document.getElementById('cal-detail');
    if (!grid) return;

    var monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
    if (labelEl) labelEl.textContent = monthNames[calMonth] + ' ' + calYear;

    var firstDay  = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    var todayKey  = new Date().toISOString().slice(0, 10);

    var html = '';

    // Empty cells before first day
    for (var i = 0; i < firstDay; i++) {
        html += '<div style="min-height:64px;"></div>';
    }

    for (var d = 1; d <= daysInMonth; d++) {
        var mm   = String(calMonth + 1).padStart(2, '0');
        var dd   = String(d).padStart(2, '0');
        var key  = calYear + '-' + mm + '-' + dd;
        var data = calDayData[key] || { count: 0, grams: 0 };
        var isToday = (key === todayKey);

        var bg = '#f5f5f5';
        var textColor = '#bbb';
        var countColor = '#ccc';
        if (data.count >= 5) { bg = '#2EBA8A'; textColor = '#fff'; countColor = '#fff'; }
        else if (data.count >= 3) { bg = '#3dbf7e'; textColor = '#fff'; countColor = '#fff'; }
        else if (data.count >= 1) { bg = '#a8e6cf'; textColor = '#2d7a5f'; countColor = '#2d7a5f'; }
        else { bg = '#f5f5f5'; textColor = '#bbb'; countColor = '#ddd'; }

        var border = isToday ? '2px solid #3498DB' : '1px solid transparent';
        var dayNumColor = isToday ? '#3498DB' : (data.count > 0 ? textColor : '#999');

        html += '<div onclick="calSelectDay(\'' + key + '\')" style="' +
            'min-height:64px;background:' + bg + ';border-radius:8px;padding:8px;' +
            'cursor:pointer;border:' + border + ';transition:transform .1s;position:relative;' +
            '" onmouseover="this.style.transform=\'scale(1.03)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
            '<div style="font-size:13px;font-weight:700;color:' + dayNumColor + ';">' + d + '</div>';

        if (data.count > 0) {
            html += '<div style="font-size:18px;font-weight:800;color:' + countColor + ';line-height:1;margin-top:4px;">' + data.count + '</div>' +
                    '<div style="font-size:10px;color:' + countColor + ';opacity:0.85;">' + data.grams + 'g</div>';
        }
        html += '</div>';
    }

    grid.innerHTML = html;
    if (detail) detail.style.display = 'none';
}

function calSelectDay(key) {
    var detail     = document.getElementById('cal-detail');
    var detailDate = document.getElementById('cal-detail-date');
    var detailBody = document.getElementById('cal-detail-body');
    if (!detail) return;

    var data = calDayData[key] || { count: 0, grams: 0 };
    var d    = new Date(key + 'T00:00:00');
    var label = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    detailDate.textContent = label;

    if (data.count === 0) {
        detailBody.innerHTML = '<span style="color:#aaa;">No feeds recorded on this day.</span>';
    } else {
        detailBody.innerHTML =
            '<span style="color:#2EBA8A;font-weight:700;font-size:16px;">' + data.count + ' feed' + (data.count !== 1 ? 's' : '') + '</span>' +
            ' &nbsp;•&nbsp; <span style="color:#F39C12;font-weight:700;">' + data.grams + 'g total</span>' +
            ' &nbsp;•&nbsp; <span style="color:#888;">avg ' + (data.count > 0 ? (data.grams / data.count).toFixed(1) : 0) + 'g/feed</span>';
    }

    detail.style.display = 'block';
}

// ─────────────────────────────────────────────
//  Analytics — Main render
// ─────────────────────────────────────────────
var feedChartInstance      = null;
var feedChartWeekInstance  = null;
var feedChartMonthInstance = null;

function renderAnalytics(logsArray) {

    var byDay   = {};
    var byWeek  = {};
    var byMonth = {};

    (logsArray || []).forEach(function(log) {
        var grams = extractGrams(log.message);
        if (grams <= 0) return;

        var d         = new Date(log.timestamp);
        var dayKey    = d.toISOString().slice(0, 10);
        var weekKey   = getWeekKey(d);
        var monthKey  = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

        if (!byDay[dayKey])     byDay[dayKey]     = { count: 0, grams: 0 };
        if (!byWeek[weekKey])   byWeek[weekKey]   = { count: 0, grams: 0 };
        if (!byMonth[monthKey]) byMonth[monthKey] = { count: 0, grams: 0 };

        byDay[dayKey].count++;    byDay[dayKey].grams    += grams;
        byWeek[weekKey].count++;  byWeek[weekKey].grams  += grams;
        byMonth[monthKey].count++;byMonth[monthKey].grams+= grams;
    });

    // Share day data with calendar
    calDayData = byDay;
    if (currentAnalysisTab === 'calendar') renderCalendar();

    var dayEntries   = Object.entries(byDay).sort(function(a,b){ return a[0].localeCompare(b[0]); });
    var weekEntries  = Object.entries(byWeek).sort(function(a,b){ return b[0].localeCompare(a[0]); });
    var monthEntries = Object.entries(byMonth).sort(function(a,b){ return b[0].localeCompare(a[0]); });

    var todayKey     = new Date().toISOString().slice(0, 10);
    var thisWeekKey  = getWeekKey(new Date());
    var now          = new Date();
    var thisMonthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    var todayData  = byDay[todayKey]      || { count: 0, grams: 0 };
    var weekData   = byWeek[thisWeekKey]  || { count: 0, grams: 0 };
    var monthData  = byMonth[thisMonthKey]|| { count: 0, grams: 0 };
    var totalCount = dayEntries.reduce(function(s, e){ return s + e[1].count; }, 0);
    var totalGrams = dayEntries.reduce(function(s, e){ return s + e[1].grams; }, 0);

    function fmt(g) { return (g % 1 === 0) ? g + 'g' : g.toFixed(1) + 'g'; }
    function setEl(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

    // Stat cards
    setEl('an-today-count',    todayData.count);
    setEl('an-today-grams',    fmt(todayData.grams));
    setEl('an-week-count',     weekData.count);
    setEl('an-week-grams',     fmt(weekData.grams));
    setEl('an-month-count',    monthData.count);
    setEl('an-month-grams',    fmt(monthData.grams));
    setEl('an-total-count',    totalCount);
    setEl('total-feed-dispensed', fmt(totalGrams));

    // ── Daily table ────────────────────────────
    var dayTable = document.getElementById('an-day-table');
    if (dayTable) {
        var dayRows = dayEntries.slice().reverse().slice(0, 30);
        if (dayRows.length === 0) {
            dayTable.innerHTML = '<tr><td colspan="4" style="color:#aaa;padding:16px;text-align:center;">No data yet.</td></tr>';
        } else {
            dayTable.innerHTML = dayRows.map(function(e) {
                var key = e[0]; var v = e[1];
                var d = new Date(key + 'T00:00:00');
                var label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                var isToday = key === todayKey;
                var avg = v.count > 0 ? (v.grams / v.count).toFixed(1) : '0';
                return '<tr style="' + (isToday ? 'background:#f0faf6;font-weight:600;' : '') + 'border-bottom:1px solid #f0f0f0;">' +
                    '<td style="padding:11px 16px;color:#444;">' + (isToday ? '<span style="color:#2EBA8A;">\u25CF</span> Today &mdash; ' : '') + label + '</td>' +
                    '<td style="padding:11px 16px;text-align:center;color:#3498DB;font-weight:700;font-size:15px;">' + v.count + '</td>' +
                    '<td style="padding:11px 16px;text-align:center;color:#F39C12;font-weight:600;">' + fmt(v.grams) + '</td>' +
                    '<td style="padding:11px 16px;text-align:center;color:#2EBA8A;font-size:13px;">' + avg + 'g</td>' +
                    '</tr>';
            }).join('');
        }
    }

    // ── Weekly table ───────────────────────────
    var weekTable = document.getElementById('an-week-table-body');
    if (weekTable) {
        if (weekEntries.length === 0) {
            weekTable.innerHTML = '<tr><td colspan="4" style="color:#aaa;padding:16px;text-align:center;">No data yet.</td></tr>';
        } else {
            weekTable.innerHTML = weekEntries.slice(0, 12).map(function(e) {
                var key = e[0]; var v = e[1];
                var parts = key.split('-W'); var yr = parts[0]; var wk = parts[1];
                var isThis = key === thisWeekKey;
                var avg = v.count > 0 ? (v.grams / v.count).toFixed(1) : '0';
                return '<tr style="' + (isThis ? 'background:#f0faf6;font-weight:600;' : '') + 'border-bottom:1px solid #f0f0f0;">' +
                    '<td style="padding:11px 16px;color:#444;">Week ' + wk + ', ' + yr + (isThis ? ' <span style="font-size:11px;color:#2EBA8A;">(this week)</span>' : '') + '</td>' +
                    '<td style="padding:11px 16px;text-align:center;color:#3498DB;font-weight:700;font-size:15px;">' + v.count + '</td>' +
                    '<td style="padding:11px 16px;text-align:center;color:#F39C12;font-weight:600;">' + fmt(v.grams) + '</td>' +
                    '<td style="padding:11px 16px;text-align:center;color:#2EBA8A;font-size:13px;">' + avg + 'g</td>' +
                    '</tr>';
            }).join('');
        }
    }

    // ── Monthly table ──────────────────────────
    var monthTable = document.getElementById('an-month-table');
    if (monthTable) {
        var monthNames = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];
        if (monthEntries.length === 0) {
            monthTable.innerHTML = '<tr><td colspan="4" style="color:#aaa;padding:16px;text-align:center;">No data yet.</td></tr>';
        } else {
            monthTable.innerHTML = monthEntries.map(function(e) {
                var key = e[0]; var v = e[1];
                var parts = key.split('-'); var yr = parts[0]; var mo = parseInt(parts[1]) - 1;
                var isThis = key === thisMonthKey;
                var avg = v.count > 0 ? (v.grams / v.count).toFixed(1) : '0';
                return '<tr style="' + (isThis ? 'background:#faf0ff;font-weight:600;' : '') + 'border-bottom:1px solid #f0f0f0;">' +
                    '<td style="padding:11px 16px;color:#444;">' + monthNames[mo] + ' ' + yr + (isThis ? ' <span style="font-size:11px;color:#9B59B6;">(this month)</span>' : '') + '</td>' +
                    '<td style="padding:11px 16px;text-align:center;color:#3498DB;font-weight:700;font-size:15px;">' + v.count + '</td>' +
                    '<td style="padding:11px 16px;text-align:center;color:#F39C12;font-weight:600;">' + fmt(v.grams) + '</td>' +
                    '<td style="padding:11px 16px;text-align:center;color:#2EBA8A;font-size:13px;">' + avg + 'g</td>' +
                    '</tr>';
            }).join('');
        }
    }

    // ── Daily Chart ────────────────────────────
    var canvas = document.getElementById('feedChart');
    if (canvas) {
        var chartEntries = dayEntries.slice(-14);
        if (feedChartInstance) feedChartInstance.destroy();
        feedChartInstance = buildChart(canvas, chartEntries, todayKey, '#3498DB', 'rgba(52,152,219,0.12)', 'Daily Feeds');
    }

    // ── Weekly Chart ───────────────────────────
    var canvasWeek = document.getElementById('feedChartWeek');
    if (canvasWeek) {
        var wChartEntries = weekEntries.slice().reverse().slice(-8);
        if (feedChartWeekInstance) feedChartWeekInstance.destroy();
        feedChartWeekInstance = buildWeekChart(canvasWeek, wChartEntries, thisWeekKey);
    }

    // ── Monthly Chart ──────────────────────────
    var canvasMonth = document.getElementById('feedChartMonth');
    if (canvasMonth) {
        var mChartEntries = monthEntries.slice().reverse();
        if (feedChartMonthInstance) feedChartMonthInstance.destroy();
        feedChartMonthInstance = buildMonthChart(canvasMonth, mChartEntries, thisMonthKey);
    }
}

function buildChart(canvas, entries, todayKey, color, fillColor, label) {
    var labels = entries.map(function(e) {
        if (e[0] === todayKey) return 'Today';
        var d = new Date(e[0] + 'T00:00:00');
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    var counts  = entries.map(function(e){ return e[1].count; });
    var grams   = entries.map(function(e){ return e[1].grams; });
    var bgColors = entries.map(function(e){ return e[0] === todayKey ? '#2EBA8A' : color; });

    return new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Feeds', data: counts, backgroundColor: bgColors, borderRadius: 6, borderSkipped: false, yAxisID: 'yCount', order: 1 },
                { label: 'Grams', data: grams, type: 'line', borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.07)', borderWidth: 2, pointBackgroundColor: '#F39C12', pointRadius: 4, tension: 0.35, fill: true, yAxisID: 'yGrams', order: 0 }
            ]
        },
        options: chartOptions('Feed Count', 'Grams')
    });
}

function buildWeekChart(canvas, entries, thisWeekKey) {
    var labels  = entries.map(function(e){ var p = e[0].split('-W'); return 'W' + p[1] + ' \'' + p[0].slice(2); });
    var counts  = entries.map(function(e){ return e[1].count; });
    var grams   = entries.map(function(e){ return e[1].grams; });
    var bgColors = entries.map(function(e){ return e[0] === thisWeekKey ? '#2EBA8A' : 'rgba(46,186,138,0.6)'; });

    return new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Feeds', data: counts, backgroundColor: bgColors, borderRadius: 6, borderSkipped: false, yAxisID: 'yCount', order: 1 },
                { label: 'Grams', data: grams, type: 'line', borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.07)', borderWidth: 2, pointBackgroundColor: '#F39C12', pointRadius: 4, tension: 0.35, fill: true, yAxisID: 'yGrams', order: 0 }
            ]
        },
        options: chartOptions('Feed Count', 'Grams')
    });
}

function buildMonthChart(canvas, entries, thisMonthKey) {
    var mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var labels  = entries.map(function(e){ var p = e[0].split('-'); return mNames[parseInt(p[1])-1] + ' ' + p[0]; });
    var counts  = entries.map(function(e){ return e[1].count; });
    var grams   = entries.map(function(e){ return e[1].grams; });
    var bgColors = entries.map(function(e){ return e[0] === thisMonthKey ? '#9B59B6' : 'rgba(155,89,182,0.6)'; });

    return new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Feeds', data: counts, backgroundColor: bgColors, borderRadius: 6, borderSkipped: false, yAxisID: 'yCount', order: 1 },
                { label: 'Grams', data: grams, type: 'line', borderColor: '#F39C12', backgroundColor: 'rgba(243,156,18,0.07)', borderWidth: 2, pointBackgroundColor: '#F39C12', pointRadius: 4, tension: 0.35, fill: true, yAxisID: 'yGrams', order: 0 }
            ]
        },
        options: chartOptions('Feed Count', 'Grams')
    });
}

function chartOptions(leftLabel, rightLabel) {
    return {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'top', labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
            tooltip: { callbacks: { label: function(ctx) {
                return ctx.dataset.label === 'Feeds'
                    ? ' ' + ctx.parsed.y + ' feed' + (ctx.parsed.y !== 1 ? 's' : '')
                    : ' ' + ctx.parsed.y + 'g';
            }}}
        },
        scales: {
            yCount: { type: 'linear', position: 'left', beginAtZero: true, ticks: { stepSize: 1, precision: 0, color: '#3498DB', font: { size: 11 } }, grid: { color: '#f5f5f5' }, title: { display: true, text: leftLabel, color: '#3498DB', font: { size: 11 } } },
            yGrams: { type: 'linear', position: 'right', beginAtZero: true, ticks: { color: '#F39C12', font: { size: 11 }, callback: function(v){ return v + 'g'; } }, grid: { drawOnChartArea: false }, title: { display: true, text: rightLabel, color: '#F39C12', font: { size: 11 } } },
            x: { ticks: { color: '#666', font: { size: 11 } }, grid: { display: false } }
        }
    };
}
