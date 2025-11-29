class TranscriptionApp {
    constructor() {
        this.recognition = null;
        this.isRecording = false;

        // DOM Elements
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.speakerInput = document.getElementById('speakerName');
        this.statusEl = document.getElementById('status');
        this.logArea = document.getElementById('transcriptionLog');

        // Interim result element
        this.interimDiv = null;

        this.init();
    }

    init() {
        // Check browser support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('お使いのブラウザはWeb Speech APIをサポートしていません。Google Chromeをご利用ください。');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        // Configuration
        this.recognition.lang = 'ja-JP';
        this.recognition.continuous = true;
        this.recognition.interimResults = true; // Enable interim results for "Zoom-like" speed

        // Event Listeners
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.downloadBtn.addEventListener('click', () => this.downloadLog());

        // Recognition Events
        this.recognition.onstart = () => {
            this.isRecording = true;
            this.updateUI(false);
            this.removeInterimDiv();
        }

        updateUI(isRecording) {
            this.startBtn.disabled = isRecording;
            this.stopBtn.disabled = !isRecording;

            if (isRecording) {
                document.body.classList.add('recording');
            } else {
                document.body.classList.remove('recording');
            }
        }

        getFormattedDate() {
            const now = new Date();
            const days = ['日', '月', '火', '水', '木', '金', '土'];
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const date = now.getDate();
            const day = days[now.getDay()];
            const time = now.toLocaleTimeString('ja-JP', { hour12: false });

            return `${year}/${month}/${date}(${day}) ${time}`;
        }

        addLogEntry(text) {
            if (!text.trim()) return;

            const entryDiv = document.createElement('div');
            entryDiv.className = 'log-entry';

            const timeSpan = document.createElement('span');
            timeSpan.className = 'timestamp';

            const speakerName = this.speakerInput.value.trim();
            const namePart = speakerName ? `[${speakerName}] ` : '';

            timeSpan.textContent = `[${this.getFormattedDate()}] ${namePart}`;

            const textDiv = document.createElement('div');
            textDiv.className = 'text';
            textDiv.textContent = text;

            entryDiv.appendChild(timeSpan);
            entryDiv.appendChild(textDiv);

            this.logArea.appendChild(entryDiv);
            this.scrollToBottom();
        }

        updateInterimDiv(text) {
            if (!this.interimDiv) {
                this.interimDiv = document.createElement('div');
                this.interimDiv.className = 'log-entry interim';
                this.interimDiv.style.opacity = '0.7'; // Visual cue for interim
                this.logArea.appendChild(this.interimDiv);
            }
            this.interimDiv.textContent = text;
            this.scrollToBottom();
        }

        removeInterimDiv() {
            if (this.interimDiv) {
                this.interimDiv.remove();
                this.interimDiv = null;
            }
        }

        scrollToBottom() {
            this.logArea.scrollTop = this.logArea.scrollHeight;
        }

        downloadLog() {
            const entries = this.logArea.querySelectorAll('.log-entry:not(.interim)');
            if (entries.length === 0) {
                alert('保存するログがありません。');
                return;
            }

            let content = '';
            entries.forEach(entry => {
                const timeAndName = entry.querySelector('.timestamp').textContent;
                const text = entry.querySelector('.text').textContent;
                content += `${timeAndName} ${text}\n`;
            });

            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const date = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const fileName = `transcription_${year}${month}${date}_${hours}${minutes}.txt`;

            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    new TranscriptionApp();
});
