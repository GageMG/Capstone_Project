import logging
import os
import tempfile
from pathlib import Path

import AzureClass
import ContentScorer
import DBConn
import ImageRanker
import PreFilter
from ProjectHelper import Helpers as ph

import VideoExtraction

log = logging.getLogger(__name__)

class newRunner:
    def __init__(self, db=None):
        self.cs = ContentScorer.ContentScoring()
        self.ir = ImageRanker.blipRanker()
        self.pf = PreFilter.ImgQualFilt()
        self.ve = VideoExtraction.ExtractVidFrames()
        self.blob = AzureClass.blobHandler()
        if db is None:
            log.warning("EventsClass.Manager created its own DB connection — db was not injected")
            self.db = DBConn.SQLbuilder()
            self.db.connect()
        else:
            self.db = db

    def runProcess(self, eventID: int, dt: str = 'photo'):
        dType = dt2 = 'photo_id'

        if dt == 'video':
            dType = 'frame_id'
            dt2 = 'video_id'

        photos = self.db.getMedia(eventID, dt)
        if not photos or len(photos) == 0:
            return "No Photos found"

        prefilt = imgRank = contScore = 'Success'

        with tempfile.TemporaryDirectory() as tempDir:
            tempDir = Path(tempDir)
            mediaSet = self.blob.downloadToTemp(photos, tempDir, dt2)
            if dt == 'video':
                mediaSet = self.ve.batchRun(videos=mediaSet, tempDir=tempDir, eventID=eventID)
            
            pfr = self.pf.batchRunPF(mediaSet, dType)
            if not pfr:
                prefilt = 'Failed'

            irr = self.ir.batchRunIR(mediaSet, dType)
            if not irr:
                imgRank = 'Failed'
            
            csr = self.cs.batchRunCS(mediaSet, dType)
            if not csr:
                contScore = 'Failed'
            
        return {f"Pre Filter: {prefilt}\n Results: {pfr}\nImage Ranker: {imgRank}\nResults: {irr}\nContent Score: {contScore}\nResults: {csr}"}

def main():
    test = newRunner()
    res = test.runProcess(4, 'video')
    #res = test.runVideos(4)
    print(res)

if __name__ == "__main__":
    main()