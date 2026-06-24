/* ─────────────────────────────────────────────────
   MEDCORE HMS · SCHEDULER: TIMELINE & GRID UI
   ───────────────────────────────────────────────── */

const GRID_START_HOUR = 8;  // Leaves it at 8:00 AM
const GRID_END_HOUR = 20;   // Changes it to 8:00 PM (or use 21 for 9:00 PM)
const PIXELS_PER_HOUR = 120;

let displayMonthDate = new Date();
let selectedDate = new Date();

/* ── 1. CALENDAR NAVIGATION ── */
function renderCalendar() {
    const monthYearText = document.getElementById('calendar-month-year');
    const grid = document.getElementById('calendar-days-grid');
    const year = displayMonthDate.getFullYear();
    const month = displayMonthDate.getMonth();

    monthYearText.textContent = `${monthNames[month]} ${year}`;
    grid.innerHTML = `<div class="calendar-day-name">S</div><div class="calendar-day-name">M</div><div class="calendar-day-name">T</div><div class="calendar-day-name">W</div><div class="calendar-day-name">T</div><div class="calendar-day-name">F</div><div class="calendar-day-name">S</div>`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    for (let i = firstDayIndex - 1; i >= 0; i--) {
        grid.innerHTML += `<div class="calendar-date faded" onclick="changeMonth(-1)">${prevMonthDays - i}</div>`;
    }
    for (let i = 1; i <= daysInMonth; i++) {
        const isSelected = i === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
        const activeClass = isSelected ? 'active' : '';
        grid.innerHTML += `<div class="calendar-date ${activeClass}" onclick="selectDate(${year}, ${month}, ${i})">${i}</div>`;
    }
    const remainingCells = 42 - (firstDayIndex + daysInMonth);
    for (let i = 1; i <= remainingCells; i++) {
        grid.innerHTML += `<div class="calendar-date faded" onclick="changeMonth(1)">${i}</div>`;
    }
}

function changeMonth(offset) {
    displayMonthDate.setMonth(displayMonthDate.getMonth() + offset);
    renderCalendar();
}

function selectDate(year, month, day) {
    selectedDate = new Date(year, month, day);
    displayMonthDate = new Date(year, month, 1);
    renderCalendar();

    document.getElementById('header-date-text').textContent = `${shortMonths[month]} ${day}, ${year}`;
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    document.getElementById('panel-date-input').value = formattedDate;

    renderAppointmentsForDate(formattedDate);
    updateTimeIndicator();
}

/* ── 2. GRID STRUCTURE ── */
function buildGridStructure() {
    const timeAxisContainer = document.getElementById('time-axis-container');
    const horizontalLines = document.getElementById('horizontal-lines');
    const timeSelect = document.getElementById('panel-time-input');
    timeSelect.innerHTML = '';

    for (let i = GRID_START_HOUR; i <= GRID_END_HOUR; i++) {
        const topPosition = (i - GRID_START_HOUR) * PIXELS_PER_HOUR;
        let hourStr = i > 12 ? (i - 12) + ':00 PM' : i + ':00 AM';
        let halfHourStr = i > 12 ? (i - 12) + ':30 PM' : i + ':30 AM';
        if (i === 12) { hourStr = '12:00 PM'; halfHourStr = '12:30 PM'; }

        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-slot-label';
        timeLabel.style.top = topPosition + 'px';
        timeLabel.innerText = hourStr;
        timeAxisContainer.appendChild(timeLabel);

        const hourLine = document.createElement('div');
        hourLine.className = 'hour-line';
        hourLine.style.top = topPosition + 'px';
        horizontalLines.appendChild(hourLine);

        timeSelect.innerHTML += `<option value="${hourStr}">${hourStr}</option>`;

        if (i < GRID_END_HOUR) {
            const halfHourLine = document.createElement('div');
            halfHourLine.className = 'half-hour-line';
            halfHourLine.style.top = (topPosition + (PIXELS_PER_HOUR / 2)) + 'px';
            horizontalLines.appendChild(halfHourLine);
            timeSelect.innerHTML += `<option value="${halfHourStr}">${halfHourStr}</option>`;
        }
    }
}

function updateTimeIndicator() {
    const indicator = document.getElementById('current-time-indicator');
    if (!indicator) return null;

    const now = new Date();
    const todayStr = formatDateKey(now);
    const selectedStr = formatDateKey(selectedDate);

    if (selectedStr !== todayStr) {
        indicator.style.display = 'none';
        return null;
    }

    indicator.style.display = 'flex';
    let hours = now.getHours();
    let minutes = now.getMinutes();

    if (hours < GRID_START_HOUR) { hours = GRID_START_HOUR; minutes = 0; }
    if (hours > GRID_END_HOUR) { hours = GRID_END_HOUR; minutes = 0; }

    const topPixels = ((hours - GRID_START_HOUR) * PIXELS_PER_HOUR) + (minutes * (PIXELS_PER_HOUR / 60));
    indicator.style.top = topPixels + 'px';

    let actualHours = now.getHours();
    let ampm = actualHours >= 12 ? 'PM' : 'AM';
    let dispHour = actualHours % 12 || 12;
    let dispMin = minutes < 10 ? '0' + minutes : minutes;
    document.getElementById('header-time').innerText = `${dispHour}:${dispMin} ${ampm}`;

    return topPixels;
}

function smartAutoScroll() {
    const currentPixels = updateTimeIndicator();
    const scrollContainer = document.getElementById('grid-scroll-container');
    if (currentPixels !== null) scrollContainer.scrollTop = currentPixels - (scrollContainer.clientHeight / 2);
    else scrollContainer.scrollTop = 0;
}

/* ── 4. TIMELINE RENDERING ── */
function renderAppointmentsForDate(dateString) {
    getAppointmentsForDate(dateString);
    forceTimeIntegrity();

    for (let i = 0; i < 5; i++) { const col = document.getElementById(`col-${i}`); if (col) col.innerHTML = ''; }

    const dailyApps = appointments.filter(app => app.date === dateString);

    dailyApps.forEach(app => {
        const column = document.getElementById(`col-${app.colIndex}`); if (!column) return;
        const topPixels = ((app.startHour - GRID_START_HOUR) * PIXELS_PER_HOUR) + (app.startMinute * (PIXELS_PER_HOUR / 60));
        const heightPixels = app.duration * (PIXELS_PER_HOUR / 60);
        const block = document.createElement('div');

        let statusClass = 'app-status-scheduled';
        if (app.status === 'arrived') statusClass = 'app-status-arrived';
        else if (app.status === 'warning') statusClass = 'app-status-warning';
        else if (app.status === 'completed' || app.status === 'past') statusClass = 'app-status-completed';
        else if (app.status === 'cancelled') statusClass = 'app-status-cancelled';

        block.className = `appointment-block ${statusClass}`; block.style.top = topPixels + 'px'; block.style.height = heightPixels + 'px';
        block.innerHTML = `<div class="app-title">${app.patientName}</div><div class="app-detail">${app.reason}</div>`;
        block.onclick = (e) => { e.stopPropagation(); openAppointmentDetails(app.id); };
        column.appendChild(block);
    });
}