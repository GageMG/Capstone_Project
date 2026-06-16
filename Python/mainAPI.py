import fastapi
import qrGen
from pydantic import BaseModel
import os, shutil
from fastapi import File, UploadFile
from typing import List

#For the upload directory
Upload_Dir = "uploads"
os.makedirs(Upload_Dir, exist_ok=True)


class QRRequest(BaseModel):
    eventID: int
    expirationDate: str
    maxUploads: int = 50
    purpose: str = "guests"
    is_active: bool = True

class Validate(BaseModel):
    token: str

app = fastapi.FastAPI()

@app.post('/qr/generate')
async def createQR(req: QRRequest):
    qrCode = qrGen.genQR()
    qrCode.generateUrl(req.eventID)
    qrCode.generateQRcode(req.expirationDate, req.maxUploads, req.purpose, req.is_active)
    print("done")

@app.get('/qr/validate')
async def validateQR(req: Validate):
    qrCode = qrGen.genQR()
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
@app.post('/upload')
async def uploadPhotos(files: List[UploadFile] = File(...)):
    saved = []
    for file in files:
        dest = os.path.join(Upload_Dir, file.filename)
        with open(dest, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            saved.append(file.filename)
            return {"Uploaded": len(saved), "files": saved}

@app.get('/events') 
async def getEvent():
    events = db.query("SELECT * FROM placeholder")  #need to have databse connect for db to work
    return events