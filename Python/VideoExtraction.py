import os

import cv2 as cv
from pathlib import Path
import tempfile
import DBConn

class ExtractVidFrames():
    def __init__(self):
        self.db = DBConn.SQLbuilder()
        self.db.connect()
        
    def extractFrames(self, inPath: str, outPath: str, eventID: int, videoID: int, setSeconds: int= 3):

        vidPath = Path(inPath)
        #outPut = Path(outPath) / f"videoID_{videoID}"
        #outPut.mkdir(parents=True, exist_ok=True)

        if not vidPath.exists():
            print(f'Video not found: {vidPath}')
            return []
        
        cap = cv.VideoCapture(str(vidPath))
        if not cap.isOpened():
            print(f"could not open video: {vidPath}")
            return []
        
        fps = cap.get(cv.CAP_PROP_FPS)

        if fps == 0:
            fps = 30

        frameInt = int(fps * setSeconds)

        savedFrames = []
        frameCount = 0
        savedCount = 0

        while True:
            outPut = Path(outPath) / f"video_ID_{videoID}"
            outPut.mkdir(parents=True, exist_ok=True)
            success, frame = cap.read()

            if not success: 
                break

            if frameCount % frameInt == 0:
                frameFile = outPut/f'{vidPath.stem}_frame_{savedCount}.jpg'
                cv.imwrite(str(frameFile), frame)
                savedFrames.append(str(frameFile))
                savedCount += 1
                print(f"{savedCount}/{frameInt}.")

            frameCount += 1
        cap.release()

        return savedFrames
    
    def batchRun(self, eventID: int, outPath: str):
        if not os.path.exists(outPath):
            os.makedirs(outPath)
        tempDir = tempfile.mkdtemp(prefix=f"event_{eventID}_", suffix="_frames", dir=outPath)
        videos = self.db.getVideos(eventID)
        if not videos:
            print("No videos found for the given event.")
            return

        for video in videos:
            self.extractFrames(video["file_path"], tempDir, eventID, video["video_id"])

            print(f"Extracted frames for event {eventID} to {tempDir}")

def main():
    frames = ExtractVidFrames()
    #frames.extractFrames(r"C:\CSI4999\Videos\kelly_&_michael's_wedding_day_teaser (2160p).mp4", r'C:\CSI4999\Videos\Frames', 1 )
    frames.batchRun(1, r'C:\CSI4999\Videos\tempFrames')
    print('done')

if __name__ == "__main__":
    main()