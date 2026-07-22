
import secrets
from datetime import datetime, timezone, timedelta,date, time
from urllib.parse import urlencode
from io import BytesIO
import qrcode
import os
from uuid import uuid4

class genQR():
    def __init__(self, db, log, blob, path = None):
        self.baseUrl = (
            path
            or os.getenv("QR_BASE_URL")
            or "http://localhost:8081/guest-upload"
        ).rstrip("/?")
        self.log = log
        self.blob = blob
        self.db = db


    def genToken(self):
       tokLen = 32
       return secrets.token_urlsafe(tokLen)
    
    def generateUrl(self, eventID: int, token: str) -> str:
        if eventID is None:
            raise ValueError("Event ID is empty")

        if not token:
            raise ValueError("Token is empty")

        query = urlencode(
            {
                "eventID": eventID,
                "qrToken": token
            }
        )

        return f"{self.baseUrl}?{query}"
    
    def parseExpiration(self, expirationDate):


        if expirationDate is None:
            return None

        if isinstance(expirationDate, datetime):
            expires = expirationDate

        elif isinstance(expirationDate, date):
            expires = datetime.combine(expirationDate, time(23, 59, 59))

        elif isinstance(expirationDate, str):
            raw = expirationDate.strip()

            formats = [
                "%m/%d/%y",
                "%m/%d/%Y",
                "%Y-%m-%d",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S",
            ]

            expires = None

            for fmt in formats:
                try:
                    expires = datetime.strptime(raw, fmt)
                    break
                except ValueError:
                    pass

            if expires is None:
                try:
                    expires = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                except ValueError:
                    raise ValueError(f"Invalid expiration date format: {expirationDate}")

        else:
            raise ValueError("Unsupported expiration date type")

        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)

        return expires

    def generateQRcode(self, eventID:int, expirationDate, maxUpload, purpose = "guests", setActive = True):
        if eventID is None:
            raise ValueError("Event ID is required")
        
        token = self.genToken()
        fullUrl = self.generateUrl(eventID=eventID, token=token)
        
        qr = qrcode.make(fullUrl)
        buffer = BytesIO()
        qr.save(buffer, format="PNG")
        qrBytes = buffer.getvalue()

        blobName = f"events/{eventID}/qrcodes/{uuid4().hex}.png"

        uploadResult = self.blob.uploadBytes(blobName=blobName, data=qrBytes, contentType="image/png")

        if not uploadResult:
            raise RuntimeError("Failed to upload QR code to Azure Blob Storage")

        qrImageUrl = uploadResult["url"]

        expires = self.parseExpiration(expirationDate)

        if expires is None:
            expires = datetime.now(timezone.utc) + timedelta(days=100)

        dbRow = self.db.postQRtoDB(eventID= eventID, url=str(qrImageUrl), token= token, expires_at= expires.isoformat(), max_uploads= maxUpload, purpose=purpose, is_active = setActive)

        return {
            "event_id": eventID,
            "qrcode_row": dbRow,
            "qr_image_url": qrImageUrl,
            "qr_blob_name": blobName,
            "qr_url": fullUrl,
            "token": token,
            "expires_at": expires.isoformat(),
            "max_uploads": maxUpload,
            "purpose": purpose,
            "is_active": setActive
        }

    
    def validateQRcode(self, eventID: int, token: str, enforceUploadLimit: bool = True):
        if token is None or token.strip() == "":
            return False, "Missing Token"
        
        if eventID is None:
            return False, "Missing event ID"

        qrToken = self.db.getQRToken(token=token)

        if qrToken is None:
            return False, "No Data"
        
        tokenEventID = qrToken.get("event_id")

        if tokenEventID is None:
            return False, "QR token is missing event ID"

        if int(tokenEventID) != int(eventID):
            return False, "QR token does not match this event"

        if not qrToken.get("is_active", False):
            return False, "QR token is not active"

        expires_at = qrToken.get("expires_at")

        if expires_at is not None:
            expires = datetime.fromisoformat(str(expires_at))

            if expires.tzinfo is None:
                now = datetime.now()
            else:
                now = datetime.now(timezone.utc)

            if now > expires:
                return False, "QR code expired"

        max_uploads = qrToken.get("max_uploads")
        upload_count = qrToken.get("upload_count", 0)

        if enforceUploadLimit and max_uploads is not None:
            if int(upload_count) >= int(max_uploads):
                return False, "Upload limit reached"

        return True, "QR code is valid"
