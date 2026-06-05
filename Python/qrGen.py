import qrcode 
import DBConn 
from pathlib import Path
class genQR():
    def __init__(self, path = "Test Path"):
        self.baseUrl = path
        self.fullUrl = None
        self.eventID = None
        self.db = DBConn.SQLbuilder()
        self.localTesting = Path(r"C:\CSI4500")
        self.db.connect()

    def generateUrl(self, eventID: str):
        if eventID is None:
            raise ValueError('Event ID is empty')
        self.eventID = eventID
        self.fullUrl = f'{self.baseUrl}/{eventID}'

    def generateQRcode(self):
        if self.fullUrl is None or self.eventID is None:
            raise ValueError('URL must be generated')
        qr = qrcode.make(self.fullUrl)
        qr.save(fr"{self.localTesting }/testqr.png")
        self.db.postQRtoDB(195, fr"{self.localTesting }/testqr.png")


def main():
    qrCo = genQR('www.espn.com')
    qrCo.generateUrl(r"nfl/story/_/id/48649984/2026-nfl-offseason-biggest-roster-holes-depth-needs-all-32-teams-postdraft")
    qrCo.generateQRcode()
    print('done with test')

if __name__ == "__main__":
    main()