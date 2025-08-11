document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const copyBtn = document.getElementById('copyBtn');
  const tempEmailElement = document.getElementById('tempEmail');
  const emailsContainer = document.getElementById('emails');
  const refreshBtn = document.getElementById('refreshBtn');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  const closeModalBtn = document.getElementById('closeModal');
  
  let localPart = '';
  let pollingInterval;
  let emailsData = []; // Store emails data for reference
  
  // Check for existing email in cookies when page loads
  function checkExistingEmail() {
    const savedEmail = getCookie('tempEmail');
    if (savedEmail) {
      tempEmailElement.textContent = savedEmail;
      localPart = savedEmail.split('@')[0];
      copyBtn.disabled = false;
      
      // Start polling for emails
      fetchEmails();
      pollingInterval = setInterval(fetchEmails, 5000);
    }
  }
  
  // Generate temp email
  generateBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/generate', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate email');
      }
      
      const data = await response.json();
      tempEmailElement.textContent = data.email;
      localPart = data.email.split('@')[0];
      
      // Save to cookie (30 days expiration)
      setCookie('tempEmail', data.email, 30);
      
      // Enable copy button
      copyBtn.disabled = false;
      
      // Start polling for emails
      if (pollingInterval) clearInterval(pollingInterval);
      fetchEmails();
      pollingInterval = setInterval(fetchEmails, 5000);
      
      // Show success notification
      showNotification('Email generated successfully!');
      
    } catch (error) {
      console.error('Error generating email:', error);
      showNotification('Failed to generate email. Please try again.', 'error');
    }
  });

  // Delete current email and generate new one
  document.getElementById('deleteBtn').addEventListener('click', () => {
    // Delete cookie
    deleteCookie('tempEmail');
    
    // Clear UI
    tempEmailElement.textContent = '-';
    emailsContainer.innerHTML = '<p class="no-emails">No emails yet. Generate a temporary email to get started.</p>';
    copyBtn.disabled = true;
    
    // Stop polling
    if (pollingInterval) clearInterval(pollingInterval);
    localPart = '';
    emailsData = [];
    
    // Show notification
    showNotification('Email deleted. You can generate a new one.');
  });
  
  // Copy email address
  copyBtn.addEventListener('click', () => {
    const emailText = tempEmailElement.textContent;
    navigator.clipboard.writeText(emailText)
      .then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
        showNotification('Email copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy email', 'error');
      });
  });
  
  // Manual refresh button
  refreshBtn.addEventListener('click', () => {
    if (localPart) {
      // Add spinning animation to refresh button
      refreshBtn.classList.add('spinning');
      
      fetchEmails().finally(() => {
        // Remove spinning animation after fetch completes
        setTimeout(() => {
          refreshBtn.classList.remove('spinning');
        }, 500);
      });
      
      showNotification('Inbox refreshed');
    } else {
      showNotification('No email address generated yet', 'error');
    }
  });

  // Close modal when clicking the close button
  closeModalBtn.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
  });

  // Close modal when clicking outside the content
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('active');
    }
  });
  
  // Fetch emails for the current temp email
  async function fetchEmails() {
    if (!localPart) return;
    
    try {
      const response = await fetch(`/api/emails/${localPart}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }
      
      const emails = await response.json();
      emailsData = emails; // Store emails data
      renderEmails(emails);
      
    } catch (error) {
      console.error('Error fetching emails:', error);
    }
  }
  
  // Render emails in the UI
  function renderEmails(emails) {
    if (!emails || emails.length === 0) {
      emailsContainer.innerHTML = '<p class="no-emails">No emails received yet.</p>';
      return;
    }
    
    emailsContainer.innerHTML = '';
    
    // Sort emails by received time (newest first)
    emails.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    
    emails.forEach((email, index) => {
      const emailElement = document.createElement('div');
      emailElement.className = 'email-item';
      emailElement.setAttribute('data-index', index);
      
      const fromAddress = formatFromAddress(email.from);
      const previewText = getEmailPreview(email.text, email.html);
      
      emailElement.innerHTML = `
        <div class="email-header">
          <div class="email-subject">${escapeHtml(email.subject || 'No Subject')}</div>
          <div class="email-meta">
            <span class="email-from">From: ${escapeHtml(fromAddress)}</span>
            <span class="email-date">${formatDate(new Date(email.receivedAt))}</span>
          </div>
        </div>
        <div class="email-preview">${previewText}</div>
      `;
      
      // Add click event to show full email details
      emailElement.addEventListener('click', () => {
        showEmailDetails(email);
      });
      
      emailsContainer.appendChild(emailElement);
    });
  }

  // Format the from address
  function formatFromAddress(from) {
    if (!from) return 'Unknown';
    
    if (typeof from === 'string') {
      return from;
    }
    
    if (from.address) {
      return from.name ? `${from.name} <${from.address}>` : from.address;
    }
    
    return JSON.stringify(from);
  }

  // Get a preview of the email content
  function getEmailPreview(text, html) {
    if (!text && !html) {
      return '<span class="email-no-content">No content</span>';
    }
    
    if (text === 'Error: Could not extract email content') {
      return '<span class="email-error">Email content could not be extracted</span>';
    }
    
    // Use text content for preview if available
    if (text && text.trim()) {
      const preview = text.trim().substring(0, 100);
      return `<span class="email-text-preview">${escapeHtml(preview)}${preview.length >= 100 ? '...' : ''}</span>`;
    }
    
    // Fall back to stripped HTML content
    if (html) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      const preview = textContent.trim().substring(0, 100);
      return `<span class="email-text-preview">${escapeHtml(preview)}${preview.length >= 100 ? '...' : ''}</span>`;
    }
    
    return '<span class="email-no-content">No content</span>';
  }

  // Show email details in modal
  function showEmailDetails(email) {
    const fromAddress = formatFromAddress(email.from);
    
    // Determine content to display
    let emailContent = '';
    
    // If HTML content is available, use it
    if (email.html && email.html.trim()) {
      emailContent = `
        <div class="email-html-content">
          <iframe id="emailContentFrame" sandbox="allow-same-origin" frameborder="0" width="100%"></iframe>
        </div>
      `;
    } 
    // If text content is available, use it
    else if (email.text && email.text.trim() && email.text !== 'Error: Could not extract email content') {
      emailContent = `
        <div class="email-text-content">
          <pre>${escapeHtml(email.text)}</pre>
        </div>
      `;
    } 
    // If there's an error or no content, show headers
    else {
      emailContent = `
        <div class="email-error-content">
          <p>The email content could not be extracted properly.</p>
          ${email.headers ? `
            <div class="email-headers">
              <h3>Email Headers</h3>
              <div class="headers-container">
                ${Object.entries(email.headers).map(([key, value]) => 
                  `<div class="header-item"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</div>`
                ).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    // Set modal content
    modalContent.innerHTML = `
      <div class="modal-header">
        <h2>${escapeHtml(email.subject || 'No Subject')}</h2>
        <button id="closeModal" class="btn icon-btn"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-meta">
        <div><strong>From:</strong> ${escapeHtml(fromAddress)}</div>
        <div><strong>To:</strong> ${escapeHtml(email.to || tempEmailElement.textContent)}</div>
        <div><strong>Date:</strong> ${formatDate(new Date(email.receivedAt), true)}</div>
      </div>
      <div class="modal-body">
        ${emailContent}
      </div>
    `;
    
    // Show the modal
    modalOverlay.classList.add('active');
    
    // If HTML content, set it to the iframe after the modal is visible
    if (email.html && email.html.trim()) {
      setTimeout(() => {
        const iframe = document.getElementById('emailContentFrame');
        if (iframe) {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          iframeDoc.open();
          
          // Add base styles and sanitize HTML
          iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  padding: 10px;
                  margin: 0;
                }
                img {
                  max-width: 100%;
                  height: auto;
                }
                a {
                  color: #4f46e5;
                }
              </style>
            </head>
            <body>
              ${email.html}
            </body>
            </html>
          `);
          iframeDoc.close();
          
          // Adjust iframe height to content
          iframe.onload = function() {
            iframe.style.height = iframe.contentWindow.document.body.scrollHeight + 'px';
          };
        }
      }, 100);
    }
    
    // Add event listener to the close button
    document.getElementById('closeModal').addEventListener('click', () => {
      modalOverlay.classList.remove('active');
    });
  }
  
  // Helper function to format date
  function formatDate(date, detailed = false) {
    if (detailed) {
      return date.toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // Helper function to escape HTML
  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  // Cookie helper functions
  function setCookie(name, value, days) {
    let expires = '';
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + (value || '') + expires + '; path=/';
  }
  
  function getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }
  
  function deleteCookie(name) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }
  
  // Show notification
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }
  
  // Initialize
  checkExistingEmail();
}); 