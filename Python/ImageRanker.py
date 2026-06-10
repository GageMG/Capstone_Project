from PIL import Image
import torch
from transformers import (BlipProcessor, BlipForConditionalGeneration, pipeline)
import os
import DBConn

class blipRanker():
    def __init__(self):
        self.device = self.selectDevice()
        self.blipProc = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
        self.blipModel = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
        self.blipModel.to(self.device)
        self.clipClassify = pipeline(task="zero-shot-image-classification",model="openai/clip-vit-base-patch32")
        self.db = DBConn.SQLbuilder()
        self.db.connect()

    def selectDevice(self):
        if torch.cuda.is_available():
            device = torch.device('cuda:0')
        elif torch.mps.is_available(): #For a macos Metal Performace Shader
            device = torch.device("mps")
        else:
            device = torch.device("cpu")
        print(f'Using device {device}')
        return device

    def scorePhotos(self, caption: str, kw: dict):
        caption.lower()
        score = 0
        matched = []
        
        for word, points in kw.items():
            if word in caption:
                score += points
                matched.append(word)
        
        score = min(score, 100)

        print(f"keyword_score: {score}, matched_keyword: {matched}")

        return {"keyword_score": score, "matched_keyword": matched}
    
    def captionImg(self, photoID: int, img: str):
        input = self.blipProc(img, return_tensors="pt").to(self.device)

        output = self.blipModel.generate(**input, max_new_tokens= 40)

        capt = self.blipProc.decode(output[0], skip_special_tokens=True)

        print(capt)

    def classifyMood(self, photoID: int, img: str):
        labels = ["a romantic wedding photo","a fun group photo", "a formal ceremony photo",
            "a candid emotional photo", "a photo of food or decorations", "a low quality random photo", "nudity"]
        
        res = self.clipClassify(img, candidate_labels = labels)
        best = res[0]
        print(best)
        return best 
    
    def romanticScorePhotos(self, photoID: int, caption: str):

        keywords = {"bride": 15,
            "groom": 15,
            "couple": 20,
            "kiss": 25,
            "kissing": 25,
            "hugging": 15,
            "dancing": 15,
            "holding hands": 25,
            "wedding": 10,
            "first dance": 30,
            "couple": 10,
            "cutting cake": 15
        }

        """score = 0
        matched = []
        
        for word, points in keywords.items():
            if word in caption:
                score += points
                matched.append(word)
        
        score = min(score, 100)

        print(f"keyword_score: {score}, matched_keyword: {matched}")"""
        score = self.scorePhotos(caption, keywords)
        return score

    
    def analyze(self, eventID):
        photos = self.db.getPhotos(eventID)

        if photos is None:
            return "No photos found"
        
        skippable = ["nudity", "a low quality random photo"]
        results = []
        score = 0

        for photo in photos:
            print(photo)
            caption = self.captionImg(photo["photo_id"], photo["file_path"])
            mood = self.classifyMood(photo["photo_id"], photo["file_path"]) 
            if mood['label'] in skippable:
                score = 0
                print(f"scoring skipped: {mood['label']}")
            else:
                score = self.romanticScorePhotos(photo["photo_id"], photo["file_path"])

def main():
    print(os.getenv("HF_TOKEN"))
    test = blipRanker()
    test.analyze(1)

if __name__ == "__main__":
    main()