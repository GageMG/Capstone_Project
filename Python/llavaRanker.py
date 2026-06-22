import ollama
from pathlib import Path
import json

class llavaTool():
    def __init__(self, modelName: str = "llava:7b"):
        self.modelName = modelName

    def selectMsg(self, userPrompt: str, user: str = "user", filePath: str = None):
        if userPrompt is None:
            raise ValueError("No prompt provided")

        if filePath is not None:
            self.modelName = "llava:7b"
            llavaPrompt =  """
            Analyze this event photo for an image ranking system.

            Return ONLY valid JSON with this exact structure:

            {
            "caption": "one sentence caption",
            "mood_label": "happy",
            "mood_conf_score": 0.0,
            "all_mood_labels": ["happy", "romantic", "celebration"],
            "all_mood_scores": [0.0, 0.0, 0.0],
            "keyword_score": 0.0,
            "keywords": ["wedding", "smiling", "group"],
            "nudity_check": 0
            }

            Rules:
            - caption must be one clear sentence.
            - mood_label should be the strongest label.
            - keyword_score should be from 0 to 10.
            - Higher score means better event photo.
            - Good photos include smiling people, couples, groups, dancing, ceremony, reception, family, celebration, or romantic moments.
            - Low score means blurry, random, empty, object-only, low quality, or not useful.
            - nudity_check must be 1 only if there is explicit nudity, otherwise 0.
            - Do not include markdown.
            - Do not include explanation.
            """
            #content = f'{llavaPrompt}\n\nUser prompt to analyze:\n"""\n{userPrompt}\n"""'
            content = f'{llavaPrompt}'
            return [{"role": user, "content": content, "images": [filePath]}]
        else:
            self.modelName = "llama3.2"
            llavaPrompt = f"""
                You are a text-only prompt intent analyzer.

                Your job is to read the user's prompt and identify what the user wants the model to do.

                Do NOT answer the user's original prompt.
                Only analyze the prompt.

                Return ONLY valid JSON with this exact structure:

                {{
                "intent": "short intent name",
                "task": "specific task being requested",
                "needs_image": false,
                "needs_text_only": true,
                "requested_outputs": ["output1", "output2"],
                "summary": "plain English explanation of what the prompt is asking for",
                "confidence": 0.0
                }}

                Rules:
                - Return only JSON.
                - No markdown.
                - No explanation outside the JSON.
                - Set "needs_image" to true only if the prompt requires an image.
                - Set "needs_text_only" to true if the task can be completed with text alone.
                - "requested_outputs" should list what the prompt wants returned.
                - "confidence" should be a number from 0.0 to 1.0.
                - Do not perform the task. Only classify what the task is asking for.

                User prompt to analyze:
                \"\"\"
                {userPrompt}
                \"\"\"
                """
            return [{"role": user, "content": llavaPrompt}]

    def sendPrompt(self, role: str, prompt: str, filePath=None):
        try:
            message = self.selectMsg(prompt, user=role, filePath=filePath)
            res = ollama.chat(
                model=self.modelName,
                messages=message,
                format="json",
                options={"temperature": 0},
            )
            rawText = res["message"]["content"]

            data = json.loads(rawText)
            return data

        except json.JSONDecodeError as e:
            print(f"JSON parse error for photo_id {filePath}: {e}")
            print(f"Raw output was: {rawText!r}")
            return None
        except Exception as e:
            print(f"LLaVA analysis error for photo_id {filePath}: {e}")
            return None

    # def sendPromptBatch(self, role: str, prompt: str, filePaths: list[str]):
        
    #     results = {}
    #     for filePath in filePaths:
    #         print(f"Processing: {filePath}")
    #         result = self.sendPrompt(role, prompt, filePath=filePath)
    #         results[filePath] = result
    #     return results
    
    def sendPromptBatch(self, eventType: str, photo_id: int, file_path: str):
        if photo_id is None:
            print("Missing photo_id")
            return None

        if not file_path:
            print(f"Missing file path for photo_id {photo_id}")
            return None

        file_path = str(Path(file_path))

        if not Path(file_path).is_file():
            print(f"LLaVA analysis error for photo_id {photo_id}: invalid image path: {file_path}")
            return None

        prompt = f"""
Analyze this photo from a {eventType} event.

Decide whether this photo is useful for a storyboard or slideshow for this specific event.

The goal is to identify what part of the event this photo belongs to.
For the "keywords" field, include scene-setting labels when appropriate, such as:
- ceremony
- reception
- cocktail hour
- professional photos
- group photo
- couple photo
- family photo
- dancing
- dinner
- speeches
- decorations
- candid moment
- venue
- guest moment

Return ONLY valid JSON with this exact structure:
{{
    "caption": "short caption",
    "scene_type": "scene label",
    "mood": "mood label",
    "keywords": ["keyword1", "keyword2"],
    "is_useful_for_storyboard": true
}}

Rules:
- "caption" should be one short sentence.
- "scene_type" should describe the event moment, such as "Ceremony", "Reception", "Cocktail Hour", "Professional Photos", "Candid Moment", or "General Event Moment".
- "mood" should be a short label, such as "happy", "formal", "romantic", "celebratory", "calm", or "unclear".
- "keywords" should contain 2 to 6 useful storyboard keywords.
- "is_useful_for_storyboard" must be true or false.
- Use lowercase true/false because this must be valid JSON.
- Do not return markdown.
- Do not explain the answer outside the JSON.
- Do not include any information other then the json
"""

        try:
            response = ollama.chat(
                model=self.modelName,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                        "images": [file_path]
                    }
                ]
            )

            print(f"LLaVA result for photo_id {photo_id}:")
            print(response)

            return {
                "photo_id": photo_id,
                "file_path": file_path,
                "response": response
            }

        except Exception as e:
            print(f"LLaVA analysis error for photo_id {photo_id}: {e}")
            return None

def main():
    prompt = "Add addtional details that help descibe facial mood in the photos"

    photo_dir = Path(r"C:\CSI4999\Photos")
    photo_paths = [str(p) for p in photo_dir.glob("*.jpg")]

    tool = llavaTool()
    results = tool.sendPromptBatch("user", prompt, photo_paths)

    for path, data in results.items():
        print(f"\n--- {path} ---")
        print(json.dumps(data, indent=2) if data else "FAILED")


if __name__ == "__main__":
    main()