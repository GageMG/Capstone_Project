import time
import logging
import tempfile
from pathlib import Path
from shared.ProjectHelper import Helpers as ph
from shared.AzureClass import blobHandler
from worker.ContentScorer import ContentScoring
from shared.DBConn import SQLbuilder
from worker.ImageRanker import blipRanker
from worker.PreFilter import ImgQualFilt
from worker.SlideShow import SlideShowGenerator
from api.StoryBoard import StoryBoardGen
from worker.VideoExtraction import ExtractVidFrames

logging.basicConfig(level=logging.INFO)

class newRunner:
    def __init__(self, db = None, log = None, blob = None):
        self.log = log or logging.getLogger("Worker")
        self.blob = blob or blobHandler(self.log)
        self.db = db or SQLbuilder(self.log)
       
        self.cs = ContentScoring(db= self.db, log=self.log)
        self.ir = blipRanker(db= self.db, log=self.log)
        self.pf = ImgQualFilt(db= self.db, log= self.log)
        self.ve = ExtractVidFrames(db= self.db, log= self.log)
        self.ss = SlideShowGenerator(db=self.db, log= self.log, azure= self.blob)
        self.sb = StoryBoardGen(db=self.db, log=self.log)


    def manageQueue(self):
        def updateCall(jobID, update:str, err: str | None = None, prompt: int | None = None):
            self.db.updateJobStatus(jobID, update, err, prompt)

        self.log.info("Queue worker started.") 

        while True:
            msg = self.blob.queue.receive_message(visibility_timeout=300)
            
            if msg is None:
                time.sleep(5)
                continue

            jobID = None

            try:
                self.log.info(f"Raw queue message received: {msg.content}")
                data = ph.parseQueueMessage(msg.content)

                self.log.info(f"Parsed queue message: {data}")
    
                eventID = data['event_id']
                jobType = data['job_type']
                jobID = data.get("job_id")

                self.log.info(f'Parsed msg Received: {data}')

                
                if jobType== 'preprocess':

                    mediaType = data["type"]
                    uploadIDs = data.get("upload_ids") or []
                    
                    if not uploadIDs and data.get("upload_id") is not None:
                        uploadIDs = [data.get("upload_id")]

                    if mediaType == "photo":
                        mediaType = "photos"
                    elif mediaType == "video":
                        mediaType = 'videos'

                    self.log.info(f'Parsed msg Received: {data}')

                    updateCall(jobID, 'processing')
                    res = self.runProcess(eventID, mediaType, uploadIDs)

                    if res:
                        updateCall(jobID, 'completed')


                elif jobType == 'create':
                    if not jobID:
                        raise ValueError("Missing job_id for video job")
                    
                    storyBoardID = data.get('storyboard_id')

                    self.log.info(f"Running video creation for event_id={eventID}, storyboard_id={storyBoardID}")

                    if not storyBoardID:
                        raise ValueError
                    
                    updateCall(jobID, 'processing')

                    sb = self.db.getStoryboardItems(storyBoardID)

                    if not sb:
                        raise ValueError(f"No approved storyboard photos found for event {eventID}")
                    
                    videoPath = self.ss.generateVideo(sb, eventID)    

                    self.log.info(f"Video created successfully: {videoPath}")

                    updateCall(jobID, 'completed')

                else:
                    raise ValueError(f"Unknown job_type: {jobType}")

                self.blob.queue.delete_message(msg)

            except Exception as e:
                self.log.exception(f"Queue job failed: {e}")

                if jobID:
                    updateCall(jobID, 'failed', str(e))

                self.blob.queue.delete_message(msg)

    def runProcess(self, eventID: int, dt: str = 'photos', uploadIDs: list[int] | None = None):
        print(f'Starting Event {eventID}, for {dt}')
        dt = dt.lower().strip()
        
        uploadIDs = uploadIDs or []

        if dt not in ("photos", "videos"):
            raise ValueError("dt must be either 'photos' or 'videos'")

        videoFlag = None
        vidID = None
        dType = dt2 = 'photo_id'

        if dt == 'videos':
            dType = 'frame_id'
            dt2 = 'video_id'

        try:
            photos = self.db.getMedia(eventID, dt, uploadIDs = uploadIDs or [])
    
            if not photos or len(photos) == 0:
                raise ValueError(f"No {dt} found to preprocess.")

            prefilt = imgRank = contScore = 'Success'

            with tempfile.TemporaryDirectory() as tempDir:
                tempDir = Path(tempDir)
                mediaSet = self.blob.downloadToTemp(photos, tempDir, dt2)

                if not mediaSet:
                    raise ValueError(f"No {dt} files downloaded for preprocess.")

                if dt == 'videos':
                    videoFlag = 'videos'
                    mediaSet = self.ve.batchRun(videos=mediaSet, tempDir=tempDir, eventID=eventID)
                    dt = 'video_frames'

                    if not mediaSet:
                        raise ValueError(f"No {dt} files downloaded for preprocess.")

                ids = [row[dType] for row in mediaSet]

                if videoFlag:
                    vidID = list(set(row[dt2] for row in mediaSet))
                    self.batchStatus(videoFlag, dt2, vidID, "processing")

                self.batchStatus(dt, dType, ids, "processing")
                
                pfr = self.pf.batchRunPF(mediaSet, dType)
                if not pfr:
                    prefilt = 'Failed'

                self.batchStatus(dt, dType, ids, "stage1")

                irr = self.ir.batchRunIR(mediaSet, dType)
                if not irr:
                    imgRank = 'Failed'

                self.batchStatus(dt, dType, ids, "stage2")

                csr = self.cs.batchRunCS(mediaSet, dType)

                if not csr:
                    contScore = 'Failed'
                
                self.batchStatus(dt, dType, ids, "completed")

                if videoFlag:
                    self.batchStatus(videoFlag, dt2, vidID, "completed")
        
            return {f"Pre Filter: {prefilt}\n Results: {pfr}\nImage Ranker: {imgRank}\nResults: {irr}\nContent Score: {contScore}\nResults: {csr}"}

        except Exception as e:
            self.log.exception(f"job failed: {e}")
            raise

    def batchStatus(self, tblName, idColName, rowID, Status):
        self.db.batchStatusUodate(tblName=tblName, idColName=idColName, rowIDs=rowID, status= Status)
    
    
        
# if __name__ == "__main__":
#     test = newRunner()
#     res = test.runProcess(1, 'videos')
if __name__ == "__main__":
    runner = newRunner()
    runner.manageQueue()