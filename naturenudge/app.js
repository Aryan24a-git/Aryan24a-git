// State
let state = {
    apiKey: localStorage.getItem('nn_apikey') || '',
    name: localStorage.getItem('nn_name') || '',
    goal: parseInt(localStorage.getItem('nn_goal')) || 30,
    journal: JSON.parse(localStorage.getItem('nn_journal')) || [],
    stats: JSON.parse(localStorage.getItem('nn_stats')) || { totalTime: 0, sessions: 0, streak: 0, lastDate: null }
};

// If we had the user's key with leading hyphens, clean it up just in case
if (state.apiKey.startsWith('----')) state.apiKey = state.apiKey.substring(4);
localStorage.setItem('nn_apikey', state.apiKey);

// DOM Elements
const els = {
    splash: document.getElementById('splash'),
    app: document.getElementById('app'),
    tabs: document.querySelectorAll('.tab-panel'),
    navBtns: document.querySelectorAll('.nav-item'),
    modals: document.querySelectorAll('.modal-overlay'),
    weatherTemp: document.getElementById('weather-temp'),
    weatherDesc: document.getElementById('weather-desc'),
    weatherIcon: document.getElementById('weather-icon'),
    weatherLoc: document.getElementById('weather-loc'),
    weatherHum: document.getElementById('weather-humidity'),
    weatherWind: document.getElementById('weather-wind'),
    nudgeTitle: document.getElementById('nudge-title'),
    nudgeBody: document.getElementById('nudge-body'),
    nudgeTags: document.getElementById('nudge-tags'),
    nudgeLoading: document.getElementById('nudge-loading'),
    timerValue: document.getElementById('timer-value'),
    timerRing: document.getElementById('timer-ring-progress'),
    btnTimer: document.getElementById('btn-timer-toggle'),
    timerText: document.getElementById('btn-timer-text'),
    timerTodayTotal: document.getElementById('timer-today-total'),
    timerStreak: document.getElementById('timer-streak'),
    journalList: document.getElementById('journal-list'),
    journalEmpty: document.getElementById('journal-empty')
};

// App Initialization
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        els.splash.style.opacity = '0';
        setTimeout(() => {
            els.splash.classList.add('hidden');
            els.app.classList.remove('hidden');
            initApp();
        }, 500);
    }, 1500);
});

function initApp() {
    setupNavigation();
    setupModals();
    setupSettings();
    setupJournal();
    updateStatsUI();
    
    // Check if we need to fetch weather & nudge
    const lastNudgeDate = localStorage.getItem('nn_last_nudge_date');
    const today = new Date().toDateString();
    
    if (lastNudgeDate === today && localStorage.getItem('nn_cached_nudge')) {
        // Load cached
        const cached = JSON.parse(localStorage.getItem('nn_cached_nudge'));
        displayNudge(cached);
        // Also try weather if cached, else fetch
    }
    
    fetchWeatherAndNudge();
}

// Navigation
function setupNavigation() {
    els.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active nav
            els.navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show correct tab
            const target = btn.dataset.tab;
            els.tabs.forEach(tab => {
                tab.classList.remove('active');
                if (tab.dataset.tab === target) tab.classList.add('active');
            });
        });
    });
}

// Modals
function setupModals() {
    document.getElementById('btn-settings').addEventListener('click', () => openModal('modal-settings'));
    document.getElementById('btn-new-entry').addEventListener('click', () => openModal('modal-journal'));
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById(btn.dataset.close).classList.add('hidden');
        });
    });
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Settings
function setupSettings() {
    document.getElementById('setting-api-key').value = state.apiKey;
    document.getElementById('setting-name').value = state.name;
    
    const goalChips = document.querySelectorAll('#setting-goal .chip');
    goalChips.forEach(chip => {
        if (parseInt(chip.dataset.value) === state.goal) {
            goalChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        }
        chip.addEventListener('click', () => {
            goalChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        });
    });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
        state.apiKey = document.getElementById('setting-api-key').value.trim();
        state.name = document.getElementById('setting-name').value.trim();
        state.goal = parseInt(document.querySelector('#setting-goal .chip.active').dataset.value);
        
        localStorage.setItem('nn_apikey', state.apiKey);
        localStorage.setItem('nn_name', state.name);
        localStorage.setItem('nn_goal', state.goal);
        
        document.getElementById('modal-settings').classList.add('hidden');
        showToast('Settings saved!');
    });
}

// Weather
async function fetchWeatherAndNudge() {
    els.weatherDesc.textContent = "Getting location…";
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                els.weatherLoc.textContent = `📍 ${lat.toFixed(2)}, ${lon.toFixed(2)}`;
                await getWeather(lat, lon);
            },
            (err) => {
                console.warn("Geolocation blocked", err);
                els.weatherLoc.textContent = "📍 Location access denied";
                getWeather(40.71, -74.00); // Default to NYC if blocked
            }
        );
    } else {
        getWeather(40.71, -74.00);
    }
}

async function getWeather(lat, lon) {
    els.weatherDesc.textContent = "Fetching weather…";
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`);
        const data = await res.json();
        const current = data.current;
        
        els.weatherTemp.textContent = `${Math.round(current.temperature_2m)}°C`;
        els.weatherHum.textContent = `💧 ${current.relative_humidity_2m}%`;
        els.weatherWind.textContent = `🌬️ ${current.wind_speed_10m} km/h`;
        
        const code = current.weather_code;
        let desc = "Clear"; let icon = "☀️";
        if (code >= 1 && code <= 3) { desc = "Cloudy"; icon = "⛅"; }
        if (code >= 51 && code <= 67) { desc = "Rainy"; icon = "🌧️"; }
        if (code >= 71 && code <= 77) { desc = "Snowy"; icon = "❄️"; }
        if (code >= 95) { desc = "Stormy"; icon = "⛈️"; }
        
        els.weatherDesc.textContent = desc;
        els.weatherIcon.textContent = icon;
        
        // Now get the nudge based on weather
        getGemmaNudge(desc, Math.round(current.temperature_2m));
        
    } catch (e) {
        console.error("Weather error:", e);
        els.weatherDesc.textContent = "Weather unavailable";
        getGemmaNudge("Unknown", 20); // Fallback
    }
}

// Gemma AI API
async function getGemmaNudge(weatherDesc, temp) {
    if (!state.apiKey) {
        els.nudgeTitle.textContent = "API Key Required";
        els.nudgeBody.textContent = "Please add your Google AI Studio key in Settings to get AI nudges.";
        return;
    }
    
    // Check if we fetched recently to save API calls
    const lastFetch = localStorage.getItem('nn_last_fetch_time');
    if (lastFetch && (Date.now() - parseInt(lastFetch)) < 3600000 && localStorage.getItem('nn_cached_nudge')) {
        // Less than 1 hour ago, use cache
        return; 
    }

    els.nudgeTitle.textContent = "Thinking…";
    els.nudgeBody.textContent = "";
    els.nudgeTags.innerHTML = "";
    els.nudgeLoading.style.display = "flex";

    const prompt = `You are NatureNudge, an outdoor companion app. 
Generate a short, engaging, and unique outdoor micro-activity for a user.
Context: Weather is ${weatherDesc}, ${temp}°C. 
Return ONLY valid JSON with no markdown formatting. Format:
{
  "title": "Short catchy title",
  "description": "2-3 sentences explaining the activity. Be inspiring and action-oriented.",
  "tags": ["Tag1", "Tag2"]
}`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-2-2b-it:generateContent?key=${state.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.8, maxOutputTokens: 200 }
            })
        });
        
        const data = await res.json();
        
        if (data.error) throw new Error(data.error.message);
        
        const text = data.candidates[0].content.parts[0].text;
        // Clean markdown block if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const nudge = JSON.parse(jsonStr);
        
        // Cache it
        localStorage.setItem('nn_cached_nudge', JSON.stringify(nudge));
        localStorage.setItem('nn_last_nudge_date', new Date().toDateString());
        localStorage.setItem('nn_last_fetch_time', Date.now().toString());
        
        displayNudge(nudge);
        
    } catch (e) {
        console.error("Gemma API Error:", e);
        els.nudgeLoading.style.display = "none";
        
        // Fallback nudge
        displayNudge({
            title: "15-Minute Sensory Walk",
            description: "Step outside and find 5 things you can see, 4 you can touch, 3 you hear, 2 you smell. A perfect quick reset.",
            tags: ["Mindfulness", "Quick"]
        });
    }
}

function displayNudge(nudge) {
    els.nudgeLoading.style.display = "none";
    els.nudgeTitle.textContent = nudge.title;
    els.nudgeBody.textContent = nudge.description;
    
    els.nudgeTags.innerHTML = '';
    (nudge.tags || []).forEach(t => {
        const span = document.createElement('span');
        span.className = 'nudge-tag';
        span.textContent = t;
        els.nudgeTags.appendChild(span);
    });
}

document.getElementById('btn-refresh-nudge').addEventListener('click', () => {
    // Force refresh bypassing time cache
    localStorage.removeItem('nn_last_fetch_time');
    getWeather(parseInt(els.weatherTemp.textContent) || 20, 0); // Fake coords just to trigger the chain
});

// Timer Logic
let timerInterval;
let timerSeconds = 0;
let isTimerRunning = false;

els.btnTimer.addEventListener('click', () => {
    if (isTimerRunning) {
        // Stop
        clearInterval(timerInterval);
        isTimerRunning = false;
        els.timerText.textContent = "Start Timer";
        els.btnTimer.classList.remove('btn-secondary');
        els.btnTimer.classList.add('btn-primary');
        
        // Save stats if ran for > 1 min
        const mins = Math.floor(timerSeconds / 60);
        if (mins > 0) {
            updateStats(mins);
            showToast(`Awesome! You spent ${mins} minutes outside.`);
        }
        timerSeconds = 0;
        updateTimerDisplay();
    } else {
        // Start
        isTimerRunning = true;
        els.timerText.textContent = "Stop & Save";
        els.btnTimer.classList.remove('btn-primary');
        els.btnTimer.classList.add('btn-secondary');
        timerInterval = setInterval(() => {
            timerSeconds++;
            updateTimerDisplay();
        }, 1000);
    }
});

function updateTimerDisplay() {
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const s = (timerSeconds % 60).toString().padStart(2, '0');
    els.timerValue.textContent = `${m}:${s}`;
    
    // Ring progress (max 60 mins)
    const pct = Math.min(timerSeconds / 3600, 1);
    const offset = 326 - (pct * 326);
    els.timerRing.style.strokeDashoffset = offset;
}

// Stats & Streaks
function updateStats(minutes) {
    const today = new Date().toDateString();
    
    state.stats.totalTime += minutes;
    state.stats.sessions += 1;
    
    if (state.stats.lastDate !== today) {
        // Check streak
        if (state.stats.lastDate) {
            const last = new Date(state.stats.lastDate);
            const now = new Date();
            const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                state.stats.streak += 1;
            } else if (diffDays > 1) {
                state.stats.streak = 1;
            }
        } else {
            state.stats.streak = 1;
        }
        state.stats.lastDate = today;
    }
    
    localStorage.setItem('nn_stats', JSON.stringify(state.stats));
    
    // Update daily total
    let dailyTotal = parseInt(localStorage.getItem('nn_daily_total_' + today)) || 0;
    dailyTotal += minutes;
    localStorage.setItem('nn_daily_total_' + today, dailyTotal);
    
    updateStatsUI();
}

function updateStatsUI() {
    const today = new Date().toDateString();
    const dailyTotal = parseInt(localStorage.getItem('nn_daily_total_' + today)) || 0;
    
    els.timerTodayTotal.textContent = dailyTotal;
    els.timerStreak.textContent = state.stats.streak;
    
    document.getElementById('stats-streak').textContent = state.stats.streak;
    document.getElementById('stats-total-time').textContent = state.stats.totalTime;
    document.getElementById('stats-total-sessions').textContent = state.stats.sessions;
    document.getElementById('stats-journal-count').textContent = state.journal.length;
}

// Journal Logic
function setupJournal() {
    const chips = document.querySelectorAll('#journal-mood-chips .chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        });
    });

    document.getElementById('btn-save-journal').addEventListener('click', () => {
        const title = document.getElementById('journal-title-input').value.trim();
        const note = document.getElementById('journal-note-input').value.trim();
        const mood = document.querySelector('#journal-mood-chips .chip.active').dataset.value;
        const aiSummary = document.getElementById('journal-note-input').dataset.aiSummary || null;
        
        if (!title && !note) {
            showToast("Please enter something to save.");
            return;
        }
        
        const entry = {
            id: Date.now(),
            date: new Date().toLocaleDateString(),
            title: title || "Nature Discovery",
            note, mood, aiSummary
        };
        
        state.journal.unshift(entry);
        localStorage.setItem('nn_journal', JSON.stringify(state.journal));
        
        document.getElementById('modal-journal').classList.add('hidden');
        document.getElementById('journal-title-input').value = '';
        document.getElementById('journal-note-input').value = '';
        document.getElementById('journal-note-input').removeAttribute('data-ai-summary');
        showToast("Journal entry saved!");
        renderJournal();
        updateStatsUI();
    });
    
    // AI Describe Button
    document.getElementById('btn-ai-describe').addEventListener('click', async () => {
        const title = document.getElementById('journal-title-input').value;
        const note = document.getElementById('journal-note-input').value;
        
        if (!title && !note) {
            showToast("Write a few words first!");
            return;
        }
        
        const btn = document.getElementById('btn-ai-describe');
        btn.innerHTML = "✨ Writing...";
        btn.disabled = true;
        
        try {
            const prompt = `Act as a poetic nature guide. The user found: "${title}". Notes: "${note}". 
Write a beautifully poetic, inspiring 2-sentence reflection on this discovery.`;

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-2-2b-it:generateContent?key=${state.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.9, maxOutputTokens: 150 }
                })
            });
            
            const data = await res.json();
            if(data.error) throw new Error(data.error.message);
            
            const text = data.candidates[0].content.parts[0].text;
            
            // Set as AI summary attribute to render differently in UI
            document.getElementById('journal-note-input').dataset.aiSummary = text;
            showToast("AI added a poetic touch!");
            
        } catch (e) {
            console.error(e);
            showToast("Failed to generate description.");
        } finally {
            btn.innerHTML = "✨ Let AI describe this";
            btn.disabled = false;
        }
    });

    renderJournal();
}

function renderJournal() {
    els.journalList.innerHTML = '';
    
    if (state.journal.length === 0) {
        els.journalEmpty.style.display = 'block';
    } else {
        els.journalEmpty.style.display = 'none';
        
        state.journal.forEach(item => {
            const el = document.createElement('div');
            el.className = 'journal-item';
            el.innerHTML = `
                <div class="journal-item-head">
                    <span class="journal-item-title">${item.mood} ${item.title}</span>
                    <span class="journal-item-date">${item.date}</span>
                </div>
                ${item.note ? `<div class="journal-item-body">${item.note}</div>` : ''}
                ${item.aiSummary ? `<div class="journal-item-ai">✨ ${item.aiSummary}</div>` : ''}
            `;
            els.journalList.appendChild(el);
        });
    }
}

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('SW registered!', reg);
        }).catch(err => console.log('SW registration failed', err));
    });
}
