import fastapi
import qrGen
from pydantic import BaseModel

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
