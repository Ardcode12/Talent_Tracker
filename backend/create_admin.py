# backend/create_admin.py
# Run this ONCE to create an admin user: python create_admin.py

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
import models
from core.security import get_password_hash

def create_tables():
    """Create all tables if they don't exist"""
    try:
        models.Base.metadata.create_all(bind=engine)
        print("✅ Database tables created/verified")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")

def create_admin():
    """Create default admin user"""
    db = SessionLocal()
    try:
        # Check if AdminUser table exists and has admin
        try:
            existing = db.query(models.AdminUser).filter(
                models.AdminUser.email == "admin@talenttracker.com"
            ).first()
            
            if existing:
                print("ℹ️  Admin user already exists!")
                print(f"   Email: {existing.email}")
                return existing
        except Exception as e:
            print(f"Note: {e}")
        
        # Create admin user
        admin = models.AdminUser(
            email="admin@talenttracker.com",
            password=get_password_hash("admin123"),
            name="Admin User",
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        
        print("=" * 50)
        print("✅ Admin user created successfully!")
        print("=" * 50)
        print(f"   Email:    admin@talenttracker.com")
        print(f"   Password: admin123")
        print("=" * 50)
        
        return admin
        
    except Exception as e:
        print(f"❌ Error creating admin: {e}")
        db.rollback()
        
        # Try to provide more info
        import traceback
        traceback.print_exc()
        
    finally:
        db.close()

if __name__ == "__main__":
    print("\n🔧 TalentTracker Admin Setup\n")
    create_tables()
    create_admin()
    print("\n✅ Setup complete! You can now login to the admin dashboard.\n")