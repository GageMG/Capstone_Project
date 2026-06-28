import DataStruct as ds
import DBConn
from pwdlib import PasswordHash


class Users:
    def __init__(self):
        self.db = DBConn.SQLbuilder()
        self.db.connect()
        self.pwhash = PasswordHash.recommended()

    def hashPWD(self, pwd: str) -> str:
        return self.pwhash.hash(pwd)
    
    def verifyPWD(self, userPWD: str, hashedPWD) -> bool:
        return self.pwhash.verify(userPWD, hashedPWD)
        
    def createUser(self, user: ds.userCreate):
        userData = user.model_dump(exclude={"pwd"})
        userData["password_hash"] = self.hashPWD(user.pwd)

        self.extraSec(user)
        
        res = self.db.insertUser(userData)

        self.extraSec(userData)

        if not res:
            return None
        
        return res
    
    def getUserData(self, email:str):
        print('time')
    
    def loginUser(self, login: ds.userLogin ):
        user = self.db.getUserPWD(login.email, login.user_name)

        if not user:
            print('Record not found') 
        
        isValid = self.verifyPWD(login.pwd, user['password_hash'])

        user.pop("password_hash", None)

        if not isValid:
            self.extraSec(user)
            print('Invalid password')
            return None

        print('Valid password')
        return user
    
    def extraSec(self, dataDict: dict):
        dataDict.clear()
        del dataDict    
    
if __name__ == "__main__":
    # testUser = ds.userCreate(
    #     user_name="testuser4",
    #     first_name="Test",
    #     last_name="User",
    #     email="testuser4@example.com",
    #     phone="555-555-5555",
    #     role="user",
    #     pwd="TestPassword123!"
    # )


    userService = Users()
    # res = userService.createUser(testUser)
    result = userService.userLogin("TestPasswo3!","testuser4@example.com")

    print(result)