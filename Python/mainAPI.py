import logging
import os
from logging.handlers import RotatingFileHandler
from typing import List

import Auth
import AzureClass
import ChatBot
import DataStruct as dc
import DBConn
import EventsClass
import fastapi
import jwt
import newRunner
import qrGen
import SlideShow
import StoryBoard
import Uploads
import UserClass
import uvicorn
from fastapi import Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordBearer

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

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")
authMang = Auth.Auth()

blob = AzureClass.blobHandler()
db = DBConn.SQLbuilder()
db.connect()

uc = UserClass.Users(db=db)
ev = EventsClass.Manager(db=db)
qrCode = qrGen.genQR(db=db)

app = fastapi.FastAPI()
uploadManager = Uploads.UploadManager(db=db, blob=blob, logger=logger)

def getCurrentUserID(token: str = Depends(oauth2_scheme)) -> int:
    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Could not validate credentials.",headers={"WWW-Authenticate": "Bearer"},)
 
    try:
        payload = authMang.decodeToken(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Token has expired.",headers={"WWW-Authenticate": "Bearer"},) from None
    except jwt.InvalidTokenError:
        raise credentials_exception from None
 
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
 
    try:
        return int(user_id_str)
    except ValueError:
        raise credentials_exception from None
    
def verifyEventOwner(eventID: int, current_user_id: int) -> dict:
    event = ev.getEventByID(eventID)

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Event not found.")

    owner_id = event.get("user_id") or event.get("owner_id")

    if owner_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You do not have access to this event.")

    return event

def verifyGuestQRCode(eventID: int, qrToken: str):
    if not qrToken:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="QR token is required.")

    valid, reason = qrCode.validateQRcode(eventID=eventID, token=qrToken)

    if not valid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail=reason or "Invalid or expired QR code.")

    return True

@app.post('/qr/generate')
async def createQR(req: dc.QRRequest):
    verifyEventOwner(req.eventID, getCurrentUserID)
    qrCode.generateUrl(req.eventID)
    result = qrCode.generateQRcode(req.eventID, req.expirationDate, req.maxUploads, req.purpose, req.is_active)

    return {
            "event_id": req.eventID,
            "status": "created",
            "url": 'temp',
            "result": result
        }

@app.get('/qr/validate')
async def validateQR(req: dc.validateToken):

    valid, reason = qrCode.validateQRcode(req.event_id, req.token)

    print(valid, reason)
    return {"eventID": req.eventID, "valid": valid, "reason": reason}

#API endpoint for the upload function
@app.post("/upload/user")
async def uploadUserPhotos(eventID: int = Form(...),files: List[UploadFile] = File(...),current_user_id: int = Depends(getCurrentUserID)):

    verifyEventOwner(eventID, current_user_id)

    return await uploadManager.upload_files(eventID=eventID,userID=current_user_id,guestID=None,files=files)

@app.post("/upload/guest")
async def uploadGuestPhotos(eventID: int = Form(...),qrToken: str = Form(...),guestID: int = Form(...),files: List[UploadFile] = File(...)):
    verifyGuestQRCode(eventID, qrToken)

    res = await uploadManager.upload_files(eventID=eventID,userID=None,guestID=guestID,files=files)

    if res["uploaded"] > 0:
        db.incrementQRUploadCount(qrToken, res["uploaded"])

@app.post("/video/generate")
async def generateVideo(req: dc.MakeVideoRequest):
    try:
        verifyEventOwner(req.eventID, getCurrentUserID)
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
        verifyEventOwner(request.eventID, getCurrentUserID)
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
        verifyEventOwner(req.eventID, getCurrentUserID)
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

@app.post("/users/login",response_model=dc.tokenReturn)
async def loginUser(login: dc.userLogin):
    user = uc.loginUser(login)

    if user is None:
        raise HTTPException(status_code=401,detail="Invalid email/username or password.")
    
    token = authMang.createAccessToken(user)

    return {"access_token": token, "token_type": "bearer"}

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
    verifyEventOwner(eventID, getCurrentUserID)
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

@app.patch("/events/modify{eventID}")
def modifyEvent(eventID: int, event: dc.eventModify):
    verifyEventOwner(eventID, getCurrentUserID)

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