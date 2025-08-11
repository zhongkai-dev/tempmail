document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const copyBtn = document.getElementById('copyBtn');
  const tempEmailElement = document.getElementById('tempEmail');
  const emailsContainer = document.getElementById('emails');
  const refreshBtn = document.getElementById('refreshBtn');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  
  let localPart = '';
  let pollingInterval;

  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      let date = new Date();
      date.setTime(date.getTime() + (days*24*60*60*1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
  }

  function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for(let i=0;i < ca.length;i++) {
      let c = ca[i];
      while (c.charAt(0)==' ') c = c.substring(1,c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
  }

  function deleteCookie(name) {   
    document.cookie = name+'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }

  function checkExistingEmail() {
    const savedEmail = getCookie('tempEmail');
    if (savedEmail) {
      tempEmailElement.textContent = savedEmail;
      localPart = savedEmail.split('@')[0];
      copyBtn.disabled = false;
      fetchEmails();
      pollingInterval = setInterval(fetchEmails, 5000);
    }
  }

  generateBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/generate', { method: 'POST' });
      const data = await response.json();
      tempEmailElement.textContent = data.email;
      localPart = data.email.split('@')[0];
      setCookie('tempEmail', data.email, 30);
      copyBtn.disabled = false;
      if (pollingInterval) clearInterval(pollingInterval);
      emailsContainer.innerHTML = '<p class="no-emails">No emails yet.</p>';
      pollingInterval = setInterval(fetchEmails, 5000);
      showNotification('Email generated successfully!');
    } catch (error) {
      showNotification('Failed to generate email.', 'error');
    }
  });

  document.getElementById('deleteBtn').addEventListener('click', () => {
    deleteCookie('tempEmail');
    tempEmailElement.textContent = '-';
    emailsContainer.innerHTML = '<p class="no-emails">No emails yet.</p>';
    copyBtn.disabled = true;
    if (pollingInterval) clearInterval(pollingInterval);
    localPart = '';
    showNotification('Email deleted.');
  });
  
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(tempEmailElement.textContent).then(() => {
      showNotification('Email copied to clipboard!');
    });
  });

  refreshBtn.addEventListener('click', () => {
    if (localPart) {
      refreshBtn.classList.add('spinning');
      fetchEmails().finally(() => {
        setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
      });
      showNotification('Inbox refreshed');
    } else {
      showNotification('No email address generated yet', 'error');
    }
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('active');
    }
  });
  
  async function fetchEmails() {
    if (!localPart) return;
    const response = await fetch(`/api/emails/${localPart}`);
    const emails = await response.json();
    renderEmails(emails);
  }
  
  function renderEmails(emails) {
    emailsContainer.innerHTML = (!emails || emails.length === 0) 
      ? '<p class="no-emails">No emails received yet.</p>' 
      : '';
    
    if (!emails) return;

    emails.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    
    emails.forEach((email) => {
      const emailElement = document.createElement('div');
      emailElement.className = 'email-item';
      
      emailElement.innerHTML = `
        <div class="email-header">
          <div class="email-subject">${escapeHtml(email.subject || 'No Subject')}</div>
          <div class="email-meta">
            <span class="email-from">From: ${escapeHtml(formatFromAddress(email.from))}</span>
            <span class="email-date">${formatDate(new Date(email.receivedAt))}</span>
          </div>
        </div>
        <div class="email-preview">${getEmailPreview(email)}</div>
      `;
      
      emailElement.addEventListener('click', () => showEmailDetails(email));
      emailsContainer.appendChild(emailElement);
    });
  }

  function getEmailPreview(email) {
    if (email.text) return `<span class="email-text-preview">${escapeHtml(email.text.substring(0, 100))}...</span>`;
    return '<span class="email-no-content">No content available</span>';
  }

  function showEmailDetails(email) {
    let emailContent = '';
    if (email.html) {
      emailContent = `<div class="email-html-content"><iframe id="emailContentFrame" sandbox="allow-same-origin" frameborder="0" width="100%"></iframe></div>`;
    } else if (email.text) {
      emailContent = `<div class="email-text-content"><pre>${escapeHtml(email.text)}</pre></div>`;
    } else {
      emailContent = `<div class="email-error-content"><p>Could not display email content.</p><div class="email-headers"><h3>Email Headers</h3><div class="headers-container">${Object.entries(email.headers || {}).map(([key, value]) => `<div class="header-item"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value.toString())}</div>`).join('')}</div></div></div>`;
    }
    
    modalContent.innerHTML = `
      <div class="modal-header"><h2>${escapeHtml(email.subject || 'No Subject')}</h2><button id="closeModalBtn" class="btn icon-btn"><i class="fas fa-times"></i></button></div>
      <div class="modal-meta">
        <div><strong>From:</strong> ${escapeHtml(formatFromAddress(email.from))}</div>
        <div><strong>To:</strong> ${escapeHtml(email.to)}</div>
        <div><strong>Date:</strong> ${formatDate(new Date(email.receivedAt), true)}</div>
      </div>
      <div class="modal-body">${emailContent}</div>
    `;
    
    modalOverlay.classList.add('active');
    
    if (email.html) {
      const iframe = document.getElementById('emailContentFrame');
      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html><html><head><style>body{font-family:sans-serif;line-height:1.6;color:#333;padding:10px;}img{max-width:100%;height:auto;}a{color:#4f46e5;}</style></head><body>${email.html}</body></html>`);
      iframeDoc.close();
      iframe.onload = () => iframe.style.height = iframe.contentWindow.document.body.scrollHeight + 'px';
    }
    
    document.getElementById('closeModalBtn').addEventListener('click', () => modalOverlay.classList.remove('active'));
  }

  const formatFromAddress = (from) => (typeof from === 'string' ? from : (from?.name ? `${from.name} <${from.address}>` : from?.address || 'Unknown'));
  
  function formatDate(date, detailed = false) {
    return detailed 
      ? date.toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  
  const escapeHtml = (unsafe) => unsafe?.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") || '';
  
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  }
  
  checkExistingEmail();
}); 