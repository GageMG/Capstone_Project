from ultralytics import YOLO
import cv2
from pathlib import Path
import DBConn

class ContentScoring:
    def __init__(self, modelPath ="yolo26n.pt"):
        self.model = YOLO(modelPath)
        self.db = DBConn.SQLbuilder()
        self.db.connect()

    def buildDict(self, photoID: int, perCount: int, maxPerConf: float, objClass: list[str], conf: float, contScore: int):
        objects = ",".join(objClass)

        return{"photo_id": photoID,
               "person_count": perCount,
               "max_person_conf": maxPerConf,
               "obj_class": objects,
               "confidence": conf,
                "content_score": contScore
               }

    def analyze(self, photo_id: int, imgPath: str):
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
        return(self.buildDict(photo_id, perCnt, maxPerCof, classNames,conf, contScore))
    
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

def main():
    scorer = ContentScoring()
    f = scorer.batchRun(1)
    print(f)


if __name__ == "__main__":
    main()      