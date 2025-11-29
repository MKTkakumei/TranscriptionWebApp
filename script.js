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

        // Merge Elements
        this.logUpload = document.getElementById('logUpload');
        this.mergeBtn = document.getElementById('mergeBtn');
        this.fileList = document.getElementById('fileList');
        this.clearFilesBtn = document.getElementById('clearFilesBtn');

        // State
        this.selectedFiles = [];

        // Interim result element
        this.interimDiv = null;

        // Duplicate prevention state
        this.lastLogContent = '';
        this.lastLogTime = 0;

        // Mobile detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
        // Disable interim results on mobile to prevent double display issue
        this.recognition.interimResults = !this.isMobile;
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

        // Merge Event Listeners
        this.logUpload.addEventListener('change', (e) => this.handleFileSelect(e));
        this.mergeBtn.addEventListener('click', () => this.mergeLogs());
        this.clearFilesBtn.addEventListener('click', () => this.clearFiles());

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
            } else if (interimTranscript && !this.isMobile) {
                // Only show interim results on non-mobile devices
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

        const now = Date.now();

        // 1. Exact duplicate prevention (within 2 seconds)

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

    handleFileSelect(event) {
        const newFiles = Array.from(event.target.files);

        newFiles.forEach(file => {
            // Check for duplicates based on name and size
            const isDuplicate = this.selectedFiles.some(f =>
                f.name === file.name && f.size === file.size
            );

            if (!isDuplicate) {
                this.selectedFiles.push(file);
            }
        });

        // Reset input so same file can be selected again if it was removed
        this.logUpload.value = '';

        this.updateFileList();
    }

    updateFileList() {
        this.fileList.innerHTML = '';

        if (this.selectedFiles.length === 0) {
            const emptyMsg = document.createElement('li');
            emptyMsg.className = 'empty-list-message';
            emptyMsg.textContent = 'ファイルが選択されていません';
            this.fileList.appendChild(emptyMsg);
            this.mergeBtn.disabled = true;
            return;
        }

        this.selectedFiles.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'file-name';
            nameSpan.textContent = file.name;
            nameSpan.title = file.name; // Tooltip for long names

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file-btn';
            removeBtn.innerHTML = '×';
            removeBtn.title = '削除';
            removeBtn.onclick = () => this.removeFile(index);

            li.appendChild(nameSpan);
            li.appendChild(removeBtn);
            this.fileList.appendChild(li);
        });

        this.mergeBtn.disabled = false;
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFileList();
    }

    clearFiles() {
        this.selectedFiles = [];
        this.updateFileList();
    }

    async mergeLogs() {
        if (this.selectedFiles.length === 0) return;

        this.mergeBtn.disabled = true;
        this.mergeBtn.textContent = '統合中...';

        try {
            const allEntries = [];

            for (let i = 0; i < this.selectedFiles.length; i++) {
                const text = await this.selectedFiles[i].text();
                const entries = this.parseLogFile(text);
                allEntries.push(...entries);
            }

            // Sort by timestamp
            allEntries.sort((a, b) => a.date - b.date);

            // Generate merged content
            const mergedContent = allEntries.map(entry => {
                return `${entry.rawTimestamp} ${entry.content}`;
            }).join('\n');

            this.downloadMergedLog(mergedContent);

        } catch (error) {
            console.error('Log merge failed:', error);
            alert('ログの統合に失敗しました。ファイル形式を確認してください。');
        } finally {
            this.mergeBtn.disabled = false;
            this.mergeBtn.innerHTML = '<span class="icon">💾</span> 統合して保存';
        }
    }

    parseLogFile(text) {
        const lines = text.split('\n');
        const entries = [];
        // Regex to match timestamp: [YYYY/MM/DD(Day) HH:MM:SS]
        // Example: [2023/11/29(土) 18:30:00] [Speaker] Text
        const timestampRegex = /^\[(\d{4}\/\d{1,2}\/\d{1,2}\(.\) \d{1,2}:\d{2}:\d{2})\] (.*)$/;

        lines.forEach(line => {
            const match = line.match(timestampRegex);
            if (match) {
                const rawTimestamp = `[${match[1]}]`;
                const content = match[2];

                // Parse date for sorting
                // Remove day of week for parsing: 2023/11/29(土) 18:30:00 -> 2023/11/29 18:30:00
                const dateStr = match[1].replace(/\(.\)/, '');
                const date = new Date(dateStr);

                entries.push({
                    date: date,
                    rawTimestamp: rawTimestamp,
                    content: content
                });
            }
        });

        return entries;
    }

    downloadMergedLog(content) {
        if (!content) {
            alert('統合されたログが空です。');
            return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const fileName = `merged_transcription_${year}${month}${date}_${hours}${minutes}.txt`;

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
