from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError


class SQLbuilder:
    def __init__(self):
        db_path = Path("C:/CSI4999/supra_protege.db")

        if not db_path.exists(): 
            raise FileNotFoundError(f"Database file not found: {db_path}")

        self.connStr = f"sqlite:///{db_path.as_posix()}"
        self.engine = create_engine(self.connStr, echo=True, future=True)

    def connect(self):
        try:
            with self.engine.connect() as connection:
                result = connection.execute(text("SELECT sqlite_version();"))

                print("Connected to SQLite database.")
                print("SQLite version:", result.scalar())
                print("Database:", self.connStr)

                return True

        except SQLAlchemyError as error:
            print("Connection failed:", error)
            return False

    def postQRtoDB(self, eventID: int, url: str, token: str, expires_at: str, max_upload: int, purpose: str, is_active: bool):
        if eventID is None or url is None:
            print('Missing Values in arguments')
            return None
        sql = """INSERT into qrcodes(event_id, image_url, token, expires_at, max_uploads, purpose, is_active)
        VALUES  (?,?,?,?,?,?,?)"""

        try:
            with self.engine.begin() as connection:
                connection.exec_driver_sql(sql, (eventID, url, token, expires_at, max_upload, purpose, is_active))

            print('QR Saved')

        except SQLAlchemyError as e:
            print(f'Error Occurred: {e}')

    def getQRToken(self, token: str):
        if token is None or token.strip() == "":
            return False, "Missing Token"
        
        query = """SELECT * FROM qrcodes WHERE token = ?"""
        try:
            with self.engine.connect() as conn:
                result = conn.exec_driver_sql(query, (token.strip(),))
                row = result.mappings().first()

                if row is None:
                    return None

            return dict(row)
                
        except SQLAlchemyError as e:
            print(f'Error Occurred: {e}')
    
    def insertPreFilter(self, results: list[dict]):
        if not results:
            print("No filter results to insert.")
            return None

        sql = """
            INSERT INTO filter_photos (
                photo_id, status, reason, blur_score,
                bright_score, contrast_score, width, height, image_hash, user_approved
            )
            VALUES (:photo_id, :status, :reason, :blur_score,
                    :bright_score, :contrast_score, :width, :height, :image_hash, :user_approved)
        """

        values = [
            {
                "photo_id": item.get("photo_id"),
                "status": item.get("status", "pending"),
                "reason": item.get("reason", ""),
                "blur_score": item.get("blur_score", 0),
                "bright_score": item.get("bright_score", 0),
                "contrast_score": item.get("contrast_score", 0),
                "width": item.get("width", 0),
                "height": item.get("height", 0),
                "image_hash": item.get("image_hash"),
                "user_approved": item.get("user_approved", 0)
            }
            for item in results
        ]
        try:

            with self.engine.begin() as connection:
                connection.execute(text(sql), values)

            print(f"Inserted {len(results)} pre-filter records.")
            return True

        except SQLAlchemyError as e:
            print(f"Error occurred batch inserting pre-filter data: {e}")
            return None
        
    def insertContent(self, results: list[dict]):
        if not results:
            print("No filter results to insert.")
            return None


        sql = """
            INSERT INTO photos_content (
                photo_id, person_count, max_person_conf,
                obj_class, confidence, content_score
            )
            VALUES (:photo_id, :person_count, :max_person_conf,
                    :obj_class, :confidence, :content_score)
        """

        values = [
            {
                "photo_id": item.get("photo_id"),
                "person_count": item.get("person_count", 0),
                "max_person_conf": item.get("max_person_conf", 0.0),
                "obj_class": item.get("obj_class", ""),
                "confidence": item.get("confidence", 0.0),
                "content_score": item.get("content_score", 0)
            }
            for item in results
        ]

        try:

            with self.engine.begin() as connection:
                connection.execute(text(sql), values)

            print(f"Inserted {len(results)} pre-filter records.")
            return True

        except SQLAlchemyError as e:
            print(f"Error occurred batch inserting pre-filter data: {e}")
            return None
        
    def getPhotos(self, eventID: int):
        #query = """SELECT photoID, photoURL
        #FROM photos
        #WHERE eventID = ?"""

        query = """SELECT *
        FROM photos
        WHERE event_id = ?"""

        try:
            with self.engine.begin() as connection:
                result = connection.exec_driver_sql(query, (eventID,))
                rows = result.fetchall()

            print("Pre-filter data saved")
            return [dict(row._mapping) for row in rows]

        except SQLAlchemyError as e:
            print(f"Error Occurred inserting pre-filter data: {e}")
            return None 

        
    def selectAll(self, table: str):
        sql = f"""
        SELECT *
        FROM {table}
        """

        with self.engine.connect() as conn:
            result = conn.exec_driver_sql(sql)
            return result.fetchall()

if __name__ == "__main__":
    db = SQLbuilder()
    db.connect()
  #  db.postQRtoDB(35, "www.espn.com")
    rows = db.selectAll('filter_photos')
    for row in rows:
        print(row)