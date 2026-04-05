-- Add image support to chat messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_width INTEGER;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_height INTEGER;

-- Allow text to be nullable (for image-only messages)
ALTER TABLE chat_messages ALTER COLUMN text DROP NOT NULL;
