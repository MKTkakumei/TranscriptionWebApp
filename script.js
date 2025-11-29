class TranscriptionApp {
    constructor() {
        this.recognition = null;
        this.isRecording = false;

        // DOM Elements
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
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

        // Recognition Events
        this.recognition.onstart = () => {
            this.isRecording = true;
            this.updateUI(true);
            this.statusEl.textContent = '聞き取っています...';
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                // If it stopped but we didn't click stop (e.g. silence), restart it
                try {
                    this.recognition.start();
                } catch (e) {
                    console.log('Restarting recognition...');
                }
            } else {
                this.updateUI(false);
                this.statusEl.textContent = '文字起こし準備完了';
                this.removeInterimDiv();
            }
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                this.removeInterimDiv();
                this.addLogEntry(finalTranscript);
            }

            if (interimTranscript) {
                this.updateInterimDiv(interimTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            if (event.error === 'not-allowed') {
                alert('マイクへのアクセスが拒否されました。マイクの使用を許可してください。');
                this.stopRecording();
            }
        };
    }

    startRecording() {
        if (this.isRecording) return;

        // Clear placeholder if it exists
        const placeholder = this.logArea.querySelector('.placeholder-text');
        if (placeholder) {
            placeholder.remove();
        }

        try {
            this.recognition.start();
        } catch (e) {
            console.error(e);
        }
    }

    stopRecording() {
        this.isRecording = false;
        this.recognition.stop();
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
        timeSpan.textContent = `[${this.getFormattedDate()}]`;

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
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    new TranscriptionApp();
});
