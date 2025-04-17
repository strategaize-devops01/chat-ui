document.addEventListener('DOMContentLoaded', () => {
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const responseArea = document.getElementById('responseArea');
  const webhookUrl = 'https://strategaize.app.n8n.cloud/webhook/chat-ui';

  sendButton.addEventListener('click', () => {
    const message = messageInput.value.trim();

    if (message) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })
      .then(response => response.text())
      .then(data => {
        // If response is a QuickChart URL, show it as an image
        if (data.startsWith('https://quickchart.io/chart')) {
          responseArea.innerHTML = `<img src="${data}" alt="Chart" style="max-width: 100%;">`;
        } else {
          responseArea.textContent = data;
        }
        messageInput.value = '';
      })
      .catch(error => {
        console.error('Error:', error);
        responseArea.textContent = 'Error sending message.';
      });
    }
  });

  messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      sendButton.click();
    }
  });
});
