import math
import os
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse
from uuid import uuid4

import cv2 as cv
import imageio_ffmpeg
import numpy as np
from moviepy import AudioFileClip, VideoFileClip, concatenate_audioclips


class SlideShowGenerator:
    def __init__(self, db, log, azure, width: int = 1280, height: int = 720,
                 fps: int = 30, secPerPhoto: int = 5):
        self.width = width
        self.height = height
        self.fps = fps
        self.secPerPhoto = secPerPhoto
        self.db = db
        self.log = log
        self.azure = azure

    def resizePadding(self, img):
        if img is None or not hasattr(img, "shape") or len(img.shape) < 2:
            raise ValueError("Cannot resize an empty media frame.")
        h, w = img.shape[:2]
        if h <= 0 or w <= 0:
            raise ValueError("Cannot resize a media frame with invalid dimensions.")

        scale = min(self.width / w, self.height / h)
        newW = max(int(round(w * scale)), 1)
        newH = max(int(round(h * scale)), 1)
        resized = cv.resize(img, (newW, newH))
        canvas = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        xOffset = (self.width - newW) // 2
        yOffset = (self.height - newH) // 2
        canvas[yOffset:yOffset + newH, xOffset:xOffset + newW] = resized
        return canvas

    def drawCaption(self, frame, sceneLabel, reason=None):
        title = str(sceneLabel).strip() if sceneLabel is not None else ""
        subtitle = str(reason).strip() if reason is not None else ""
        if not title and not subtitle:
            return frame
        overlay = frame.copy()
        barHeight = min(120, self.height)
        yStart = self.height - barHeight
        cv.rectangle(overlay, (0, yStart), (self.width, self.height), (0, 0, 0), -1)
        frame = cv.addWeighted(overlay, 0.65, frame, 0.35, 0)
        title = str(sceneLabel) if sceneLabel else "Scene"
        subtitle = str(reason) if reason else ""
        cv.putText(frame, title[:55], (40, yStart + 45), cv.FONT_HERSHEY_SIMPLEX,1.2, (255, 255, 255), 2, cv.LINE_AA)
        if subtitle:
            cv.putText(frame, subtitle[:95], (40, yStart + 90), cv.FONT_HERSHEY_SIMPLEX,0.65, (220, 220, 220), 1, cv.LINE_AA)
        return frame

    def createTitleFrame(self, eventName):
        title = str(eventName or "Event Highlight").strip() or "Event Highlight"
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        font = cv.FONT_HERSHEY_SIMPLEX
        fontScale = 1.8
        thickness = 3
        maxWidth = int(self.width * 0.82)

        while fontScale > 0.7:
            (textWidth, _), _ = cv.getTextSize(title, font, fontScale, thickness)
            if textWidth <= maxWidth:
                break
            fontScale -= 0.1

        (textWidth, textHeight), baseline = cv.getTextSize(
            title, font, fontScale, thickness
        )
        x = max((self.width - textWidth) // 2, 20)
        y = max((self.height + textHeight - baseline) // 2, textHeight + 20)
        cv.putText(
            frame,
            title,
            (x, y),
            font,
            fontScale,
            (255, 255, 255),
            thickness,
            cv.LINE_AA,
        )
        return frame

    @staticmethod
    def positiveFloat(value, default=None):
        try:
            result = float(value)
        except (TypeError, ValueError):
            return default
        return result if math.isfinite(result) and result > 0 else default

    def writeSlide(self, writer, frame, durationSeconds=None):
        duration = self.positiveFloat(durationSeconds, float(self.secPerPhoto))
        totalFrames = max(int(round(self.fps * duration)), 1)
        fadeFrames = min(max(int(round(self.fps * 0.5)), 1), max(totalFrames // 2, 1))
        black = np.zeros_like(frame)

        for i in range(totalFrames):
            if i < fadeFrames:
                alpha = min((i + 1) / fadeFrames, 1.0)
                displayFrame = cv.addWeighted(frame, alpha, black, 1 - alpha, 0)
            elif i >= totalFrames - fadeFrames:
                alpha = max((totalFrames - i) / fadeFrames, 0.0)
                displayFrame = cv.addWeighted(frame, alpha, black, 1 - alpha, 0)
            else:
                displayFrame = frame
            writer.write(displayFrame)
        return totalFrames

    def normalizeVideoForDecoding(self, videoPath):
        sourcePath = Path(videoPath)
        normalizedPath = sourcePath.with_name(
            f"{sourcePath.stem}_{uuid4().hex[:8]}_normalized.mp4"
        )
        videoFilter = (
            f"scale={self.width}:{self.height}:force_original_aspect_ratio=decrease,"
            f"pad={self.width}:{self.height}:(ow-iw)/2:(oh-ih)/2:black,"
            f"setsar=1,fps={self.fps}"
        )
        command = [
            imageio_ffmpeg.get_ffmpeg_exe(),
            "-y",
            "-i", str(sourcePath),
            "-map", "0:v:0",
            "-an",
            "-sn",
            "-dn",
            "-map_metadata", "-1",
            "-vf", videoFilter,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(normalizedPath),
        ]
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
        if completed.returncode != 0:
            details = (completed.stderr or completed.stdout or "").strip()
            raise ValueError(
                f"FFmpeg could not normalize video clip {sourcePath.name}: "
                f"{details[-2000:]}"
            )
        if not normalizedPath.is_file() or normalizedPath.stat().st_size == 0:
            raise ValueError(
                f"FFmpeg did not create a normalized video for {sourcePath.name}."
            )
        return normalizedPath

    def writeVideoSegment(self, writer, videoPath, startSec=0, endSec=None,durationSeconds=None, sceneLabel=None, reason=None):
        clip = None
        normalizedPath = None
        try:
            clip = VideoFileClip(str(videoPath), audio=False)
        except Exception as firstError:
            self.log.warning(
                "MoviePy could not open %s directly; normalizing its video stream: %s",
                Path(videoPath).name,
                firstError,
            )
            try:
                normalizedPath = self.normalizeVideoForDecoding(videoPath)
                clip = VideoFileClip(str(normalizedPath), audio=False)
            except Exception as fallbackError:
                if normalizedPath is not None:
                    normalizedPath.unlink(missing_ok=True)
                raise ValueError(
                    f"Could not open video clip after normalization: {videoPath}"
                ) from fallbackError

        sourceDuration = self.positiveFloat(clip.duration, 0.0)
        if sourceDuration <= 0:
            clip.close()
            if normalizedPath is not None:
                normalizedPath.unlink(missing_ok=True)
            raise ValueError(f"Video clip has no playable duration: {videoPath}")

        try:
            start = max(float(startSec or 0), 0.0)
        except (TypeError, ValueError):
            start = 0.0

        requestedDuration = self.positiveFloat(durationSeconds)
        if endSec is None:
            end = start + requestedDuration if requestedDuration else sourceDuration
        else:
            try:
                end = float(endSec)
            except (TypeError, ValueError):
                end = sourceDuration
        if sourceDuration > 0:
            start = min(start, sourceDuration)
            end = min(end, sourceDuration)
        if not math.isfinite(end) or end <= start:
            if clip is not None:
                clip.close()
            if normalizedPath is not None:
                normalizedPath.unlink(missing_ok=True)
            return 0

        outputFrames = max(int(round((end - start) * self.fps)), 1)
        framesWritten = 0
        try:
            for index in range(outputFrames):
                timestamp = min(start + index / self.fps, end - (1 / self.fps))
                sourceFrame = clip.get_frame(max(timestamp, start))
                sourceFrame = np.asarray(sourceFrame)
                if sourceFrame.dtype != np.uint8:
                    sourceFrame = np.clip(sourceFrame, 0, 255).astype(np.uint8)
                if sourceFrame.ndim == 2:
                    sourceFrame = cv.cvtColor(sourceFrame, cv.COLOR_GRAY2BGR)
                elif sourceFrame.shape[2] == 4:
                    sourceFrame = cv.cvtColor(sourceFrame, cv.COLOR_RGBA2BGR)
                else:
                    sourceFrame = cv.cvtColor(sourceFrame, cv.COLOR_RGB2BGR)
                frame = self.resizePadding(sourceFrame)
                writer.write(frame)
                framesWritten += 1
        finally:
            if clip is not None:
                clip.close()
            if normalizedPath is not None:
                normalizedPath.unlink(missing_ok=True)
        return framesWritten

    @staticmethod
    def safeFilePart(value):
        cleaned = re.sub(r"[^A-Za-z0-9]+", "_", str(value or "").strip())
        return cleaned.strip("_") or "event"

    def generatedBlobName(self, eventID: int, fileName: str):
        return f"events/{eventID}/generated_videos/{Path(fileName).name}"

    @staticmethod
    def blobNameFromUrl(filePath):
        if not filePath or not isinstance(filePath, str):
            return None
        parsed = urlparse(filePath)
        if parsed.scheme not in {"http", "https"}:
            return None
        parts = [unquote(part) for part in parsed.path.split("/") if part]
        return "/".join(parts[1:]) if len(parts) > 1 else None

    def normalizeStoryboard(self, storyboard):
        if isinstance(storyboard, dict):
            metadata = dict(storyboard.get("storyboard") or storyboard.get("metadata") or {})
            event = dict(storyboard.get("event") or {})
            metadata["event_name"] = (
                event.get("name")
                or metadata.get("event_name")
                or metadata.get("eventName")
            )
            music = dict(storyboard.get("music") or {})
            items = storyboard.get("items") or storyboard.get("storyboard_items") or []
        else:
            metadata, music, items = {}, {}, storyboard
        if not isinstance(items, list) or not items:
            raise ValueError("Storyboard is empty.")
        normalized = [dict(item) for item in items if isinstance(item, dict)]
        if not normalized:
            raise ValueError("Storyboard has no valid media items.")
        normalized.sort(key=lambda item: item.get("sequence_order") or 0)
        return metadata, music, normalized

    def prepareMedia(self, items, tempPath):
        ready, remote = [], []
        for item in items:
            localPath = item.get("file_path")
            if localPath and Path(str(localPath)).is_file():
                ready.append(item)
                continue
            prepared = dict(item)
            prepared["blob_name"] = prepared.get("blob_name") or self.blobNameFromUrl(localPath)
            if not prepared.get("blob_name"):
                prepared["error"] = "No local file or Azure blob name was available"
                ready.append(prepared)
                continue
            remote.append(prepared)
        if remote:
            ready.extend(self.azure.downloadToTemp(remote, tempPath, "storyboard_item_id"))
        ready.sort(key=lambda item: item.get("sequence_order") or 0)
        return ready

    def getDefaultMusicPath(self):
        return os.getenv("DEFAULT_MUSIC_PATH") or None

    def downloadMusicToTemp(self, tempPath: Path, blobName=None):
        musicBlob = blobName or os.getenv("DEFAULT_MUSIC_BLOB_NAME")
        if not musicBlob:
            return None
        localPath = tempPath / Path(musicBlob).name
        self.azure.downloadBlobToFile(musicBlob, str(localPath))
        return str(localPath)

    def resolveMusicPath(self, tempPath: Path, musicPath=None, music=None, useDefault=True):
        music = music or {}
        candidate = musicPath or music.get("file_path")
        if candidate and Path(str(candidate)).is_file():
            return str(candidate)
        blobName = music.get("blob_name") or self.blobNameFromUrl(candidate)
        if not blobName and candidate and "/" in str(candidate) and not urlparse(str(candidate)).scheme:
            blobName = str(candidate)
        if not blobName and music.get("file_name") and "/" in str(music.get("file_name")):
            blobName = music.get("file_name")
        if blobName:
            return self.downloadMusicToTemp(tempPath, blobName)
        if not useDefault:
            return None
        localPath = self.getDefaultMusicPath()
        if localPath:
            return localPath
        return self.downloadMusicToTemp(tempPath)

    def generateVideo(self, storyboard, eventID: int, outputname=None, musicPath=None):

        metadata, music, items = self.normalizeStoryboard(storyboard)
        eventName = str(metadata.get("event_name") or f"Event {eventID}").strip()
        videoType = str(metadata.get("video_type") or "slideshow")
        createdAt = datetime.now(timezone.utc)
        uniqueToken = f"{createdAt.strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}"
        outputname = outputname or (
            f"{self.safeFilePart(eventName)}_"
            f"{self.safeFilePart(videoType)}_{uniqueToken}.mp4"
        )
        finalOutputName = outputname if outputname.lower().endswith(".mp4") else f"{outputname}.mp4"
        generatedTitle = (
            f"{eventName} {videoType.replace('_', ' ').title()} - "
            f"{createdAt.strftime('%Y-%m-%d %H:%M:%S UTC')}"
        )

        with tempfile.TemporaryDirectory() as tempDir:
            tempPath = Path(tempDir)
            rawVideoPath = tempPath / f"raw_{finalOutputName}"
            finalVideoPath = tempPath / finalOutputName
            # A new storyboard with music_id=None deliberately has no music.
            useDefaultMusic = not isinstance(storyboard, dict)
            resolvedMusic = self.resolveMusicPath(tempPath, musicPath, music, useDefaultMusic)
            media = self.prepareMedia(items, tempPath)
            writer = cv.VideoWriter(str(rawVideoPath), cv.VideoWriter_fourcc(*"mp4v"),
                                    self.fps, (self.width, self.height))
            if not writer.isOpened():
                raise RuntimeError("Could not open slideshow video writer.")

            itemsUsed = 0
            videoClipsUsed = 0
            framesWritten = 0
            try:
                titleFrame = self.createTitleFrame(eventName)
                framesWritten += self.writeSlide(writer, titleFrame, 3.0)

                for item in media:
                    itemID = item.get("storyboard_item_id") or item.get("photo_id") or item.get("video_id")
                    mediaType = str(item.get("source_type") or item.get("media_type")
                                    or item.get("type") or "photo").lower()
                    if item.get("error"):
                        if mediaType == "video":
                            raise RuntimeError(
                                f"Selected video clip {itemID} could not be downloaded: {item['error']}"
                            )
                        self.log.warning("Skipping storyboard item %s: %s", itemID, item["error"])
                        continue
                    path = Path(str(item.get("file_path") or ""))
                    if not path.is_file():
                        if mediaType == "video":
                            raise RuntimeError(
                                f"Selected video clip {itemID} is missing locally: {path}"
                            )
                        self.log.warning("Skipping missing local storyboard media: %s", path)
                        continue

                    if mediaType == "video":
                        written = self.writeVideoSegment(
                            writer, path,
                            startSec=item.get("clip_start_seconds", item.get("clip_start", 0)),
                            endSec=item.get("clip_end_seconds", item.get("clip_end")),
                            durationSeconds=item.get("duration_seconds"),
                            sceneLabel=item.get("scene_label"), reason=item.get("reason"))
                        if written <= 0:
                            raise RuntimeError(
                                f"Selected video clip {itemID} decoded zero frames."
                            )
                        videoClipsUsed += 1
                        self.log.info(
                            "Added storyboard video clip %s (%s-%s seconds, %s frames)",
                            itemID,
                            item.get("clip_start_seconds", item.get("clip_start", 0)),
                            item.get("clip_end_seconds", item.get("clip_end")),
                            written,
                        )
                    else:
                        img = cv.imread(str(path))
                        if img is None:
                            self.log.warning("Skipping unreadable slideshow image: %s", path)
                            continue
                        frame = self.resizePadding(img)
                        #frame = self.drawCaption(frame, item.get("scene_label"), item.get("reason"))
                        written = self.writeSlide(writer, frame, item.get("duration_seconds"))
                    if written > 0:
                        itemsUsed += 1
                        framesWritten += written
            finally:
                writer.release()

            if itemsUsed == 0:
                raise ValueError("No valid media items were added to the slideshow.")
            if not rawVideoPath.is_file() or rawVideoPath.stat().st_size == 0:
                raise RuntimeError("Raw slideshow video file was not created.")

            return self.attachMusic(
                videoPath=str(rawVideoPath), musicPath=resolvedMusic,
                outPutPath=str(finalVideoPath), eventID=eventID,
                fileName=finalOutputName, durationSeconds=framesWritten / self.fps,
                itemsUsed=itemsUsed, videoClipsUsed=videoClipsUsed,
                musicID=metadata.get("music_id") or music.get("music_id"),
                videoType=videoType, title=generatedTitle)

    def attachMusic(self, videoPath, musicPath, outPutPath, eventID=None, fileName=None,durationSeconds=None, itemsUsed=None, videoClipsUsed=0, musicID=None,videoType="slideshow", title=None):
        video = VideoFileClip(videoPath)
        music = None
        audio = None
        finalVideo = video
        videoDuration = float(video.duration or durationSeconds or 0)
        try:
            if musicPath:
                music = AudioFileClip(musicPath)
                if music.duration <= 0:
                    raise ValueError("The selected music file has no playable duration.")
                if music.duration < videoDuration:
                    repeats = max(int(math.ceil(videoDuration / music.duration)), 1)
                    audio = concatenate_audioclips([music] * repeats).subclipped(0, videoDuration)
                else:
                    audio = music.subclipped(0, videoDuration)
                finalVideo = video.with_audio(audio)
            finalVideo.write_videofile(outPutPath, codec="libx264",audio=bool(musicPath),audio_codec="aac" if musicPath else None,ffmpeg_params=["-movflags", "+faststart"],logger=None)
            
        finally:
            if finalVideo is not video:
                finalVideo.close()
            if audio is not None and audio is not music:
                audio.close()
            if music is not None:
                music.close()
            video.close()

        finalPath = Path(outPutPath)
        if not finalPath.is_file() or finalPath.stat().st_size == 0:
            raise RuntimeError("Final slideshow video was not created.")
        if eventID is None:
            return str(finalPath)

        blobName = self.generatedBlobName(eventID, fileName or finalPath.name)
        uploadResult = self.azure.uploadLocalFile(blobName=blobName, localPath=str(finalPath),contentType="video/mp4")
        if not uploadResult:
            raise RuntimeError("Final slideshow was created but could not be uploaded to Azure Blob Storage.")
        savedDuration = durationSeconds if durationSeconds is not None else videoDuration
        dbRows = self.db.insertGeneratedVideo(
            eventID=eventID, fileName=Path(blobName).name, filePath=uploadResult["url"],
            musicID=musicID, title=title or f"Event {eventID} Final Slideshow",
            videoType=videoType, status="completed", durationSeconds=savedDuration,
            width=self.width, height=self.height, fps=self.fps,
            fileSize=uploadResult["size_bytes"])
        if not dbRows:
            raise RuntimeError("Final slideshow was uploaded to Azure but could not be recorded in Supabase.")

        result = {
            "event_id": eventID, "items_used": itemsUsed,
            "video_clips_used": videoClipsUsed,
            "duration_seconds": savedDuration, "blob_name": uploadResult["blob_name"],
            "url": uploadResult["url"],
            "generated_video": dbRows[0] if isinstance(dbRows, list) else dbRows,
        }
        self.log.info("Uploaded final slideshow for event_id=%s: %s", eventID, uploadResult["url"])
        return result
