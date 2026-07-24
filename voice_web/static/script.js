const robotEl = document.querySelector(".robot");
const waveEl = document.querySelector(".wave");
const replyTitleEl = document.getElementById("replyTitle");
const replyTextEl = document.getElementById("replyText");
const historyBtn = document.getElementById("historyBtn");
const micBtn = document.getElementById("micBtn");
const chatSidebar = document.getElementById("chatSidebar");
const closeChatBtn = document.getElementById("closeChatBtn");
const chatMessagesEl = document.getElementById("chatMessages");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const text = textInput.value.trim();


let conversationHistory = [];
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentAudio = null;


historyBtn.addEventListener("click", () => {
    openSidebar();
});

closeChatBtn.addEventListener("click", () => {
    closeSidebar();
});

sidebarOverlay.addEventListener("click", () => {
    closeSidebar();
});

function openSidebar() {
    renderChatMessages();
    chatSidebar.classList.add("open");
    sidebarOverlay.classList.add("show");
}

function closeSidebar() {
    chatSidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
}


function renderChatMessages() {

    chatMessagesEl.innerHTML = "";

    conversationHistory.forEach((message) => {
        const bubble = document.createElement("div");

        bubble.className = "chat-msg " + message.role;
        bubble.textContent = message.content;

        chatMessagesEl.appendChild(bubble);
    });

    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

/**
 * تعرض رسالة داخل صندوق الرد (العنوان + النص).
 * @param {string} title - العنوان اللي يظهر فوق (مثلاً اسم المتكلم أو حالة).
 * @param {string} text - النص الأساسي للرسالة.
 */
function showReply(title, text) {
    replyTitleEl.textContent = title;
    replyTextEl.textContent = text;
}

/**
 * تعرض رسالة خطأ داخل صندوق الرد بشكل واضح للمستخدم.
 * @param {string} message - نص الخطأ.
 */
function showError(message) {
    showReply("⚠️ حدث خطأ", message);
}

function startTalkingAnimation() {
    waveEl.classList.add("talking");
}

function stopTalkingAnimation() {
    waveEl.classList.remove("talking");
}

micBtn.addEventListener("click", async () => {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
});


async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        mediaRecorder = new MediaRecorder(stream);

        audioChunks = [];

        mediaRecorder.addEventListener("dataavailable", (event) => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener("stop", handleRecordingStopped);

        mediaRecorder.start();

        isRecording = true;
        micBtn.classList.add("recording");
        showReply("🔴 جاري التسجيل...", "اضغطي المايك مرة ثانية للإيقاف والإرسال.");

    } catch (error) {
        console.error("خطأ أثناء فتح الميكروفون:", error);
        showError("ما قدرنا نوصل للميكروفون. تأكدي من إعطاء الإذن للمتصفح.");
    }
}


function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        micBtn.classList.remove("recording");
    }
}

async function handleRecordingStopped() {
    showReply("⏳ لحظة...", "جاري تحويل الصوت إلى نص.");

    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

    await sendAudioToServer(audioBlob);
}


/**
 * ترسل ملف الصوت لمسار /api/transcribe وتستقبل النص المحول.
 * @param {Blob} audioBlob - الملف الصوتي المسجل.
 */
async function sendAudioToServer(audioBlob) {
    // FormData يسمح لنا نرسل ملفات عبر fetch بسهولة
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    try {
        const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.error) {
            showError(data.error);
            return;
        }

        const userText = data.text;

        conversationHistory.push({
            role: "user",
            content: userText
        });

        renderChatMessages();
        await sendTextToLLM();

    } catch (error) {
        console.error("خطأ أثناء تحويل الصوت لنص:", error);
        showError("صار خطأ أثناء تحويل الصوت إلى نص. حاولي مرة ثانية.");
    }
}

textInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        handleTextSubmit();
    }
});

async function handleTextSubmit() {
    const text = textInput.value.trim();

    if (!text) {
        return;
    }

    textInput.value = "";

    conversationHistory.push({
        role: "user",
        content: text
    });

    showReply("you:", text);

    renderChatMessages();
    await sendTextToLLM();
}


async function sendTextToLLM() {
    showReply("🤔 جاري التفكير...", "لحظة وبيوصلك الرد.");

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                history: conversationHistory
            })
        });

        const data = await response.json();

        if (data.error) {
            showError(data.error);
            return;
        }

        const replyText = data.reply_text;
        const audioUrl = data.audio_url;

        conversationHistory.push({
            role: "assistant",
            content: replyText
        });

        showReply("", replyText);

        renderChatMessages();

        createPlayButton(audioUrl);

    } catch (error) {
        console.error("خطأ أثناء توليد الرد:", error);
        showError("صار خطأ أثناء توليد الرد. حاولي مرة ثانية.");
    }
}



/**
 * تنشئ زر "🔊 تشغيل الرد" وتضيفه تحت صندوق الرد.
 * عند الضغط عليه، يتم تشغيل الصوت الناتج من /api/chat.
 * @param {string} audioUrl - رابط ملف الصوت اللي رجعه السيرفر.
 */
function createPlayButton(audioUrl) {

    const oldButton = document.getElementById("playReplyBtn");
    if (oldButton) {
        oldButton.remove();
    }

    const playButton = document.createElement("button");
    playButton.id = "playReplyBtn";
    playButton.className = "icon-btn";
    playButton.textContent = "🔊";

    playButton.addEventListener("click", () => {
        playAudio(audioUrl);
    });

    replyTextEl.insertAdjacentElement("afterend", playButton);
}

/**
 * تشغل ملف صوتي معين وتتحكم بحركة فم الروبوت أثناء التشغيل.
 * @param {string} url - رابط ملف الصوت.
 */
function playAudio(url) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        stopTalkingAnimation();
    }

    currentAudio = new Audio(url);

    currentAudio.addEventListener("play", () => {
        startTalkingAnimation();
    });

    currentAudio.addEventListener("ended", () => {
        stopTalkingAnimation();
    });

    currentAudio.addEventListener("error", () => {
        stopTalkingAnimation();
        showError("ما قدرنا نشغل ملف الصوت.");
    });

    currentAudio.play();
}
