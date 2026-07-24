# 🤖 Voice AI Assistant

A web-based AI voice assistant that allows users to interact using speech or text.  
The application converts spoken input into text, generates an AI response, and converts the response back into speech.

## Features

- 🎤 Voice recording from the browser
- ✍️ Text input support
- 📝 Speech-to-Text using Whisper
- 🤖 AI responses powered by Cohere
- 🔊 Text-to-Speech response generation
- 💬 Conversation history sidebar
- 🌐 Responsive web interface built with HTML, CSS, and JavaScript
- ⚡ Flask backend for handling AI requests

---

## Technologies Used

- Python
- Flask
- HTML
- CSS
- JavaScript
- OpenAI Whisper
- Cohere API
- gTTS (Google Text-to-Speech)

---

## Project Structure

```
voice_web/
│
├── app.py
├── templates/
│   └── index.html
├── static/
│   ├── style.css
│   └── script.js
├── .gitignore
└── README.md
```

---

## Installation

Create a `.env` file and add your API key:

```env
COHERE_API_KEY=your_api_key_here
```

Run the application:

```bash
python app.py
```

Open your browser and visit:

```
http://127.0.0.1:5000
```

---

## Notes

The following files are generated during runtime and are intentionally excluded from the repository:

- `.env`
- `input.wav`
- `raw_input.webm`
- `reply.mp3`

---

## Demo

The assistant supports both voice and text conversations.

Users can:

1. Speak using the microphone.
2. Convert speech into text.
3. Receive an AI-generated response.
4. Listen to the generated voice reply.
5. View previous conversations in the chat sidebar.

---

## Author

Developed by **aljazi**
