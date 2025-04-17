document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesContainer = document.getElementById('messagesContainer');
    const webhookUrl = 'https://strategaize.app.n8n.cloud/webhook/chat-ui';

    // Generate a unique session ID once per user session
    const sessionId = localStorage.getItem('chatSessionId') || (() => {
        const id = crypto.randomUUID?.() || Date.now().toString();
        localStorage.setItem('chatSessionId', id);
        return id;
    })();

    function createMessageElement(content, sender = 'bot') {
        const messageEl = document.createElement('div');
        messageEl.classList.add('message', sender);

        const avatar = document.createElement('div');
        avatar.classList.add('avatar', sender);
        messageEl.appendChild(avatar);

        if (sender === 'bot') {
            messageEl.innerHTML += marked.parse(content); // Append content after avatar
        } else {
            messageEl.innerHTML += content; // Append content after avatar
        }

        const timestamp = document.createElement('div');
        timestamp.classList.add('timestamp');
        timestamp.textContent = new Date().toLocaleTimeString();

        messageEl.appendChild(timestamp);
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function showLoading() {
        const loadingEl = document.createElement('div');
        loadingEl.classList.add('message', 'bot', 'loading');
        loadingEl.setAttribute('id', 'loadingMessage');

        const avatar = document.createElement('div');
        avatar.classList.add('avatar', 'bot');
        loadingEl.appendChild(avatar);

        loadingEl.innerHTML += 'Thinking...';
        messagesContainer.appendChild(loadingEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function hideLoading() {
        const loadingEl = document.getElementById('loadingMessage');
        if (loadingEl) loadingEl.remove();
    }

    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (!message) return;

        // Add user message
        createMessageElement(message, 'user');
        messageInput.value = '';

        // Show loading animation
        showLoading();

        // Send message to webhook
        fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chatInput: message,
                sessionId: sessionId
            }),
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            if (data.output) {
                createMessageElement(data.output, 'bot');
            } else {
                createMessageElement('No response received.', 'bot');
            }
        })
        .catch(err => {
            console.error('Error:', err);
            hideLoading();
            createMessageElement('Something went wrong.', 'bot');
        });
    });

    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendButton.click();
        }
    });
});
