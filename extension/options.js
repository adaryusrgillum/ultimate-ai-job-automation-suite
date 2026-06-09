document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('profileForm');
  const saveBtn = document.getElementById('saveBtn');
  const btnText = saveBtn.querySelector('.btn-text');
  const loader = document.getElementById('saveLoader');
  const statusMessage = document.getElementById('statusMessage');

  const fields = [
    'firstName', 'lastName', 'middleName', 'prefix', 'pronouns', 'email', 'phone', 'dob', 'birthplace',
    'physicalAddress', 'addressLine2', 'city', 'state', 'zip', 'country', 'mailingAddress', 'gender', 'race', 'veteran', 'disability',
    'linkedin', 'github', 'twitter', 'portfolio', 'gpa', 'gradYear', 'major', 'university', 'salary', 'noticePeriod', 'referralSource',
    'skills', 'experience', 'coverLetter', 'localLlmUrl', 'localLlmModel', 'cloudProvider', 'openaiApiKey', 'geminiApiKey', 'anthropicApiKey'
  ];

  // Load saved data
  chrome.storage.local.get('jobProfile', (result) => {
    if (result.jobProfile) {
      const data = result.jobProfile;
      fields.forEach(field => {
        const el = document.getElementById(field);
        if (el && data[field] !== undefined) {
          el.value = data[field];
        }
      });
    }
  });

  // Save data
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // UI Loading state
    btnText.style.opacity = '0';
    loader.style.display = 'block';
    statusMessage.classList.add('hidden');

    const profileData = {};
    fields.forEach(field => {
      const el = document.getElementById(field);
      if (el) {
        profileData[field] = el.value.trim();
      }
    });

    chrome.storage.local.set({ jobProfile: profileData, aiAnswerCache: {} }, () => {
      setTimeout(() => {
        btnText.style.opacity = '1';
        loader.style.display = 'none';
        statusMessage.classList.remove('hidden');
        setTimeout(() => {
          statusMessage.classList.add('hidden');
        }, 3000);
      }, 600);
    });
  });

  // Start Automation Bot listener
  const startBotBtn = document.getElementById('startBotBtn');
  if (startBotBtn) {
    startBotBtn.addEventListener('click', () => {
      const keywords = document.getElementById('botKeywords').value.trim();
      const locationVal = document.getElementById('botLocation').value.trim();
      const autoSubmit = document.getElementById('botAutoSubmit').checked;
      const statusMsg = document.getElementById('botStatusMessage');

      if (!keywords) {
        alert('Please enter job keywords first.');
        return;
      }

      statusMsg.style.display = 'block';
      statusMsg.textContent = '🚀 Launching bot in a new tab...';

      chrome.runtime.sendMessage({
        action: 'START_AUTO_APPLY',
        keywords,
        location: locationVal || 'Remote',
        autoSubmit
      }, (response) => {
        if (response?.success) {
          statusMsg.textContent = '✅ Bot is active! LinkedIn Easy Apply tab opened.';
        } else {
          statusMsg.textContent = '❌ Failed to start bot.';
        }
      });
    });
  }
});
