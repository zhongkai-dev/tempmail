document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const copyBtn = document.getElementById('copyBtn');
  const tempEmailElement = document.getElementById('tempEmail');
  const emailsContainer = document.getElementById('emails');
  const refreshBtn = document.getElementById('refreshBtn');
  
  let localPart = '';
  let pollingInterval;
  
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
  
  // Fetch emails for the current temp email
  async function fetchEmails() {
    if (!localPart) return;
    
    try {
      const response = await fetch(`/api/emails/${localPart}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }
      
      const emails = await response.json();
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
    
    emails.forEach(email => {
      const emailElement = document.createElement('div');
      emailElement.className = 'email-item';
      
      const fromAddress = typeof email.from === 'string' ? email.from : 
                         (email.from.address ? `${email.from.name || ''} <${email.from.address}>` : 'Unknown');
      
      emailElement.innerHTML = `
        <div class="email-header">
          <div class="email-subject">${escapeHtml(email.subject || 'No Subject')}</div>
          <div class="email-meta">
            <span>From: ${escapeHtml(fromAddress)}</span>
            <span>${formatDate(new Date(email.receivedAt))}</span>
          </div>
        </div>
        <div class="email-content">
          ${email.html ? email.html : `<pre>${escapeHtml(email.text || '')}</pre>`}
        </div>
      `;
      
      emailsContainer.appendChild(emailElement);
    });
  }
  
  // Helper function to format date
  function formatDate(date) {
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