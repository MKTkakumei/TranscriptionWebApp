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
        this.setupVisibilityDetection();
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
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        // Load speaker name from local storage
        const savedName = localStorage.getItem('speakerName');
        if (savedName) {
            this.speakerInput.value = savedName;
        }

        // Event Listeners
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.downloadBtn.addEventListener('click', () => this.downloadLog());

        // Speaker input validation and persistence
        this.speakerInput.addEventListener('input', () => {
            localStorage.setItem('speakerName', this.speakerInput.value);
            this.validateInput();
        });

        // Initial validation
        this.validateInput();

        // Recognition Events
        this.recognition.onstart = () => {
            this.isRecording = true;
            this.updateUI(true);
            this.updateStatus();
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                // Immediate restart for fastest response
                try {
                    this.recognition.start();
                } catch (e) {
                    console.log('Restarting recognition failed:', e);
                }
            } else {
                this.updateUI(false);
                this.statusEl.textContent = '文字起こし準備完了';
                this.statusEl.classList.remove('warning');
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
                this.addLogEntry(finalTranscript);
                this.removeInterimDiv();
            } else if (interimTranscript) {
                this.updateInterimDiv(interimTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            // Ignore non-fatal errors silently
            if (event.error === 'no-speech' || event.error === 'network' || event.error === 'aborted') {
                return;
            }

            console.error('Speech recognition error', event.error);

            if (event.error === 'not-allowed') {
                alert('マイクへのアクセスが拒否されました。マイクの使用を許可してください。');
                this.stopRecording();
            } else {
                // For other errors, try to keep going if recording
                if (this.isRecording) {
                    this.statusEl.textContent = 'エラー発生、再試行中...';
                }
            }
        };
    }

    validateInput() {
        // No longer disabling button, validation happens on click
        const name = this.speakerInput.value.trim();
        if (!name) {
            this.startBtn.title = "話者名を入力してください";
        } else {
            this.startBtn.title = "";
        }
    }

    startSilentAudio() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.value = 100;
        gainNode.gain.value = 0; // Silent

        oscillator.start();
        console.log("Background workaround: Silent audio started");
    }

    setupVisibilityDetection() {
        document.addEventListener('visibilitychange', () => {
            if (this.isRecording) {
                this.updateStatus();
            }
        });
    }

    updateStatus() {
        if (document.hidden) {
            this.statusEl.textContent = '⚠️ タブがバックグラウンドです。精度が低下する可能性があります';
            this.statusEl.classList.add('warning');
        } else {
            this.statusEl.textContent = '聞き取っています...';
            this.statusEl.classList.remove('warning');
        }
    }

    startRecording() {
        if (this.isRecording) return;

        // Final check for speaker name
        if (!this.speakerInput.value.trim()) {
            alert('話者名を入力してください。');
            this.speakerInput.focus();
            return;
        }

        // Clear placeholder if it exists
        const placeholder = this.logArea.querySelector('.placeholder-text');
        if (placeholder) {
            placeholder.remove();
        }

        this.isRecording = true;
        this.startSilentAudio(); // Start silent audio to keep tab active

        try {
            this.recognition.start();
        } catch (e) {
            console.error(e);
            this.isRecording = false;
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
        this.speakerInput.disabled = isRecording; // Disable input while recording

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
            this.interimDiv.style.opacity = '0.7';
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
