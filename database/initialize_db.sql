-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS Users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    theme_pref VARCHAR(50) DEFAULT 'dark',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS User_OAuth_Tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    client_id VARCHAR(255),
    client_secret VARCHAR(255),
    refresh_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Songs (
    song_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255),
    artist VARCHAR(255),
    album VARCHAR(255),
    genre VARCHAR(100),
    duration_ms INTEGER,
    spotify_uri VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS Audio_Features (
    feature_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    song_id UUID REFERENCES Songs(song_id) ON DELETE CASCADE,
    tempo FLOAT,
    energy FLOAT,
    key INTEGER,
    valence FLOAT,
    danceability FLOAT,
    acousticness FLOAT,
    instrumentalness FLOAT,
    liveliness FLOAT,
    loudness FLOAT,
    mode BOOLEAN,
    time_signature INTEGER,
    fetched_at TIMESTAMP,
    source VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS Mood_Tag_Definitions (
    tag_def_id SERIAL PRIMARY KEY,
    label VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Mood_Tags (
    tag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    song_id UUID REFERENCES Songs(song_id),
    user_id UUID REFERENCES Users(user_id),
    label INTEGER REFERENCES Mood_Tag_Definitions(tag_def_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Playlists (
    playlist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES Users(user_id),
    name VARCHAR(255),
    description TEXT,
    is_collaborative BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Playlist_Versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID REFERENCES Playlists(playlist_id),
    created_by UUID REFERENCES Users(user_id),
    snapshot_date TIMESTAMP,
    label VARCHAR(100),
    is_manual BOOLEAN
);

CREATE TABLE IF NOT EXISTS Playlist_Songs (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID REFERENCES Playlist_Versions(version_id),
    song_id UUID REFERENCES Songs(song_id),
    position INTEGER,
    added_by UUID REFERENCES Users(user_id),
    added_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Playlist_Collaborators (
    collab_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID REFERENCES Playlists(playlist_id),
    user_id UUID REFERENCES Users(user_id),
    invited_by UUID REFERENCES Users(user_id),
    invite_method VARCHAR(20) CHECK (invite_method IN ('direct', 'link')),
    permission_level VARCHAR(10) CHECK (permission_level IN ('owner','editor','viewer')),
    joined_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Listening_History (
    listen_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES Users(user_id),
    song_id UUID REFERENCES Songs(song_id),
    played_at TIMESTAMP,
    skipped BOOLEAN,
    completion_pct FLOAT,
    source_type VARCHAR(50),
    source_playlist_id UUID REFERENCES Playlists(playlist_id)
);

CREATE TABLE IF NOT EXISTS User_Analytics (
    analytics_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES Users(user_id),
    top_genre VARCHAR(100),
    top_artist VARCHAR(255),
    top_song_id UUID REFERENCES Songs(song_id),
    skip_rate FLOAT,
    total_playtime BIGINT,
    timeframe VARCHAR(50),
    recorded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES Users(user_id),
    type VARCHAR(100),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    related_id UUID,
    related_type VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS Playlist_Exports (
    export_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID REFERENCES Playlists(playlist_id),
    user_id UUID REFERENCES Users(user_id),
    spotify_playlist_id VARCHAR(255),
    exported_at TIMESTAMP,
    status VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS Song_Reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    song_id UUID REFERENCES Songs(song_id),
    user_id UUID REFERENCES Users(user_id),
    rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    created_at TIMESTAMP,
    UNIQUE(song_id, user_id)
);

CREATE TABLE IF NOT EXISTS Blocked_Entities (
    block_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES Users(user_id),
    entity_type VARCHAR(20) CHECK (entity_type IN ('genre','artist')),
    entity_value VARCHAR(255),
    spotify_uri VARCHAR(255),
    created_at TIMESTAMP,
    UNIQUE(user_id, entity_type, spotify_uri)
);

-- Friendships
CREATE TABLE IF NOT EXISTS Friendships (
    friend_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    user_id_2 UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','ACCEPTED','BLOCKED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (user_id_1 < user_id_2),
    UNIQUE(user_id_1, user_id_2)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user1
ON Friendships(user_id_1);

CREATE INDEX IF NOT EXISTS idx_friendships_user2
ON Friendships(user_id_2);

-- Add requester_id to track who initiated the friendship request
ALTER TABLE Friendships ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES Users(user_id);
