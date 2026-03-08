-- Add requester_id to track who initiated the friendship request
ALTER TABLE Friendships ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES Users(user_id);
