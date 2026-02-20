/*
  app.js — Frontend Logic
  Sends requests to Flask API, shows/hides sections.
*/

// Check if already logged in on page load.
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (res.ok) {
            const data = await res.json();
            showDashboard(data.username);
        }
    } catch (e) { /* not logged in */ }
});

// Register
document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("regUsername").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value.trim();

    try {
        const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username, email, password }),
        });
        const data = await res.json();
        document.getElementById("authMessage").textContent = res.ok
            ? "Registered! You can now log in."
            : data.error;
    } catch (e) {
        document.getElementById("authMessage").textContent = "Network error.";
    }
});

// Login
document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (res.ok) {
            showDashboard(data.username);
        } else {
            document.getElementById("authMessage").textContent = data.error;
        }
    } catch (e) {
        document.getElementById("authMessage").textContent = "Network error.";
    }
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    document.getElementById("dashboard").style.display = "none";
    document.getElementById("authSection").style.display = "block";
    document.getElementById("userStatus").textContent = "";
    document.getElementById("authMessage").textContent = "";
});

// Show dashboard and load songs
function showDashboard(username) {
    document.getElementById("authSection").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    document.getElementById("userStatus").textContent = "Logged in as: " + username;
    loadSongs();
}

async function loadSongs() {
    const tbody = document.getElementById("songBody");
    tbody.innerHTML = "";
    try {
        const res = await fetch("/api/songs", { credentials: "include" });
        const data = await res.json();
        if (res.ok && data.songs.length > 0) {
            document.getElementById("songTable").style.display = "";
            document.getElementById("noSongs").style.display = "none";
            data.songs.forEach((s) => {
                const tr = document.createElement("tr");
                tr.innerHTML =
                    "<td>" + esc(s.title) + "</td>" +
                    "<td>" + esc(s.artist) + "</td>" +
                    "<td>" + esc(s.album || "-") + "</td>" +
                    "<td>" + esc(s.genre || "-") + "</td>" +
                    "<td>" + fmtDur(s.duration_ms) + "</td>";
                tbody.appendChild(tr);
            });
        } else {
            document.getElementById("songTable").style.display = "none";
            document.getElementById("noSongs").style.display = "";
        }
    } catch (e) {
        document.getElementById("noSongs").style.display = "";
    }
}

function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

function fmtDur(ms) {
    if (!ms) return "-";
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ":" + (s % 60).toString().padStart(2, "0");
}
