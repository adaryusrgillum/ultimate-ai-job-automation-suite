/* ===================================================================
   ATS Platform Detector — Identifies which ATS a page uses
   Returns a platform key so the autofiller can apply platform-specific logic.
   =================================================================== */

const ATS_PLATFORMS = {
  greenhouse: {
    name: 'Greenhouse',
    detect: () => {
      if (location.hostname.includes('greenhouse.io')) return true;
      if (document.querySelector('input[name^="job_application"]')) return true;
      return false;
    },
    fieldMap: {
      firstName: 'input[name="job_application[first_name]"]',
      lastName:  'input[name="job_application[last_name]"]',
      email:     'input[name="job_application[email]"]',
      phone:     'input[name="job_application[phone]"]',
    }
  },

  lever: {
    name: 'Lever',
    detect: () => {
      if (location.hostname.includes('lever.co')) return true;
      if (document.querySelector('input[name="cards[0]"]')) return true;
      return false;
    },
    fieldMap: {
      fullName: 'input[name="name"]',
      email:    'input[type="email"]',
      phone:    'input[type="tel"]',
    }
  },

  workday: {
    name: 'Workday',
    detect: () => {
      if (location.hostname.includes('myworkdayjobs.com')) return true;
      if (document.querySelector('[data-automation-id]')) return true;
      return false;
    },
    fieldMap: {}, // Workday uses ARIA labels, handled by main heuristics
    useAriaLabels: true
  },

  icims: {
    name: 'iCIMS',
    detect: () => {
      if (location.hostname.includes('icims.com')) return true;
      return false;
    },
    fieldMap: {}
  },

  taleo: {
    name: 'Taleo (Oracle)',
    detect: () => {
      if (location.hostname.includes('taleo.net')) return true;
      if (location.hostname.includes('oraclecloud.com') && location.pathname.includes('hcmUI')) return true;
      return false;
    },
    fieldMap: {}
  },

  bamboohr: {
    name: 'BambooHR',
    detect: () => {
      if (location.hostname.includes('bamboohr.com')) return true;
      return false;
    },
    fieldMap: {}
  },

  adp: {
    name: 'ADP',
    detect: () => {
      if (document.querySelector('recruitment-current-openings')) return true;
      return false;
    },
    fieldMap: {}
  },

  jobvite: {
    name: 'Jobvite',
    detect: () => {
      if (location.hostname.includes('jobvite.com')) return true;
      return false;
    },
    fieldMap: {
      firstName: 'input[name="firstName"]',
      lastName:  'input[name="lastName"]',
    }
  },

  smartrecruiters: {
    name: 'SmartRecruiters',
    detect: () => {
      if (location.hostname.includes('smartrecruiters.com')) return true;
      return false;
    },
    fieldMap: {}
  },

  ashby: {
    name: 'Ashby',
    detect: () => {
      if (location.hostname.includes('ashbyhq.com')) return true;
      return false;
    },
    fieldMap: {}
  },

  breezyhr: {
    name: 'Breezy HR',
    detect: () => {
      if (location.hostname.includes('breezy.hr')) return true;
      return false;
    },
    fieldMap: {}
  },

  jazzhr: {
    name: 'JazzHR',
    detect: () => {
      if (location.hostname.includes('applytojob.com')) return true;
      if (document.querySelector('#apply-form')) return true;
      return false;
    },
    fieldMap: {}
  },

  rippling: {
    name: 'Rippling',
    detect: () => {
      if (location.hostname.includes('rippling.com')) return true;
      return false;
    },
    fieldMap: {}
  },

  linkedin: {
    name: 'LinkedIn Easy Apply',
    detect: () => {
      if (location.hostname.includes('linkedin.com') && location.pathname.includes('/jobs')) return true;
      if (document.querySelector('.jobs-easy-apply-form-section__grouping')) return true;
      return false;
    },
    fieldMap: {},
    useAriaLabels: true
  },

  indeed: {
    name: 'Indeed Apply',
    detect: () => {
      if (location.hostname.includes('indeed.com')) return true;
      if (document.querySelector('.indeed-apply-widget')) return true;
      return false;
    },
    fieldMap: {},
    isIframe: true // Cannot autofill — cross-origin
  },

  gusto: {
    name: 'Gusto',
    detect: () => {
      if (location.hostname.includes('gusto.com')) return true;
      return false;
    },
    fieldMap: {}
  },

  paylocity: {
    name: 'Paylocity',
    detect: () => {
      if (location.hostname.includes('paylocity.com')) return true;
      return false;
    },
    fieldMap: {}
  },

  paycom: {
    name: 'Paycom',
    detect: () => {
      if (location.hostname.includes('paycom.com') || location.hostname.includes('paycomonline.com')) return true;
      return false;
    },
    fieldMap: {}
  },

  ukg: {
    name: 'UKG / UltiPro',
    detect: () => {
      if (location.hostname.includes('ultipro.com')) return true;
      return false;
    },
    fieldMap: {},
    useAriaLabels: true
  },

  successfactors: {
    name: 'SuccessFactors (SAP)',
    detect: () => {
      if (location.hostname.includes('successfactors.com') || location.hostname.includes('successfactors.eu')) return true;
      return false;
    },
    fieldMap: {}
  }
};

/**
 * Detect which ATS platform the current page belongs to.
 * @returns {{ key: string, platform: object } | null}
 */
function detectPlatform() {
  for (const [key, platform] of Object.entries(ATS_PLATFORMS)) {
    try {
      if (platform.detect()) {
        console.log(`[JAF] Detected ATS Platform: ${platform.name}`);
        return { key, platform };
      }
    } catch (e) {
      // Detection failed silently — move to next
    }
  }
  return null;
}

/**
 * Try to fill fields using platform-specific selectors first.
 * @returns {number} Number of fields filled
 */
function fillWithPlatformSelectors(platform, profileData) {
  let filled = 0;
  if (!platform.fieldMap) return filled;

  for (const [field, selector] of Object.entries(platform.fieldMap)) {
    const element = document.querySelector(selector);
    if (element && !element.value) {
      let value = '';
      if (field === 'fullName') {
        value = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
      } else {
        value = profileData[field] || '';
      }
      if (value) {
        // Use the global setNativeValue from content.js
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        filled++;
      }
    }
  }

  return filled;
}
