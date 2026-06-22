import os
from supabase import create_client, Client
from dotenv import load_dotenv
from ProjectHelper import Helpers as ph

class SQLbuilder:
    def __init__(self):
        load_dotenv()

        self.supabase_url = os.getenv("SUPABASE_URL")
        self.service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not self.supabase_url or not self.service_key:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")

        self.client: Client = create_client(self.supabase_url, self.service_key)

    def connect(self):
        try:
            # Simple lightweight call to confirm the client can reach Supabase
            self.client.table("photos").select("photo_id").limit(1).execute()
            return True
        except Exception as error:
            print("Connection failed:", error)
            return False

    def insertToDB(self, values, table: str = "Basic"):
        """
        Generic insert helper.
        values: a single dict OR a list of dicts representing row(s) to insert.
        """
        try:
            result = self.client.table(table).insert(values).execute()
            count = len(values) if isinstance(values, list) else 1
            print(f"Saved {count} row(s) to {table}")
            return result.data

        except Exception as e:
            print(f"Error inserting into {table}: {e}")
            return None

    def postQRtoDB(self, eventID: int, url: str, token: str, expires_at: str, max_upload: int, purpose: str, is_active: bool):
        if eventID is None or url is None:
            print('Missing Values in arguments')
            return None

        table = 'qrcodes'
        values = {
            "event_id": eventID,
            "image_url": url,
            "token": token,
            "expires_at": expires_at,
            "max_uploads": max_upload,
            "purpose": purpose,
            "is_active": is_active
        }

        return self.insertToDB(values, table)

    def getQRToken(self, token: str):
        if token is None or token.strip() == "":
            return False, "Missing Token"

        try:
            result = (
                self.client.table("qrcodes")
                .select("*")
                .eq("token", token.strip())
                .execute()
            )

            rows = result.data
            if not rows:
                return None

            return rows[0]

        except Exception as e:
            print(f'Error Occurred: {e}')
            return None

    def insertPreFilter(self, results: list[dict]):
        if not results:
            print("No filter results to insert.")
            return None

        table = 'filter_photos'

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
                "photo_original_date": ph.formatTimeStamps(item.get("photo_original_date")),
                "camera_model": item.get("camera_model"),
                "gps": item.get("gps"),
                "user_approved": item.get("user_approved", 0)
            }
            for item in results
        ]
        return self.insertToDB(values, table)

    def insertContent(self, results: list[dict]):
        if not results:
            print("No filter results to insert.")
            return None

        table = 'photos_content'

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
            self.client.table(table).insert(values).execute()
            return True

        except Exception as e:
            print(f"Error occurred batch inserting pre-filter data: {e}")
            return None

    def getPhotos(self, eventID: int):
        try:
            result = (
                self.client.table("photos")
                .select("photo_id, file_path")
                .eq("event_id", eventID)
                .execute()
            )

            print("Pre-filter data saved")
            return result.data

        except Exception as e:
            print(f"Error Occurred inserting pre-filter data: {e}")
            return None

    def insertImageRanking(self, dataDict: list[dict]):
        if dataDict is None:
            print("Missing image ranking data")
            return None

        table = 'image_ranking'

        values = [{
            "caption": item.get("caption", ""),
            "mood_label": item.get("mood_label", ""),
            "mood_conf_score": item.get("mood_conf_score", 0),
            "all_mood_labels": item.get("all_mood_labels", ""),
            "keyword_score": item.get("keyword_score", 0),
            "keywords": item.get("keywords", ""),
            "nudity_check": item.get("nudity_check", 0),
            "all_mood_scores": item.get("all_mood_scores", ""),
            "photo_id": item.get("photo_id")
        } for item in dataDict]

        return self.insertToDB(values, table)

    def selectAll(self, table: str):
        try:
            result = self.client.table(table).select("*").execute()
            return result.data
        except Exception as e:
            print(f"Error selecting all from {table}: {e}")
            return None

    def getApprovedPhotosForStoryboard(self, eventID: int):
        if eventID is None:
            print("Missing eventID")
            return []

        try:
            # Supabase/PostgREST can't do this exact multi-join + OR + COALESCE-order-by
            # in one fluent call, so we use an RPC call to a Postgres function instead.
            # See the matching SQL function `get_approved_photos_for_storyboard`
            # provided below this file to create it once in Supabase's SQL editor.
            result = self.client.rpc(
                "get_approved_photos_for_storyboard",
                {"p_event_id": eventID}
            ).execute()

            return result.data or []

        except Exception as e:
            print(f"Error getting approved photos for storyboard: {e}")
            return []

    def insertStoryboardItems(self, event_id: int, storyboard_items: list[dict]):
        if not storyboard_items:
            print("No storyboard items to insert.")
            return None

        values = []

        for index, item in enumerate(storyboard_items, start=1):
            values.append({
                "event_id": event_id,
                "photo_id": item.get("photo_id"),
                "sequence_order": index,
                "scene_label": item.get("scene_label", "unknown"),
                "confidence": item.get("confidence", 0),
                "reason": item.get("reason", "")
            })

        print("Storyboard rows being inserted:")
        for row in values:
            print(row["event_id"], row["photo_id"], row["sequence_order"])

        try:
            response = (
                self.client
                .table("storyboard_items")
                .insert(values)
                .execute()
            )

            print(f"Inserted {len(values)} storyboard items.")
            return response

        except Exception as e:
            print(f"Error inserting storyboard items: {e}")
            return None

    def getStoryboardByEvent(self, eventID: int):
        if eventID is None:
            print("Missing eventID")
            return []

        try:
            # Join storyboard_items -> photos via Supabase's nested select syntax.
            # Requires a foreign key from storyboard_items.photo_id -> photos.photo_id
            result = (
                self.client.table("storyboard_items")
                .select(
                    "storyboard_id, event_id, photo_id, sequence_order, "
                    "scene_label, confidence, reason, "
                    "photos(file_path)"
                )
                .eq("event_id", eventID)
                .order("sequence_order", desc=False)
                .execute()
            )

            rows = result.data or []

            # Flatten nested photos.file_path and apply COALESCE-style defaults in Python,
            # since PostgREST doesn't support COALESCE directly in select().
            cleaned = []
            for row in rows:
                photo = row.pop("photos", None) or {}
                row["file_path"] = photo.get("file_path")
                row["scene_label"] = row.get("scene_label") or "General Event Moment"
                row["confidence"] = row.get("confidence") or 0
                row["reason"] = row.get("reason") or ""
                cleaned.append(row)

            return cleaned

        except Exception as e:
            print(f"Error getting storyboard: {e}")
            return []

    def insertMusic(self, title: str, fileName: str, filePath: str, artist: str = None, eventType: str = "general",
                     moodLabel: str = "general", durationSeconds: float = 0, source: str = "local file",
                     licenseType: str = "project testing", isActive: bool = True):
        table = 'music'

        values = {
            "title": title,
            "artist": artist,
            "event_type": eventType,
            "mood_label": moodLabel,
            "file_name": fileName,
            "file_path": filePath,
            "duration_seconds": durationSeconds,
            "source": source,
            "license_type": licenseType,
            "is_active": isActive
        }
        return self.insertToDB(values, table)

    def insertGeneratedVideo(self, eventID: int, fileName: str, filePath: str, musicID: int = None,
                              title: str = "Final Event Video", videoType: str = "slideshow",
                              status: str = "completed", durationSeconds: float = 0, width: int = 1280,
                              height: int = 720, fps: int = 30, fileSize: int = 0):
        table = 'generated_videos'

        values = {
            "event_id": eventID,
            "music_id": musicID,
            "title": title,
            "file_name": fileName,
            "file_path": filePath,
            "video_type": videoType,
            "status": status,
            "duration_seconds": durationSeconds,
            "width": width,
            "height": height,
            "fps": fps,
            "file_size": fileSize
        }
        return self.insertToDB(values, table)


if __name__ == "__main__":
    db = SQLbuilder()
    if db.connect():
        print("Connected to Supabase.")

    rows = db.selectAll('storyboard_items')
    for row in rows or []:
        print(row)
