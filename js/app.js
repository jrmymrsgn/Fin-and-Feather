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
    feederRef.child('control').update({ dispense_now: true, trigger_time: Date.now() });
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

function renderAnalytics(logsArray) {
    const container = document.getElementById('analytics-container');
    if (!container) return;

    if (!logsArray || logsArray.length === 0) {
        container.innerHTML = '<p style="color:#888;font-size:14px;padding:16px;">No log data available for analysis.</p>';
        return;
    }

    // ── Aggregate by day and week ──────────────
    const byDay  = {};
    const byWeek = {};

    logsArray.forEach(log => {
        const grams = extractGrams(log.message);
        if (grams <= 0) return;

        const d       = new Date(log.timestamp);
        const dayKey  = d.toISOString().slice(0, 10);
        const weekKey = getWeekKey(d);

        byDay[dayKey]   = (byDay[dayKey]   || 0) + grams;
        byWeek[weekKey] = (byWeek[weekKey] || 0) + grams;
    });

    const dayEntries  = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0]));
    const weekEntries = Object.entries(byWeek).sort((a, b) => b[0].localeCompare(a[0]));

    if (dayEntries.length === 0) {
        container.innerHTML = '<p style="color:#888;font-size:14px;padding:16px;">No gram data found in logs yet. Gram amounts are read from messages like "Dispensed 50g".</p>';
        return;
    }

    // ── Summary stats ──────────────────────────
    const totalEver     = dayEntries.reduce((s, [, g]) => s + g, 0);
    const avgPerDay     = totalEver / dayEntries.length;
    const todayKey      = new Date().toISOString().slice(0, 10);
    const todayGrams    = byDay[todayKey]          || 0;
    const thisWeekKey   = getWeekKey(new Date());
    const thisWeekGrams = byWeek[thisWeekKey]      || 0;
    const maxDay        = Math.max(...dayEntries.map(([, g]) => g), 1);
    const maxWeek       = Math.max(...weekEntries.map(([, g]) => g), 1);

    function fmt(g) {
        return g % 1 === 0 ? g + 'g' : g.toFixed(1) + 'g';
    }

    function fmtDay(isoKey) {
        const d = new Date(isoKey + 'T00:00:00');
        const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        return isoKey === todayKey
            ? `<strong>Today</strong> <span style="color:#aaa;font-size:11px;">${label}</span>`
            : label;
    }

    function barRow(label, grams, max, accent) {
        const pct    = Math.round((grams / max) * 100);
        const isZero = grams === 0;
        return `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <div style="width:130px;font-size:13px;color:#555;flex-shrink:0;text-align:right;">${label}</div>
            <div style="flex:1;background:#f0f0f0;border-radius:6px;height:22px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:${accent};border-radius:6px;
                    transition:width .4s ease;min-width:${isZero ? 0 : 4}px;"></div>
            </div>
            <div style="width:68px;font-size:13px;font-weight:600;color:#333;flex-shrink:0;">
                ${isZero ? '—' : fmt(grams)}
            </div>
        </div>`;
    }

    function statCard(label, value, sub, color) {
        return `
        <div style="flex:1;min-width:120px;background:#fff;border:1px solid #e8e8e8;
            border-radius:10px;padding:14px 16px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:${color};">${value}</div>
            <div style="font-size:12px;font-weight:600;color:#555;margin:4px 0 2px;">${label}</div>
            <div style="font-size:11px;color:#aaa;">${sub}</div>
        </div>`;
    }

    container.innerHTML = `

        <!-- Summary stat cards -->
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px;">
            ${statCard('Today',      fmt(todayGrams),    new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'}), '#2EBA8A')}
            ${statCard('This Week',  fmt(thisWeekGrams), thisWeekKey,                                                            '#3498DB')}
            ${statCard('Avg / Day',  fmt(avgPerDay),     'across ' + dayEntries.length  + ' day(s)',                            '#9B59B6')}
            ${statCard('Total Ever', fmt(totalEver),     dayEntries.length + ' day(s) of data',                                 '#F39C12')}
        </div>

        <!-- Daily bar chart -->
        <div style="background:#fff;border:1px solid #e8e8e8;border-radius:10px;
            padding:18px 20px;margin-bottom:18px;">
            <div style="font-weight:700;font-size:14px;color:#333;margin-bottom:16px;">
                <i class="fas fa-calendar-day" style="color:#2EBA8A;margin-right:8px;"></i>
                Daily Dispensed <span style="font-weight:400;color:#aaa;font-size:12px;">(last ${Math.min(dayEntries.length, 14)} days)</span>
            </div>
            ${dayEntries.slice(0, 14).map(([key, g]) => barRow(fmtDay(key), g, maxDay, '#2EBA8A')).join('')}
        </div>

        <!-- Weekly bar chart -->
        <div style="background:#fff;border:1px solid #e8e8e8;border-radius:10px;
            padding:18px 20px;">
            <div style="font-weight:700;font-size:14px;color:#333;margin-bottom:16px;">
                <i class="fas fa-calendar-week" style="color:#3498DB;margin-right:8px;"></i>
                Weekly Dispensed <span style="font-weight:400;color:#aaa;font-size:12px;">(last ${Math.min(weekEntries.length, 8)} weeks)</span>
            </div>
            ${weekEntries.slice(0, 8).map(([key, g]) => {
                const [yr, wk] = key.split('-W');
                return barRow('Week ' + wk + ', ' + yr, g, maxWeek, '#3498DB');
            }).join('')}
        </div>`;
}
