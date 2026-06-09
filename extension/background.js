const defaultProfile = {
  firstName: "Adaryus",
  lastName: "Gillum",
  middleName: "Ryan",
  prefix: "Mr.",
  pronouns: "He/Him",
  email: "adaryusg@aol.com",
  phone: "(304) 290-7713",
  dob: "09/04/2000",
  birthplace: "Buckhannon, West Virginia",
  physicalAddress: "5310 University Commons Dr, Morgantown, WV",
  addressLine2: "Apt 204",
  city: "Morgantown",
  state: "West Virginia",
  zip: "26505",
  country: "United States",
  mailingAddress: "52 Phillips Dairy Rd, Buckhannon, WV 26201",
  gender: "Male",
  race: "White",
  veteran: "Veteran",
  disability: "No",
  linkedin: "https://linkedin.com/in/adaryus",
  github: "https://github.com/adaryus",
  twitter: "https://x.com/adaryus",
  portfolio: "https://adaryus.com",
  gpa: "4.0",
  gradYear: "2026",
  major: "Artificial Intelligence Marketing",
  university: "West Virginia University",
  salary: "160,000",
  noticePeriod: "2 weeks",
  referralSource: "LinkedIn",
  skills: "AI / ML & Data Science: Python, R, SAS, SPSS, SQL, prompt engineering (Persona/Task/Context/Format), k-means clustering, k-NN, matrix factorization, sentiment analysis, topic modeling, NLP pipelines, t-tests, inferential statistics, Stable Diffusion, local LLM setup/fine-tuning.\nMarTech & Analytics: Brand24, Google Analytics 4 (GA4), Looker Studio, Tableau, Sprout Social, Hootsuite, Meta Ads Manager, HubSpot, Salesforce, Apify, GA4 measurement plans, UTM frameworks, SEO/Local SEO/AEO-GEO.\nWeb & Applications: WordPress, Next.js, React, Three.js, HTML/CSS, JavaScript, conversion-focused website architecture, desktop application builds.\nUAV & Geospatial: LiDAR, GIS (ArcGIS), CAD, 3D modeling, VR/AR, aerial photogrammetry/mapping.\nCreative & Production: Adobe Creative Suite, Canva, photography, videography, drone imaging, visual branding, social media creative direction.\nLicenses/Certs: FAA Part 107 Small UAS Pilot, Transport Canada RPAS Advanced Operations, WV & WA Insurance Producer, CITI Responsible Conduct of Research, FEMA Incident Command (ICS-100, ICS-200, IS-700, IS-800), Medical Cannabis Specialization, ANITD Negotiation Professional.",
  experience: "Founder & AI Marketing Strategist — AdvertiseWV LLC, Morgantown, WV (2024 - Present)\n- Build and operate marketing studio serving regional businesses with visibility, credibility, and lead generation.\n- Developed AI-driven automation workflows (OpenAI API, n8n, CRM/chatbot integrations) reducing operational costs by 47% and increasing conversions.\n- Delivered 50+ websites and 15+ applications using Next.js, React, Three.js, and WordPress.\n\nFounder & Lead Pilot — Elevated Imaging LLC, West Virginia (Jan 2021 - Present)\n- Logged 250+ professional flight hours across infrastructure, construction, and real estate sectors.\n- Conducted high-precision LiDAR surveys and 3D mapping; integrated data with CAD and GIS software for enterprise clients (e.g., CBRE, Zeitview).\n- Maintained dual licensure: FAA Part 107 (US) and Transport Canada RPAS Advanced Operations.\n\nMedia Consultant — Prospect & Price Creative, Morgantown, WV (Aug 2023 - May 2024)\n- Architected multi-channel marketing plans for SMBs across Google Ads, Meta, and LinkedIn.\n- Built GA4 measurement plans and UTM frameworks; aligned KPIs (CTR, CPC, CPA, ROAS) to funnel stage.\n- Ran SEO audits and on-page optimization for metadata and site architecture.\n\nUndergraduate Research Apprentice — WVU Construction Informatics Lab (Jan 2024 - Dec 2024)\n- Collected high-precision spatial data using UAV-mounted LiDAR and photogrammetry for industrial inspection scenarios.\n- Converted aerial datasets into 3D models and integrated them into immersive VR/AR environments for remote inspection workflows.\n- Applied mathematical modeling to improve inspection accuracy and real-time data reliability.\n\nGraduation Photographer — Balfour & Co., Morgantown, WV (Oct 2021 - Aug 2025)\n- Photographed 16,000+ graduates across 35+ commencement ceremonies in fast-paced live environments.\n- Managed lighting conditions, workflow timing, and real-time problem-solving.\n\nExtraction Technician — Mountaineer Green Ventures (Aug 2019 - Sept 2021)\n- Operated laboratory processes including rotary evaporation, lipid filtration, and short-path distillation to standardize formulations.\n\nAcademic Project: Graduate Consulting Practicum (Abel Insurance Group) — Buckhannon, WV (Fall 2025)\n- Applied AI-driven research methods (SWOT, social listening, NLP sentiment analysis, topic modeling, behavioral segmentation, t-tests) to diagnose and bridge brand visibility gap.",
  coverLetter: "I am an AI-augmented marketing strategist, founder of AdvertiseWV LLC, and Master of Science candidate in Artificial Intelligence Marketing at West Virginia University (GPA: 4.0, Expected Aug 2026). I combine entrepreneurial business ownership with advanced technical skills, specializing in prompt engineering, n8n automation workflows, and Next.js/React web development. I hold certifications in Google Analytics 4, Google Ads, and HubSpot SEO, and possess a strong background in NLP sentiment analysis, audience segmentation, and geospatial mapping (FAA Part 107 pilot). I am passionate about leveraging AI, data, and technology to optimize marketing campaigns and drive business growth.",
  localLlmUrl: "http://localhost:11434/v1/chat/completions",
  localLlmModel: "gemma4:latest",
  cloudProvider: "local",
  openaiApiKey: "",
  geminiApiKey: "",
  anthropicApiKey: ""
};

const PREFERRED_LOCAL_MODEL = "gemma4:latest";
const LLM_TIMEOUT_MS = 240000;

async function postJsonWithTimeout(url, payload, headers = {}, timeoutMs = LLM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      throw new Error(`API returned non-JSON response (${response.status}).`);
    }

    if (!response.ok) {
      const message = data?.error?.message || data?.message || response.statusText || 'Request failed';
      throw new Error(`HTTP ${response.status}: ${message}`);
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function queryLlm(profile, systemPrompt, userPrompt, temperature = 0.3, maxTokens = 350) {
  const provider = profile.cloudProvider || 'local';
  let url = '';
  let headers = {};
  let payload = {};
  let isAnthropic = false;

  try {
    if (provider === 'openai' && profile.openaiApiKey) {
      url = 'https://api.openai.com/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${profile.openaiApiKey}` };
      payload = {
        model: profile.localLlmModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: temperature,
        max_tokens: maxTokens
      };
    } else if (provider === 'gemini' && profile.geminiApiKey) {
      url = 'https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${profile.geminiApiKey}` };
      payload = {
        model: profile.localLlmModel || 'gemini-1.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: temperature,
        max_tokens: maxTokens
      };
    } else if (provider === 'anthropic' && profile.anthropicApiKey) {
      url = 'https://api.anthropic.com/v1/messages';
      headers = {
        'x-api-key': profile.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      };
      isAnthropic = true;
      payload = {
        model: profile.localLlmModel || 'claude-3-5-sonnet-latest',
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        temperature: temperature,
        max_tokens: maxTokens
      };
    } else {
      // Local Ollama
      url = profile.localLlmUrl || 'http://localhost:11434/v1/chat/completions';
      payload = {
        model: profile.localLlmModel || 'gemma4:latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: temperature,
        max_tokens: maxTokens
      };
    }

    const data = await postJsonWithTimeout(url, payload, headers);
    
    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }

    if (isAnthropic) {
      return data?.content?.[0]?.text || '';
    } else {
      return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.response || '';
    }
  } catch (err) {
    if (provider !== 'local') {
      console.warn(`[JAF Cloud Llm] Cloud provider ${provider} failed: ${err.message}. Falling back to local Ollama...`);
      const localUrl = profile.localLlmUrl || 'http://localhost:11434/v1/chat/completions';
      const localPayload = {
        model: 'gemma4:latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: temperature,
        max_tokens: maxTokens
      };
      try {
        const data = await postJsonWithTimeout(localUrl, localPayload, {});
        return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.response || '';
      } catch (localErr) {
        throw new Error(`Both cloud LLM and local fallback failed. Local error: ${localErr.message}`);
      }
    }
    throw err;
  }
}

function cleanGeneratedText(text) {
  return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function buildFallbackAnswer(question, profile) {
  const lowerQuestion = String(question || '').toLowerCase();
  if (/\bsponsor|visa|h-?1b|employment visa/.test(lowerQuestion)) return 'No';
  if (/\bauthori[sz]ed|eligible to work|right to work|work in the united states/.test(lowerQuestion)) return 'Yes';
  if (/why|interest|motivat|work at|join/.test(lowerQuestion)) {
    return `I am excited about this role because it aligns with my experience applying AI, data analysis, and creative technology to solve practical business problems. My background in NLP, analytics, automation, and digital strategy would help me contribute quickly while continuing to grow as an AI engineer.`;
  }
  return `My background combines AI, data analysis, automation, and applied technology work, including NLP pipelines, analytics, prompt engineering, and web development. I would bring a practical, results-focused approach to this role.`;
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get('jobProfile', (result) => {
    if (!result.jobProfile) {
      // Fresh install — set the full default profile
      chrome.storage.local.set({ jobProfile: defaultProfile }, () => {
        console.log("Job Application Autofiller installed with default profile.");
      });
    } else {
      // Update — merge defaultProfile with stored profile to ensure all new CV values are updated,
      // but preserve user's LLM keys and cloud settings.
      const stored = result.jobProfile;
      const patched = {
        ...defaultProfile, // Start with latest CV defaults
        ...stored          // Overwrite with user's settings
      };

      // Specifically keep the latest CV values for these profile details
      const cvKeys = [
        'firstName', 'lastName', 'middleName', 'prefix', 'pronouns', 'email', 'phone', 'dob', 'birthplace',
        'physicalAddress', 'addressLine2', 'city', 'state', 'zip', 'country', 'mailingAddress', 'gender', 'race',
        'veteran', 'disability', 'linkedin', 'github', 'twitter', 'portfolio', 'gpa', 'gradYear', 'major',
        'university', 'skills', 'experience', 'coverLetter'
      ];
      cvKeys.forEach(key => {
        patched[key] = defaultProfile[key];
      });

      // Maintain local/cloud keys and provider setup
      patched.cloudProvider = stored.cloudProvider || defaultProfile.cloudProvider;
      patched.openaiApiKey = stored.openaiApiKey || defaultProfile.openaiApiKey;
      patched.geminiApiKey = stored.geminiApiKey || defaultProfile.geminiApiKey;
      patched.anthropicApiKey = stored.anthropicApiKey || defaultProfile.anthropicApiKey;
      patched.localLlmUrl = stored.localLlmUrl || defaultProfile.localLlmUrl;
      patched.localLlmModel = stored.localLlmModel || defaultProfile.localLlmModel;

      if (patched.localLlmModel === "deepseek-r1:1.5b" || !patched.localLlmModel) {
        patched.localLlmModel = PREFERRED_LOCAL_MODEL;
      }
      if (!patched.localLlmUrl) {
        patched.localLlmUrl = 'http://localhost:11434/v1/chat/completions';
      }

      chrome.storage.local.set({ jobProfile: patched }, () => {
        console.log("Job Application Autofiller profile patched to match CV, keeping LLM settings.");
      });
    }
  });
});

// ─── Generate a simple PDF from text ────────────────────────────────────────
function generatePdfBlob(title, bodyText, applicantName) {
  // Minimal valid PDF generator — no external libraries needed
  const lines = bodyText.split('\n');
  const pageWidth = 612;  // US Letter
  const pageHeight = 792;
  const margin = 72;      // 1 inch
  const lineHeight = 14;
  const maxCharsPerLine = 80;
  const usableHeight = pageHeight - margin * 2;
  const linesPerPage = Math.floor(usableHeight / lineHeight);

  // Word-wrap long lines
  const wrappedLines = [];
  for (const line of lines) {
    if (line.length <= maxCharsPerLine) {
      wrappedLines.push(line);
    } else {
      const words = line.split(' ');
      let current = '';
      for (const word of words) {
        if ((current + ' ' + word).trim().length > maxCharsPerLine) {
          wrappedLines.push(current.trim());
          current = word;
        } else {
          current += ' ' + word;
        }
      }
      if (current.trim()) wrappedLines.push(current.trim());
    }
  }

  // Chunk into pages
  const pages = [];
  for (let i = 0; i < wrappedLines.length; i += linesPerPage) {
    pages.push(wrappedLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(['']);

  // Escape PDF special chars
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  let objCount = 0;
  const objects = [];
  const addObj = (content) => {
    objCount++;
    objects.push({ id: objCount, content });
    return objCount;
  };

  // Obj 1: Catalog
  const catalogId = addObj('');
  // Obj 2: Pages parent
  const pagesId = addObj('');

  // Font object
  const fontId = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);

  const pageIds = [];
  const streamIds = [];

  for (const pageLines of pages) {
    // Build text stream
    let streamContent = `BT\n/F1 11 Tf\n${margin} ${pageHeight - margin} Td\n${lineHeight} TL\n`;
    for (const line of pageLines) {
      streamContent += `(${esc(line)}) Tj T*\n`;
    }
    streamContent += 'ET';

    const streamId = addObj(`<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`);
    streamIds.push(streamId);

    const pageId = addObj('');
    pageIds.push(pageId);
  }

  // Now fill in objects
  objects[catalogId - 1].content = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1].content = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  for (let i = 0; i < pageIds.length; i++) {
    objects[pageIds[i] - 1].content = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamIds[i]} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
  }

  // Build PDF
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objCount + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objCount + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

// Helper to compute token-based Jaccard similarity for question caching
function getJaccardSimilarity(str1, str2) {
  const words1 = new Set(str1.toLowerCase().match(/\b\w+\b/g) || []);
  const words2 = new Set(str2.toLowerCase().match(/\b\w+\b/g) || []);
  
  if (words1.size === 0 && words2.size === 0) return 1.0;
  if (words1.size === 0 || words2.size === 0) return 0.0;
  
  let intersection = 0;
  words1.forEach(word => {
    if (words2.has(word)) intersection++;
  });
  
  return intersection / (words1.size + words2.size - intersection);
}

// ─── Message Listener ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // ── AI Answer Generation ──
  if (request.action === 'GENERATE_AI_ANSWER') {
    chrome.storage.local.get(['jobProfile', 'aiAnswerCache'], async (result) => {
      const profile = result.jobProfile;
      if (!profile || !profile.localLlmUrl) {
        sendResponse({ success: false, error: 'Local LLM Endpoint not configured. Please open Options.' });
        return;
      }

      const cache = result.aiAnswerCache || {};
      const cacheKey = `${profile.firstName || ''}_${profile.lastName || ''}_${request.question.trim().toLowerCase()}`;

      // 1. Direct match check
      if (cache[cacheKey]) {
        console.log(`[JAF Cache] Direct cache hit for question: "${request.question}"`);
        sendResponse({ success: true, answer: cache[cacheKey], cached: true });
        return;
      }

      // 2. Fuzzy semantic match check
      const currentQuestionLower = request.question.trim().toLowerCase();
      const prefix = `${profile.firstName || ''}_${profile.lastName || ''}_`;
      let bestMatchKey = null;
      let bestMatchScore = 0.0;

      for (const key of Object.keys(cache)) {
        if (key.startsWith(prefix)) {
          const cachedQuestion = key.substring(prefix.length);
          const score = getJaccardSimilarity(currentQuestionLower, cachedQuestion);
          if (score > bestMatchScore) {
            bestMatchScore = score;
            bestMatchKey = key;
          }
        }
      }

      const SIMILARITY_THRESHOLD = 0.70; // 70% word overlap
      if (bestMatchScore >= SIMILARITY_THRESHOLD && bestMatchKey) {
        console.log(`[JAF Cache] Fuzzy cache hit (similarity: ${Math.round(bestMatchScore * 100)}%) for question: "${request.question}"`);
        sendResponse({ success: true, answer: cache[bestMatchKey], cached: true });
        return;
      }

      const systemPrompt = `You are a helpful job application assistant.
Your task is to write a highly tailored, concise response to the provided job application question based on the applicant's profile.
CRITICAL INSTRUCTIONS:
1. Output ONLY the raw answer to be pasted directly into the form field.
2. Do NOT repeat or echo the question, label, or context.
3. Do NOT include any pleasantries, intro, or concluding text (e.g., do NOT say "Here is the answer:" or "Sure, here's a response").
4. Do NOT wrap the answer in quotation marks.
5. If the question asks for a number (e.g. years of experience) or a simple Yes/No, output ONLY that number or "Yes"/"No".`;

      const userPrompt = `Applicant Profile:
Name: ${profile.firstName} ${profile.lastName}
Skills: ${profile.skills}
Experience: ${profile.experience}
Summary/Cover Letter context: ${profile.coverLetter}

Job Application Question:
"${request.question}"

Page Context (surrounding text):
"${request.context}"

Please write a professional, natural-sounding direct response to the question above. Remember: write ONLY the response text itself, do NOT repeat the question, do NOT use quotes, and do NOT add intro/outro text.`;

      try {
        const rawText = await queryLlm(profile, systemPrompt, userPrompt, 0.3, 350);
        const cleanAnswer = cleanGeneratedText(rawText);
        
        if (cleanAnswer) {
          // Save to cache
          cache[cacheKey] = cleanAnswer;
          chrome.storage.local.set({ aiAnswerCache: cache });
          sendResponse({ success: true, answer: cleanAnswer, cached: false });
        } else {
          sendResponse({ success: false, error: "Unexpected response format from LLM." });
        }
      } catch (err) {
        sendResponse({ success: false, error: "Failed to query LLM: " + (err.message || err.toString()) });
      }
    });
    return true;
  }

  // ── Cover Letter Generation & PDF Download (FAST) ──
  if (request.action === 'GENERATE_COVER_LETTER') {
    chrome.storage.local.get('jobProfile', async (result) => {
      const profile = result.jobProfile;
      if (!profile || !profile.localLlmUrl) {
        sendResponse({ success: false, error: 'Local LLM Endpoint not configured.' });
        return;
      }

      // Trim context aggressively — we only need job title, company, key requirements
      const rawContext = request.context || '';
      const trimmedContext = rawContext.substring(0, 800);

      const prompt = `Write a short, professional cover letter (max 250 words) for this job application.

Applicant: ${profile.firstName} ${profile.lastName} | ${profile.email} | ${profile.phone}
Skills: ${(profile.skills || '').substring(0, 300)}
Experience: ${(profile.experience || '').substring(0, 300)}

Job details:
${trimmedContext}

Write ONLY the cover letter text. No markdown. Start with "Dear Hiring Manager," and end with "Sincerely, ${profile.firstName} ${profile.lastName}".`;

      try {
        const systemPrompt = "You are a professional cover letter writer.";
        const rawText = await queryLlm(profile, systemPrompt, prompt, 0.5, 400);
        const coverLetterText = cleanGeneratedText(rawText);
        
        if (!coverLetterText) {
          sendResponse({ success: false, error: "Empty response from LLM." });
          return;
        }

        // Generate PDF
        const pdfBlob = generatePdfBlob(
          "Cover Letter",
          coverLetterText,
          `${profile.firstName} ${profile.lastName}`
        );

        // Convert blob to data URL for download
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result;
          const companyMatch = rawContext.match(/(?:at|for|join)\s+([A-Z][A-Za-z0-9\s&.'-]+?)(?:\s+as|\s+–|\s*-|\s*\||,|\n|\.)/);
          const companyName = companyMatch ? companyMatch[1].trim().replace(/\s+/g, '_') : 'Company';
          const filename = `Cover_Letter_${profile.firstName}_${profile.lastName}_${companyName}.pdf`;

          chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: false
          }, (downloadId) => {
            sendResponse({ 
              success: true, 
              coverLetter: coverLetterText,
              downloadId: downloadId,
              filename: filename,
              dataUrl: dataUrl
            });
          });
        };
        reader.readAsDataURL(pdfBlob);

      } catch (err) {
        sendResponse({ success: false, error: "Failed to generate cover letter: " + err.toString() });
      }
    });
    return true;
  }

  // ── Auto-Apply Bot Starter ──
  if (request.action === 'START_AUTO_APPLY') {
    const { keywords, location, autoSubmit } = request;
    const linkedinUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_AL=true`;
    
    chrome.storage.local.set({
      jafBotState: {
        active: true,
        keywords,
        location,
        autoSubmit,
        currentJobIndex: 0
      }
    }, () => {
      chrome.tabs.create({ url: linkedinUrl, active: true }, (tab) => {
        sendResponse({ success: true, tabId: tab.id });
      });
    });
    return true;
  }
});
