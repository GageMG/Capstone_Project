import sqlite3
from pathlib import Path


DB_NAME = "supra_protege.db"
DB_FOLDER = Path(r"C:\CSI4999")
DB_PATH = DB_FOLDER / DB_NAME


def create_database():
    DB_FOLDER.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DB_PATH)
    cursor = connection.cursor()

    # Required for SQLite foreign keys to work
    cursor.execute("PRAGMA foreign_keys = ON;")

    cursor.executescript("""
    -- Drop child tables first
    DROP TABLE IF EXISTS filter_photos;
    DROP TABLE IF EXISTS photos;
    DROP TABLE IF EXISTS guests;
    DROP TABLE IF EXISTS qrcodes;
    DROP TABLE IF EXISTS event;
    DROP TABLE IF EXISTS location;
    DROP TABLE IF EXISTS app_user;

    CREATE TABLE app_user (
        iduser INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        role TEXT NOT NULL,
        created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
        password_hash TEXT NOT NULL
    );

    CREATE TABLE location (
        idlocation INTEGER PRIMARY KEY AUTOINCREMENT,
        venue_name TEXT NOT NULL,
        street TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip TEXT NOT NULL,
        searchable INTEGER NOT NULL DEFAULT 0 CHECK (searchable IN (0, 1)),
        uploads_active INTEGER NOT NULL DEFAULT 0 CHECK (uploads_active IN (0, 1))
    );

    CREATE TABLE event (
        idevent INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        event_date TEXT NOT NULL,
        location_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        password_hash TEXT NOT NULL,

        CONSTRAINT fk_event_owner
            FOREIGN KEY (owner_id)
            REFERENCES app_user(iduser),

        CONSTRAINT fk_event_location
            FOREIGN KEY (location_id)
            REFERENCES location(idlocation)
    );

    CREATE TABLE qrcodes (
        qr_code_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
        expires_at TEXT NOT NULL,
        max_uploads INTEGER NOT NULL DEFAULT 10,
        upload_count INTEGER NOT NULL DEFAULT 0,
        created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        purpose TEXT NOT NULL DEFAULT 'N/A',

        CONSTRAINT fk_qrcodes_event
            FOREIGN KEY (event_id)
            REFERENCES event(idevent)
    );

    CREATE TABLE guests (
        guest_id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        phone_number TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        event_id INTEGER NOT NULL,
        can_post INTEGER NOT NULL DEFAULT 0 CHECK (can_post IN (0, 1)),
        email TEXT,

        CONSTRAINT guests_event_id_fkey
            FOREIGN KEY (event_id)
            REFERENCES event(idevent)
    );

    CREATE TABLE photos (
        photo_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        photo_taken TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_edit TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,                
        user_id INTEGER,
        guest_id INTEGER,


        CONSTRAINT photos_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES app_user(iduser)
    );

    CREATE TABLE filter_photos (
        filter_id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'pending',
        blur_score REAL NOT NULL DEFAULT 0,
        bright_score REAL NOT NULL DEFAULT 0,
        contrast_score REAL NOT NULL DEFAULT 0,
        width TEXT NOT NULL DEFAULT '0',
        height TEXT NOT NULL DEFAULT '0',
        user_approved INTEGER NOT NULL DEFAULT 0 CHECK (user_approved IN (0, 1)),
        reason NOT NULL,
                         
        CONSTRAINT filter_photos_photo_id_fkey
            FOREIGN KEY (photo_id)
            REFERENCES photos(photo_id)
    );
    """)

    connection.commit()
    connection.close()

    print(f"Database created successfully at: {DB_PATH}")


def seed_photos_from_folder():
    """
    Optional test loader.
    This inserts every image from C:\\CSI4999\\Photos into the photos table
    using default values for scores/status.
    """
    PHOTO_DIR = Path("C:/CSI4999/Photos")
    image_extensions = {".jpg", ".jpeg", ".png", ".webp"}

    connection = sqlite3.connect(DB_PATH)
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")

    if not PHOTO_DIR.exists():
        print(f"Photo folder does not exist: {PHOTO_DIR}")
        connection.close()
        return

    files = [
        file for file in PHOTO_DIR.iterdir()
        if file.is_file() and file.suffix.lower() in image_extensions
    ]

    for file in files:
        cursor.execute("""
        INSERT INTO photos (
            event_id,
            file_name,
            file_path
        )
        VALUES (?, ?, ?);
        """, (
            int(1),
            file.name,
            str(file)
        ))

    connection.commit()
    connection.close()

    print(f"Inserted {len(files)} photo records.")

def createTable():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA foreign_keys = ON;")

    sql = """
    CREATE TABLE IF NOT EXISTS photos_content (
        content_id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_id INTEGER NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        person_count INTEGER NOT NULL DEFAULT 0,
        max_person_conf REAL NOT NULL DEFAULT 0,
        obj_class TEXT NOT NULL DEFAULT 'unknown',
        confidence REAL NOT NULL DEFAULT 0,
        content_score INTEGER DEFAULT 0,

        CONSTRAINT photos_content_photo_id_fkey
            FOREIGN KEY (photo_id)
            REFERENCES photos(photo_id)
            ON DELETE CASCADE
    );
    """

    cursor.execute(sql)
    conn.commit()
    conn.close()

    print("photos_content table created")

if __name__ == "__main__":
    createTable()
    #create_database()
   # seed_photos_from_folder()