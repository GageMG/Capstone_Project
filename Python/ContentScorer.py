from ultralytics import YOLO
import DBConn
from pathlib import Path
from ProjectHelper import Helpers as ph

class ContentScoring:
    def __init__(self, modelPath ="yolo26n.pt"):
        self.model = YOLO(modelPath)
        self.db = DBConn.SQLbuilder()
        self.db.connect()

    def buildDict(self, photoID: int, perCount: int, maxPerConf: float, objClass: list[str], conf: float, contScore: int, isVideo: bool = False):
        #objects = ",".join(objClass)
        id = "photo_id"
        if isVideo:
            id = "video_id"
        if objClass:
            reasonStr = ",".join(objClass)
        else:
            reasonStr = "N/A"

        return{"id": photoID,
               "person_count": perCount,
               "max_person_conf": maxPerConf,
               "obj_class": objClass,
               "confidence": conf,
                "content_score": contScore
               }

    def analyze(self, photo_id: int, imgPath: str, isVideo: bool = False):
        results = self.model(imgPath)
        detectedObj = []
        perCnt = 0 #person count
        maxPerCof = 0.00
        conf = 0.0

        for result in results:
            for box in result.boxes:
                classID = int(box.cls[0])
                conf = float(box.conf[0])
                className = self.model.names[classID]

                detectedObj.append({ "class": className,"confidence": round(conf, 3)})

                if className == "person":
                    perCnt += 1
                    maxPerCof = max(maxPerCof, conf)
        
        contScore = 0
    
        if perCnt > 0:
            contScore += 25
        
        if maxPerCof > .8:
            contScore += 25

        if perCnt >= 2:
            contScore += +15

        classNames = [obj["class"] for obj in detectedObj]
        #print(f'People: {perCnt}\nCofidence: {conf}\nMax perConf: {maxPerCof}\nContent Score: {contScore}\nDetected Objects {detectedObj}')
        return(self.buildDict(photo_id, perCnt, maxPerCof, classNames,conf, contScore, isVideo=isVideo))
    
    def batchRun(self, eventID):

        photos = self.db.getPhotos(eventID)

        if photos is None:
            return "No photos found"
        
        results = []

        for photo in photos:
            res = self.analyze(photo["photo_id"], photo["file_path"])
            results.append(res)

        self.db.insertContent(results)
        return results
    
    def batchRunVideos(self, tempDir: str, eventID: int):
        ext = ('.jpg', '.jpeg', '.png')
        results = []
        evID = ph.getIDNum(Path(tempDir).name, pos = 1)
        tempPath = Path(tempDir)
        if not tempPath.exists():
            return "Invalid temp directory"

        if evID != eventID: 
                err = f"Event ID mismatch: expected {eventID}, got {evID}"
                print(err)
                return "Event ID mismatch"

        for videoFolder in tempPath.iterdir():

            if not videoFolder.is_dir():
                continue

            vidID = ph.getIDNum(videoFolder.name, pos=2)

            print(f"Processing video folder: {videoFolder.name}, video_id: {vidID}")

            for frameNum, framePath in enumerate(videoFolder.iterdir()):

                if not framePath.is_file():
                    continue

                if not framePath.name.lower().endswith(ext):
                    continue

                res = self.analyze(frameNum, str(framePath), isVideo=True)
                res["video_id"] = vidID
                results.append(res)

                print(f"Processed video {vidID}, frame {frameNum}: {framePath.name}")
        
        self.db.insertVideoPreFilter(results)

        return results
def main():
    scorer = ContentScoring()
    #scorer.batchRun(1)
    scorer.batchRunVideos(r'C:\CSI4999\Videos\tempFrames\event_1_35iz4tfs_frames', 1)
   # print(f)


if __name__ == "__main__":
    main()      