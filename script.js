document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesContainer = document.getElementById('messagesContainer');
    const webhookUrl = 'https://strategaize.app.n8n.cloud/webhook/chat-ui';

    const sessionId = localStorage.getItem('chatSessionId') || (() => {
        const newId = crypto.randomUUID?.() || Date.now().toString();
        localStorage.setItem('chatSessionId', newId);
        return newId;
    })();

    const loadChatHistory = () => JSON.parse(localStorage.getItem('chatHistory') || '[]');
    const saveChatHistory = (history) => localStorage.setItem('chatHistory', JSON.stringify(history));
    let chatHistory = loadChatHistory();

    const scrollToBottom = () => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    function createMessageElement(content, sender = 'bot') {
        const messageEl = document.createElement('div');
        messageEl.classList.add('message', sender);

        const avatar = document.createElement('div');
        avatar.classList.add('avatar', sender);
        messageEl.appendChild(avatar);

        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('content');
        contentWrapper.innerHTML = sender === 'bot' ? marked.parse(content) : content;
        messageEl.appendChild(contentWrapper);

        const timestamp = document.createElement('div');
        timestamp.classList.add('timestamp');
        timestamp.textContent = new Date().toLocaleTimeString();
        messageEl.appendChild(timestamp);

        messagesContainer.appendChild(messageEl);
        scrollToBottom();

        chatHistory.push({ sender, content, timestamp: new Date().toLocaleTimeString() });
        saveChatHistory(chatHistory);
    }

    function showLoading() {
        const loading = document.createElement('div');
        loading.classList.add('message', 'bot', 'loading');
        loading.setAttribute('id', 'loadingMessage');

        const avatar = document.createElement('div');
        avatar.classList.add('avatar', 'bot');
        loading.appendChild(avatar);

        const dots = document.createElement('div');
        dots.textContent = 'Thinking...';
        loading.appendChild(dots);

        messagesContainer.appendChild(loading);
        scrollToBottom();
    }

    function hideLoading() {
        const loadingEl = document.getElementById('loadingMessage');
        if (loadingEl) loadingEl.remove();
    }

    function createChartMessageWithOverlay(thumbnailSrc, fullSrc, description = '') {
        const chartImg = document.createElement('img');
        chartImg.src = thumbnailSrc;
        chartImg.classList.add('chart-outside');
        messagesContainer.appendChild(chartImg);

        const descriptionText = document.createElement('div');
        descriptionText.classList.add('chart-description');
        descriptionText.innerHTML = marked.parse(description);
        messagesContainer.appendChild(descriptionText);

        scrollToBottom();

        chatHistory.push({
            sender: 'bot',
            content: `<img src="${thumbnailSrc}" />`,
            timestamp: new Date().toLocaleTimeString()
        });
        saveChatHistory(chatHistory);
    }

    function sendMessage(message) {
        createMessageElement(message, 'user');
        showLoading();

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatInput: message, sessionId })
        })
        .then(res => res.json())
        .then(data => {
            hideLoading();
            if (!data || !data.output) {
                createMessageElement('No response received.', 'bot');
                return;
            }

            if (typeof data.output === 'object' && data.output.chartThumbnail) {
                createChartMessageWithOverlay(
                    data.output.chartThumbnail,
                    data.output.chartFull,
                    data.output.chartDescription || ''
                );
            } else {
                createMessageElement(data.output, 'bot');
            }
        })
        .catch(err => {
            hideLoading();
            console.error(err);
            createMessageElement('Something went wrong.', 'bot');
        });
    }

    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (!message) return;
        messageInput.value = '';
        sendMessage(message);
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendButton.click();
    });

    chatHistory.forEach(m => createMessageElement(m.content, m.sender));
});
