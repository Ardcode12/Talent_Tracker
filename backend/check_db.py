from database import engine
from sqlalchemy import text, inspect

print("=" * 50)
print("DATABASE DIAGNOSTIC")
print("=" * 50)

# List all tables
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f"\nAll tables ({len(tables)}):")
for t in tables:
    print(f"  - {t}")

with engine.connect() as conn:
    print("\n" + "=" * 50)
    print("TABLE DATA COUNTS")
    print("=" * 50)
    
    # Check comments
    try:
        result = conn.execute(text('SELECT COUNT(*) FROM comments'))
        print(f"\ncomments count: {result.scalar()}")
        
        # Show comment structure
        result = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'comments' ORDER BY ordinal_position"))
        print("comments columns:")
        for row in result:
            print(f"  - {row[0]}: {row[1]}")
    except Exception as e:
        print(f"comments ERROR: {e}")
    
    # Check comment_replies
    try:
        result = conn.execute(text('SELECT COUNT(*) FROM comment_replies'))
        print(f"\ncomment_replies count: {result.scalar()}")
        
        # Show all replies
        result = conn.execute(text('SELECT id, comment_id, user_id, text, likes_count FROM comment_replies'))
        replies = result.fetchall()
        if replies:
            print("Existing replies:")
            for r in replies:
                print(f"  ID:{r[0]} CommentID:{r[1]} UserID:{r[2]} Text:'{r[3][:30] if r[3] else ''}...' Likes:{r[4]}")
        else:
            print("No replies found in database")
    except Exception as e:
        print(f"comment_replies ERROR: {e}")
    
    # Check comment_likes
    try:
        result = conn.execute(text('SELECT COUNT(*) FROM comment_likes'))
        print(f"\ncomment_likes count: {result.scalar()}")
        
        # Show all comment likes
        result = conn.execute(text('SELECT * FROM comment_likes'))
        likes = result.fetchall()
        if likes:
            print("Existing comment likes:")
            for l in likes:
                print(f"  UserID:{l[0]} CommentID:{l[1]}")
        else:
            print("No comment likes found")
    except Exception as e:
        print(f"comment_likes ERROR: {e}")
    
    # Check reply_likes
    try:
        result = conn.execute(text('SELECT COUNT(*) FROM reply_likes'))
        print(f"\nreply_likes count: {result.scalar()}")
    except Exception as e:
        print(f"reply_likes ERROR: {e}")
    
    # Show sample comments with their data
    print("\n" + "=" * 50)
    print("SAMPLE COMMENTS DATA")
    print("=" * 50)
    try:
        result = conn.execute(text('SELECT id, post_id, user_id, text, likes_count, replies_count FROM comments LIMIT 5'))
        comments = result.fetchall()
        for c in comments:
            print(f"Comment ID:{c[0]} PostID:{c[1]} UserID:{c[2]}")
            print(f"  Text: '{c[3][:50] if c[3] else ''}...'")
            print(f"  Likes: {c[4]}, Replies: {c[5]}")
    except Exception as e:
        print(f"Sample comments ERROR: {e}")

print("\n" + "=" * 50)
print("DIAGNOSTIC COMPLETE")
print("=" * 50)
