import fastapi

app = fastapi.FastAPI()

@app.post('/qrcode')
async def createQR():
    print('Fuck you Michael')

@app.get('/users/me')
async def readUserMe():
    return {'userID': "The Current User"}

@app.get('/users/{userID}')
async def readUser(userID : str):
    return{'userID': userID}