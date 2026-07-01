import logging
import os
from dataclasses import asdict
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import List, Optional

import AzureClass
import ChatBot
import DataStruct as dc
import DBConn
import EventsClass
import fastapi
import newRunner
import qrGen
import SlideShow
import StoryBoard
import UserClass
import uvicorn
from fastapi import File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("MainAPI")
logger.setLevel(logging.INFO)

file_handler = RotatingFileHandler(os.path.join(LOG_DIR, "mainapi.log"), maxBytes=10_000_000, backupCount=5)
file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))

console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))

logger.addHandler(file_handler)
logger.addHandler(console_handler)


blob = AzureClass.blobHandler()
db = DBConn.SQLbuilder()
db.connect()

uc = UserClass.Users(db=db)
ev = EventsClass.Manager(db=db)
qrCode = qrGen.genQR(db=db)

app = fastapi.FastAPI()

@app.post('/qr/generate')
async def createQR(req: dc.QRRequest):

    qrCode.generateUrl(req.eventID)
    result = qrCode.generateQRcode(req.expirationDate, req.maxUploads, req.purpose, req.is_active)

    return {
            "event_id": req.eventID,
            "status": "created",
            "url": 'temp',
            "result": result
        }

@app.get('/qr/validate')
async def validateQR(req: dc.validateToken):


    valid, reason = qrCode.validateQRcode(req.eventID)

    print(valid, reason)
    return {"eventID": req.eventID, "valid": valid, "reason": reason}

@app.get('/users/me')
async def readUserMe():
    return {'userID': "The Current User"}

@app.get('/users/{userID}')
async def readUser(userID : str):
    return{'userID': userID}

#API endpoint for the upload function
@app.post("/upload")
async def uploadPhotos(eventID: int = Form(...),userID: Optional[int] = Form(None),guestID: Optional[int] = Form(None),files: List[UploadFile] = File(...)):
    if userID is None and guestID is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either userID or guestID is required."
        )

    photosExt = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic")
    vidExt = (".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".mkv")

    saved = []

    for file in files:
        orgName = Path(file.filename or "unknown_file").name
        suffix = Path(orgName).suffix.lower()

        if suffix in photosExt:
            fType = "photo"
        elif suffix in vidExt:
            fType = "video"
        else:
            saved.append(
                asdict(
                    dc.uploadResults(file_name=orgName,status="skipped",reason="Unsupported file type")
                )
            )
            continue

        try:
            res = await blob.fileUpload(file, eventID, fType)

            saved.append(
                asdict(
                    dc.uploadResults(
                        file_name=res["original_name"],
                        status="saved",
                        file_type=fType,
                        size_bytes=res["size_bytes"],
                        url=res["url"],
                        blob_name=res["blob_name"],
                        reason="success",
                        content_type=res["content_type"]
                    )
                )
            )

            print(f'File: {res["url"]} Size: {res["size_bytes"]} bytes, Type: {fType}')

        except Exception as e:
            saved.append(
                asdict(
                    dc.uploadResults(
                        file_name=orgName,
                        status="failed",
                        reason=str(e)
                    )
                )
            )

    uploadRows = []

    for item in saved:
        if item["status"] != "saved":
            continue

        uploadRows.append(
            {
                "event_id": eventID,
                "user_id": userID,
                "guest_id": guestID,
                "original_file_name": item["file_name"],
                "blob_name": item["blob_name"],
                "file_path": item["url"],
                "media_type": item["file_type"],
                "mime_type": item["content_type"],
                "file_size": item["size_bytes"],
                "upload_status": "uploaded",
                "processing_status": "not_started"
            }
        )

    if not uploadRows:
        return {
            "event_id": eventID,
            "user_id": userID,
            "guest_id": guestID,
            "uploaded": 0,
            "db_records_inserted": 0,
            "photo_records_inserted": 0,
            "video_records_inserted": 0,
            "results": saved
        }

    inserted = db.insertUploads(uploadRows)

    if not inserted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Files uploaded to Azure, but database insert failed."
        )

    mediaInserts = db.insertMediaRecordsFromUploads(inserted)

    if not mediaInserts:
        mediaInserts = {"photos": [], "videos": []}

    return {
        "event_id": eventID,
        "user_id": userID,
        "guest_id": guestID,
        "uploaded": len([item for item in saved if item["status"] == "saved"]),
        "db_records_inserted": len(inserted),
        "photo_records_inserted": len(mediaInserts["photos"]),
        "video_records_inserted": len(mediaInserts["videos"]),
        "results": saved
    }
  
@app.post("/video/generate")
async def generateVideo(req: dc.MakeVideoRequest):
    try:
        ss = SlideShow.SlideShowGenerator(db=db)
        sb = StoryBoard.StoryBoardGen(db=db)
        
        media = db.getApprovedPhotosForStoryboard(req.eventID)

        if not media:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='No media found for event')
        
        sb.generateSeq(media)
        sboard =db.getStoryboardByEvent(req.eventID)

        if not sboard:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail = 'Storyboard not created. no records found')
        

        outPutThat = ss.generateVideo(sboard, req.eventID)
        return {
            "event_id": req.eventID,
            "user_id": req.userID,
            "feeling": req.feeling,
            "status": "generated",
            "output_path": str(outPutThat) if outPutThat else None
        }
    
    except HTTPException:
        raise

    except [Exception] as e:
        logger.exception('Video Generation failed')
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail= "Video Generation Failed") from e

@app.post("/prompt/analyze")
async def analyzePrompt(request: dc.PromptRequest):
    try:
        bot = ChatBot.chatBotOpenAI()
        result = bot.getResponse(request.prompt)

        if not isinstance(result, dict):
            return {
                "allowed": False,
                "out_of_scope": False,
                "unsafe_or_invalid": True,
                "reason": "The prompt analyzer returned data that was not a JSON object.",
                "response": "Sorry, I could not understand that request."
            }

        result["event_id"] = request.eventID
        result["user_id"] = request.userID
        result["guest_id"] = request.guestID
        result["original_prompt"] = request.prompt

        inserted = db.insertPromptRequest(result)

        return {
            "event_id": request.eventID,
            "user_id": request.userID,
            "guest_id": request.guestID,
            "inserted": inserted,
            "analysis": result
        }

    except Exception as e:
        logger.exception("Prompt analysis failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Prompt analysis failed."
        ) from e
    
@app.post('/media/allmedia')
async def getMedia(req: dc.mediaModel):
    try:
        media = db.getAllMedia(eventID=req.eventID,dataType=req.dataType)

        return {
            "status": "success",
            "eventID": req.eventID,
            "dataType": req.dataType,
            "photos_count": len(media["photos"]),
            "videos_count": len(media["videos"]),
            "data": media
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting media: {e}"
        )

@app.post("/users/create", response_model=dc.userResponse)
async def create_user(user: dc.userCreate):
    created_user = uc.createUser(user)

    if not created_user:
        raise HTTPException(
            status_code=400,
            detail="User could not be created."
        )

    return created_user

@app.post("/users/login",response_model=dc.userResponse)
async def loginUser(login: dc.userLogin):
    user = uc.loginUser(login)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email/username or password."
        )

    return user

@app.post("/events/create")
def create_event(event: dc.eventCreate, location: dc.eventLocation):

    result = ev.createEvent(event=event, location= location)
    
    if not result:
        raise HTTPException(
            status_code=500,
            detail="Event could not be created."
        )

    return {
        "message": "Event created successfully.",
        "data": result
    }
    
@app.get("/locations/all")
def getAllLoc():

    result = ev.getAllLocations()

    if result is None:
        raise HTTPException(
            status_code=500,
            detail="Locations could not be loaded."
        )

    return {
        "message": "Locations loaded successfully.",
        "locations": result
    }

@app.get("/locations/{locationID}")
def getLocID(locationID: int):

    result = ev.getLocationByID(locationID)

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Location not found."
        )

    return {
        "message": "Location loaded successfully.",
        "location": result}

@app.get("/events/{eventID}")
def getEvent(eventID: int):

    result = ev.getEventByID(eventID)

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Event not found."
        )

    return {
        "message": "Event loaded successfully.",
        "event": result
    }

@app.patch("/events/{eventID}")
def modifyEvent(eventID: int, event: dc.eventModify):

    result = ev.modifyEvent(eventID=eventID, event=event)

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Event could not be modified."
        )

    return {
        "message": "Event modified successfully.",
        "event": result
    }

@app.patch("/locations/{locationID}")
def modifyLoc(locationID: int, location: dc.eventLocationModify):

    result = ev.modifyLocation(locationID=locationID, location=location)

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Location could not be modified."
        )

    return {
        "message": "Location modified successfully.",
        "location": result
    }
if __name__ == "__main__":
    uvicorn.run("mainAPI:app", host="127.0.0.1", port=8000, reload=True)