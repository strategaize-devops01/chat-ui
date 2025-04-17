document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const responseArea = document.getElementById('responseArea'); // Get the response area element
    const webhookUrl = 'https://strategaize.app.n8n.cloud/webhook/337d424c-674f-4a19-b009-2f23a0eb3619/chat'; // Your n8n webhook URL

    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();

        if (message) {
            fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message }),
            })
            .then(response => response.text()) // Expecting plain text response from n8n
            .then(data => {
                console.log('Response from n8n:', data);
                responseArea.textContent = data; // Display the response in the response area
                messageInput.value = ''; // Clear the input field after sending
            })
            .catch(error => {
                console.error('Error:', error);
                responseArea.textContent = 'Error sending message.'; // Display an error message to the user
            });
        }
    });

    // Optional: Allow sending the message by pressing Enter key
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendButton.click();
        }
    });
});