/**
 * Audio-Draft2 — Client-Side Utilities
 */

// --- XSS Protection ---
function sanitize(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initFlashAutoDismiss();
    initFormValidation();
    initAuthForms();

    // Check Authentication state
    checkAuthState();

    // Init Page Specifics
    const path = window.location.pathname;
    if (path.endsWith('dashboard.html')) {
        initDashboard();
    } else if (path.endsWith('social.html')) {
        initSocial();
    } else if (path.endsWith('settings.html')) {
        initSettings();
    } else if (path.endsWith('analytics.html')) {
        initAnalytics();
    }

    // Init Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('audioDraftUser');
            window.location.href = 'login.html';
        });
    }
});

/* ── Auth checking & helpers ────────────────────────────────────────────────── */
function checkAuthState() {
    const isAuthPage = window.location.pathname.endsWith('login.html') ||
        window.location.pathname.endsWith('register.html') ||
        window.location.pathname === '/' ||
        window.location.pathname.endsWith('index.html');

    const userData = localStorage.getItem('audioDraftUser');

    if (!userData && !isAuthPage) {
        window.location.href = 'login.html';
    } else if (userData && isAuthPage) {
        window.location.href = 'dashboard.html';
    } else if (userData && !isAuthPage) {
        const user = JSON.parse(userData);
        const usernameEl = document.getElementById('nav-username');
        const avatarEl = document.getElementById('nav-avatar');
        const welcomeEl = document.getElementById('welcome-msg');

        if (usernameEl) usernameEl.textContent = user.username;
        if (avatarEl) avatarEl.textContent = user.username.charAt(0).toUpperCase();
        if (welcomeEl) welcomeEl.textContent = `Welcome back, ${user.username}`;

        if (user.theme_pref) {
            setTheme(user.theme_pref, false);
        }
    }
}

// Wrapper for fetch API to automatically include the auth header
async function apiFetch(url, options = {}) {
    const userData = localStorage.getItem('audioDraftUser');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (userData) {
        const user = JSON.parse(userData);
        headers['Authorization'] = `Bearer ${user.id}`;
    }

    return fetch(url, { ...options, headers });
}

// Check if Spotify credentials are set
async function checkSpotifyStatus() {
    try {
        const res = await apiFetch('/api/spotify/status');
        const data = await res.json();
        return !!data.configured;
    } catch (err) {
        console.error("Failed to check Spotify status:", err);
        return false;
    }
}

/* ── Theme Management ──────────────────────────────────────────────────────── */
function initTheme() {
    const savedTheme = localStorage.getItem('audioDraftTheme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme, sync = true) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
    localStorage.setItem('audioDraftTheme', theme);

    const userData = localStorage.getItem('audioDraftUser');
    if (userData && sync) {
        const user = JSON.parse(userData);
        user.theme_pref = theme;
        localStorage.setItem('audioDraftUser', JSON.stringify(user));

        apiFetch('/api/settings/theme', {
            method: 'PUT',
            body: JSON.stringify({ theme_pref: theme })
        }).catch(err => console.error("Failed to sync theme:", err));
    }

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.checked = (theme === 'light');
    }
}


/* ── Flash Message Auto-Dismiss ────────────────────────────────────────────── */
function initFlashAutoDismiss() {
    const container = document.getElementById("flash-container");
    if (!container) return;

    const flashes = container.querySelectorAll(".flash");
    flashes.forEach((flash, i) => {
        setTimeout(() => {
            flash.style.transition = "opacity 0.3s ease, transform 0.3s ease";
            flash.style.opacity = "0";
            flash.style.transform = "translateX(40px)";
            setTimeout(() => flash.remove(), 300);
        }, 4000 + i * 500);
    });
}


/* ── Client-Side API Authentication ────────────────────────────────────────── */
function initAuthForms() {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = document.getElementById("login-submit");
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            btn.disabled = true;
            btn.textContent = "Signing In...";

            try {
                const response = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                if (response.ok) {
                    localStorage.setItem('audioDraftUser', JSON.stringify(data.user));
                    if (data.user.theme_pref) {
                        setTheme(data.user.theme_pref, false);
                    }
                    window.location.href = "dashboard.html";
                } else {
                    alert(data.error || "Login failed");
                    btn.disabled = false;
                    btn.textContent = "Sign In";
                }
            } catch (err) {
                alert("Network error. Could not connect to the server.");
                btn.disabled = false;
                btn.textContent = "Sign In";
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = document.getElementById("register-submit");
            const username = document.getElementById("username").value;
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const confirm_password = document.getElementById("confirm_password").value;

            if (password !== confirm_password) {
                alert("Passwords do not match");
                return;
            }

            btn.disabled = true;
            btn.textContent = "Creating Account...";

            try {
                const response = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, email, password })
                });

                const data = await response.json();
                if (response.ok) {
                    localStorage.setItem('audioDraftUser', JSON.stringify(data.user));
                    if (data.user.theme_pref) {
                        setTheme(data.user.theme_pref, false);
                    }
                    alert("Account created successfully! Redirecting to dashboard...");
                    window.location.href = "dashboard.html";
                } else {
                    alert(data.error || "Registration failed");
                    btn.disabled = false;
                    btn.textContent = "Create Account";
                }
            } catch (err) {
                alert("Network error. Could not connect to the server.");
                btn.disabled = false;
                btn.textContent = "Create Account";
            }
        });
    }
}


/* ── Client-Side Form Validation ───────────────────────────────────────────── */
function initFormValidation() {
    const forms = document.querySelectorAll(".auth-form, .settings-form");

    forms.forEach((form) => {
        const inputs = form.querySelectorAll(".form-input");

        inputs.forEach((input) => {
            input.addEventListener("blur", () => {
                validateInput(input);
            });

            input.addEventListener("input", () => {
                const group = input.closest(".form-group");
                if (group) {
                    group.classList.remove("form-group--error");
                }
            });
        });

        const password = form.querySelector("#password");
        const confirm = form.querySelector("#confirm_password");

        if (password && confirm) {
            confirm.addEventListener("input", () => {
                if (confirm.value && password.value !== confirm.value) {
                    showInputError(confirm, "Passwords do not match");
                } else {
                    clearInputError(confirm);
                }
            });
        }
    });
}

function validateInput(input) {
    const value = input.value.trim();
    const id = input.id;

    if (!value) return;

    if (id === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            showInputError(input, "Please enter a valid email address");
            return;
        }
    }

    if (id === "username") {
        if (value.length < 3) {
            showInputError(input, "Username must be at least 3 characters");
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            showInputError(input, "Letters, numbers, and underscores only");
            return;
        }
    }

    if (id === "password") {
        if (value.length < 8) {
            showInputError(input, "Password must be at least 8 characters");
            return;
        }
    }

    if (id === "client_id") {
        if (!/^[a-f0-9]{32}$/i.test(value)) {
            showInputError(input, "Client ID must be a 32-character hex string");
            return;
        }
    }

    if (id === "client_secret") {
        if (!/^[a-f0-9]{32}$/i.test(value)) {
            showInputError(input, "Client Secret must be a 32-character hex string");
            return;
        }
    }

    clearInputError(input);
}

function showInputError(input, message) {
    const group = input.closest(".form-group");
    if (!group) return;

    const existing = group.querySelectorAll(".form-error--client");
    existing.forEach((el) => el.remove());

    group.classList.add("form-group--error");
    input.style.borderColor = "var(--accent-red)";

    const errorSpan = document.createElement("span");
    errorSpan.className = "form-error form-error--client";
    errorSpan.textContent = message;
    group.appendChild(errorSpan);
}

function clearInputError(input) {
    const group = input.closest(".form-group");
    if (!group) return;

    group.classList.remove("form-group--error");
    input.style.borderColor = "";

    const existing = group.querySelectorAll(".form-error--client");
    existing.forEach((el) => el.remove());
}

/* ── Dashboard — Now Playing Only ─────────────────────────────────────────── */
async function initDashboard() {
    updateNowPlaying();
    setInterval(updateNowPlaying, 30000);
}

function formatMs(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    return `${m}:${s}`;
}

async function updateNowPlaying() {
    const container = document.getElementById('now-playing-container');
    if (!container) return;

    try {
        const response = await apiFetch('/api/spotify/currently-playing');
        const data = await response.json();

        if (data.playing) {
            const artHtml = data.album_art
                ? `<img class="now-playing-card__art" src="${sanitize(data.album_art)}" alt="Album art">`
                : `<div class="now-playing-card__art" style="background: rgba(255,255,255,0.05);"></div>`;

            const statusBadge = data.is_playing
                ? `<div class="playing-badge"><div class="playing-badge__dot"></div>Now Playing</div>`
                : `<div class="playing-badge" style="background: rgba(250,204,21,0.15); color: #facc15;"><div class="playing-badge__dot" style="background: #facc15;"></div>Paused</div>`;

            const deviceIcon = data.device_type === 'smartphone' ? '📱'
                : data.device_type === 'computer' ? '💻'
                    : data.device_type === 'speaker' ? '🔊' : '🎧';

            container.innerHTML = `
                ${statusBadge}
                <div class="now-playing-card" style="margin-top: 16px;">
                    ${artHtml}
                    <div class="now-playing-card__info">
                        <div class="now-playing-card__title">${sanitize(data.title)}</div>
                        <div class="now-playing-card__artist">${sanitize(data.artist)}</div>
                        <div class="now-playing-card__album">${sanitize(data.album)}</div>
                        <div class="now-playing-card__device">${deviceIcon} ${sanitize(data.device_name)}</div>
                        <div class="progress-track">
                            <div class="progress-track__fill" style="width: ${data.progress_pct}%"></div>
                        </div>
                        <div class="now-playing-card__time">
                            <span>${formatMs(data.progress_ms)}</span>
                            <span>${formatMs(data.duration_ms)}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state__icon">🎧</div>
                    <h3>Nothing playing</h3>
                    <p>Play something on Spotify to see it here.</p>
                </div>
            `;
        }
    } catch (err) {
        console.error("Now Playing Error:", err);
    }
}


/* ── Social & Search Logic ────────────────────────────────────────────────── */
function initSocial() {
    const searchForm = document.getElementById('user-search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const query = document.getElementById('search-query').value;
            const resultsDiv = document.getElementById('search-results');
            resultsDiv.innerHTML = '<p>Searching...</p>';

            try {
                const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();

                if (data.users.length === 0) {
                    resultsDiv.innerHTML = '<p>No users found.</p>';
                    return;
                }

                resultsDiv.innerHTML = data.users.map(u => `
                    <div class="user-card">
                        <div class="user-card__info">
                            <strong>${sanitize(u.username)}</strong>
                            <span>${sanitize(u.email)}</span>
                        </div>
                        <button class="btn btn--small btn--dark" onclick="sendFriendRequest('${sanitize(u.user_id)}')">Add Friend</button>
                    </div>
                `).join('');
            } catch (err) {
                resultsDiv.innerHTML = '<p>Search failed.</p>';
            }
        });
    }
    loadFriendships();
}

async function sendFriendRequest(userId) {
    try {
        const res = await apiFetch('/api/friends/request', {
            method: 'POST',
            body: JSON.stringify({ target_user_id: userId })
        });
        const data = await res.json();
        alert(data.message || data.error);
    } catch (err) {
        alert("Failed to send request");
    }
}

async function loadFriendships() {
    const friendsDiv = document.getElementById('friends-list');
    const requestsDiv = document.getElementById('requests-list');
    if (!friendsDiv) return;

    try {
        const res = await apiFetch('/api/friends');
        const data = await res.json();
        const user = JSON.parse(localStorage.getItem('audioDraftUser'));

        const accepted = data.friendships.filter(f => f.status === 'ACCEPTED');
        const pending = data.friendships.filter(f => f.status === 'PENDING' && f.requester_id !== user.id);

        friendsDiv.innerHTML = accepted.length ? accepted.map(f => {
            const friendName = f.user_id_1 === user.id ? f.user2.username : f.user1.username;
            return `<div class="friend-item">
                <span>${sanitize(friendName)}</span>
                <button class="btn btn--small btn--dark" style="background: var(--accent-red);" onclick="removeFriend('${sanitize(f.friend_id)}')">Remove</button>
            </div>`;
        }).join('') : '<p>No friends yet.</p>';

        requestsDiv.innerHTML = pending.length ? pending.map(f => {
            const requesterName = f.requester_id === f.user_id_1 ? f.user1.username : f.user2.username;
            return `
                <div class="request-item">
                    <span>${sanitize(requesterName)} sent you a request</span>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn--small btn--dark" onclick="acceptFriend('${sanitize(f.friend_id)}')">Accept</button>
                        <button class="btn btn--small btn--dark" style="background: var(--accent-red);" onclick="declineFriend('${sanitize(f.friend_id)}')">Decline</button>
                    </div>
                </div>
            `;
        }).join('') : '<p>No pending requests.</p>';
    } catch (err) {
        console.error(err);
    }
}

async function acceptFriend(friendId) {
    try {
        await apiFetch('/api/friends/accept', {
            method: 'POST',
            body: JSON.stringify({ friend_id: friendId })
        });
        loadFriendships();
    } catch (err) {
        alert("Failed to accept");
    }
}

async function declineFriend(friendId) {
    if (!confirm("Decline this friend request?")) return;
    try {
        await apiFetch(`/api/friends/${friendId}`, {
            method: 'DELETE'
        });
        loadFriendships();
    } catch (err) {
        alert("Failed to decline");
    }
}

async function removeFriend(friendId) {
    if (!confirm("Remove this friend?")) return;
    try {
        await apiFetch(`/api/friends/${friendId}`, {
            method: 'DELETE'
        });
        loadFriendships();
    } catch (err) {
        alert("Failed to remove friend");
    }
}

/* ── Settings Specifics ───────────────────────────────────────────────────── */
function initSettings() {
    const connectBtn = document.getElementById('connect-spotify-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            try {
                const res = await apiFetch('/api/spotify/auth-url');
                const data = await res.json();
                if (data.url) {
                    try {
                        const { shell } = require('electron');
                        shell.openExternal(data.url);
                    } catch (e) {
                        window.open(data.url, '_blank');
                    }
                } else {
                    alert(data.error || "Could not get Auth URL");
                }
            } catch (err) {
                alert("Error connecting to Spotify");
            }
        });
    }
}

/* ── Analytics Logic (Real Spotify API + Profile) ─────────────────────────── */
async function initAnalytics() {
    const btns = document.querySelectorAll('.timeframe-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadAnalytics(btn.getAttribute('data-time'));
        });
    });

    loadAnalytics('short_term');
    loadProfileAnalytics();
}

async function loadProfileAnalytics() {
    try {
        const res = await apiFetch('/api/profile-analytics');
        if (!res.ok) return;
        const data = await res.json();

        const el = (id) => document.getElementById(id);
        if (el('stat-playlists')) el('stat-playlists').textContent = data.playlists_count;
        if (el('stat-reviews')) el('stat-reviews').textContent = data.reviews_count;
        if (el('stat-friends')) el('stat-friends').textContent = data.friends_count;
        if (el('stat-avg-rating')) el('stat-avg-rating').textContent = data.average_rating_given ? `${data.average_rating_given} / 5` : 'N/A';
        if (el('stat-exports')) el('stat-exports').textContent = data.exports_count;
    } catch (err) {
        console.error("Failed to load profile analytics", err);
    }
}

async function loadAnalytics(timeframe) {
    const artistsList = document.getElementById('top-artists-list');
    const tracksList = document.getElementById('top-tracks-list');
    const recentList = document.getElementById('recent-tracks-list');
    const genreEl = document.getElementById('top-genre');
    const syncStatus = document.getElementById('spotify-sync-status');

    if (syncStatus) syncStatus.textContent = 'Syncing...';

    try {
        const response = await apiFetch(`/api/analytics?timeframe=${timeframe}`);
        if (!response.ok) {
            const errData = await response.json();
            if (syncStatus) syncStatus.textContent = errData.error || 'Error';
            return;
        }

        const data = await response.json();

        if (genreEl) genreEl.textContent = data.genre || 'Unknown';

        if (artistsList && data.artists) {
            artistsList.innerHTML = data.artists.length > 0 ? data.artists.map((a, i) => {
                const imgHtml = a.image
                    ? `<img class="ranking-img ranking-img--round" src="${sanitize(a.image)}" alt="${sanitize(a.name)}">`
                    : `<div class="ranking-img ranking-img--round" style="background: rgba(255,255,255,0.05);"></div>`;
                const genreHtml = (a.genres || []).map(g => `<span class="genre-badge">${sanitize(g)}</span>`).join('');
                return `
                <div class="ranking-item">
                    <div class="ranking-rank">${i + 1}</div>
                    ${imgHtml}
                    <div class="ranking-info">
                        <div class="ranking-name">${sanitize(a.name)}</div>
                        <div>${genreHtml}</div>
                    </div>
                </div>
            `}).join('') : '<p class="text-muted">No top artists data available.</p>';
        }

        if (tracksList && data.tracks) {
            tracksList.innerHTML = data.tracks.length > 0 ? data.tracks.map((t, i) => {
                const imgHtml = t.image
                    ? `<img class="ranking-img" src="${sanitize(t.image)}" alt="${sanitize(t.name)}">`
                    : `<div class="ranking-img" style="background: rgba(255,255,255,0.05);"></div>`;
                const dur = t.duration_ms ? formatMs(t.duration_ms) : '';
                return `
                <div class="ranking-item">
                    <div class="ranking-rank">${i + 1}</div>
                    ${imgHtml}
                    <div class="ranking-info">
                        <div class="ranking-name">${sanitize(t.name)}</div>
                        <div class="ranking-sub">${sanitize(t.artist)} · ${sanitize(t.album)}</div>
                    </div>
                    ${dur ? `<div class="ranking-sub" style="flex-shrink:0">${dur}</div>` : ''}
                </div>
            `}).join('') : '<p class="text-muted">No top tracks data available.</p>';
        }

        if (recentList && data.recent) {
            recentList.innerHTML = data.recent.length > 0 ? data.recent.map(t => {
                const imgHtml = t.image
                    ? `<img class="ranking-img" src="${sanitize(t.image)}" alt="${sanitize(t.name)}">`
                    : `<div class="ranking-img" style="background: rgba(255,255,255,0.05);"></div>`;
                const timeAgo = getTimeAgo(t.played_at);
                return `
                <div class="ranking-item">
                    ${imgHtml}
                    <div class="ranking-info">
                        <div class="ranking-name">${sanitize(t.name)}</div>
                        <div class="ranking-sub">${sanitize(t.artist)}</div>
                    </div>
                    <div class="ranking-sub" style="flex-shrink:0">${timeAgo}</div>
                </div>
            `}).join('') : '<p class="text-muted">No recent listening data available.</p>';
        }

        if (syncStatus) syncStatus.textContent = 'Synced ✓';
    } catch (err) {
        console.error("Analytics Load Error:", err);
        if (syncStatus) syncStatus.textContent = 'Error';
    }
}

function getTimeAgo(isoDate) {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}
