import sqlite3
from pathlib import Path


DB_NAME = "supra_protege.db"


def create_database():
    db_path = fr"C:\CSI4999\{DB_NAME}"

    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()

    # SQLite requires this to actually enforce foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

    # Drop tables while testing
    cursor.execute("DROP TABLE IF EXISTS filter_photos;")
    cursor.execute("DROP TABLE IF EXISTS qrcodes;")
    cursor.execute("DROP TABLE IF EXISTS event;")
    cursor.execute("DROP TABLE IF EXISTS location;")
    cursor.execute("DROP TABLE IF EXISTS app_user;")

    # -----------------------------------------------------
    # Table: app_user
    # -----------------------------------------------------
    cursor.execute("""
        CREATE TABLE app_user (
            iduser INTEGER PRIMARY KEY AUTOINCREMENT,
            user_name TEXT NOT NULL UNIQUE,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT NOT NULL,
            role TEXT NOT NULL,
            created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated TEXT
        );
    """)

    # -----------------------------------------------------
    # Table: location
    # -----------------------------------------------------
    cursor.execute("""
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
    """)

    # -----------------------------------------------------
    # Table: event
    # -----------------------------------------------------
    cursor.execute("""
        CREATE TABLE event (
            idevent INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            event_date TEXT NOT NULL,
            location_id INTEGER NOT NULL,
            status TEXT NOT NULL,

            CONSTRAINT fk_event_owner
                FOREIGN KEY (owner_id)
                REFERENCES app_user(iduser)
                ON DELETE NO ACTION
                ON UPDATE NO ACTION,

            CONSTRAINT fk_event_location
                FOREIGN KEY (location_id)
                REFERENCES location(idlocation)
                ON DELETE NO ACTION
                ON UPDATE NO ACTION
        );
    """)

    # -----------------------------------------------------
    # Table: qrcodes
    # -----------------------------------------------------
    cursor.execute("""
        CREATE TABLE qrcodes (
            idqrcodes INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            image_url TEXT NOT NULL,
            qrcodescol TEXT,

            CONSTRAINT fk_qrcodes_event
                FOREIGN KEY (event_id)
                REFERENCES event(idevent)
                ON DELETE NO ACTION
                ON UPDATE NO ACTION
        );
    """)

    # -----------------------------------------------------
    # Table: filter_photos
    # SQLite version of your Supabase/PostgreSQL table
    # -----------------------------------------------------
    cursor.execute("""
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
            user_approved INTEGER NOT NULL DEFAULT 0 CHECK (user_approved IN (0, 1))
        );
    """)

    # Indexes
    cursor.execute("CREATE INDEX idx_event_owner_id ON event(owner_id);")
    cursor.execute("CREATE INDEX idx_event_location_id ON event(location_id);")
    cursor.execute("CREATE INDEX idx_qrcodes_event_id ON qrcodes(event_id);")
    cursor.execute("CREATE INDEX idx_filter_photos_photo_id ON filter_photos(photo_id);")
    cursor.execute("CREATE INDEX idx_filter_photos_status ON filter_photos(status);")

    connection.commit()
    connection.close()

    print(f"SQLite database created successfully: {db_path}")


if __name__ == "__main__":
    create_database()