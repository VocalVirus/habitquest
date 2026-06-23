-- HabitQuest Database Schema

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(32) UNIQUE NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS characters (
  id          SERIAL PRIMARY KEY,
  user_id     INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(32),
  sprite      VARCHAR(64) DEFAULT 'hero_default',
  level       INT DEFAULT 1,
  -- RPG stats derived from real-world habits (0-100)
  strength     INT DEFAULT 0,   -- gym time
  intelligence INT DEFAULT 0,   -- study time
  agility      INT DEFAULT 0,   -- walking / steps
  vitality     INT DEFAULT 0,   -- sleep quality/hours
  wisdom       INT DEFAULT 0,   -- reading
  constitution INT DEFAULT 0,   -- water intake
  focus        INT DEFAULT 0,   -- meditation
  gold         INT DEFAULT 0,   -- money saved
  -- World position
  map_id      VARCHAR(64) DEFAULT 'town',
  pos_x       FLOAT DEFAULT 400,
  pos_y       FLOAT DEFAULT 300,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Triggered when a user registers: auto-create their character
CREATE OR REPLACE FUNCTION create_character_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO characters (user_id, display_name) VALUES (NEW.id, NEW.username);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_user_insert
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_character_for_user();

-- Habit log: each entry is one real-world activity
CREATE TABLE IF NOT EXISTS habit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE CASCADE,
  habit_type  VARCHAR(32) NOT NULL CHECK (habit_type IN ('gym', 'study', 'walk', 'sleep', 'reading', 'water', 'meditation', 'save_money')),
  value       NUMERIC NOT NULL,         -- hours, km, etc.
  unit        VARCHAR(16) NOT NULL,     -- 'hours', 'km', 'steps'
  logged_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_habit_logs_user_date ON habit_logs(user_id, logged_date DESC);
