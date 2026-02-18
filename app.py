from flask import Flask, render_template, request, redirect, url_for, jsonify
import sqlite3
from datetime import date, datetime, timedelta

app = Flask(__name__)
DATABASE = 'vocab.db'


def get_db():
    """Get a database connection."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database with required tables."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            streak INTEGER DEFAULT 0,
            last_active_date TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            german_word TEXT NOT NULL,
            meaning TEXT NOT NULL,
            example TEXT,
            date_added TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS streak_dates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            active_date TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, active_date)
        )
    ''')

    # Create default user if not exists
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            'INSERT INTO users (name, streak) VALUES (?, ?)',
            ('Learner', 0)
        )

    conn.commit()
    conn.close()


def get_user():
    """Get the default user."""
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = 1').fetchone()
    conn.close()
    return user


def get_today_word_count():
    """Get number of words added today."""
    conn = get_db()
    today = date.today().isoformat()
    count = conn.execute(
        'SELECT COUNT(*) FROM words WHERE user_id = 1 AND date_added = ?',
        (today,)
    ).fetchone()[0]
    conn.close()
    return count


def update_streak():
    """Update the user's streak based on activity."""
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = 1').fetchone()
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    today_count = conn.execute(
        'SELECT COUNT(*) FROM words WHERE user_id = 1 AND date_added = ?',
        (today,)
    ).fetchone()[0]

    last_active = user['last_active_date']
    current_streak = user['streak']

    if today_count >= 5:
        # Log today as active
        conn.execute(
            'INSERT OR IGNORE INTO streak_dates (user_id, active_date) VALUES (1, ?)',
            (today,)
        )

        if last_active == today:
            # Already updated today
            pass
        elif last_active == yesterday:
            # Consecutive day → increment
            current_streak += 1
            conn.execute(
                'UPDATE users SET streak = ?, last_active_date = ? WHERE id = 1',
                (current_streak, today)
            )
        elif last_active is None:
            # First time
            conn.execute(
                'UPDATE users SET streak = 1, last_active_date = ? WHERE id = 1',
                (today,)
            )
        else:
            # Missed day(s) → reset
            conn.execute(
                'UPDATE users SET streak = 1, last_active_date = ? WHERE id = 1',
                (today,)
            )
    else:
        # Update last_active_date if adding words today but haven't hit 5 yet
        if last_active != today and last_active != yesterday and last_active is not None:
            # Missed day(s) → reset streak
            conn.execute(
                'UPDATE users SET streak = 0 WHERE id = 1',
            )

    conn.commit()
    conn.close()


# ─── ROUTES ──────────────────────────────────────────

@app.route('/')
def dashboard():
    """Dashboard page showing words and stats."""
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = 1').fetchone()
    words = conn.execute(
        'SELECT * FROM words WHERE user_id = 1 ORDER BY date_added DESC'
    ).fetchall()
    conn.close()

    today_count = get_today_word_count()

    return render_template(
        'dashboard.html',
        user=user,
        words=words,
        today_count=today_count
    )


@app.route('/add')
def add_word():
    """Show the add word form and list words for management."""
    conn = get_db()
    words = conn.execute(
        'SELECT * FROM words WHERE user_id = 1 ORDER BY date_added DESC'
    ).fetchall()
    conn.close()
    return render_template('add_word.html', words=words)


@app.route('/delete_word/<int:word_id>', methods=['POST'])
def delete_word(word_id):
    """Delete a word from the database."""
    conn = get_db()
    conn.execute('DELETE FROM words WHERE id = ? AND user_id = 1', (word_id,))
    conn.commit()
    conn.close()
    return redirect(url_for('add_word'))


@app.route('/save_word', methods=['POST'])
def save_word():
    """Save a new word to the database."""
    german_word = request.form.get('german_word', '').strip()
    meaning = request.form.get('meaning', '').strip()
    example = request.form.get('example', '').strip()

    if german_word and meaning:
        conn = get_db()
        
        # Check for duplicate (case-insensitive)
        existing = conn.execute(
            'SELECT id FROM words WHERE user_id = 1 AND german_word = ? COLLATE NOCASE',
            (german_word,)
        ).fetchone()

        if existing:
            conn.close()
            return render_template('add_word.html', error=f"The word '{german_word}' already exists!")

        conn.execute(
            'INSERT INTO words (user_id, german_word, meaning, example, date_added) VALUES (?, ?, ?, ?, ?)',
            (1, german_word, meaning, example, date.today().isoformat())
        )
        conn.commit()
        conn.close()

        # Update streak after adding word
        update_streak()

    return redirect(url_for('dashboard'))


@app.route('/learn')
def learn():
    """Slideshow learning page."""
    return render_template('learn.html')


@app.route('/streak')
def streak_page():
    """Streak page with calendar."""
    user = get_user()
    today_count = get_today_word_count()
    return render_template(
        'streak.html',
        user=user,
        today_count=today_count
    )


@app.route('/api/words')
def api_words():
    """Return all words as JSON for the slideshow."""
    conn = get_db()
    words = conn.execute(
        'SELECT * FROM words WHERE user_id = 1 ORDER BY date_added DESC'
    ).fetchall()
    conn.close()

    words_list = [
        {
            'id': w['id'],
            'german_word': w['german_word'],
            'meaning': w['meaning'],
            'example': w['example'],
            'date_added': w['date_added']
        }
        for w in words
    ]

    return jsonify(words_list)


@app.route('/api/streak_dates')
def api_streak_dates():
    """Return streak active dates as JSON for calendar."""
    conn = get_db()
    dates = conn.execute(
        'SELECT active_date FROM streak_dates WHERE user_id = 1'
    ).fetchall()
    conn.close()

    return jsonify([d['active_date'] for d in dates])





@app.route('/sw.js')
def service_worker():
    return app.send_static_file('sw.js')


# ─── MAIN ────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
