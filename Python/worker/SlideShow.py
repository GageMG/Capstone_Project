import os
import tempfile
from pathlib import Path
from uuid import uuid4

import cv2 as cv
import numpy as np
from moviepy import AudioFileClip, VideoFileClip


class SlideShowGenerator:
    def __init__(self,db,log,azure,width: int = 1280,height: int = 720,fps: int = 30,secPerPhoto: int = 3,):
        self.width = width
        self.height = height
        self.fps = fps
        self.secPerPhoto = secPerPhoto
        self.db = db
        self.log = log
        self.azure = azure

    def resizePadding(self, img):
        h, w = img.shape[:2]
        scale = min(self.width / w, self.height / h)
        newW = int(w * scale)
        newH = int(h * scale)

        resized = cv.resize(img, (newW, newH))
        canvas = np.zeros((self.height, self.width, 3), dtype=np.uint8)

        xOffset = (self.width - newW) // 2
        yOffset = (self.height - newH) // 2
        canvas[yOffset:yOffset + newH, xOffset:xOffset + newW] = resized

        return canvas

    def drawCaption(self, frame, sceneLabel, reason=None):
        overlay = frame.copy()
        barHeight = 120
        yStart = self.height - barHeight

        cv.rectangle(overlay, (0, yStart), (self.width, self.height), (0, 0, 0), -1)
        frame = cv.addWeighted(overlay, 0.65, frame, 0.35, 0)

        title = str(sceneLabel) if sceneLabel else "Scene"
        subtitle = str(reason) if reason else ""

        cv.putText(frame, title[:55], (40, yStart + 45), cv.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2, cv.LINE_AA)

        if subtitle:
            cv.putText(frame, subtitle[:95], (40, yStart + 90), cv.FONT_HERSHEY_SIMPLEX, 0.65, (220, 220, 220), 1, cv.LINE_AA)

        return frame

    def writeSlide(self, writer, frame):
        totalFrames = self.fps * self.secPerPhoto
        fadeFrames = max(int(self.fps * 0.5), 1)
        black = np.zeros_like(frame)

        for i in range(totalFrames):
            displayFrame = frame.copy()

            if i < fadeFrames:
                alpha = i / fadeFrames
                displayFrame = cv.addWeighted(frame, alpha, black, 1 - alpha, 0)
            elif i > totalFrames - fadeFrames:
                alpha = (totalFrames - i) / fadeFrames
                displayFrame = cv.addWeighted(frame, alpha, black, 1 - alpha, 0)

            writer.write(displayFrame)

        return totalFrames

    def writeVideoSegment(self, writer, videoPath, startSec=0, endSec=None, sceneLabel=None, reason=None):
        cap = cv.VideoCapture(str(videoPath))

        if not cap.isOpened():
            raise ValueError(f"Could not open video clip: {videoPath}")

        sourceFps = cap.get(cv.CAP_PROP_FPS) or self.fps
        totalFrames = cap.get(cv.CAP_PROP_FRAME_COUNT) or 0
        duration = totalFrames / sourceFps if totalFrames else 0

        startSec = max(float(startSec or 0), 0)
        if endSec is None:
            endSec = duration
        endSec = max(float(endSec), startSec)

        cap.set(cv.CAP_PROP_POS_MSEC, startSec * 1000)
        framesWritten = 0

        try:
            while True:
                currentMs = cap.get(cv.CAP_PROP_POS_MSEC)
                if currentMs and currentMs / 1000 >= endSec:
                    break

                ok, frame = cap.read()
                if not ok:
                    break

                frame = self.resizePadding(frame)
                if sceneLabel or reason:
                    frame = self.drawCaption(frame, sceneLabel, reason)

                writer.write(frame)
                framesWritten += 1
        finally:
            cap.release()

        return framesWritten

    def generatedBlobName(self, eventID: int, fileName: str):
        safeName = Path(fileName).name
        return f"events/{eventID}/generated_videos/{uuid4().hex}_{safeName}"

    def getDefaultMusicPath(self):
        localPath = os.getenv("DEFAULT_MUSIC_PATH")
        if localPath:
            return localPath

        return None

    def downloadMusicToTemp(self, tempPath: Path):
        musicBlob = os.getenv("DEFAULT_MUSIC_BLOB_NAME")
        if not musicBlob:
            return None

        localPath = tempPath / Path(musicBlob).name
        self.azure.downloadBlobToFile(musicBlob, str(localPath))
        return str(localPath)

    def resolveMusicPath(self, tempPath: Path, musicPath=None):
        if musicPath:
            return musicPath

        localPath = self.getDefaultMusicPath()
        if localPath:
            return localPath

        blobMusicPath = self.downloadMusicToTemp(tempPath)
        if blobMusicPath:
            return blobMusicPath

        raise ValueError("Music is required. Set DEFAULT_MUSIC_PATH, DEFAULT_MUSIC_BLOB_NAME, or pass musicPath.")

    def generateVideo(self, storyboard, eventID: int, outputname=None, dType="photo_id", musicPath=None):
        if not storyboard:
            raise ValueError("Storyboard is empty.")
        
        outputname = outputname or f"event_{eventID}_slideshow.mp4"
        finalOutputName = outputname if outputname.lower().endswith(".mp4") else f"{outputname}.mp4"
        fourcc = cv.VideoWriter_fourcc(*"mp4v")

        with tempfile.TemporaryDirectory() as tempDir:
            tempPath = Path(tempDir)
            rawVideoPath = tempPath / f"raw_{finalOutputName}"
            finalVideoPath = tempPath / finalOutputName
            musicPath = self.resolveMusicPath(tempPath, musicPath)

            media = self.azure.downloadToTemp(storyboard, tempPath, dType)
            writer = cv.VideoWriter(str(rawVideoPath), fourcc, self.fps, (self.width, self.height))

            if not writer.isOpened():
                raise RuntimeError("Could not open slideshow video writer.")

            itemsUsed = 0
            framesWritten = 0

            try:
                for item in media:
                    if item.get("error"):
                        self.log.warning("Skipping item %s because Blob download failed: %s", item.get(dType), item.get("error"))
                        continue

                    filePath = item.get("file_path")
                    if not filePath:
                        self.log.warning("Skipping item %s with no local file path.", item.get(dType))
                        continue

                    path = Path(filePath)
                    if not path.exists():
                        self.log.warning("Skipping missing local media file: %s", path)
                        continue

                    mediaType = str(item.get("media_type") or item.get("type") or "photo").lower()

                    if mediaType in {"video", "clip", "video_clip"}:
                        written = self.writeVideoSegment(
                            writer,
                            path,
                            startSec=item.get("clip_start") or item.get("start_time") or item.get("start_sec") or 0,
                            endSec=item.get("clip_end") or item.get("end_time") or item.get("end_sec"),
                            sceneLabel=item.get("scene_label"),
                            reason=item.get("reason"),
                        )
                    else:
                        img = cv.imread(str(path))
                        if img is None:
                            self.log.warning("Skipping unreadable slideshow image: %s", path)
                            continue
                       
                        if img is None:
                            self.log.warning("Skipping unreadable slideshow image: %s", path)
                            continue

                        frame = self.resizePadding(img)
                        frame = self.drawCaption(frame, item.get("scene_label", "Scene"), item.get("reason", ""))
                        written = self.writeSlide(writer, frame)

                    if written > 0:
                        itemsUsed += 1
                        framesWritten += written
            finally:
                writer.release()

            if itemsUsed == 0:
                raise ValueError("No valid media items were added to the slideshow.")

            if not rawVideoPath.exists() or rawVideoPath.stat().st_size == 0:
                raise RuntimeError("Raw slideshow video file was not created.")

            return self.attachMusic(
                videoPath=str(rawVideoPath),
                musicPath=musicPath,
                outPutPath=str(finalVideoPath),
                eventID=eventID,
                fileName=finalOutputName,
                durationSeconds=framesWritten / self.fps,
                itemsUsed=itemsUsed,
            )

    def attachMusic(self,videoPath,musicPath,outPutPath,eventID=None,fileName=None,durationSeconds=None,itemsUsed=None):
        video = VideoFileClip(videoPath)
        music = AudioFileClip(musicPath)
        finalVideo = None
        videoDuration = video.duration

        try:
            music = music.subclipped(0, videoDuration)
            finalVideo = video.with_audio(music)
            finalVideo.write_videofile(outPutPath, codec="libx264", audio_codec="aac")
        finally:
            video.close()
            music.close()
            if finalVideo is not None:
                finalVideo.close()

        finalPath = Path(outPutPath)
        if not finalPath.exists() or finalPath.stat().st_size == 0:
            raise RuntimeError("Final slideshow with music was not created.")

        if eventID is None:
            return str(finalPath)

        blobName = self.generatedBlobName(eventID, fileName or finalPath.name)
        uploadResult = self.azure.uploadLocalFile(blobName=blobName,localPath=str(finalPath),contentType="video/mp4")

        if not uploadResult:
            raise RuntimeError("Final slideshow was created but could not be uploaded to Azure Blob Storage.")

        dbRows = self.db.insertGeneratedVideo(
            eventID=eventID,
            fileName=Path(blobName).name,
            filePath=uploadResult["url"],
            musicID=None,
            title=f"Event {eventID} Final Slideshow",
            videoType="slideshow",
            status="completed",
            durationSeconds=durationSeconds or videoDuration,
            width=self.width,
            height=self.height,
            fps=self.fps,
            fileSize=uploadResult["size_bytes"],
        )

        if not dbRows:
            raise RuntimeError("Final slideshow was uploaded to Azure but could not be recorded in Supabase.")

        result = {
            "event_id": eventID,
            "items_used": itemsUsed,
            "duration_seconds": durationSeconds or videoDuration,
            "blob_name": uploadResult["blob_name"],
            "url": uploadResult["url"],
            "generated_video": dbRows[0] if isinstance(dbRows, list) else dbRows,
        }

        self.log.info("Uploaded final slideshow with music for event_id=%s: %s", eventID, uploadResult["url"])
        return result
