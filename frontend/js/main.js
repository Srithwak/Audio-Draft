/**
 * Audio-Draft2 — Client-Side Utilities
 */

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
        // Not logged in and trying to access a protected page
        window.location.href = 'login.html';
    } else if (userData && isAuthPage) {
        // Logged in but trying to access login/register
        window.location.href = 'dashboard.html';
    } else if (userData && !isAuthPage) {
        // Update UI with user info
        const user = JSON.parse(userData);
        const usernameEl = document.getElementById('nav-username');
        const avatarEl = document.getElementById('nav-avatar');
        const welcomeEl = document.getElementById('welcome-msg');

        if (usernameEl) usernameEl.textContent = user.username;
        if (avatarEl) avatarEl.textContent = user.username.charAt(0).toUpperCase();
        if (welcomeEl) welcomeEl.textContent = `Welcome back, ${user.username}`;

        // Match theme if user has preference
        if (user.theme_pref) {
            setTheme(user.theme_pref, false); // Don't sync back if we just loaded it
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

    // Sync with DB if logged in and requested
    const userData = localStorage.getItem('audioDraftUser');
    if (userData && sync) {
        const user = JSON.parse(userData);
        // Update local session data too
        user.theme_pref = theme;
        localStorage.setItem('audioDraftUser', JSON.stringify(user));

        apiFetch('/api/settings/theme', {
            method: 'PUT',
            body: JSON.stringify({ theme_pref: theme })
        }).catch(err => console.error("Failed to sync theme:", err));
    }

    // Update toggle switch if it exists
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
                    // Registration success, log them in or redirect them to login
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

        // Password match validation
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

    // Spotify credential validation
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

    // Remove existing errors
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


/* ── Dashboard & Spotify Live Logic ───────────────────────────────────────── */
function initDashboard() {
    updateNowPlaying();
    updateTrendingSongs();
    // Poll every 40 seconds
    setInterval(updateNowPlaying, 40000);
}

async function updateNowPlaying() {
    const container = document.getElementById('now-playing-container');
    if (!container) return;

    try {
        const response = await apiFetch('/api/spotify/currently-playing');
        const data = await response.json();

        if (data.playing) {
            container.innerHTML = `
                <div class="now-playing-card">
                    <div class="now-playing-card__art" style="background: rgba(255,255,255,0.05);"></div>
                    <div class="now-playing-card__info">
                        <div class="now-playing-card__title">${data.title}</div>
                        <div class="now-playing-card__artist">${data.artist}</div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `<p class="text-muted">Not listening to anything right now.</p>`;
        }
    } catch (err) {
        console.error("Spotify Polling Error:", err);
    }
}

async function updateTrendingSongs() {
    const container = document.getElementById('discover-container');
    if (!container) return;

    // --- CONVINCING DISCOVER MOCK DATA ---
    const discoverMock = [
        { title: "BIRDS OF A FEATHER", artist: "Billie Eilish", uri: "#" },
        { title: "Not Like Us", artist: "Kendrick Lamar", uri: "#" },
        { title: "Espresso", artist: "Sabrina Carpenter", uri: "#" },
        { title: "Houdini", artist: "Eminem", uri: "#" },
        { title: "Million Dollar Baby", artist: "Tommy Richman", uri: "#" },
        { title: "Good Luck, Babe!", artist: "Chappell Roan", uri: "#" }
    ];

    renderTrendingTracks(discoverMock, container);

    /*
    // --- REAL API DISABLED FOR DEMO ---
    try {
        const response = await apiFetch('/api/spotify/trending');
        ...
    } catch (err) {
        console.error("Trending Songs Error:", err);
    }
    */
}

function renderTrendingTracks(tracks, container) {
    container.innerHTML = tracks.map((track, index) => `
        <div class="track-card" onclick="window.open('${track.uri}', '_blank')">
            <div class="track-card__badge">#${index + 1}</div>
            <div class="track-card__art" style="background: rgba(255,255,255,0.05);"></div>
            <div class="track-card__title" title="${track.title}">${track.title}</div>
            <div class="track-card__artist" title="${track.artist}">${track.artist}</div>
        </div>
    `).join('');
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
                            <strong>${u.username}</strong>
                            <span>${u.email}</span>
                        </div>
                        <button class="btn btn--small btn--dark" onclick="sendFriendRequest('${u.user_id}')">Add Friend</button>
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
            return `<div class="friend-item">${friendName}</div>`;
        }).join('') : '<p>No friends yet.</p>';

        requestsDiv.innerHTML = pending.length ? pending.map(f => {
            const requesterName = f.requester_id === f.user_id_1 ? f.user1.username : f.user2.username;
            return `
                <div class="request-item">
                    <span>${requesterName} sent you a request</span>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn--small btn--dark" onclick="acceptFriend('${f.friend_id}')">Accept</button>
                        <button class="btn btn--small btn--dark" style="background: var(--accent-red);" onclick="declineFriend('${f.friend_id}')">Decline</button>
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
                        // Fallback for non-electron environment
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

/* ── Analytics Logic ──────────────────────────────────────────────────────── */
function initAnalytics() {
    const btns = document.querySelectorAll('.timeframe-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadAnalytics(btn.getAttribute('data-time'));
        });
    });

    loadAnalytics('short_term');
}

async function loadAnalytics(timeframe) {
    const historyList = document.getElementById('history-stats');
    const artistsList = document.getElementById('top-artists-list');
    const tracksList = document.getElementById('top-tracks-list');
    const recentList = document.getElementById('recent-tracks-list');
    const playtimeEl = document.getElementById('total-playtime');
    const songsLoggedEl = document.getElementById('songs-logged');

    // if (!historyList) return; // REMOVED: This was causing an early return since the ID doesn't exist in analytics.html

    // --- CONVINCING DEMO MOCK DATA ---
    const mockData = {
        short_term: {
            songs: 142,
            playtime: "8h 24m",
            genre: "Indie Pop",
            artists: [
                { name: "Taylor Swift", popularity: 98, image: "https://i.scdn.co/image/ab6761610000e5eb5a00969d90918a163f45c2ae" },
                { name: "The Weeknd", popularity: 95, image: "https://i.scdn.co/image/ab6761610000e5eb214f470001880486c9d09c31" },
                { name: "Lana Del Rey", popularity: 89, image: "https://i.scdn.co/image/ab6761610000e5eb2d08560942e1a3bc33066601" },
                { name: "Arctic Monkeys", popularity: 87, image: "https://i.scdn.co/image/ab6761610000e5eb7da39dea0a72f581535fb11f" },
                { name: "Billie Eilish", popularity: 92, image: "https://i.scdn.co/image/ab6761610000e5eb221183df06e987c933979858" }
            ],
            tracks: [
                { name: "Cruel Summer", artist: "Taylor Swift", album: "Lover", image: "https://i.scdn.co/image/ab67616d0000b273e787cffec20aa2a1562b7cf2" },
                { name: "Blinding Lights", artist: "The Weeknd", album: "After Hours", image: "https://i.scdn.co/image/ab67616d0000b273886566993ef909249719396f" },
                { name: "Starboy", artist: "The Weeknd", album: "Starboy", image: "https://i.scdn.co/image/ab67616d0000b2734718388b53b7c809741b4e9e" },
                { name: "Say Yes To Heaven", artist: "Lana Del Rey", album: "Say Yes To Heaven", image: "https://i.scdn.co/image/ab67616d0000b27391730a394336c253896504a5" }
            ],
            recent: [
                { name: "Fortnight", artist: "Taylor Swift", played_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), image: "https://i.scdn.co/image/ab67616d0000b27382b988f06056f345c2f82c23" },
                { name: "Espresso", artist: "Sabrina Carpenter", played_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), image: "https://i.scdn.co/image/ab67616d0000b273a0a38fd6a28e815e982d6ca0" },
                { name: "Pink + White", artist: "Frank Ocean", played_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), image: "https://i.scdn.co/image/ab67616d0000b2730129033324f6502283cc2834" }
            ]
        },
        medium_term: {
            songs: 1240,
            playtime: "72h 15m",
            genre: "Synthwave",
            artists: [
                { name: "Daft Punk", popularity: 88, image: "https://i.scdn.co/image/ab6761610000e5eb24f470001880486c9d09c31" },
                { name: "Kavinsky", popularity: 75, image: "https://i.scdn.co/image/ab6761610000e5ebf8713d78c0e2a3a7895f50ef" },
                { name: "The Weeknd", popularity: 95, image: "https://i.scdn.co/image/ab6761610000e5eb214f470001880486c9d09c31" }
            ],
            tracks: [
                { name: "Nightcall", artist: "Kavinsky", album: "OutRun", image: "https://i.scdn.co/image/ab67616d0000b2734107f9095655519491a6d912" },
                { name: "One More Time", artist: "Daft Punk", album: "Discovery", image: "https://i.scdn.co/image/ab67616d0000b273ff20138546b4146a78287d3a" }
            ],
            recent: []
        },
        long_term: {
            songs: 5280,
            playtime: "312h 45m",
            genre: "Classic Rock",
            artists: [
                { name: "Queen", popularity: 92, image: "https://i.scdn.co/image/ab6761610000e5eb6040854c30c822e18fa4cf2b" },
                { name: "Pink Floyd", popularity: 85, image: "https://i.scdn.co/image/ab6761610000e5eb74b78631ef812a6409b626d7" },
                { name: "The Beatles", popularity: 90, image: "https://i.scdn.co/image/ab6761610000e5ebc58f96e4693a388a100652da" }
            ],
            tracks: [
                { name: "Bohemian Rhapsody", artist: "Queen", album: "A Night at the Opera", image: "https://i.scdn.co/image/ab67616d0000b273e319ba339066601f01c25143" },
                { name: "Wish You Were Here", artist: "Pink Floyd", album: "Wish You Were Here", image: "https://i.scdn.co/image/ab67616d0000b2735702652b36203cf6551b9200" }
            ],
            recent: []
        }
    };

    const currentMock = mockData[timeframe] || mockData.short_term;

    function renderMock() {
        if (playtimeEl) playtimeEl.textContent = currentMock.playtime;
        if (songsLoggedEl) songsLoggedEl.textContent = currentMock.songs;
        const genreEl = document.getElementById('top-genre');
        if (genreEl) genreEl.textContent = currentMock.genre;

        if (artistsList) {
            artistsList.innerHTML = currentMock.artists.map(a => `
                <div class="ranking-item">
                    <div class="ranking-img" style="background: rgba(255,255,255,0.05);"></div>
                    <div class="ranking-info">
                        <div class="ranking-name">${a.name}</div>
                        <div class="progress-bar"><div class="progress-fill" style="width: ${a.popularity}%"></div></div>
                    </div>
                    <div class="ranking-value">${a.popularity}%</div>
                </div>
            `).join('');
        }

        if (tracksList) {
            tracksList.innerHTML = currentMock.tracks.map(t => `
                <div class="ranking-item">
                    <div class="ranking-img" style="background: rgba(255,255,255,0.05);"></div>
                    <div class="ranking-info">
                        <div class="ranking-name">${t.name}</div>
                        <div class="ranking-sub">${t.artist} • ${t.album}</div>
                    </div>
                </div>
            `).join('');
        }

        if (recentList && currentMock.recent.length > 0) {
            recentList.innerHTML = currentMock.recent.map(t => `
                <div class="ranking-item">
                    <div class="ranking-img" style="background: rgba(255,255,255,0.05);"></div>
                    <div class="ranking-info">
                        <div class="ranking-name">${t.name}</div>
                        <div class="ranking-sub">${t.artist} • ${new Date(t.played_at).toLocaleString()}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    renderMock(); // SHOW MOCK BY DEFAULT

    /* 
    // --- REAL API ATTEMPT (DISABLED FOR PURE DEMO AS REQUESTED) ---
    try {
        const historyRes = await apiFetch(`/api/analytics?timeframe=${timeframe}`);
        ...
    } catch (err) {
        console.error("Analytics Load Error:", err);
    }
    */
}
