import torch
import pyiqa
import os
from pathlib import Path

class NimaScorer:
    def __init__(self, model_name: str = 'nima-spaq'):
        self.hf_token = os.getenv("HF_TOKEN")
        os.environ["HF_TOKEN"] = self.hf_token
        self.device = self.selectDevice()
        self.model = pyiqa.create_metric(model_name, device=self.device)

    def selectDevice(self):
        if torch.cuda.is_available():
            device = torch.device('cuda:0')
        elif torch.mps.is_available(): #For a macos Metal Performace Shader
            device = torch.device("mps")
        else:
            device = torch.device("cpu")
        print(f'Using device {device}')
        return device
    
    @torch.inference_mode()
    def score(self, img) -> float:
        result= self.model(str(Path(img)))
        return float(result)

if __name__ == "__main__":
    scorer = NimaScorer()

    folder = Path(r"C:\CSI4999\Photos")
    extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

    images = [
        path for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in extensions
    ]

    results = []  # list of (image_path, score) tuples

    for image in images:
        try:
            score = scorer.score(image)
            results.append((image, score))
        except Exception as error:
            print(f"ERROR | {image.name} | {error}")

    results.sort(key=lambda item: item[1], reverse=True)

    for image, score in results:
        print(f"{score:5.2f} | {image.name}")