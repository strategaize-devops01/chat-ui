document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const responseArea = document.getElementById('responseArea');

    const webhookUrl = 'https://strategaize.app.n8n.cloud/webhook/chat-ui';

    // 🔁 Generate or load persistent sessionId
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
        sessionId = crypto.randomUUID?.() || 'session-' + Date.now();  // Use UUID if available
        localStorage.setItem('sessionId', sessionId);
    }

    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();

        if (message) {
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
            .then(response => response.text())
            .then(data => {
                console.log('Response from n8n:', data);
                responseArea.textContent = data;
                messageInput.value = '';
            })
            .catch(error => {
                console.error('Error:', error);
                responseArea.textContent = 'Error sending message.';
            });
        }
    });

    // Send on Enter key
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendButton.click();
        }
    });
});
