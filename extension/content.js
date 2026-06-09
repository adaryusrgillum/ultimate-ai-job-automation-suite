/* ===================================================================
   Job Application Autofiller v2.1 — Content Script (Hardened)
   ─────────────────────────────────────────────────────────────────
   Features:
     • MutationObserver for dynamically loaded SPA forms
     • Duplicate injection prevention
     • Full event dispatch chain (input, change, blur, focusout)
     • Custom ARIA dropdown handling (Workday, Greenhouse)
     • Phone / date format normalization
     • Undo history
     • Retry queue for LLM calls
     • Debug logging with toggle
     • Iframe scanning
     • Confidence-based matching
   =================================================================== */

(() => {
  // ── Prevent double-injection ──────────────────────────────────────────────
  if (window.__JAF_INJECTED__) return;
  window.__JAF_INJECTED__ = true;

  // ── Debug Mode ────────────────────────────────────────────────────────────
  const DEBUG = false;
  const log = (...args) => { if (DEBUG) console.log('[JAF]', ...args); };
  const warn = (...args) => console.warn('[JAF]', ...args);
  const AI_TEXTAREA_MIN_CHARS = 80;
  const MESSAGE_TIMEOUT_MS = 240000;
  const TEXT_FIELD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

  const ATS_PLATFORMS = [
    { id: 'greenhouse', hosts: [/greenhouse\.io/i, /boards\.greenhouse\.io/i], selectors: ['#grnhse_app', '.application-form', '[data-source="greenhouse"]'] },
    { id: 'lever', hosts: [/lever\.co/i], selectors: ['.lever', '.posting-form', '[data-qa="posting-form"]'] },
    { id: 'workday', hosts: [/myworkdayjobs\.com/i, /workdayjobs\.com/i], selectors: ['[data-automation-id]', '[data-uxi-widget-type]', '[data-testid]'] },
    { id: 'icims', hosts: [/icims\.com/i], selectors: ['.iCIMS_JobsTable', '[id*="icims"]', '[class*="iCIMS"]'] },
    { id: 'taleo', hosts: [/taleo\.net/i], selectors: ['[id*="taleo"]', '[class*="taleo"]'] },
    { id: 'ashby', hosts: [/ashbyhq\.com/i], selectors: ['[data-ashby]', '.ashby-job-posting'] },
    { id: 'smartrecruiters', hosts: [/smartrecruiters\.com/i], selectors: ['[class*="SmartRecruiters"]', '[data-test*="job"]'] },
    { id: 'jobvite', hosts: [/jobvite\.com/i], selectors: ['[class*="jv-"]', '#jv-careersite'] }
  ];

  function detectPlatform() {
    const host = location.hostname;
    for (const platform of ATS_PLATFORMS) {
      if (platform.hosts.some(pattern => pattern.test(host))) return platform.id;
      if (platform.selectors.some(selector => document.querySelector(selector))) return platform.id;
    }
    return 'generic';
  }

  function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').replace(/\*/g, '').trim();
  }

  function isVisible(element) {
    if (!element || element.type === 'hidden') return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  }

  function isAutofillable(element) {
    if (!element || !TEXT_FIELD_TAGS.has(element.tagName)) return false;
    if (element.disabled || element.readOnly) return false;
    if (!isVisible(element)) return false;
    const type = (element.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'file', 'image', 'reset', 'password'].includes(type)) return false;
    if (element.closest('[aria-hidden="true"], [hidden]')) return false;
    return true;
  }

  // ── Undo History ──────────────────────────────────────────────────────────
  const undoHistory = [];

  // ── Auto-Advance State ───────────────────────────────────────────────────
  let jafAutoAdvancing = false;
  let waitingForNextStep = false;
  let lastStepSignature = '';
  let autoAdvanceTimeout = null;

  function recordUndo(element, previousValue) {
    undoHistory.push({ element, previousValue, timestamp: Date.now() });
  }

  function sendMessageWithTimeout(message, callback, timeoutMs = MESSAGE_TIMEOUT_MS) {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      callback({ success: false, error: 'Timed out waiting for the local AI service.' });
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          callback({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        callback(response || { success: false, error: 'No response from extension background worker.' });
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback({ success: false, error: err.message || String(err) });
    }
  }

  // ── Event Dispatch (comprehensive for React/Angular/Vue) ──────────────────
  function dispatchFullEventChain(element) {
    const events = ['input', 'change', 'blur', 'focusout'];
    for (const eventType of events) {
      try {
        element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
      } catch (e) { /* ignore */ }
    }
    // React 16+ synthetic events
    try {
      const nativeInputEvent = new InputEvent('input', { bubbles: true, cancelable: true, data: element.value });
      element.dispatchEvent(nativeInputEvent);
    } catch (e) { /* ignore */ }
  }

  // ── Emulate human typing for anti-detection and React state binding ──────
  async function emulateHumanType(element, value) {
    if (!element) return;
    try { element.focus(); } catch (e) {}
    recordUndo(element, element.value);
    
    // Clear value
    element.value = '';

    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      const keyInit = { key: char, bubbles: true, cancelable: true };
      
      try { element.dispatchEvent(new KeyboardEvent('keydown', keyInit)); } catch (e) {}
      
      element.value += char;
      
      try {
        element.dispatchEvent(new InputEvent('input', {
          inputType: 'insertText',
          data: char,
          bubbles: true,
          cancelable: true
        }));
      } catch (e) {}

      try { element.dispatchEvent(new KeyboardEvent('keyup', keyInit)); } catch (e) {}

      // Quick delay for typing simulation (2-6ms per char)
      await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 4) + 2));
    }

    try {
      const tracker = element._valueTracker;
      if (tracker) tracker.setValue('');
    } catch (e) {}

    dispatchFullEventChain(element);
  }

  // ── Set Value (React/Vue/Angular compatible, asynchronous) ────────────────
  async function setNativeValue(element, value) {
    if (!element || value === undefined || value === null) return false;
    value = String(value);

    // SELECT elements
    if (element.tagName === 'SELECT') {
      return handleSelectElement(element, value);
    }

    // RADIO / CHECKBOX
    if (element.type === 'radio' || element.type === 'checkbox') {
      recordUndo(element, element.checked);
      element.checked = true;
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      dispatchFullEventChain(element);
      return true;
    }

    // TEXT / TEXTAREA / etc.
    await emulateHumanType(element, value);
    return true;
  }

  // ── SELECT element handler (standard and fuzzy matching) ──────────────────
  function handleSelectElement(element, value) {
    const lowerValue = value.toLowerCase();
    let bestMatch = -1;
    let bestScore = 0;

    for (let i = 0; i < element.options.length; i++) {
      const optText = element.options[i].text.toLowerCase();
      const optValue = element.options[i].value.toLowerCase();

      // Exact match
      if (optValue === lowerValue || optText === lowerValue) {
        bestMatch = i;
        bestScore = 100;
        break;
      }
      // Partial match
      if (optText.includes(lowerValue) || lowerValue.includes(optText)) {
        const score = Math.min(optText.length, lowerValue.length) / Math.max(optText.length, lowerValue.length) * 80;
        if (score > bestScore) {
          bestMatch = i;
          bestScore = score;
        }
      }
      // Word-level match
      const valueWords = lowerValue.split(/\s+/);
      const optWords = optText.split(/\s+/);
      const commonWords = valueWords.filter(w => optWords.some(ow => ow.includes(w) || w.includes(ow)));
      if (commonWords.length > 0) {
        const score = (commonWords.length / Math.max(valueWords.length, optWords.length)) * 70;
        if (score > bestScore) {
          bestMatch = i;
          bestScore = score;
        }
      }
    }

    if (bestMatch >= 0 && bestScore >= 30) {
      log(`SELECT match: "${value}" → "${element.options[bestMatch].text}" (score: ${bestScore.toFixed(0)})`);
      recordUndo(element, element.selectedIndex);
      element.selectedIndex = bestMatch;
      dispatchFullEventChain(element);
      return true;
    }

    log(`SELECT no match for "${value}" in ${element.options.length} options`);
    return false;
  }

  // ── Custom ARIA Dropdown handler (Workday, Greenhouse, etc. - Hardened) ───
  function handleCustomDropdown(triggerElement, value) {
    try {
      log(`Triggering custom dropdown for value: "${value}"`);
      
      // Look for hidden input nearby
      const hiddenInput = triggerElement.parentElement?.querySelector('input[type="hidden"]') ||
                          triggerElement.querySelector('input[type="hidden"]');
      if (hiddenInput) {
        hiddenInput.value = value;
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Click to open dropdown
      triggerElement.click();
      triggerElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      triggerElement.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

      // Wait for options to render
      setTimeout(() => {
        const listboxId = triggerElement.getAttribute('aria-controls') ||
                          triggerElement.getAttribute('aria-owns');
        let optionElements = [];

        if (listboxId) {
          const listbox = document.getElementById(listboxId);
          if (listbox) {
            optionElements = listbox.querySelectorAll('[role="option"], li, [data-value], .custom-option');
          }
        }

        // Fallback: search nearby inside parent container
        if (optionElements.length === 0) {
          const parent = triggerElement.closest('.form-group, .field, .question, .custom-select-container');
          if (parent) {
            optionElements = parent.querySelectorAll('[role="option"], li, [data-value], .custom-option');
          }
        }

        // Fallback: search global page popups
        if (optionElements.length === 0) {
          const popup = document.querySelector('[role="listbox"], [role="menu"], .dropdown-menu, .select-options, .custom-select-options');
          if (popup) {
            optionElements = popup.querySelectorAll('[role="option"], li, [data-value], .custom-option');
          }
        }

        const lowerValue = value.toLowerCase();
        let matchedOpt = null;

        // Try exact/partial matching in both directions
        for (const opt of optionElements) {
          const optText = opt.textContent.trim().toLowerCase();
          const optVal = (opt.getAttribute('data-value') || '').toLowerCase();
          
          if (optText === lowerValue || optVal === lowerValue) {
            matchedOpt = opt;
            break;
          }
          if (optText.includes(lowerValue) || lowerValue.includes(optText) ||
              optVal.includes(lowerValue) || lowerValue.includes(optVal)) {
            matchedOpt = opt;
          }
        }

        if (matchedOpt) {
          matchedOpt.click();
          matchedOpt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          log(`Custom dropdown: selected "${matchedOpt.textContent.trim()}"`);
          
          // If hidden input exists, force event dispatch
          if (hiddenInput) {
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return;
        }

        // Keyboard navigation fallback (ArrowDown + Enter) if list items are unclickable
        log(`No direct element click match. Attempting keyboard select...`);
        const keyEvents = ['ArrowDown', 'ArrowDown', 'Enter'];
        let keyIndex = 0;
        
        const keyInterval = setInterval(() => {
          if (keyIndex >= keyEvents.length) {
            clearInterval(keyInterval);
            return;
          }
          const key = keyEvents[keyIndex];
          triggerElement.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true }));
          keyIndex++;
        }, 150);

        // Close dropdown
        setTimeout(() => {
          document.body.click();
        }, 1000);
        warn(`Custom dropdown: no match for "${value}"`);
      }, 300);
    } catch (e) {
      warn('Custom dropdown error:', e);
    }
  }

  // ── Label Text Extraction (comprehensive) ─────────────────────────────────
  function getLabelText(element) {
    let sources = [];

    // 1. Explicit <label> via `for` attribute
    if (element.labels && element.labels.length > 0) {
      sources.push(Array.from(element.labels).map(l => l.innerText).join(' '));
    }

    // 2. aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) sources.push(ariaLabel);

    // 3. aria-labelledby
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const ids = ariaLabelledBy.split(/\s+/);
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) sources.push(el.innerText);
      }
    }

    // 4. title attribute
    if (element.title) sources.push(element.title);

    // 5. data-automation-id (Workday)
    const autoId = element.getAttribute('data-automation-id');
    if (autoId) sources.push(autoId.replace(/[-_]/g, ' '));

    // 6. Walk up DOM to find wrapping label, heading, or sibling label
    if (sources.length === 0) {
      let node = element;
      for (let i = 0; i < 5 && node.parentElement; i++) {
        node = node.parentElement;

        if (node.tagName === 'LABEL') {
          sources.push(node.innerText);
          break;
        }

        // Check previous sibling
        const prev = node.previousElementSibling;
        if (prev) {
          const tag = prev.tagName;
          if (['LABEL', 'SPAN', 'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'LEGEND'].includes(tag)) {
            const text = prev.innerText.trim();
            if (text.length > 0 && text.length < 200) {
              sources.push(text);
              break;
            }
          }
        }
      }
    }

    return cleanText(sources.join(' ')).toLowerCase();
  }

  function getQuestionText(element) {
    const sources = [];
    const labelText = getLabelText(element);
    if (labelText) sources.push(labelText);
    if (element.placeholder) sources.push(element.placeholder);

    const describedBy = element.getAttribute('aria-describedby');
    if (describedBy) {
      for (const id of describedBy.split(/\s+/)) {
        const described = document.getElementById(id);
        if (described) sources.push(described.innerText || described.textContent);
      }
    }

    const container = element.closest('label, fieldset, .form-group, .field, .question, .application-question, [role="group"], li, section, div');
    if (container) {
      const clone = container.cloneNode(true);
      clone.querySelectorAll('input, textarea, select, button, option, script, style').forEach(node => node.remove());
      const text = cleanText(clone.innerText || clone.textContent);
      if (text && text.length < 500) sources.push(text);
    }

    return cleanText([...new Set(sources.filter(Boolean))].join(' '));
  }

  function isLongFormQuestion(element, labelText) {
    if (element.tagName !== 'TEXTAREA') return false;
    const question = getQuestionText(element) || labelText || '';
    if ((element.rows && element.rows >= 3) || element.clientHeight > 70) return true;
    if (question.length >= AI_TEXTAREA_MIN_CHARS) return true;
    return /why|tell us|describe|explain|motivat|interest|anything else|additional|cover letter/i.test(question);
  }

  // ── Field Type Detection (with confidence scoring) ────────────────────────
  function getFieldType(input, labelText) {
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
    const dataField = (input.getAttribute('data-field') || input.getAttribute('data-automation-id') || '').toLowerCase();
    const inputType = (input.type || '').toLowerCase();

    const role = (input.getAttribute('role') || '').toLowerCase();
    const describedBy = (input.getAttribute('aria-describedby') || '').toLowerCase();
    const combined = `${name} ${id} ${placeholder} ${labelText} ${autocomplete} ${dataField} ${role} ${describedBy}`;

    if (input.tagName === 'TEXTAREA' && isLongFormQuestion(input, labelText)) {
      if (/cover.*letter/i.test(combined)) return 'coverLetter';
      if (/\bskills?\b/i.test(combined)) return 'skills';
      if (/experience|work.*history/i.test(combined)) return 'experience';
      return null;
    }

    // ── Autocomplete attribute (highest priority) ──
    const autoMap = {
      'given-name': 'firstName', 'family-name': 'lastName', 'name': 'fullName',
      'email': 'email', 'tel': 'phone', 'tel-national': 'phone',
      'street-address': 'physicalAddress', 'address-line1': 'physicalAddress',
      'address-level2': 'city', 'address-level1': 'state',
      'postal-code': 'zip', 'country-name': 'country', 'organization': 'company',
      'bday': 'dob', 'url': 'portfolio'
    };
    if (autoMap[autocomplete]) return autoMap[autocomplete];

    // ── Type-based quick checks ──
    if (inputType === 'email') return 'email';
    if (inputType === 'tel') return 'phone';

    // ── Pattern matching (ordered by specificity, most specific first) ──
    const rules = [
      // Demographics & Voluntary disclosures
      [/gender|\bsex\b|género|genre|geschlecht/i, 'gender'],
      [/race|ethnicity|raza|origen|ethnie|rasse/i, 'race'],
      [/veteran|veterano|vétéran|veteran/i, 'veteran'],
      [/disability|disabled|discapacidad|handicap|behinderung/i, 'disability'],
      [/pronoun|gender.*pronoun|how.*address/i, 'pronouns'],
      [/prefix|title|salutation|mr\b|mrs\b|ms\b|dr\b|título|civilité/i, 'prefix'],

      // Address details
      [/mailing.*address|dirección.*postal/i, 'mailingAddress'],
      [/address.*line.*2|address2|unit|apt|apartment|suite|piso|departamento/i, 'addressLine2'],
      [/physical.*address|\bstreet\b|address.*line.*1|address1|dirección|adresse|straße/i, 'physicalAddress'],
      [/\bcity\b|address.*level.*2|ciudad|ville|stadt/i, 'city'],
      [/\bstate\b|\bprovince\b|address.*level.*1|estado|provincia|état|bundesland/i, 'state'],
      [/\bzip\b|postal.*code|código.*postal|code.*postal|plz|postleitzahl/i, 'zip'],
      [/\bcountry\b|país|pays|land/i, 'country'],
      [/birth.*place|place.*birth|lugar.*nacimiento|lieu.*naissance|geburtsort/i, 'birthplace'],
      [/\bdob\b|date.*birth|birthdate|\bbday\b|fecha.*nacimiento|date.*naissance|geburtsdatum/i, 'dob'],
      [/country.*code|area.*code/i, 'countryCode'],

      // Names
      [/first.*name|fname|given.*name|nombre|prénom|vorname/i, 'firstName'],
      [/last.*name|lname|family.*name|surname|apellido|nom|nachname/i, 'lastName'],
      [/middle.*name|mname|segundo.*nombre/i, 'middleName'],
      [/full.*name|nombre.*completo|nom.*complet|vollständiger.*name/i, 'fullName'],

      // Contact
      [/\bemail\b|e-mail|correo|courriel/i, 'email'],
      [/phone|mobile|\bcell\b|\btel\b|teléfono|téléphone|telefon/i, 'phone'],

      // Links & Socials
      [/linkedin/i, 'linkedin'],
      [/github|git.*hub/i, 'github'],
      [/twitter|t\.co|x\.com/i, 'twitter'],
      [/hackerrank/i, 'hackerrank'],
      [/kaggle/i, 'kaggle'],
      [/dribbble/i, 'dribbble'],
      [/behance/i, 'behance'],
      [/portfolio|website|personal.*site|web.*personal|site.*web|webseite/i, 'portfolio'],

      // Academic
      [/\bgpa\b|grade.*point|nota.*media/i, 'gpa'],
      [/grad.*year|graduation.*date|year.*grad/i, 'gradYear'],
      [/major|field.*study|degree.*subject|discipline|carrera|spécialité|fachrichtung/i, 'major'],
      [/school|university|college|institution|universidad|université|universität/i, 'university'],

      // Professional / Logistics
      [/\bskill|habilidad|compétence|fähigkeit/i, 'skills'],
      [/experience|work.*history|experiencia|expérience|berufserfahrung/i, 'experience'],
      [/\bsalary\b|compensation|desired.*pay|salario|rémunération|gehalt/i, 'salary'],
      [/notice.*period|notice.*days|notice\b|aviso.*previo|préavis|kündigungsfrist/i, 'noticePeriod'],
      [/start.*date|earliest.*start|\bavailab|disponib/i, 'startDate'],
      [/cover.*letter|carta.*presentacion|lettre.*motivation|anschreiben/i, 'coverLetter'],
      [/\bhow.*hear|hear.*about|referr|origen.*candidatura/i, 'referralSource'],

      // Catch-all name (must be last)
      [/\bname\b|nombre|nom|name/i, 'fullName'],
    ];

    for (const [pattern, fieldType] of rules) {
      if (pattern.test(combined)) {
        log(`Field match: "${combined.substring(0, 60)}..." → ${fieldType}`);
        return fieldType;
      }
    }

    return null;
  }

  // ── File Field Detection ──────────────────────────────────────────────────
  function getFileFieldType(input) {
    const combined = `${(input.name || '')} ${(input.id || '')} ${getLabelText(input)}`.toLowerCase();
    if (/cover.*letter/i.test(combined)) return 'coverLetter';
    if (/resume|\bcv\b/i.test(combined)) return 'resume';
    return null;
  }

  // ── Phone Number Normalization ────────────────────────────────────────────
  function normalizePhone(phone, format) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      switch (format) {
        case 'dashes':   return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
        case 'dots':     return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
        case 'parens':   return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
        case 'plain':    return digits;
        default:         return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
      }
    }
    return phone;
  }

  // ── Date Normalization ────────────────────────────────────────────────────
  function normalizeDate(dateStr, inputElement) {
    // Detect expected format from placeholder or type
    const placeholder = (inputElement.placeholder || '').toLowerCase();
    const inputType = inputElement.type;

    // If it's a date input, convert to YYYY-MM-DD
    if (inputType === 'date') {
      const parts = dateStr.match(/(\d{2})\/?(\d{2})\/?(\d{4})/);
      if (parts) return `${parts[3]}-${parts[1]}-${parts[2]}`;
    }

    // If placeholder suggests a format
    if (placeholder.includes('yyyy')) {
      const parts = dateStr.match(/(\d{2})\/?(\d{2})\/?(\d{4})/);
      if (parts) {
        if (placeholder.startsWith('mm')) return `${parts[1]}/${parts[2]}/${parts[3]}`;
        if (placeholder.startsWith('dd')) return `${parts[2]}/${parts[1]}/${parts[3]}`;
        if (placeholder.startsWith('yyyy')) return `${parts[3]}/${parts[1]}/${parts[2]}`;
      }
    }

    return dateStr;
  }

  // ── Radio Button Group Handler ────────────────────────────────────────────
  function handleRadioGroup(radios, profileData) {
    if (!radios.length) return false;
    let groupFilled = false;
    const context = getRadioGroupContext(radios).toLowerCase();

    radios.forEach(radio => {
      if (radio.checked) return; // Already filled
      const labelText = getLabelText(radio);
      const value = radio.value.toLowerCase();
      const isYes = value === 'yes' || value === 'true' || labelText.includes('yes');
      const isNo = value === 'no' || value === 'false' || labelText.includes('no');

      const hasAuth = /\b(authori[sz]ed|legally eligible|eligible to work|right to work|work in the united states|work in the u\.?s\.?)\b/i.test(context);
      const hasSponsor = /\b(sponsor|sponsorship|visa|h-?1b|employment visa|work permit)\b/i.test(context);
      const has18 = context.includes('18') || context.includes('age');
      const hasRelocate = context.includes('relocat');
      const hasCommute = context.includes('commut');
      const hasNonCompete = context.includes('non-compete') || context.includes('noncompete');
      const hasBackground = context.includes('background check');
      const hasDrug = context.includes('drug') && context.includes('test');

      if (hasAuth && !hasSponsor) {
        if (isYes) { setNativeValue(radio, true); groupFilled = true; }
      } else if (hasSponsor && !hasAuth) {
        if (isNo) { setNativeValue(radio, true); groupFilled = true; }
      } else if (hasAuth && hasSponsor) {
        if (radio.name.toLowerCase().includes('sponsor')) {
          if (isNo) { setNativeValue(radio, true); groupFilled = true; }
        } else {
          if (isYes) { setNativeValue(radio, true); groupFilled = true; }
        }
      } else if (has18) {
        if (isYes) { setNativeValue(radio, true); groupFilled = true; }
      } else if (hasRelocate || hasCommute) {
        if (isYes) { setNativeValue(radio, true); groupFilled = true; }
      } else if (hasBackground || hasDrug) {
        if (isYes) { setNativeValue(radio, true); groupFilled = true; }
      }
    });
    return groupFilled;
  }

  function getRadioGroupContext(radios) {
    const first = radios[0];
    const stableContainer = first.closest('fieldset, .form-group, .field, .question, .application-question, [role="radiogroup"], [role="group"], li');
    if (stableContainer && radios.every(radio => stableContainer.contains(radio))) {
      return extractContainerQuestion(stableContainer);
    }

    let contextNode = first.parentElement;
    while (contextNode && contextNode !== document.body) {
      if (radios.every(radio => contextNode.contains(radio))) {
        return extractContainerQuestion(contextNode);
      }
      contextNode = contextNode.parentElement;
    }

    return radios.map(radio => `${getLabelText(radio)} ${radio.name || ''} ${radio.value || ''}`).join(' ');
  }

  function extractContainerQuestion(container) {
    const clone = container.cloneNode(true);
    clone.querySelectorAll('input, textarea, select, option, button, script, style').forEach(node => node.remove());
    let text = cleanText(clone.innerText || clone.textContent);
    if (!text || text.length < 4) {
      const previous = container.previousElementSibling;
      if (previous) text = cleanText(previous.innerText || previous.textContent);
    }
    return text;
  }

  // ── Cover Letter Button Injection ─────────────────────────────────────────
  function injectCoverLetterButton(targetElement) {
    if (targetElement.parentElement.querySelector('.jaf-cl-btn')) return;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:8px;';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'jaf-cl-btn';
    btn.innerHTML = '📝 Generate & Download Cover Letter';
    btn.style.cssText = `
      background:linear-gradient(135deg,#a855f7,#3b82f6);color:white;border:none;
      border-radius:8px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      box-shadow:0 2px 8px rgba(168,85,247,0.3);transition:all 0.2s ease;`;

    const status = document.createElement('span');
    status.style.cssText = 'font-size:13px;color:#6b7280;';

    btn.onmouseenter = () => btn.style.transform = 'translateY(-1px)';
    btn.onmouseleave = () => btn.style.transform = 'translateY(0)';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      btn.disabled = true;
      btn.innerHTML = '⏳ Generating with AI...';
      status.textContent = '';

      sendMessageWithTimeout({
        action: 'GENERATE_COVER_LETTER',
        context: document.body.innerText.substring(0, 2000)
      }, (response) => {
        btn.disabled = false;
        if (response?.success) {
          btn.innerHTML = '✅ Generated & Attached!';
          status.textContent = response.filename;

          // Attempt to attach the file to the input
          if (targetElement && targetElement.type === 'file' && response.dataUrl) {
            try {
              // Convert dataURL to Blob
              const byteString = atob(response.dataUrl.split(',')[1]);
              const mimeString = response.dataUrl.split(',')[0].split(':')[1].split(';')[0];
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              const blob = new Blob([ab], {type: mimeString});
              
              // Create File
              const file = new File([blob], response.filename, { type: mimeString });
              
              // Create DataTransfer
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              targetElement.files = dataTransfer.files;
              
              // Trigger events
              targetElement.dispatchEvent(new Event('change', { bubbles: true }));
              targetElement.dispatchEvent(new Event('input', { bubbles: true }));
              log('Cover letter auto-attached successfully!');
            } catch (err) {
              warn("Failed to auto-attach cover letter:", err);
            }
          }

          setTimeout(() => { btn.innerHTML = '📝 Regenerate Cover Letter'; }, 4000);
        } else {
          btn.innerHTML = '❌ Failed — Retry';
          status.textContent = response?.error || 'Unknown error';
          setTimeout(() => { btn.innerHTML = '📝 Generate & Download Cover Letter'; }, 4000);
        }
      });
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(status);
    targetElement.parentElement.insertBefore(wrapper, targetElement.nextSibling);
  }

  // ── AI Sparkle UI ─────────────────────────────────────────────────────────
  function injectSparkleUI(element, labelText) {
    if (element.parentElement?.querySelector('.jaf-sparkle-btn')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'jaf-wrapper';
    element.parentNode.insertBefore(wrapper, element);
    wrapper.appendChild(element);

    const sparkle = document.createElement('div');
    sparkle.className = 'jaf-sparkle-btn';
    sparkle.innerHTML = '✨';
    sparkle.title = 'AI Copilot: Generate Answer';
    wrapper.appendChild(sparkle);

    sparkle.addEventListener('click', (e) => {
      e.preventDefault();
      sparkle.classList.add('jaf-sparkle-loading');

      const context = document.body.innerText.substring(0, 1500);
      const question = getQuestionText(element) || labelText || element.placeholder || element.name || 'Custom Question';

      sendWithRetry({
        action: 'GENERATE_AI_ANSWER',
        question, context
      }, (response) => {
        sparkle.classList.remove('jaf-sparkle-loading');
        if (response?.success) {
          setNativeValue(element, response.answer);
          element.classList.add('jaf-field-ai-done');
          sparkle.style.display = 'none';
        } else {
          warn('AI Sparkle error:', response?.error);
          sparkle.title = 'Error: ' + (response?.error || 'Unknown');
        }
      });
    });
  }

  // ── Retry Wrapper for LLM calls ──────────────────────────────────────────
  function sendWithRetry(message, callback, retries = 2) {
    sendMessageWithTimeout(message, (response) => {
      if (response?.success || retries <= 0) {
        callback(response);
      } else {
        log(`Retrying LLM call (${retries} left)...`);
        setTimeout(() => sendWithRetry(message, callback, retries - 1), 1000);
      }
    });
  }

  // ── Auto-Advance Helpers ──────────────────────────────────────────────────
  function getStepSignature() {
    return Array.from(document.querySelectorAll('input, textarea, select'))
      .filter(el => isAutofillable(el))
      .map(el => (el.id || '') + ':' + (el.name || '') + ':' + (el.placeholder || ''))
      .join(',');
  }

  function isSubmitOrApplyButton(btn) {
    const text = (btn.innerText || btn.textContent || btn.value || '').trim().toLowerCase();
    const type = (btn.type || '').toLowerCase();
    if (type === 'submit') return true;
    if (/\bsubmit\b|\bapply\b|\bfinish\b/i.test(text)) return true;
    return false;
  }

  function findNextPageButton() {
    const selectors = [
      'button[id*="next" i]', 'button[id*="continue" i]',
      'input[type="submit"][value*="Next" i]', 'input[type="submit"][value*="Continue" i]',
      'input[type="button"][value*="Next" i]', 'input[type="button"][value*="Continue" i]',
      'button.ia-continueButton', 'button[class*="continue" i]', 'button[class*="next" i]',
      'button[aria-label*="Continue" i]', 'button[aria-label*="next" i]', 'button[aria-label*="Review" i]',
      'a[role="button"][class*="next" i]', 'a[role="button"][class*="continue" i]'
    ];

    for (const selector of selectors) {
      try {
        const btn = document.querySelector(selector);
        if (btn && isVisible(btn) && !btn.disabled && !isSubmitOrApplyButton(btn)) {
          return btn;
        }
      } catch (e) {}
    }

    // Secondary scan based on text content
    const allButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]'));
    for (const btn of allButtons) {
      if (!isVisible(btn) || btn.disabled) continue;
      const text = (btn.innerText || btn.textContent || btn.value || '').trim().toLowerCase();
      
      if (/^(next|continue|review|proceed|next\s+step)/i.test(text) && !/back|cancel|clear|reset/i.test(text) && !isSubmitOrApplyButton(btn)) {
        return btn;
      }
    }

    return null;
  }

  function checkAndAutoAdvance() {
    chrome.storage.local.get(['jafAutoAdvancing', 'jafAutoAdvanceHost', 'jafBotState'], (res) => {
      if (res.jafBotState && res.jafBotState.active) {
        log('[JAF AutoAdvance] Easy Apply Bot is active. Skipping standard auto-advance.');
        return;
      }

      if (!res.jafAutoAdvancing || res.jafAutoAdvanceHost !== location.hostname) {
        log('[JAF AutoAdvance] Auto-advance is not active or hostname mismatch.');
        return;
      }

      log('[JAF AutoAdvance] Checking for next button...');
      const nextBtn = findNextPageButton();

      if (nextBtn) {
        log('[JAF AutoAdvance] Next button found!', nextBtn);
        const statusEl = document.getElementById('jaf-progress-status');
        if (statusEl) statusEl.innerHTML = 'Page filled! Auto-advancing in 2 seconds... 🚀';

        const stopContainer = document.getElementById('jaf-stop-advance-container');
        if (stopContainer) stopContainer.style.display = 'block';

        lastStepSignature = getStepSignature();
        waitingForNextStep = true;

        clearTimeout(autoAdvanceTimeout);
        autoAdvanceTimeout = setTimeout(() => {
          log('[JAF AutoAdvance] Clicking Next button...');
          nextBtn.click();
        }, 1800);
      } else {
        log('[JAF AutoAdvance] No next/continue button found, or reached final step.');
        chrome.storage.local.set({ jafAutoAdvancing: false, jafAutoAdvanceHost: '' });
        jafAutoAdvancing = false;
        waitingForNextStep = false;

        const statusEl = document.getElementById('jaf-progress-status');
        if (statusEl) {
          const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
          if (submitBtn) {
            statusEl.innerHTML = 'Ready to Submit! Please review and submit. ✨';
          } else {
            statusEl.innerHTML = 'Autofill Complete! ✨';
          }
        }
        const stopContainer = document.getElementById('jaf-stop-advance-container');
        if (stopContainer) stopContainer.style.display = 'none';
      }
    });
  }

  // ── Main Autofill Logic ───────────────────────────────────────────────────
  function autofillForm(profileData) {
    log('Starting autofill...');

    // Inject visual progress card overlay
    const existingCard = document.getElementById('jaf-progress-card');
    if (existingCard) existingCard.remove();

    const progressCard = document.createElement('div');
    progressCard.id = 'jaf-progress-card';
    progressCard.style.cssText = `
      position: fixed; top: 24px; right: 24px;
      background: rgba(17, 24, 39, 0.95); border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px; padding: 16px 20px; z-index: 9999999;
      box-shadow: 0 12px 30px rgba(0,0,0,0.5); backdrop-filter: blur(12px);
      width: 260px; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      color: white; animation: slideIn 0.3s ease;
    `;
    progressCard.innerHTML = `
      <div style="font-weight:600;font-size:14px;margin-bottom:8px;color:#a5b4fc;display:flex;align-items:center;gap:8px;">
        <span style="animation: spin 2s linear infinite;">✨</span> AI Copilot Autofilling...
      </div>
      <div style="font-size:12px;color:#9ca3af;margin-bottom:8px;" id="jaf-progress-status">Scanning form elements...</div>
      <div id="jaf-stop-advance-container" style="display:none; text-align:right;">
        <span id="jaf-stop-advance-btn" style="font-size:10px;color:#f87171;text-decoration:underline;cursor:pointer;font-weight:500;">Stop Auto-Advance</span>
      </div>
    `;

    const stopBtn = progressCard.querySelector('#jaf-stop-advance-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        chrome.storage.local.set({ jafAutoAdvancing: false, jafAutoAdvanceHost: '' });
        jafAutoAdvancing = false;
        waitingForNextStep = false;
        clearTimeout(autoAdvanceTimeout);
        const container = document.getElementById('jaf-stop-advance-container');
        if (container) container.style.display = 'none';
        const statusEl = document.getElementById('jaf-progress-status');
        if (statusEl) statusEl.textContent = 'Auto-advance stopped.';
        log('[JAF AutoAdvance] Stopped by user request.');
      });
    }
    
    // Add slide-in styling
    if (!document.getElementById('jaf-progress-keyframes')) {
      const keyframes = document.createElement('style');
      keyframes.id = 'jaf-progress-keyframes';
      keyframes.innerHTML = `
        @keyframes slideIn { from { transform: translateX(50px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `;
      document.head.appendChild(keyframes);
    }
    document.body.appendChild(progressCard);

    // ── Step 1: Detect ATS platform ──
    const report = {
      platform: detectPlatform(),
      filled: 0,
      skipped: 0,
      aiQueued: 0,
      coverLetterButtons: 0,
      errors: []
    };
    log(`Platform detected: ${report.platform}`);
    document.getElementById('jaf-progress-status').textContent = 'Analyzing form structure...';

    // ── Step 2: Universal heuristic scan ──
    const elements = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]):not([type="image"]):not([type="reset"]), textarea, select'
    );

    let filledCount = 0;
    const radioGroups = {};
    const aiQueue = []; // Batch AI requests
    document.getElementById('jaf-progress-status').textContent = 'Applying smart heuristics...';

    elements.forEach(element => {
      // Skip invisible, disabled, or read-only elements
      if (!isAutofillable(element)) {
        report.skipped++;
        return;
      }

      if (element.type === 'radio') {
        if (element.name) {
          if (!radioGroups[element.name]) radioGroups[element.name] = [];
          radioGroups[element.name].push(element);
        }
        return;
      }

      const labelText = getLabelText(element);
      const fieldType = getFieldType(element, labelText);

      if (fieldType) {
        let valueToFill = '';
        if (fieldType === 'fullName') {
          valueToFill = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
        } else {
          valueToFill = profileData[fieldType] || '';
        }

        // Normalize phone
        if (fieldType === 'phone' && valueToFill) {
          valueToFill = normalizePhone(valueToFill);
        }

        // Normalize date
        if (fieldType === 'dob' && valueToFill) {
          valueToFill = normalizeDate(valueToFill, element);
        }

        if (valueToFill && element.value !== valueToFill) {
          try {
            if (setNativeValue(element, valueToFill)) {
              element.classList.add('jaf-field-filled');
              setTimeout(() => element.classList.remove('jaf-field-filled'), 2000);
              filledCount++;
              log(`Filled: ${fieldType} = "${valueToFill.substring(0, 30)}..."`);
            }
          } catch (e) { warn('Fill error:', e); }
        }
      } else if (element.tagName === 'TEXTAREA' && !element.value && isLongFormQuestion(element, labelText)) {
        // Queue for AI
        aiQueue.push({ element, labelText: getQuestionText(element) || labelText });
      } else if (element.type === 'text' && !element.value && labelText) {
        // Only inject sparkle if there's a meaningful label
        injectSparkleUI(element, labelText);
      }
    });

    // Process radio groups
    Object.values(radioGroups).forEach(group => {
      if (handleRadioGroup(group, profileData)) filledCount++;
    });

    // Detect custom ARIA dropdowns
    const ariaDropdowns = document.querySelectorAll('[role="combobox"], [role="listbox"], [aria-haspopup="listbox"]');
    ariaDropdowns.forEach(dropdown => {
      const labelText = getLabelText(dropdown);
      const fieldType = getFieldType(dropdown, labelText);
      if (fieldType && profileData[fieldType]) {
        handleCustomDropdown(dropdown, profileData[fieldType]);
        filledCount++;
      }
    });

    // Detect cover letter upload fields
    document.querySelectorAll('input[type="file"]').forEach(fileInput => {
      if (getFileFieldType(fileInput) === 'coverLetter') {
        injectCoverLetterButton(fileInput);
        report.coverLetterButtons++;
      }
    });

    // Detect non-standard upload buttons
    document.querySelectorAll('button, a, [role="button"]').forEach(btn => {
      if (/attach.*cover|upload.*cover|cover.*letter/i.test(btn.textContent)) {
        if (!btn.parentElement.querySelector('.jaf-cl-btn')) {
          injectCoverLetterButton(btn);
          report.coverLetterButtons++;
        }
      }
    });

    // Process AI queue in parallel for maximum speed
    report.filled = filledCount;
    report.aiQueued = aiQueue.length;
    processAiQueue(aiQueue);

    log(`Autofill complete: ${filledCount} fields filled, ${aiQueue.length} AI questions queued.`);
    return report;
  }

  // ── Parallel AI Queue Processor ───────────────────────────────────────────
  function processAiQueue(queue) {
    if (!queue || queue.length === 0) {
      const statusEl = document.getElementById('jaf-progress-status');
      if (statusEl) statusEl.textContent = 'Autofill Complete! ✨';
      setTimeout(() => {
        const card = document.getElementById('jaf-progress-card');
        if (card) card.remove();
      }, 2000);
      
      checkAndAutoAdvance();
      return;
    }
    log(`Processing ${queue.length} AI questions in parallel...`);

    const statusEl = document.getElementById('jaf-progress-status');
    if (statusEl) statusEl.textContent = `Resolving ${queue.length} AI questions...`;

    const promises = queue.map(({ element, labelText }) => {
      return new Promise((resolve) => {
        element.classList.add('jaf-field-ai-pending');
        const context = document.body.innerText.substring(0, 1500);
        const question = getQuestionText(element) || labelText || element.placeholder || element.name || 'Custom Question';

        sendWithRetry({
          action: 'GENERATE_AI_ANSWER',
          question, context
        }, (response) => {
          element.classList.remove('jaf-field-ai-pending');
          if (response?.success) {
            setNativeValue(element, response.answer);
            element.classList.add('jaf-field-ai-done');
            log(`AI filled: "${question.substring(0, 40)}..."`);
          } else {
            warn(`AI failed for "${question}":`, response?.error);
            injectSparkleUI(element, labelText);
          }
          resolve();
        });
      });
    });

    Promise.all(promises).then(() => {
      if (statusEl) statusEl.textContent = 'Autofill Complete! ✨';
      setTimeout(() => {
        const card = document.getElementById('jaf-progress-card');
        if (card) card.remove();
      }, 2500);

      checkAndAutoAdvance();
    });
  }

  // ── MutationObserver for Dynamically Loaded Forms ─────────────────────────
  let observerDebounce = null;
  const observer = new MutationObserver((mutations) => {
    // Check if new form elements were added
    let hasNewInputs = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          if (node.matches?.('input, textarea, select, form') ||
              node.querySelector?.('input, textarea, select')) {
            hasNewInputs = true;
            break;
          }
        }
      }
      if (hasNewInputs) break;
    }

    if (hasNewInputs) {
      // Debounce to avoid thrashing on rapid DOM updates
      clearTimeout(observerDebounce);
      observerDebounce = setTimeout(() => {
        log('New form elements detected, scanning for cover letter uploads...');
        // Only inject cover letter buttons for new fields (don't re-trigger full autofill)
        document.querySelectorAll('input[type="file"]').forEach(fileInput => {
          if (getFileFieldType(fileInput) === 'coverLetter') {
            injectCoverLetterButton(fileInput);
          }
        });
      }, 800);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // ── Easy Apply Automation Bot Engine ──────────────────────────────────────
  function initAutoApplyBot() {
    chrome.storage.local.get('jafBotState', (res) => {
      const state = res.jafBotState;
      if (!state || !state.active) return;

      log('Auto-Apply Bot is ACTIVE on this tab!', state);
      
      // Inject control bar
      injectBotControlBar(state);

      if (isJobSearchPage()) {
        runSearchPageBot(state);
      } else if (isJobApplicationModalOpen()) {
        runModalApplicationBot(state);
      }
    });
  }

  function isJobSearchPage() {
    return location.pathname.includes('/jobs/search') || location.pathname.includes('/jobs') || location.hostname.includes('indeed.com');
  }

  function injectBotControlBar(state) {
    if (document.getElementById('jaf-bot-control-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'jaf-bot-control-bar';
    bar.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(17, 24, 39, 0.95); border: 1px solid #374151;
      padding: 12px 24px; border-radius: 12px; display: flex; align-items: center;
      gap: 15px; z-index: 999999; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white; font-size: 14px; backdrop-filter: blur(8px);
    `;
    bar.innerHTML = `
      <span style="display:flex;align-items:center;gap:8px;">
        <span style="width:10px;height:10px;border-radius:50%;background:#10b981;animation:pulse 1.5s infinite;"></span>
        <strong>AI Bot:</strong> Applying to ${state.keywords}... (Job #${state.currentJobIndex + 1})
      </span>
      <button id="jaf-pause-bot-btn" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:6px;font-weight:600;cursor:pointer;">Stop Bot</button>
    `;
    
    const style = document.createElement('style');
    style.innerHTML = `@keyframes pulse { 0% { opacity:0.4; } 50% { opacity:1; } 100% { opacity:0.4; } }`;
    document.head.appendChild(style);
    document.body.appendChild(bar);

    document.getElementById('jaf-pause-bot-btn').addEventListener('click', () => {
      chrome.storage.local.set({ jafBotState: { active: false } }, () => {
        bar.remove();
        log('Bot stopped by user.');
        alert('AI Auto-Apply Bot stopped.');
      });
    });
  }

  async function runSearchPageBot(state) {
    let jobCards = [];
    if (location.hostname.includes('linkedin.com')) {
      jobCards = Array.from(document.querySelectorAll('.jobs-search-results-list__list-item, .job-card-container, [data-job-id]'));
    } else if (location.hostname.includes('indeed.com')) {
      jobCards = Array.from(document.querySelectorAll('[data-jk], .cardOutline'));
    }

    if (jobCards.length === 0) {
      log('No job cards found. Waiting...');
      setTimeout(() => runSearchPageBot(state), 2000);
      return;
    }

    const index = state.currentJobIndex % jobCards.length;
    const selectedCard = jobCards[index];
    if (!selectedCard) {
      log('No card at index. Resetting index to 0.');
      state.currentJobIndex = 0;
      chrome.storage.local.set({ jafBotState: state });
      return;
    }

    log(`Clicking job card #${index + 1}...`);
    selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    selectedCard.click();

    setTimeout(() => {
      let applyBtn = null;
      if (location.hostname.includes('linkedin.com')) {
        applyBtn = document.querySelector('button.jobs-apply-button');
      } else if (location.hostname.includes('indeed.com')) {
        applyBtn = document.querySelector('button.ia-IndeedApplyButton, [class*="IndeedApplyButton"]');
      }

      if (applyBtn) {
        const text = applyBtn.textContent.toLowerCase();
        if (text.includes('easy apply') || text.includes('apply now') || text.includes('apply on indeed') || location.hostname.includes('indeed.com')) {
          log('Easy Apply button found! Clicking...');
          applyBtn.click();
          setTimeout(() => runModalApplicationBot(state), 2000);
        } else {
          log('Not an Easy Apply job. Skipping to next job.');
          moveToNextJob(state);
        }
      } else {
        log('Apply button not found (already applied or external). Skipping...');
        moveToNextJob(state);
      }
    }, 2500);
  }

  function isJobApplicationModalOpen() {
    return document.querySelector('.jobs-easy-apply-modal, [role="dialog"], #indeedApplyModal, .ia-IndeedApplyModal') !== null;
  }

  async function runModalApplicationBot(state) {
    const modal = document.querySelector('.jobs-easy-apply-modal, [role="dialog"], #indeedApplyModal, .ia-IndeedApplyModal');
    if (!modal) {
      log('Modal closed. Checking if we need to return to list...');
      return;
    }

    log('Modal open. Autofilling current step...');
    chrome.storage.local.get('jobProfile', async (resProfile) => {
      const profile = resProfile.jobProfile;
      if (!profile) return;

      autofillForm(profile);

      setTimeout(() => {
        let nextBtn = null;
        let submitBtn = null;

        if (location.hostname.includes('linkedin.com')) {
          nextBtn = modal.querySelector('button[aria-label*="Continue"], button[aria-label*="next"], button[aria-label*="Review"]');
          submitBtn = modal.querySelector('button[aria-label*="Submit"]');
        } else if (location.hostname.includes('indeed.com')) {
          nextBtn = modal.querySelector('button.ia-continueButton, [class*="continue"]');
          submitBtn = modal.querySelector('button.ia-continueButton[type="submit"], [class*="submit"]');
        }

        if (submitBtn) {
          if (state.autoSubmit) {
            log('Auto-Submit enabled. Clicking Submit application!');
            submitBtn.click();
            setTimeout(() => {
              closeModal(modal);
              moveToNextJob(state);
            }, 3000);
          } else {
            log('Auto-Submit disabled. Pausing on final review page for manual review.');
            const overlay = document.createElement('div');
            overlay.style.cssText = 'background:#10b981;color:white;padding:12px;text-align:center;font-weight:bold;font-size:15px;position:sticky;top:0;z-index:999999;';
            overlay.textContent = '✨ Bot filled everything! Please review and click Submit application yourself. Once submitted, close the modal to let the bot continue.';
            modal.insertBefore(overlay, modal.firstChild);
            
            const modalObserver = new MutationObserver(() => {
              if (!isJobApplicationModalOpen()) {
                modalObserver.disconnect();
                moveToNextJob(state);
              }
            });
            modalObserver.observe(document.body, { childList: true, subtree: true });
          }
        } else if (nextBtn) {
          log('Clicking Next step...');
          nextBtn.click();
          setTimeout(() => runModalApplicationBot(state), 2000);
        } else {
          log('No navigation buttons found. May require manual action.');
        }
      }, 1000);
    });
  }

  function closeModal(modal) {
    const closeBtn = modal.querySelector('button[aria-label*="Dismiss"], button[aria-label*="Close"], .ia-close-button');
    if (closeBtn) closeBtn.click();
    document.body.click();
  }

  function moveToNextJob(state) {
    state.currentJobIndex++;
    chrome.storage.local.set({ jafBotState: state }, () => {
      log(`Moving to next job card index: ${state.currentJobIndex}`);
      if (isJobSearchPage()) {
        runSearchPageBot(state);
      } else {
        location.reload();
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.jafBotState) {
      const state = changes.jafBotState.newValue;
      if (state && state.active) {
        log('Bot state changed to active! Starting bot...');
        initAutoApplyBot();
      } else {
        const bar = document.getElementById('jaf-bot-control-bar');
        if (bar) bar.remove();
      }
    }
  });

  // Initialize Auto-Apply Bot on load
  initAutoApplyBot();

  // On page load, check if we should auto-resume filling
  chrome.storage.local.get(['jafAutoAdvancing', 'jafAutoAdvanceHost', 'jobProfile', 'jafBotState'], (res) => {
    if (res.jafBotState && res.jafBotState.active) return;
    
    if (res.jafAutoAdvancing) {
      if (res.jafAutoAdvanceHost === location.hostname) {
        log('[JAF AutoAdvance] Resuming auto-advance on this host...');
        jafAutoAdvancing = true;
        // Wait for page load completely before filling
        setTimeout(() => {
          if (res.jobProfile) {
            autofillForm(res.jobProfile);
          }
        }, 1200);
      } else {
        log('[JAF AutoAdvance] Host changed. Disabling auto-advance.');
        chrome.storage.local.set({ jafAutoAdvancing: false, jafAutoAdvanceHost: '' });
      }
    }
  });

  // Periodic check for step signature change (SPA wizard support)
  setInterval(() => {
    if (!waitingForNextStep) return;

    chrome.storage.local.get(['jafAutoAdvancing', 'jafAutoAdvanceHost', 'jobProfile'], (res) => {
      if (!res.jafAutoAdvancing || res.jafAutoAdvanceHost !== location.hostname) {
        waitingForNextStep = false;
        return;
      }

      const currentSig = getStepSignature();
      if (currentSig && currentSig !== lastStepSignature) {
        log('[JAF AutoAdvance] Step signature changed! Old:', lastStepSignature, 'New:', currentSig);
        waitingForNextStep = false;
        lastStepSignature = currentSig;

        setTimeout(() => {
          log('[JAF AutoAdvance] Auto-filling new step...');
          if (res.jobProfile) {
            autofillForm(res.jobProfile);
          }
        }, 800);
      }
    });
  }, 400);

  // ── Message Listener ──────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'AUTOFILL') {
      chrome.storage.local.get('jobProfile', (result) => {
        if (result.jobProfile) {
          try {
            // Enable auto-advancing mode
            chrome.storage.local.set({
              jafAutoAdvancing: true,
              jafAutoAdvanceHost: location.hostname
            }, () => {
              jafAutoAdvancing = true;
              waitingForNextStep = false;
              
              const report = autofillForm(result.jobProfile);
              
              // Broadcast to child iframes
              if (window === window.top) {
                const frames = document.getElementsByTagName('iframe');
                for (let i = 0; i < frames.length; i++) {
                  try {
                    frames[i].contentWindow.postMessage({ action: 'JAF_FORWARD_AUTOFILL' }, '*');
                  } catch (e) {}
                }
              }

              sendResponse({ success: true, count: report.filled, report });
            });
          } catch (e) {
            warn('Autofill error:', e);
            sendResponse({ success: false, error: e.message });
          }
        } else {
          sendResponse({ success: false, reason: 'no_profile' });
        }
      });
      return true;
    }

    if (request.action === 'UNDO') {
      let undone = 0;
      while (undoHistory.length > 0) {
        const entry = undoHistory.pop();
        try {
          if (entry.element.type === 'radio' || entry.element.type === 'checkbox') {
            entry.element.checked = entry.previousValue;
          } else if (typeof entry.previousValue === 'number') {
            entry.element.selectedIndex = entry.previousValue;
          } else {
            entry.element.value = entry.previousValue;
          }
          dispatchFullEventChain(entry.element);
          undone++;
        } catch (e) { /* element may no longer exist */ }
      }
      sendResponse({ success: true, undone });
      return true;
    }
  });

  // Listen for forwarded messages in subframes
  window.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'JAF_FORWARD_AUTOFILL') {
      log('Received JAF_FORWARD_AUTOFILL message in iframe.');
      chrome.storage.local.get('jobProfile', (result) => {
        if (result.jobProfile) {
          try {
            autofillForm(result.jobProfile);
          } catch (e) {
            warn('Iframe autofill error:', e);
          }
        }
      });
    }
  });

  log('Content script loaded and ready.');
})();
