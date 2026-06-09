document.addEventListener('DOMContentLoaded', () => {
  const autofillBtn = document.getElementById('autofillBtn');
  const coverLetterBtn = document.getElementById('coverLetterBtn');
  const statusMessage = document.getElementById('statusMessage');
  const fieldCount = document.getElementById('fieldCount');
  const optionsLink = document.getElementById('optionsLink');

  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage
      ? chrome.runtime.openOptionsPage()
      : window.open(chrome.runtime.getURL('options.html'));
  });

  function showStatus(text, type) {
    statusMessage.textContent = text;
    statusMessage.className = `status-message ${type}`;
    setTimeout(() => { statusMessage.classList.add('hidden'); }, 4000);
  }

  function setAutofillLoading(isLoading) {
    const btnText = autofillBtn.querySelector('.btn-text');
    const loader = document.getElementById('autofillLoader');
    btnText.style.opacity = isLoading ? '0' : '1';
    loader.style.display = isLoading ? 'block' : 'none';
    autofillBtn.disabled = isLoading;
  }

  function describeAutofillReport(response) {
    const report = response?.report;
    if (!report) return `${response?.count || 0} fields filled. AI may still be generating answers.`;
    const parts = [
      `${report.filled || 0} fields filled`,
      `${report.aiQueued || 0} AI question${report.aiQueued === 1 ? '' : 's'} queued`
    ];
    if (report.coverLetterButtons) parts.push(`${report.coverLetterButtons} cover letter tool${report.coverLetterButtons === 1 ? '' : 's'} added`);
    if (report.platform) parts.push(`platform: ${report.platform}`);
    return parts.join(' · ');
  }

  // ── Autofill ──
  autofillBtn.addEventListener('click', async () => {
    setAutofillLoading(true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'AUTOFILL' }, (response) => {
          setAutofillLoading(false);

          if (chrome.runtime.lastError) {
            showStatus(`Error: ${chrome.runtime.lastError.message}. Refresh the page and try again.`, 'error');
          } else if (response?.success) {
            showStatus(`Autofill complete!`, 'success');
            fieldCount.textContent = describeAutofillReport(response);
            fieldCount.classList.remove('hidden');
          } else {
            showStatus(response?.error || 'No profile found. Open settings to set up.', 'error');
          }
        });
      } else {
        setAutofillLoading(false);
        showStatus('No active tab found.', 'error');
      }
    } catch (err) {
      setAutofillLoading(false);
      showStatus('Failed to trigger autofill.', 'error');
    }
  });

  // ── Cover Letter ──
  coverLetterBtn.addEventListener('click', async () => {
    coverLetterBtn.disabled = true;
    const btnText = coverLetterBtn.querySelector('.btn-text');
    btnText.textContent = '⏳ Generating...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        // Get page context by executing a small script
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => document.body.innerText.substring(0, 2000)
        }, (results) => {
          if (chrome.runtime.lastError) {
            coverLetterBtn.disabled = false;
            btnText.textContent = 'Generate Cover Letter';
            showStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
            return;
          }

          const pageContext = results?.[0]?.result || '';

          chrome.runtime.sendMessage({
            action: 'GENERATE_COVER_LETTER',
            context: pageContext
          }, (response) => {
            coverLetterBtn.disabled = false;
            if (chrome.runtime.lastError) {
              btnText.textContent = 'Generate Cover Letter';
              showStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
              return;
            }
            if (response?.success) {
              btnText.textContent = 'Generate Cover Letter';
              showStatus(`✅ Downloaded: ${response.filename}`, 'success');
            } else {
              btnText.textContent = 'Generate Cover Letter';
              showStatus(`Error: ${response?.error || 'Unknown'}`, 'error');
            }
          });
        });
      } else {
        coverLetterBtn.disabled = false;
        btnText.textContent = 'Generate Cover Letter';
        showStatus('No active tab found.', 'error');
      }
    } catch (err) {
      coverLetterBtn.disabled = false;
      coverLetterBtn.querySelector('.btn-text').textContent = 'Generate Cover Letter';
      showStatus('Failed: ' + err.message, 'error');
    }
  });
});
