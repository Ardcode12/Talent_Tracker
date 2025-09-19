# simple_create_tables.py
"""
Simple script to create tables using your exact environment variables.
Just run: python simple_create_tables.py
"""

import os
import psycopg2
from dotenv import load_dotenv

# Load your .env file
load_dotenv()

def main():
    print("Creating tables for TalentTracker...")
    
    # Use your exact environment variables
    try:
        conn = psycopg2.connect(
            host=os.getenv('PG_HOST', '127.0.0.1'),
            port=os.getenv('PG_PORT', '5432'),
            database=os.getenv('PG_DB', 'shuttle_run_db'),  # Using your DB name
            user=os.getenv('PG_USER', 'postgres'),
            password=os.getenv('PG_PASS', 'root')
        )
        
        cursor = conn.cursor()
        print(f"✓ Connected to database: {os.getenv('PG_DB')}")
        
        # Create all tables in one go
        sql_script = """
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(150) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'athlete',
            sport VARCHAR(50),
            phone VARCHAR(20),
            age INTEGER,
            location VARCHAR(100),
            bio TEXT,
            height VARCHAR(10),
            weight VARCHAR(10),
            achievements TEXT,
            skills TEXT,
            experience INTEGER,
            specialization VARCHAR(100),
            profile_image VARCHAR(255),
            profile_photo VARCHAR(255),
            national_rank INTEGER,
            ai_score FLOAT,
            weekly_progress FLOAT DEFAULT 0,
            is_online BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Assessments table
        CREATE TABLE IF NOT EXISTS assessments (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            test_type VARCHAR(50) NOT NULL,
            video_url VARCHAR(255),
            score FLOAT,
            ai_score FLOAT,
            feedback TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Posts table
        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            media_url VARCHAR(255),
            media_type VARCHAR(20),
            is_ai_verified BOOLEAN DEFAULT FALSE,
            likes_count INTEGER DEFAULT 0,
            comments_count INTEGER DEFAULT 0,
            shares_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Post likes junction table
        CREATE TABLE IF NOT EXISTS post_likes (
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, post_id)
        );

        -- Comments table
        CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Connections table
        CREATE TABLE IF NOT EXISTS connections (
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            connected_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, connected_user_id)
        );

        -- Performance data table
        CREATE TABLE IF NOT EXISTS performance_data (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            metric_type VARCHAR(50) NOT NULL,
            value FLOAT NOT NULL,
            unit VARCHAR(20),
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Announcements table
        CREATE TABLE IF NOT EXISTS announcements (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            icon VARCHAR(10),
            link VARCHAR(255),
            priority INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Predictions table (for ML results)
        CREATE TABLE IF NOT EXISTS predictions (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMPTZ NOT NULL,
            athlete_name TEXT,
            age INTEGER,
            test_type TEXT,
            input_source TEXT NOT NULL,
            video_path TEXT,
            predicted_class TEXT NOT NULL,
            probabilities JSONB NOT NULL,
            agility_score FLOAT,
            speed_score FLOAT,
            reaction_time FLOAT,
            endurance_score FLOAT,
            category TEXT,
            feedback TEXT,
            suggestions TEXT
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
        CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
        CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
        CREATE INDEX IF NOT EXISTS idx_performance_data_user_id ON performance_data(user_id);
        CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON predictions(timestamp DESC);
        
        -- Insert sample data
        INSERT INTO announcements (title, description, icon, priority, is_active) VALUES
        ('Welcome to TalentTracker!', 'Start your athletic journey with AI-powered assessments', '🏆', 1, true),
        ('New ML Model Released', 'Improved accuracy in performance predictions', '🤖', 2, true),
        ('Upcoming Championships', 'Register now for the national athletics championship', '🥇', 3, true)
        ON CONFLICT DO NOTHING;
        """
        
        # Execute the entire script
        cursor.execute(sql_script)
        conn.commit()
        
        print("✓ All tables created successfully!")
        
        # Show created tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        print(f"\nCreated {len(tables)} tables:")
        for table in tables:
            print(f"  • {table[0]}")
        
        cursor.close()
        conn.close()
        
        print("\n" + "="*50)
        print("SUCCESS! Database setup complete.")
        print("You can now run your FastAPI app:")
        print("uvicorn main:app --reload --host 0.0.0.0 --port 8000")
        print("="*50)
        
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        print("\nTroubleshooting:")
        print("1. Make sure PostgreSQL is running")
        print("2. Check your database credentials in .env")
        print("3. Ensure the database exists:")
        print(f"   CREATE DATABASE {os.getenv('PG_DB', 'shuttle_run_db')};")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()