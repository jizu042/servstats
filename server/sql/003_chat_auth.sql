-- Add is_auth column to chat_messages to distinguish verified Ely.by users from guests.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
