import json
import mmap
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

import cv2 as cv
import numpy as np


class VideoLoadError(ValueError):
    pass


class VideoMetadataProcessor:
    def __init__(self, db, log, blob):
        self.db = db
        self.log = log
        self.blob = blob

    @staticmethod
    def _positiveFloat(value, default=0.0):
        try:
            number = float(value)
            return number if number > 0 else default
        except (TypeError, ValueError):
            return default

    @classmethod
    def _frameRate(cls, value):
        if value is None:
            return 0.0

        text = str(value).strip()
        if "/" in text:
            numerator, denominator = text.split("/", 1)
            denominatorValue = cls._positiveFloat(denominator)
            if denominatorValue <= 0:
                return 0.0
            return cls._positiveFloat(numerator) / denominatorValue

        return cls._positiveFloat(text)

    @staticmethod
    def _isoDate(value):
        if not value:
            return None

        try:
            parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError):
            return None

    def _ffprobeMetadata(self, videoPath: Path):
        ffprobe = shutil.which("ffprobe")
        if not ffprobe:
            return {}

        try:
            result = subprocess.run(
                [
                    ffprobe,
                    "-v", "error",
                    "-select_streams", "v:0",
                    "-show_entries",
                    "format=duration:format_tags=creation_time:stream=width,height,avg_frame_rate,r_frame_rate:stream_tags=creation_time",
                    "-of", "json",
                    str(videoPath),
                ],
                capture_output=True,
                text=True,
                timeout=30,
                check=True,
            )
            payload = json.loads(result.stdout or "{}")
            stream = (payload.get("streams") or [{}])[0]
            videoFormat = payload.get("format") or {}
            streamTags = stream.get("tags") or {}
            formatTags = videoFormat.get("tags") or {}
            return {
                "duration_seconds": self._positiveFloat(videoFormat.get("duration")),
                "width": int(self._positiveFloat(stream.get("width"))),
                "height": int(self._positiveFloat(stream.get("height"))),
                "fps": self._frameRate(
                    stream.get("avg_frame_rate") or stream.get("r_frame_rate")
                ),
                "video_original_date": self._isoDate(
                    streamTags.get("creation_time") or formatTags.get("creation_time")
                ),
            }
        except Exception as error:
            self.log.warning("ffprobe metadata read failed for %s: %s", videoPath.name, error)
            return {}

    def _quickTimeCreationDate(self, videoPath: Path):
        if videoPath.suffix.lower() not in {".mp4", ".mov", ".m4v", ".3gp", ".hevc"}:
            return None

        try:
            with videoPath.open("rb") as videoFile:
                with mmap.mmap(videoFile.fileno(), 0, access=mmap.ACCESS_READ) as contents:
                    marker = contents.find(b"mvhd")
                    if marker < 0:
                        return None

                    payload = marker + 4
                    version = contents[payload]
                    if version == 1:
                        rawSeconds = int.from_bytes(contents[payload + 4:payload + 12], "big")
                    else:
                        rawSeconds = int.from_bytes(contents[payload + 4:payload + 8], "big")

            if rawSeconds <= 0:
                return None

            quickTimeEpoch = datetime(1904, 1, 1, tzinfo=timezone.utc)
            parsed = quickTimeEpoch + timedelta(seconds=rawSeconds)
            currentYear = datetime.now(timezone.utc).year
            if parsed.year < 1970 or parsed.year > currentYear + 2:
                return None
            return parsed.isoformat()
        except Exception as error:
            self.log.warning("QuickTime creation date read failed for %s: %s", videoPath.name, error)
            return None

    @staticmethod
    def _resizeThumbnail(frame, maxWidth=640, maxHeight=640):
        height, width = frame.shape[:2]
        scale = min(maxWidth / width, maxHeight / height, 1.0)
        if scale >= 1.0:
            return frame
        return cv.resize(
            frame,
            (max(1, int(round(width * scale))), max(1, int(round(height * scale)))),
            interpolation=cv.INTER_AREA,
        )

    def _imageioMetadataAndFrame(self, videoPath: Path):
        try:
            import imageio_ffmpeg

            reader = imageio_ffmpeg.read_frames(str(videoPath), pix_fmt="rgb24")
            try:
                metadata = next(reader)
                frameBytes = next(reader)
            finally:
                reader.close()

            width, height = metadata.get("size") or (0, 0)
            width = int(width or 0)
            height = int(height or 0)
            if width <= 0 or height <= 0:
                return {}, None

            rgbFrame = np.frombuffer(frameBytes, dtype=np.uint8).reshape((height, width, 3))
            return {
                "duration_seconds": self._positiveFloat(metadata.get("duration")),
                "fps": self._positiveFloat(metadata.get("fps")),
            }, cv.cvtColor(rgbFrame, cv.COLOR_RGB2BGR)
        except Exception as error:
            self.log.warning("FFmpeg fallback could not decode %s: %s", videoPath.name, error)
            return {}, None

    def inspectVideo(self, videoPath: str, thumbnailPath: str):
        path = Path(videoPath)
        if not path.is_file():
            raise VideoLoadError(f"Video not found: {path}")

        probe = self._ffprobeMetadata(path)
        cap = cv.VideoCapture(str(path))
        capMetadata = {}
        frame = None
        try:
            if cap.isOpened():
                if hasattr(cv, "CAP_PROP_ORIENTATION_AUTO"):
                    cap.set(cv.CAP_PROP_ORIENTATION_AUTO, 1)

                capFps = self._positiveFloat(cap.get(cv.CAP_PROP_FPS))
                frameCount = self._positiveFloat(cap.get(cv.CAP_PROP_FRAME_COUNT))
                capDuration = frameCount / capFps if capFps > 0 and frameCount > 0 else 0.0
                capMetadata = {
                    "fps": capFps,
                    "duration_seconds": capDuration,
                }
                seekDuration = self._positiveFloat(probe.get("duration_seconds")) or capDuration
                seekSeconds = min(max(seekDuration * 0.1, 0.0), 5.0) if seekDuration > 0 else 0.0
                cap.set(cv.CAP_PROP_POS_MSEC, seekSeconds * 1000.0)
                success, frame = cap.read()
                if not success:
                    cap.set(cv.CAP_PROP_POS_FRAMES, 0)
                    success, frame = cap.read()
                if not success:
                    frame = None
        finally:
            cap.release()

        fallbackMetadata = {}
        if frame is None:
            fallbackMetadata, frame = self._imageioMetadataAndFrame(path)
        if frame is None:
            raise VideoLoadError(f"Could not decode a frame from {path.name}")

        fps = (
            self._positiveFloat(probe.get("fps"))
            or self._positiveFloat(capMetadata.get("fps"))
            or self._positiveFloat(fallbackMetadata.get("fps"))
        )
        duration = (
            self._positiveFloat(probe.get("duration_seconds"))
            or self._positiveFloat(capMetadata.get("duration_seconds"))
            or self._positiveFloat(fallbackMetadata.get("duration_seconds"))
        )
        height, width = frame.shape[:2]
        thumbnail = self._resizeThumbnail(frame)
        thumbnailFile = Path(thumbnailPath)
        thumbnailFile.parent.mkdir(parents=True, exist_ok=True)
        if not cv.imwrite(str(thumbnailFile), thumbnail, [cv.IMWRITE_JPEG_QUALITY, 85]):
            raise ValueError(f"Could not write thumbnail for {path.name}")

        originalDate = probe.get("video_original_date") or self._quickTimeCreationDate(path)
        return {
            "duration_seconds": round(duration, 3),
            "width": int(width),
            "height": int(height),
            "fps": round(fps, 3),
            "video_original_date": originalDate,
            "thumbnail_local_path": str(thumbnailFile),
        }

    def processVideo(self, video: dict, eventID: int | None = None):
        videoID = int(video.get("video_id") or 0)
        resolvedEventID = int(eventID or video.get("event_id") or 0)
        videoPath = video.get("file_path")
        if videoID <= 0 or resolvedEventID <= 0 or not videoPath:
            raise VideoLoadError("Video metadata processing requires video_id, event_id, and file_path")

        thumbnailPath = str(Path(videoPath).with_name(f"video_{videoID}_thumbnail.jpg"))
        metadata = self.inspectVideo(videoPath, thumbnailPath)
        thumbnailBlobName = f"events/{resolvedEventID}/video_thumbnails/video_{videoID}.jpg"
        uploadedThumbnail = self.blob.uploadLocalFile(
            blobName=thumbnailBlobName,
            localPath=metadata.pop("thumbnail_local_path"),
            contentType="image/jpeg",
        )
        if not uploadedThumbnail:
            raise RuntimeError(f"Thumbnail upload failed for video_id={videoID}")

        metadata["thumbnail_path"] = uploadedThumbnail["url"]
        updated = self.db.updateVideoMetadata(
            eventID=resolvedEventID,
            videoID=videoID,
            metadata=metadata,
        )
        if not updated:
            raise RuntimeError(f"Video metadata database update failed for video_id={videoID}")

        self.log.info(
            "Updated metadata for video_id=%s duration=%s size=%sx%s fps=%s original_date=%s",
            videoID,
            metadata["duration_seconds"],
            metadata["width"],
            metadata["height"],
            metadata["fps"],
            metadata.get("video_original_date"),
        )
        return updated

    def batchRun(self, videos: list[dict], eventID: int | None = None):
        results = {"updated": [], "failed": []}
        for video in videos or []:
            videoID = video.get("video_id")
            try:
                results["updated"].append(self.processVideo(video, eventID))
            except VideoLoadError as error:
                resolvedEventID = int(eventID or video.get("event_id") or 0)
                hidden = self.db.hideVideo(resolvedEventID, int(videoID or 0))
                self.log.error(
                    "Hiding unreadable video_id=%s event_id=%s: %s",
                    videoID,
                    resolvedEventID,
                    error,
                )
                results["failed"].append({
                    "video_id": videoID,
                    "error": str(error),
                    "hidden": bool(hidden),
                })
            except Exception as error:
                self.log.exception("Video metadata processing failed for video_id=%s", videoID)
                results["failed"].append({
                    "video_id": videoID,
                    "error": str(error),
                    "hidden": False,
                })
        return results
