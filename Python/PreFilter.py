import cv2 as cv
import numpy as np
from pathlib import Path
from PIL import Image
import imagehash
import DBConn
import numpy as np

class ImgQualFilt:
    def __init__(self, minWidth=800, minHeight=600, blurThreshold=100., darkThreshold = 45.0, brightThreshold = 215.0, contrastThreshold = 30.0):
        self.minWidth = minWidth
        self.minHeight = minHeight
        self.blurThres = blurThreshold
        self.darkThres = darkThreshold
        self.brightThres = brightThreshold
        self.contrastThres = contrastThreshold
        self.db = DBConn.SQLbuilder()
        self.db.connect()
        self.img = None

    
    def buildDict(self, photo_id: int, status: str, reasons: list[str], blurScore: float, brightScore: float, contScore: float, width: float, height: float, imgHash: str, userApproved: int = 0):
        reasonStr = ",".join(reasons)

        return {"photo_id": photo_id,
                "status":status,
                "reason": reasonStr,
                "blur_score": blurScore,
                "bright_score": brightScore,
                "contrast_score": contScore,
                "width": width,
                "height": height,
                "image_hash": imgHash,
                "user_approved": userApproved}
    
    def hashToStr(self, h):
        if h is None:
            return None
        # already a string
        if isinstance(h, str):
            return h
        # imagehash object (correct case)
        if isinstance(h, imagehash.ImageHash):
            return str(h)
        # numpy array (shouldn't happen, but just in case)
        if hasattr(h, 'flatten'):
            return ''.join(h.flatten().astype(int).astype(str))
        return str(h)

    def strToHash(self, s):
        if s is None:
            return None
        return imagehash.hex_to_hash(s)

    def setImagePath(self, imgPath: str):
        path = Path(imgPath)

        if not path.exists():
          return self.buildDict('error', ['FNF'], 101., -1, -1, -1, 0 )
        
        self.img = cv.imread(str(path))


    def analyzeImg(self, photoID: int, imgPath: str):
        path = Path(imgPath)

        imgHash = self.hashImages(path)
        imgHash = self.hashToStr(imgHash)
        #print(imgHash)

        if not path.exists():
          return self.buildDict('error', ['FNF'], 101., -1, -1, -1, 0 )
        
        img = cv.imread(str(path))

        if img is None:
            return self.buildDict('error', ['ERROR'],10., -1, -1, -1, 0, 0 )
        
        singleColor = np.all(img == img[0,0])
        height, width = img.shape[:2]
        gray = cv.cvtColor(img, cv.COLOR_BGR2GRAY)

        blurScore = cv.Laplacian(gray, cv.CV_64F).var()
        brightScore = float(np.mean(gray))
        contrastScore = float(np.std(gray))

        reason = []

        if width < self.minWidth or height < self.minHeight:
            reason.append("low_resolution")

        if blurScore < self.blurThres:
            reason.append('blurry')

        if singleColor:
            reason.append('single_color')

        if brightScore < self.darkThres:
            reason.append('dark')
        
        if brightScore > self.brightThres:
            reason.append('bright')
        
        if contrastScore < self.contrastThres:
            ('low_contrast')

        if len(reason) > 0:
            status = 'issues'
        else:
            status = 'approved'
            reason.append('passed_filter')

        return self.buildDict(photoID, status, reason, round(float(blurScore), 2), round(float(brightScore),2), round(float(contrastScore),2), width, height, imgHash)
    
    def batchRun(self, eventID: int):
        photos = self.db.getPhotos(eventID)
        
        if photos is None:
            return "No photos found"
        
        results = []

        for photo in photos:
            res = self.analyzeImg(photo["photo_id"], photo["file_path"])
            results.append(res)

        self.db.insertPreFilter(results)

        return results
    
    def hashImages(self, imgPath: str):
        try:
            hash = imagehash.phash(Image.open(imgPath))
            #print (hash)
            return hash
        
        except Exception as e:
            print(f"Hash error: {e}")
            return None

def main():
    ts = ImgQualFilt()

    result2 = ts.batchRun(1)
    #for result in result2:
    #    print(result)

if __name__ == "__main__":
    main()