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
    
    // Time format
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;
    
    timeEl.textContent = `${hours}:${minutes}:${seconds}`;
    ampmEl.textContent = ampm;
    
    // Date format
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const date = now.getDate();
    const year = now.getFullYear();
    
    // Calculate week of month (simple approach)
    const weekOfMonth = Math.ceil((date - 1 - now.getDay()) / 7) + 1;
    
    dateEl.textContent = `Today • ${dayName}, Week ${weekOfMonth}`;

    // Calculate dynamic next feeding countdown
    if (window.nextFeedingDate) {
        let diffMs = window.nextFeedingDate - now;
        if (diffMs > 0) {
            let diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            let diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            let diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
            document.getElementById('next-feeding-countdown').textContent = `In ${diffHrs}h ${diffMins}m ${diffSecs}s`;
        } else {
            // Re-calculate or fallback
            document.getElementById('next-feeding-countdown').textContent = `Dispensing soon...`;
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
    'dashboard': 'Admin Dashboard',
    'live-monitor': 'Live Monitor',
    'schedule': 'Schedule Management',
    'logs': 'System Logs',
    'inventory': 'Inventory',
    'settings': 'Settings'
};

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active class from all nav items
        navItems.forEach(nav => nav.classList.remove('active'));
        
        // Add active class to clicked item
        item.classList.add('active');
        
        // Hide all sections
        pageSections.forEach(section => {
            section.style.display = 'none';
        });
        
        // Show target section
        const targetId = item.getAttribute('data-target');
        const targetSection = document.getElementById('section-' + targetId);
        if (targetSection) {
            targetSection.style.display = 'block';
        }

        // Update title
        if (sectionTitles[targetId]) {
            pageTitleEl.textContent = sectionTitles[targetId];
        }
        
        // Close sidebar on mobile after clicking
        if (window.innerWidth <= 992 && sidebar && sidebarOverlay && sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    });
});

// Mobile Sidebar Logic
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
    if (sidebar && sidebarOverlay) {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('show');
    }
}

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleSidebar);
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', toggleSidebar);
}

// --- FIREBASE LOGIC & APP STATE ---
const auth = firebase.auth();
let userDeviceId = null;
let feederRef = null;

// Authenticate and bind user's device
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html'; // Redirect to login if not authenticated
        return;
    }
    
    // Fetch Device ID associated with User
    const userRef = firebase.database().ref('users/' + user.uid);
    const snap = await userRef.once('value');
    if (snap.exists() && snap.val().deviceId) {
        userDeviceId = snap.val().deviceId;
        feederRef = firebase.database().ref('devices/' + userDeviceId);
        
        // Start listening to this device's node
        initializeRealtimeListeners();
    } else {
        // Attempt recovery if device is missing
        let manualDevice = prompt("No device linked! This sometimes happens due to an interrupted signup. Please enter your Device ID to link it now:");
        if (manualDevice) {
            manualDevice = manualDevice.trim();
            try {
                const devRef = firebase.database().ref('devices/' + manualDevice);
                const devSnap = await devRef.once('value');
                if (devSnap.exists()) {
                    if (devSnap.child('owner').exists() && devSnap.child('owner').val() !== user.uid) {
                        alert("This Device ID is already registered to another user.");
                    } else {
                        await firebase.database().ref('users/' + user.uid).set({ deviceId: manualDevice });
                        await devRef.child('owner').set(user.uid);
                        alert("Device linked successfully!");
                        window.location.reload();
                    }
                } else {
                    alert("Device ID not found in database.");
                }
            } catch (err) {
                alert("Error linking device: " + err.message);
            }
        } else {
            alert("No device linked to this account!");
        }
    }
});

function initializeRealtimeListeners() {
    // Status
    feederRef.child('status').on('value', (snapshot) => {
        const data = snapshot.val() || { feedLevel: 0, lastFeedingTime: '--', nextFeedingTime: '--' };
        updateStatusCards(data);
    });

    // Schedule (Dashboard list)
    feederRef.child('schedule').on('value', (snapshot) => {
        const data = snapshot.val();
        renderSchedule(data);
        computeNextFeeding(data);
    });

    // Logs (grouped by day)
    feederRef.child('logs').orderByChild('timestamp').limitToLast(50).on('value', (snapshot) => {
        const data = snapshot.val();
        renderLogsGrouped(data);
    });

    // Settings
    feederRef.child('settings').on('value', (snapshot) => {
        const data = snapshot.val();
        if(data) {
            if(document.getElementById('setting-phone')) {
                document.getElementById('setting-phone').value = data.phoneNumber || '';
                document.getElementById('setting-sms-enable').checked = data.smsEnabled !== false;
                document.getElementById('setting-servo-open').value = data.servoOpenTime || '';
                document.getElementById('setting-servo-closed').value = data.servoClosedTime || '';
                document.getElementById('setting-hopper-height').value = data.hopperHeight || '';
            }
        }
    });
}

// Settings Save Button
const btnSaveSettings = document.getElementById('btn-save-settings');
if(btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
        if (!feederRef) return alert("Device not connected yet.");
        
        const phone = document.getElementById('setting-phone').value.trim();
        const smsEnabled = document.getElementById('setting-sms-enable').checked;
        const servoOpen = parseInt(document.getElementById('setting-servo-open').value) || 0;
        const servoClosed = parseInt(document.getElementById('setting-servo-closed').value) || 0;
        const hopperHeight = parseInt(document.getElementById('setting-hopper-height').value) || 0;

        if (hopperHeight > 0 && hopperHeight < 5) {
            return alert('Hopper height must be at least 5 cm.');
        }

        feederRef.child('settings').update({
            phoneNumber: phone,
            smsEnabled: smsEnabled,
            servoOpenTime: servoOpen,
            servoClosedTime: servoClosed,
            hopperHeight: hopperHeight || null
        }).then(() => {
            alert('Settings saved successfully!');
        }).catch(err => {
            alert('Error saving settings: ' + err.message);
        });
    });
}

// Feed Now Button
btnFeedNow.addEventListener('click', () => {
    if (!feederRef) return;
    feederRef.child('control').update({ dispense_now: true, trigger_time: Date.now() });
    alert('Dispense command sent to device!');
});

// Mark Refilled Button
const btnMarkRefilled = document.getElementById('btn-mark-refilled');
if (btnMarkRefilled) {
    btnMarkRefilled.addEventListener('click', () => {
        if (!feederRef) return alert("Device not connected yet.");
        if (confirm("Are you sure you want to mark the hopper as refilled?")) {
            // Push a refill log
            feederRef.child('logs').push({
                message: "Stock manually marked as refilled",
                type: "success",
                isRefill: true,
                timestamp: Date.now()
            });
            alert("Inventory marked as refilled!");
        }
    });
}

// Logout Button
document.getElementById('btn-logout').addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
});

// Dynamic Schedule Form - Adding time inputs based on dropdown
const timesCountSelect = document.getElementById('schedule-times-count');
const dynamicTimeInputsContainer = document.getElementById('dynamic-time-inputs');

if(timesCountSelect) {
    timesCountSelect.addEventListener('change', (e) => {
        const count = parseInt(e.target.value);
        dynamicTimeInputsContainer.innerHTML = '';
        
        for(let i = 1; i <= count; i++) {
            dynamicTimeInputsContainer.innerHTML += `
                <div>
                    <label style="display:inline-block; width: 60px;">Time ${i}:</label>
                    <input type="time" class="schedule-time-input" required style="padding:8px; border:1px solid #ccc; border-radius:4px;">
                </div>
            `;
        }
    });
}

// Handle New Schedule Submission
document.getElementById('schedule-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!feederRef) return alert("Device not connected yet.");

    const checkboxes = document.querySelectorAll('input[name="days"]:checked');
    const timeInputs = document.querySelectorAll('.schedule-time-input');
    const amount = document.getElementById('schedule-amount').value;

    if(checkboxes.length === 0) return alert("Please select at least one day.");
    if(timeInputs.length === 0) return;
    
    checkboxes.forEach(cb => {
        timeInputs.forEach(timeInput => {
            const time = timeInput.value;
            if(!time) return;

            // Format time to 12-hour AM/PM for display
            let [h, m] = time.split(':');
            let ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            const formattedTime = `${h}:${m} ${ampm}`;

            feederRef.child('schedule').push({
                day: cb.value,
                time: formattedTime,
                rawTime: time,
                amount: parseInt(amount)
            });
        });
    });

    alert("Schedules successfully added!");
    
    // Reset form and reset dynamic inputs back to 1
    e.target.reset();
    timesCountSelect.value = "1";
    timesCountSelect.dispatchEvent(new Event('change'));
});

// Helper Functions
function updateStatusCards(data) {
    const level = data.feedLevel || 0;
    feedPercentageEl.textContent = level;
    feedProgressBar.style.width = `${level}%`;
    
    const invLevelEl = document.getElementById('inv-level');
    if (invLevelEl) invLevelEl.textContent = level + '%';
    
    if (level <= 20) {
        feedStatusText.textContent = 'Low';
        feedStatusText.style.color = 'var(--color-feed-low)';
        feedProgressBar.classList.add('low');
    } else {
        feedStatusText.textContent = 'Healthy';
        feedStatusText.style.color = 'var(--text-muted)';
        feedProgressBar.classList.remove('low');
    }
    
    lastFeedingTimeEl.textContent = data.lastFeedingTime || '--:-- --';
    
    if (data.lastFeedingAmount) {
        lastFeedingAmountEl.textContent = data.lastFeedingAmount + " dispensed";
    } else if (data.lastFeedingTime) {
        lastFeedingAmountEl.textContent = "Feed cycle completed";
    } else {
        lastFeedingAmountEl.textContent = "--";
    }
    // next feeding logic is decoupled
}

function renderSchedule(data) {
    scheduleListEl.innerHTML = '';
    const fullListEl = document.getElementById('full-schedule-list');
    if(fullListEl) fullListEl.innerHTML = '';

    if (!data) {
        const emptyMsg = '<li>No schedules found.</li>';
        scheduleListEl.innerHTML = emptyMsg;
        if(fullListEl) fullListEl.innerHTML = emptyMsg;
        return;
    }
    
    // Group by day, keeping track of Firebase keys
    const grouped = {};
    for (const key in data) {
        const item = { ...data[key], _key: key };
        if(!grouped[item.day]) grouped[item.day] = [];
        grouped[item.day].push(item);
    }
    
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    dayOrder.forEach(day => {
        if (grouped[day] && grouped[day].length > 0) {
            // Sort by rawTime
            grouped[day].sort((a,b) => (a.rawTime || '').localeCompare(b.rawTime || ''));
            
            // Build horizontally aligned time blocks
            let timesHTML = '';
            grouped[day].forEach(item => {
                // Dashboard view: simple pill (no buttons)
                timesHTML += `<span style="background:var(--color-bg); padding:6px 10px; border-radius:6px; font-size:13px; font-weight:500; border:1px solid #e1e4e8; display:inline-flex; align-items:center; gap:5px;">
                    <i class="far fa-clock" style="color:#666;"></i> ${item.time} 
                    <span style="color:#888; font-size:11px;">(${item.amount}g)</span>
                </span>`;
            });
            
            const dashLi = `<li style="display:flex; align-items:flex-start; border-bottom:1px solid #eee; padding:15px 20px;">
                <div style="display:flex; align-items:center; width:80px; margin-top:6px;">
                    <i class="far fa-calendar-check schedule-icon" style="color:#F39C12; margin-right:10px;"></i>
                    <span class="schedule-day" style="font-weight:bold;">${day}</span>
                </div>
                <div class="schedule-times" style="flex:1; display:flex; flex-wrap:wrap; gap:10px;">${timesHTML}</div>
            </li>`;
            scheduleListEl.innerHTML += dashLi;
            
            // Full schedule view: pills WITH edit & delete buttons
            if (fullListEl) {
                let fullTimesHTML = '';
                grouped[day].forEach(item => {
                    fullTimesHTML += `
                    <span style="background:var(--color-bg); padding:6px 10px; border-radius:6px; font-size:13px; font-weight:500; border:1px solid #e1e4e8; display:inline-flex; align-items:center; gap:6px;">
                        <i class="far fa-clock" style="color:#666;"></i> ${item.time}
                        <span style="color:#888; font-size:11px;">(${item.amount}g)</span>
                        <button onclick="openEditSchedule('${item._key}','${item.day}','${item.rawTime}',${item.amount})" title="Edit"
                            style="border:none; background:transparent; cursor:pointer; color:#2980B9; padding:0;">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button onclick="deleteScheduleEntry('${item._key}')" title="Delete"
                            style="border:none; background:transparent; cursor:pointer; color:#E74C3C; padding:0;">
                            <i class="fas fa-times"></i>
                        </button>
                    </span>`;
                });
                const fullLi = `<li style="display:flex; align-items:flex-start; border-bottom:1px solid #eee; padding:15px 20px;">
                    <div style="display:flex; align-items:center; width:80px; margin-top:6px;">
                        <i class="far fa-calendar-check schedule-icon" style="color:#F39C12; margin-right:10px;"></i>
                        <span class="schedule-day" style="font-weight:bold;">${day}</span>
                    </div>
                    <div class="schedule-times" style="flex:1; display:flex; flex-wrap:wrap; gap:10px;">${fullTimesHTML}</div>
                </li>`;
                fullListEl.innerHTML += fullLi;
            }
        }
    });
}

// Delete a single schedule entry
function deleteScheduleEntry(key) {
    if (!feederRef) return;
    if (!confirm('Delete this schedule entry?')) return;
    feederRef.child('schedule/' + key).remove()
        .then(() => console.log('Schedule entry deleted.'))
        .catch(err => alert('Error: ' + err.message));
}

// Open edit modal for a schedule entry
function openEditSchedule(key, day, rawTime, amount) {
    document.getElementById('edit-schedule-key').value = key;
    document.getElementById('edit-schedule-day').value = day;
    document.getElementById('edit-schedule-time').value = rawTime;
    document.getElementById('edit-schedule-amount').value = amount;
    const modal = document.getElementById('edit-schedule-modal');
    modal.style.display = 'flex';
}

// Cancel edit modal
const btnEditScheduleCancel = document.getElementById('btn-edit-schedule-cancel');
if (btnEditScheduleCancel) {
    btnEditScheduleCancel.addEventListener('click', () => {
        document.getElementById('edit-schedule-modal').style.display = 'none';
    });
}

// Save edited schedule entry
const btnEditScheduleSave = document.getElementById('btn-edit-schedule-save');
if (btnEditScheduleSave) {
    btnEditScheduleSave.addEventListener('click', () => {
        if (!feederRef) return alert('Device not connected.');
        const key = document.getElementById('edit-schedule-key').value;
        const day = document.getElementById('edit-schedule-day').value;
        const rawTime = document.getElementById('edit-schedule-time').value;
        const amount = parseInt(document.getElementById('edit-schedule-amount').value);
        if (!rawTime) return alert('Please select a time.');

        // Format display time
        let [h, m] = rawTime.split(':');
        let ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        const formattedTime = `${h}:${m} ${ampm}`;

        feederRef.child('schedule/' + key).update({
            day, rawTime, time: formattedTime, amount
        }).then(() => {
            document.getElementById('edit-schedule-modal').style.display = 'none';
            alert('Schedule updated successfully!');
        }).catch(err => alert('Error: ' + err.message));
    });
}

function computeNextFeeding(schedules) {
    if (!schedules) {
        window.nextFeedingDate = null;
        document.getElementById('next-feeding-time').textContent = '--:-- --';
        document.getElementById('next-feeding-countdown').textContent = 'In --h --m';
        return;
    }
    
    const now = new Date();
    const currentDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon, 6=Sun
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    let nextDate = null;
    
    for (const key in schedules) {
        let {day, rawTime} = schedules[key];
        if (!day || !rawTime) continue;
        
        let [h, m] = rawTime.split(':').map(Number);
        let targetDayIdx = dayNames.indexOf(day);
        if(targetDayIdx === -1) continue;
        
        let targetDate = new Date(now);
        targetDate.setHours(h, m, 0, 0);
        
        let dayDiff = targetDayIdx - currentDayIdx;
        
        if (dayDiff < 0 || (dayDiff === 0 && targetDate <= now)) {
            // The schedule time for this day has already passed, meaning it corresponds to next week
            dayDiff += 7;
        }
        
        targetDate.setDate(targetDate.getDate() + dayDiff);
        
        if (!nextDate || targetDate < nextDate) {
            nextDate = targetDate;
        }
    }
    
    window.nextFeedingDate = nextDate;
    
    if (nextDate) {
        // Format time
        let h = nextDate.getHours();
        let m = nextDate.getMinutes();
        let ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        m = m < 10 ? '0'+m : m;
        
        let timeStr = `${h}:${m} ${ampm}`;
        let dayStr = dayNames[nextDate.getDay() === 0 ? 6 : nextDate.getDay() - 1];
        if (nextDate.getDate() === now.getDate() && nextDate.getMonth() === now.getMonth()) {
            dayStr = "Today";
        } else {
            // Check if tomorrow
            let tmrw = new Date(now);
            tmrw.setDate(tmrw.getDate() + 1);
            if (nextDate.getDate() === tmrw.getDate() && nextDate.getMonth() === tmrw.getMonth()) {
                dayStr = "Tomorrow";
            }
        }
        
        document.getElementById('next-feeding-time').textContent = `${dayStr}, ${timeStr}`;
    } else {
        document.getElementById('next-feeding-time').textContent = '--:-- --';
    }
}

function renderLogsGrouped(data) {
    logsListEl.innerHTML = '';
    const fullLogsEl = document.getElementById('full-logs-list');
    const refillListEl = document.getElementById('refill-history-list');

    if(fullLogsEl) fullLogsEl.innerHTML = '';
    if(refillListEl) refillListEl.innerHTML = '';

    if (!data) {
        logsListEl.innerHTML = '<li>No recent logs.</li>';
        if(fullLogsEl) fullLogsEl.innerHTML = '<li>No recent logs.</li>';
        if(refillListEl) refillListEl.innerHTML = '<li style="color:#888; font-size:14px;">No recent manual refills logged.</li>';
        return;
    }

    // Convert to array keeping Firebase key, group by date
    const logsArray = Object.keys(data).map(key => ({ ...data[key], _key: key })).reverse();
    const grouped = {};

    logsArray.forEach(log => {
        const d = new Date(log.timestamp || Date.now());
        const dateString = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if(!grouped[dateString]) grouped[dateString] = [];
        grouped[dateString].push(log);
    });

    let refillCount = 0;

    for (let date in grouped) {
        // Date header (only for full log list)
        if(fullLogsEl) fullLogsEl.innerHTML += `<div style="background:#f9f9f9; padding:8px; font-weight:bold; margin-top:10px; color:#555;">${date}</div>`;
        
        grouped[date].forEach(log => {
            let iconClass = 'fas fa-check-circle completed';
            if (log.type === 'warning') iconClass = 'fas fa-exclamation-triangle warning';
            if (log.type === 'error') iconClass = 'fas fa-times-circle error';
            
            const timeStr = log.time || new Date(log.timestamp).toLocaleTimeString();
            const iconColor = log.type === 'warning' ? '#F39C12' : log.type === 'error' ? '#E74C3C' : '#2EBA8A';

            // Full log entry (with delete button)
            const fullLi = `<li style="display:flex; align-items:center; border-bottom:1px solid #eee; padding:10px;">
                <i class="${iconClass} log-icon" style="margin-right:15px; color:${iconColor}"></i>
                <span class="log-time" style="width:100px; font-size:12px; flex-shrink:0;">${timeStr}</span>
                <span class="log-message" style="flex:1; color:#666;">${log.message}</span>
                <button onclick="deleteLogEntry('${log._key}')" title="Delete log"
                    style="border:none; background:transparent; cursor:pointer; color:#E74C3C; font-size:14px; padding:4px 8px; flex-shrink:0;">
                    <i class="fas fa-trash"></i>
                </button>
            </li>`;

            // Dashboard entry (no delete button, compact)
            const dashLi = `<li style="display:flex; align-items:center; border-bottom:1px solid #eee; padding:10px;">
                <i class="${iconClass} log-icon" style="margin-right:15px; color:${iconColor}"></i>
                <span class="log-time" style="width:100px; font-size:12px;">${timeStr}</span>
                <span class="log-message" style="flex:1; color:#666;">${log.message}</span>
            </li>`;
            
            if(logsListEl.children.length < 5) logsListEl.innerHTML += dashLi;
            if(fullLogsEl) fullLogsEl.innerHTML += fullLi;

            // Refill history
            if(log.isRefill || log.message.toLowerCase().includes('refill')) {
                if(refillListEl) refillListEl.innerHTML += dashLi;
                refillCount++;
            }
        });
    }

    if (refillCount === 0 && refillListEl) {
        refillListEl.innerHTML = '<li style="color:#888; font-size:14px;">No recent manual refills logged.</li>';
    }
}

// Delete a single log entry
function deleteLogEntry(key) {
    if (!feederRef) return;
    if (!confirm('Delete this log entry?')) return;
    feederRef.child('logs/' + key).remove()
        .then(() => console.log('Log deleted.'))
        .catch(err => alert('Error deleting log: ' + err.message));
}

// Clear All Logs button
const btnClearAllLogs = document.getElementById('btn-clear-all-logs');
if (btnClearAllLogs) {
    btnClearAllLogs.addEventListener('click', () => {
        if (!feederRef) return alert('Device not connected yet.');
        if (!confirm('Are you sure you want to DELETE ALL logs? This cannot be undone.')) return;
        feederRef.child('logs').remove()
            .then(() => alert('All logs cleared.'))
            .catch(err => alert('Error clearing logs: ' + err.message));
    });
}
