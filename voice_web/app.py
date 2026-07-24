import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, render_template
import numpy as np
import soundfile as sf
import requests
import asyncio
import edge_tts
import uuid
from pydub import AudioSegment

app = Flask(__name__, static_folder="static")

os.makedirs("static", exist_ok=True)

samplerate = 16000

COHERE_API_KEY = os.environ.get("COHERE_API_KEY", "ضعي_مفتاحك_هنا")

COHERE_TRANSCRIBE_URL = "https://api.cohere.com/v2/audio/transcriptions"
COHERE_TRANSCRIBE_MODEL = "cohere-transcribe-arabic-07-2026"

COHERE_CHAT_URL = "https://api.cohere.com/v2/chat"
COHERE_CHAT_MODEL = "command-a-plus-05-2026"

TTS_VOICE = "ar-SA-ZariyahNeural"


def speech_to_text():
    with open("input.wav", "rb") as audio_file:
        response = requests.post(
            COHERE_TRANSCRIBE_URL,
            headers={
                "Authorization": f"Bearer {COHERE_API_KEY}"
            },
            data={
                "model": COHERE_TRANSCRIBE_MODEL,
                "language": "ar"
            },
            files={
                "file": ("input.wav", audio_file, "audio/wav")
            }
        )

    if response.status_code != 200:
        raise Exception(f"Cohere API Error ({response.status_code}): {response.text}")

    result = response.json()
    # الاستجابة العادية بتكون فيها الحقل "text" مباشرة
    text = result.get("text", "")
    return text.strip()


def generate_reply(messages_history):
    """
    ترسل تاريخ المحادثة كامل (system + كل الرسائل السابقة) لنموذج Cohere
    وترجع رد النص. الذاكرة هنا مبنية على كل الرسائل المرسلة من الواجهة.
    """
    system_message = {
        "role": "system",
        "content": (
            "أنت مساعد ذكي، تتكلم مع المستخدم بأسلوب طبيعي وعفوي زي ما يتكلم "
            "شخص عادي بالعامية السعودية أو الخليجية، مو بأسلوب رسمي .\n\n"
            "قواعد مهمة:\n"
            "- لا تعتذري أو تكرري عبارات زي 'أعتذر عن سوء الفهم' أو 'آسف على الإزعاج' إلا لو المستخدم فعليًا انزعج من شي أنتِ سويتيه.\n"
            "- لو المستخدم قال كلام غريب أو غير واضح (يمكن بسبب خطأ بتحويل الصوت لنص)، اسأليه مباشرة ووضحي وش فهمتيه، بدون اعتذار مبالغ فيه.\n"
            "- لو المستخدم متضايق أو يهزر أو يعلق بشكل ساخر، تفاعلي معه بطبيعية وخفة دم، مب بجفاف أو بتكرار نفس الجملة.\n"
            "- ردودك تكون مختصرة ومباشرة، ما تكررين نفس الصياغة كل مرة.\n"
            "- تذكري كل المحادثة السابقة وما تتعاملين مع كل رسالة كإنها أول مرة.\n"
            "- ما تسألين 'كيف يمكنني مساعدتك اليوم؟' إلا إذا فعلاً ما فيه سياق واضح للمحادثة."
        )
    }

    response = requests.post(
        COHERE_CHAT_URL,
        headers={
            "Authorization": f"Bearer {COHERE_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": COHERE_CHAT_MODEL,
            "messages": [system_message] + messages_history
        }
    )

    if response.status_code != 200:
        raise Exception(f"Cohere Chat API Error ({response.status_code}): {response.text}")

    result = response.json()

    content_blocks = result["message"]["content"]
    reply_text = ""
    for block in content_blocks:
        if block.get("type") == "text":
            reply_text = block.get("text", "")
            break

    return reply_text.strip()


def text_to_speech(text, output_path="static/reply.mp3", max_retries=3):
 
    async def _generate():
        communicate = edge_tts.Communicate(text, TTS_VOICE)
        await communicate.save(output_path)

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            asyncio.run(_generate())
            return output_path
        except Exception as e:
            last_error = e
            print(f"⚠️ محاولة {attempt}/{max_retries} فشلت بالـ TTS: {e}")

    raise Exception(f"فشل تحويل النص لصوت بعد {max_retries} محاولات: {last_error}")


def convert_to_wav(input_path, output_path="input.wav"):
   
    audio = AudioSegment.from_file(input_path)
    audio = audio.set_frame_rate(samplerate).set_channels(1)
    audio.export(output_path, format="wav")

    data, sr = sf.read(output_path)
    data = data.astype(np.float32)

    max_val = np.max(np.abs(data))
    if max_val > 0:
        data = data / max_val

    sf.write(output_path, data, sr)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "لا يوجد ملف صوت"}), 400

    audio_file = request.files["audio"]
    raw_path = "raw_input.webm"
    audio_file.save(raw_path)

    try:
        convert_to_wav(raw_path, "input.wav")
        text = speech_to_text()
        return jsonify({"text": text})
    except Exception as e:
        print("❌ Whisper Error:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()

    if not data or "history" not in data or not data["history"]:
        return jsonify({"error": "لا يوجد نص لإرساله"}), 400

    messages_history = data["history"]

    try:
        reply_text = generate_reply(messages_history)

        audio_path = "static/reply.mp3"
        text_to_speech(reply_text, audio_path)

        return jsonify({
            "reply_text": reply_text,
            "audio_url": f"/static/reply.mp3?v={uuid.uuid4().hex}"
        })

    except Exception as e:
        print("❌ Chat/TTS Error:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)