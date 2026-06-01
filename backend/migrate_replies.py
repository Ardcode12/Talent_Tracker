# backend/migrate_replies.py
"""
Run this script to add the new tables for comment replies feature.
python migrate_replies.py
"""

from sqlalchemy import text
from database import engine

def migrate():
    with engine.connect() as conn:
        # Add likes_count and replies_count to comments table if not exists
        try:
            conn.execute(text("""
                ALTER TABLE comments 
                ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
            """))
            conn.execute(text("""
                ALTER TABLE comments 
                ADD COLUMN IF NOT EXISTS replies_count INTEGER DEFAULT 0;
            """))
            conn.execute(text("""
                ALTER TABLE comments 
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
            """))
            print("✅ Updated comments table")
        except Exception as e:
            print(f"Comments table update: {e}")
        
        # Create comment_likes table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS comment_likes (
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    PRIMARY KEY (user_id, comment_id)
                );
            """))
            print("✅ Created comment_likes table")
        except Exception as e:
            print(f"comment_likes: {e}")
        
        # Create comment_replies table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS comment_replies (
                    id SERIAL PRIMARY KEY,
                    comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    text TEXT NOT NULL,
                    reply_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    likes_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                );
            """))
            print("✅ Created comment_replies table")
        except Exception as e:
            print(f"comment_replies: {e}")
        
        # Create reply_likes table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS reply_likes (
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    reply_id INTEGER REFERENCES comment_replies(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    PRIMARY KEY (user_id, reply_id)
                );
            """))
            print("✅ Created reply_likes table")
        except Exception as e:
            print(f"reply_likes: {e}")
        
        # Create indexes
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_comment_replies_comment_id 
                ON comment_replies(comment_id);
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_comment_replies_user_id 
                ON comment_replies(user_id);
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id 
                ON comment_likes(comment_id);
            """))
            print("✅ Created indexes")
        except Exception as e:
            print(f"Indexes: {e}")
        
        conn.commit()
        print("\n🎉 Migration completed successfully!")

if __name__ == "__main__":
    migrate()