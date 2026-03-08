require('dotenv').config({ path: './database/.env' });
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const path = require('path');
const axios = require('axios');
const querystring = require('querystring');

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.API_URL || "https://dapejabajxyemszxbcqm.supabase.co";
const ANON_PUBLIC_KEY = process.env.ANON_PUBLIC_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhcGVqYWJhanh5ZW1zenhiY3FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjk5MzQsImV4cCI6MjA4NzkwNTkzNH0.JJGVSi9w766w0-sr4t92fobqZfzVqwEQoPBwPZc2BV4";

const supabase = createClient(supabaseUrl, ANON_PUBLIC_KEY);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Test connection
supabase.from('users').select('user_id').limit(1).then(({ error }) => {
    if (error) console.error("Error connecting to Supabase Users table:", error.message);
    else console.log("Connected to Supabase.");
});

const REDIRECT_URI = 'http://127.0.0.1:5001/spotify/callback';

// Auth Middleware
const authenticateUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split(' ')[1]; // we are using the user_id as the token for now
    req.user = { user_id: token };
    next();
};

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Register
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const { data: existingUsers, error: checkError } = await supabase
            .from('users')
            .select('*')
            .or(`email.eq.${email},username.eq.${username}`);

        if (checkError) throw checkError;

        if (existingUsers && existingUsers.length > 0) {
            return res.status(400).json({ error: "Username or email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const { data: insertData, error: insertError } = await supabase
            .from('users')
            .insert([{ username, email, password_hash }])
            .select();

        if (insertError) throw insertError;

        res.status(201).json({
            message: "Account created successfully",
            user: {
                id: insertData[0].user_id,
                username: insertData[0].username,
                email: insertData[0].email,
                theme_pref: insertData[0].theme_pref
            }
        });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
    }

    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email);

        if (error) throw error;

        if (!users || users.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        res.json({
            message: "Login successful",
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                theme_pref: user.theme_pref
            }
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// Get current user profile
app.get('/api/auth/me', authenticateUser, async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('user_id, username, email, theme_pref')
            .eq('user_id', req.user.user_id);

        if (error) throw error;
        if (!users || users.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ user: { id: users[0].user_id, username: users[0].username, email: users[0].email, theme_pref: users[0].theme_pref } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -- Spotify Credentials --
app.post('/api/settings/spotify', authenticateUser, async (req, res) => {
    const { client_id, client_secret } = req.body;
    const user_id = req.user.user_id;

    if (!client_id || !client_secret) {
        return res.status(400).json({ error: "Missing Client ID or Secret" });
    }

    try {
        await supabase.from('user_oauth_tokens').delete().eq('user_id', user_id);

        const { error } = await supabase
            .from('user_oauth_tokens')
            .insert([{ user_id, client_id, client_secret }]);

        if (error) throw error;
        res.json({ message: "Spotify credentials saved" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Theme Preference
app.put('/api/settings/theme', authenticateUser, async (req, res) => {
    const { theme_pref } = req.body;
    const user_id = req.user.user_id;

    if (!theme_pref || !['light', 'dark'].includes(theme_pref)) {
        return res.status(400).json({ error: "Invalid theme preference" });
    }

    try {
        const { error } = await supabase
            .from('users')
            .update({ theme_pref })
            .eq('user_id', user_id);

        if (error) throw error;
        res.json({ message: "Theme preference updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -- Blocked Entities (Use Case 15) --
app.get('/api/blocks', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('blocked_entities')
            .select('*')
            .eq('user_id', req.user.user_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ blocks: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/blocks', authenticateUser, async (req, res) => {
    const { entity_type, entity_value } = req.body;

    if (!entity_type || !entity_value) {
        return res.status(400).json({ error: "Missing type or value" });
    }

    try {
        const { error } = await supabase
            .from('blocked_entities')
            .insert([{
                user_id: req.user.user_id,
                entity_type,
                entity_value,
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;
        res.status(201).json({ message: "Added to block list" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/blocks/:id', authenticateUser, async (req, res) => {
    try {
        const { error } = await supabase
            .from('blocked_entities')
            .delete()
            .eq('block_id', req.params.id)
            .eq('user_id', req.user.user_id); // ensure users only delete their own blocks

        if (error) throw error;
        res.json({ message: "Block removed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -- Notifications (Use Case 6) --
app.get('/api/notifications', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.user_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ notifications: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/notifications/:id/read', authenticateUser, async (req, res) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('notification_id', req.params.id)
            .eq('user_id', req.user.user_id);

        if (error) throw error;
        res.json({ message: "Notification marked as read" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -- Playlists & Collaboration (Use Case 5) --
app.get('/api/playlists', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('playlists')
            .select('*')
            .eq('user_id', req.user.user_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ playlists: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/playlists', authenticateUser, async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Playlist name is required" });
    }

    try {
        const { error } = await supabase
            .from('playlists')
            .insert([{
                user_id: req.user.user_id,
                name,
                description,
                is_collaborative: false,
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;
        res.status(201).json({ message: "Playlist created" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/playlists/:id/invite', authenticateUser, async (req, res) => {
    const playlistId = req.params.id;
    const { identifier } = req.body; // email or username

    if (!identifier) {
        return res.status(400).json({ error: "User identifier required" });
    }

    try {
        // 1. Find target user
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('user_id, username')
            .or(`email.eq.${identifier},username.eq.${identifier}`);

        if (userError) throw userError;
        if (!users || users.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const targetUserId = users[0].user_id;
        if (targetUserId === req.user.user_id) {
            return res.status(400).json({ error: "Cannot invite yourself" });
        }

        // 2. Insert into Playlist_Collaborators
        const { error: collabError } = await supabase
            .from('playlist_collaborators')
            .insert([{
                playlist_id: playlistId,
                user_id: targetUserId
            }]);

        if (collabError && !collabError.message.includes('duplicate key value')) {
            throw collabError;
        }

        // 3. Update playlist to collaborative
        await supabase
            .from('playlists')
            .update({ is_collaborative: true })
            .eq('playlist_id', playlistId);

        // 4. Send Notification to target user
        await supabase
            .from('notifications')
            .insert([{
                user_id: targetUserId,
                type: 'SYSTEM',
                message: `You have been invited to collaborate on a playlist by someone.`,
                is_read: false,
                created_at: new Date().toISOString()
            }]);

        res.json({ message: "User invited successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -- Social System (Search & Friends) --
app.get('/api/users/search', authenticateUser, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json({ users: [] });

    try {
        const { data, error } = await supabase
            .from('users')
            .select('user_id, username, email')
            .or(`username.ilike.%${q}%,email.ilike.%${q}%`)
            .neq('user_id', req.user.user_id)
            .limit(10);

        if (error) throw error;
        res.json({ users: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/friends', authenticateUser, async (req, res) => {
    try {
        // Find where user is person 1 or person 2
        const { data, error } = await supabase
            .from('friendships')
            .select('*, user1:user_id_1(username), user2:user_id_2(username)')
            .or(`user_id_1.eq.${req.user.user_id},user_id_2.eq.${req.user.user_id}`);

        if (error) throw error;
        res.json({ friendships: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/friends/request', authenticateUser, async (req, res) => {
    const target_user_id = req.body.target_user_id;
    const current_user_id = req.user.user_id;

    if (!target_user_id) return res.status(400).json({ error: "Target User ID required" });
    if (target_user_id === current_user_id) return res.status(400).json({ error: "Cannot add yourself" });

    // Respect schema constraint user_id_1 < user_id_2
    const [u1, u2] = [current_user_id, target_user_id].sort();

    try {
        const { data: existing } = await supabase
            .from('friendships')
            .select('*')
            .eq('user_id_1', u1)
            .eq('user_id_2', u2);

        if (existing && existing.length > 0) {
            return res.status(400).json({ error: "Friendship already exists or is pending" });
        }

        const { error } = await supabase
            .from('friendships')
            .insert([{ user_id_1: u1, user_id_2: u2, status: 'PENDING', requester_id: current_user_id }]);

        if (error) throw error;

        // Send notification
        await supabase.from('notifications').insert([{
            user_id: target_user_id,
            type: 'FRIEND_REQUEST',
            message: `You received a friend request!`,
            is_read: false
        }]);

        res.json({ message: "Friend request sent" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/friends/accept', authenticateUser, async (req, res) => {
    const { friend_id } = req.body;
    try {
        const { error } = await supabase
            .from('friendships')
            .update({ status: 'ACCEPTED' })
            .eq('friend_id', friend_id)
            .eq('user_id_2', req.user.user_id); // Only the receiver can accept

        if (error) throw error;
        res.json({ message: "Friend request accepted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/friends/:id', authenticateUser, async (req, res) => {
    try {
        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('friend_id', req.params.id)
            .or(`user_id_1.eq.${req.user.user_id},user_id_2.eq.${req.user.user_id}`);

        if (error) throw error;
        res.json({ message: "Friendship removed/declined" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -- Spotify Live Integration --
app.get('/api/spotify/auth-url', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_oauth_tokens')
            .select('client_id')
            .eq('user_id', req.user.user_id)
            .single();

        if (error || !data) return res.status(400).json({ error: "Spotify Client ID not found in settings" });

        const scope = 'user-read-currently-playing user-read-playback-state';
        const url = 'https://accounts.spotify.com/authorize?' +
            querystring.stringify({
                response_type: 'code',
                client_id: data.client_id,
                scope: scope,
                redirect_uri: REDIRECT_URI,
                state: req.user.user_id // Pass user_id as state
            });

        res.json({ url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/spotify/callback', async (req, res) => {
    const { code, state: user_id } = req.query;

    if (!code) return res.redirect('/settings.html?error=no_code');

    try {
        const { data: creds } = await supabase
            .from('user_oauth_tokens')
            .select('client_id, client_secret')
            .eq('user_id', user_id)
            .single();

        const tokenRes = await axios.post('https://accounts.spotify.com/api/token',
            querystring.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }), {
            headers: {
                'Authorization': 'Basic ' + (Buffer.from(creds.client_id + ':' + creds.client_secret).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token, expires_in } = tokenRes.data;
        const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

        await supabase
            .from('user_oauth_tokens')
            .update({
                access_token,
                refresh_token,
                expires_at
            })
            .eq('user_id', user_id);

        res.redirect('/settings.html?success=spotify_connected');
    } catch (err) {
        console.error("Spotify Callback Error:", err.response?.data || err.message);
        res.redirect('/settings.html?error=spotify_auth_failed');
    }
});

app.get('/api/spotify/currently-playing', authenticateUser, async (req, res) => {
    try {
        const { data: creds, error: credError } = await supabase
            .from('user_oauth_tokens')
            .select('*')
            .eq('user_id', req.user.user_id)
            .single();

        if (credError || !creds.refresh_token) {
            return res.status(401).json({ error: "Spotify not connected" });
        }

        let token = creds.access_token;
        if (new Date(creds.expires_at) <= new Date()) {
            // Refresh token
            const refreshRes = await axios.post('https://accounts.spotify.com/api/token',
                querystring.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: creds.refresh_token
                }), {
                headers: {
                    'Authorization': 'Basic ' + (Buffer.from(creds.client_id + ':' + creds.client_secret).toString('base64')),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            token = refreshRes.data.access_token;
            const expires_at = new Date(Date.now() + refreshRes.data.expires_in * 1000).toISOString();
            await supabase.from('user_oauth_tokens').update({ access_token: token, expires_at }).eq('user_id', req.user.user_id);
        }

        const spotifyRes = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (spotifyRes.status === 204 || !spotifyRes.data || !spotifyRes.data.item) {
            return res.json({ playing: false });
        }

        const track = spotifyRes.data.item;
        res.json({
            playing: true,
            title: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            album: track.album.name,
            album_art: track.album.images[0]?.url,
            progress_ms: spotifyRes.data.progress_ms,
            duration_ms: track.duration_ms
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/spotify/trending', authenticateUser, async (req, res) => {
    try {
        const { data: creds, error: credError } = await supabase
            .from('user_oauth_tokens')
            .select('*')
            .eq('user_id', req.user.user_id)
            .single();

        if (credError || !creds.refresh_token) {
            return res.status(401).json({ error: "Spotify not connected" });
        }

        let token = creds.access_token;
        if (new Date(creds.expires_at) <= new Date()) {
            const refreshRes = await axios.post('https://accounts.spotify.com/api/token',
                querystring.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: creds.refresh_token
                }), {
                headers: {
                    'Authorization': 'Basic ' + (Buffer.from(creds.client_id + ':' + creds.client_secret).toString('base64')),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            token = refreshRes.data.access_token;
            const expires_at = new Date(Date.now() + refreshRes.data.expires_in * 1000).toISOString();
            await supabase.from('user_oauth_tokens').update({ access_token: token, expires_at }).eq('user_id', req.user.user_id);
        }

        // Global Top 50 Playlist ID: 37i9dQZEVXbMDoHDwVN2tF
        const playlistId = '37i9dQZEVXbMDoHDwVN2tF';
        const spotifyRes = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const tracks = spotifyRes.data.tracks.items.slice(0, 10).map(item => ({
            id: item.track.id,
            title: item.track.name,
            artist: item.track.artists.map(a => a.name).join(', '),
            album: item.track.album.name,
            album_art: item.track.album.images[0]?.url,
            uri: item.track.uri
        }));

        res.json({ tracks });
    } catch (err) {
        console.error("Spotify Trending Error:", err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server started. Open http://localhost:${PORT} in your browser.`);
});
