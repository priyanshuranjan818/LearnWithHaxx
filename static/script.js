/* ═══════════════════════════════════════════════════
   LearnWithHaxx — JavaScript
   Pronunciation, Slideshow & Calendar Logic
   ═══════════════════════════════════════════════════ */

// ─── German Pronunciation ───────────────────────────

function speakGerman(word) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9;
    utterance.pitch = 1;

    // Try to find a German voice
    const voices = window.speechSynthesis.getVoices();
    const germanVoice = voices.find(v => v.lang.startsWith('de'));
    if (germanVoice) {
        utterance.voice = germanVoice;
    }

    window.speechSynthesis.speak(utterance);
}

// Ensure voices are loaded
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}


// ─── Slideshow Logic ────────────────────────────────

let words = [];
let currentIndex = 0;
let slideshowTimer = null;
let isPaused = false;

async function initSlideshow() {
    try {
        const response = await fetch('/api/words');
        words = await response.json();

        if (words.length === 0) {
            document.getElementById('slideshowContainer').innerHTML = `
                <div style="text-align: center; color: #afafaf;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📖</div>
                    <p style="font-size: 18px; font-weight: 600;">No words to learn!</p>
                    <p style="font-size: 14px; margin-top: 8px;">Add some words first, then come back.</p>
                    <a href="/add" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #58cc02; color: white; border-radius: 12px; font-weight: 700; text-decoration: none;">Add Words</a>
                </div>
            `;
            document.getElementById('slideshowControls').style.display = 'none';
            return;
        }

        updateProgressText();
        showCurrentWord();
        startAutoAdvance();
    } catch (error) {
        console.error('Failed to load words:', error);
    }
}

function showCurrentWord() {
    if (currentIndex >= words.length) {
        showSessionComplete();
        return;
    }

    const word = words[currentIndex];
    const slideWord = document.getElementById('slideWord');
    const slideMeaning = document.getElementById('slideMeaning');
    const slideExample = document.getElementById('slideExample');
    const slide = document.getElementById('currentSlide');

    // Re-trigger animation
    slide.style.animation = 'none';
    slide.offsetHeight; // Force reflow
    slide.style.animation = 'slideIn 0.4s ease-out';

    slideWord.textContent = word.german_word;
    slideMeaning.textContent = word.meaning;
    slideExample.textContent = word.example || '';

    updateProgressBar();
    updateProgressText();

    // Auto-pronounce
    setTimeout(() => speakGerman(word.german_word), 300);
}

function updateProgressBar() {
    const fill = document.getElementById('progressFill');
    const percent = ((currentIndex + 1) / words.length) * 100;
    fill.style.width = percent + '%';
}

function updateProgressText() {
    const text = document.getElementById('progressText');
    text.textContent = `${currentIndex + 1} / ${words.length}`;
}

function startAutoAdvance() {
    clearInterval(slideshowTimer);
    slideshowTimer = setInterval(() => {
        if (!isPaused) {
            currentIndex++;
            showCurrentWord();
        }
    }, 4000);
}

function nextSlide() {
    currentIndex++;
    if (currentIndex >= words.length) {
        showSessionComplete();
    } else {
        showCurrentWord();
    }
    // Reset timer
    startAutoAdvance();
}

function prevSlide() {
    if (currentIndex > 0) {
        currentIndex--;
        showCurrentWord();
        startAutoAdvance();
    }
}

function togglePause() {
    isPaused = !isPaused;
    const pauseIcon = document.getElementById('pauseIcon');
    const playIcon = document.getElementById('playIcon');

    if (isPaused) {
        pauseIcon.style.display = 'none';
        playIcon.style.display = 'block';
    } else {
        pauseIcon.style.display = 'block';
        playIcon.style.display = 'none';
    }
}

function showSessionComplete() {
    clearInterval(slideshowTimer);

    document.getElementById('slideshowContainer').style.display = 'none';
    document.getElementById('slideshowControls').style.display = 'none';
    document.getElementById('sessionComplete').style.display = 'flex';

    // Fill progress bar to 100%
    const fill = document.getElementById('progressFill');
    fill.style.width = '100%';
    document.getElementById('progressText').textContent = `${words.length} / ${words.length}`;
}


// ─── Streak Calendar ────────────────────────────────

let calendarDate = new Date();
let streakDates = [];

async function initCalendar() {
    try {
        const response = await fetch('/api/streak_dates');
        streakDates = await response.json();
    } catch (error) {
        console.error('Failed to load streak dates:', error);
        streakDates = [];
    }

    renderCalendar();
}

function changeMonth(delta) {
    calendarDate.setMonth(calendarDate.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('calMonth');

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    monthLabel.textContent = `${months[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    grid.innerHTML = '';

    // Empty cells for days before first day of month
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day empty';
        grid.appendChild(empty);
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'cal-day';
        dayEl.textContent = d;

        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        if (streakDates.includes(dateStr)) {
            dayEl.classList.add('active');
        }

        if (dateStr === todayStr) {
            dayEl.classList.add('today');
        }

        grid.appendChild(dayEl);
    }
}

// ─── PWA Service Worker Registration ────────────────

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered!', reg))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

// ─── Install prompt handling ─────────────────────────
let deferredPrompt;
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    deferredPrompt = e;
    // Show our custom install button
    if (installBtn) {
        installBtn.style.display = 'inline-block';
    }
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;
            console.log('User response to install prompt:', choiceResult);
            deferredPrompt = null;
            installBtn.style.display = 'none';
        }
    });
}



