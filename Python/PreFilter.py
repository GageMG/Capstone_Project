import cv2 as cv
import numpy as np
from pathlib import Path
import DBConn

class ImgQualFilt:
    def __init__(self, minWidth=800, minHeight=600, blurThreshold=100., darkThreshold = 45.0, brightThreshold = 215.0, contrastThreshold = 30.0):
        self.minWidth = minWidth
        self.minHeight = minHeight
        self.blurThres = blurThreshold
        self.darkThres = darkThreshold
        self.brightThres = brightThreshold
        self.contrastThres = contrastThreshold

    def buildDict(self, status: str, reasons: list[str], blurScore: float, brightScore: float, contScore: float, width: float, height: float):
        reasonStr = ",".join(reasons)

        return {"status":status,
                "reason": reasonStr,
                "blurScore": blurScore,
                "brightScore": brightScore,
                "contrastScore": contScore,
                "width": width,
                "height": height}

    def analyzeImg(self, imgPath: str):
        path = Path(imgPath)

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

        return self.buildDict(status, reason, round(float(blurScore), 2), round(float(brightScore),2), round(float(contrastScore),2), width, height)

def main():
    ts = ImgQualFilt()
    db = DBConn.SQLbuilder()
    db.connect()

    result = ts.analyzeImg(r"C:\Users\Micha\OneDrive\Pictures\qTcFj.jpg")
    db.insertPreFilter(1, result)
    result2 = db.selectAll('filter_photos')
    for result in result2:
        print(result)

if __name__ == "__main__":
    main()