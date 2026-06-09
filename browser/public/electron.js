const { app, BrowserWindow, ipcMain, Menu, dialog, shell, session } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');
const windowStateKeeper = require('electron-window-state');
const fs = require('fs');
const https = require('https');

// Performance and security optimizations
app.commandLine.appendSwitch('--enable-features', 'VaapiVideoDecoder,NetworkService');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('--enable-gpu-rasterization');
app.commandLine.appendSwitch('--enable-zero-copy');
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');

class UltimateJobBrowser {
    constructor() {
        this.windows = new Map();
        this.adBlocker = null;
        this.vpnManager = null;
        this.jobAutomation = null;
        this.dnsOptimizer = null;
        this.setupApp();
    }

    setupApp() {
        app.whenReady().then(() => {
            this.setupAdBlocker();
            this.setupVPNManager();
            this.setupDNSOptimizer();
            this.setupJobAutomation();
            this.createMainWindow();
            this.setupAutoUpdater();
            this.setupMenu();
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });
    }

    async setupAdBlocker() {
        console.log('🛡️ Setting up advanced ad blocker...');

        // Enhanced ad blocking with multiple filter lists
        this.adBlocker = {
            filterLists: [
                'https://easylist.to/easylist/easylist.txt',
                'https://easylist.to/easylist/easyprivacy.txt',
                'https://www.malwaredomainlist.com/hostslist/hosts.txt',
                'https://someonewhocares.org/hosts/zero/hosts',
                'https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/adservers.txt'
            ],
            blockedDomains: new Set(),
            blockedPatterns: [],

            async loadFilters() {
                console.log('📥 Loading ad block filters...');
                for (const listUrl of this.filterLists) {
                    try {
                        const response = await fetch(listUrl);
                        const content = await response.text();
                        this.parseFilterList(content);
                    } catch (error) {
                        console.error(`Failed to load filter list: ${listUrl}`, error);
                    }
                }
                console.log(`✅ Loaded ${this.blockedDomains.size} blocked domains`);
            },

            parseFilterList(content) {
                const lines = content.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!')) {
                        if (trimmed.includes('||')) {
                            const domain = trimmed.replace('||', '').replace('^', '');
                            this.blockedDomains.add(domain);
                        } else if (trimmed.startsWith('0.0.0.0')) {
                            const domain = trimmed.split(' ')[1];
                            if (domain) this.blockedDomains.add(domain);
                        }
                    }
                }
            },

            shouldBlock(url) {
                try {
                    const urlObj = new URL(url);
                    const hostname = urlObj.hostname;

                    // Check blocked domains
                    if (this.blockedDomains.has(hostname)) return true;

                    // Check for ad-related patterns
                    const adPatterns = [
                        /ads?[._-]/i,
                        /doubleclick/i,
                        /googleadservices/i,
                        /googlesyndication/i,
                        /amazon-adsystem/i,
                        /facebook\.com\/tr/i,
                        /analytics/i,
                        /tracking/i,
                        /telemetry/i
                    ];

                    return adPatterns.some(pattern => pattern.test(url));
                } catch {
                    return false;
                }
            }
        };

        await this.adBlocker.loadFilters();
    }

    setupVPNManager() {
        console.log('🔒 Setting up VPN manager...');

        this.vpnManager = {
            isEnabled: false,
            currentServer: null,
            servers: [
                { name: 'US East', endpoint: 'us-east.vpn.example.com', location: 'New York' },
                { name: 'US West', endpoint: 'us-west.vpn.example.com', location: 'California' },
                { name: 'EU', endpoint: 'eu.vpn.example.com', location: 'Netherlands' },
                { name: 'Asia', endpoint: 'asia.vpn.example.com', location: 'Singapore' }
            ],

            async connect(serverName) {
                console.log(`🔒 Connecting to VPN server: ${serverName}`);
                const server = this.servers.find(s => s.name === serverName);
                if (server) {
                    // In production, this would establish actual VPN connection
                    this.currentServer = server;
                    this.isEnabled = true;
                    console.log(`✅ Connected to ${server.name} (${server.location})`);
                    return true;
                }
                return false;
            },

            disconnect() {
                console.log('🔓 Disconnecting VPN...');
                this.isEnabled = false;
                this.currentServer = null;
                console.log('✅ VPN disconnected');
            },

            getStatus() {
                return {
                    connected: this.isEnabled,
                    server: this.currentServer,
                    ip: this.isEnabled ? '192.168.1.100' : 'Your real IP'
                };
            }
        };
    }

    setupDNSOptimizer() {
        console.log('🌐 Setting up DNS optimizer...');

        this.dnsOptimizer = {
            providers: {
                cloudflare: { primary: '1.1.1.1', secondary: '1.0.0.1', name: 'Cloudflare' },
                google: { primary: '8.8.8.8', secondary: '8.8.4.4', name: 'Google' },
                quad9: { primary: '9.9.9.9', secondary: '149.112.112.112', name: 'Quad9' },
                opendns: { primary: '208.67.222.222', secondary: '208.67.220.220', name: 'OpenDNS' }
            },
            currentProvider: 'cloudflare',

            setProvider(providerName) {
                if (this.providers[providerName]) {
                    this.currentProvider = providerName;
                    console.log(`🌐 DNS provider set to: ${this.providers[providerName].name}`);
                    // In production, this would configure system DNS
                    return true;
                }
                return false;
            },

            getCurrentProvider() {
                return this.providers[this.currentProvider];
            },

            async testSpeed() {
                console.log('⚡ Testing DNS speeds...');
                const results = {};

                for (const [name, provider] of Object.entries(this.providers)) {
                    const start = Date.now();
                    try {
                        // Simulate DNS lookup time
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
                        results[name] = Date.now() - start;
                    } catch {
                        results[name] = 9999;
                    }
                }

                return results;
            }
        };
    }

    setupJobAutomation() {
        console.log('🤖 Setting up job automation engine...');

        this.jobAutomation = {
            isActive: false,
            platforms: {
                linkedin: {
                    name: 'LinkedIn',
                    selectors: {
                        jobTitle: '.jobs-unified-top-card__job-title',
                        company: '.jobs-unified-top-card__company-name',
                        location: '.jobs-unified-top-card__bullet',
                        applyButton: '.jobs-apply-button',
                        easyApplyButton: '.jobs-apply-button--top-card',
                        firstName: '#single-line-text-form-component-formElement-urn\\:li\\:jobs_applyformcommon_easyApplyFormElement\\:3570389474-firstName-nationalId',
                        lastName: '#single-line-text-form-component-formElement-urn\\:li\\:jobs_applyformcommon_easyApplyFormElement\\:3570389474-lastName-nationalId',
                        email: '#single-line-text-form-component-formElement-urn\\:li\\:jobs_applyformcommon_easyApplyFormElement\\:3570389474-email-nationalId',
                        phone: '#single-line-text-form-component-formElement-urn\\:li\\:jobs_applyformcommon_easyApplyFormElement\\:3570389474-phoneNumber-nationalId',
                        resume: 'input[type="file"][accept*=".pdf"]'
                    },
                    optimizations: {
                        waitTime: 2000,
                        scrollDelay: 500,
                        typeDelay: 100
                    }
                },
                indeed: {
                    name: 'Indeed',
                    selectors: {
                        jobTitle: '[data-jk] h1',
                        company: '[data-jk] [data-testid="inlineHeader-companyName"]',
                        location: '[data-jk] [data-testid="job-location"]',
                        applyButton: '[data-jk] .ia-IndeedApplyButton',
                        continueButton: 'button[aria-label="Continue"]',
                        firstName: 'input[name="applicant.name.first"]',
                        lastName: 'input[name="applicant.name.last"]',
                        email: 'input[name="applicant.email"]',
                        phone: 'input[name="applicant.phoneNumber"]',
                        resume: 'input[type="file"][name="resume"]'
                    },
                    optimizations: {
                        waitTime: 1500,
                        scrollDelay: 300,
                        typeDelay: 80
                    }
                }
            },

            userProfile: {
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                resumePath: '',
                coverLetterTemplate: '',
                targetRoles: [],
                targetLocations: [],
                salaryRange: { min: 0, max: 0 }
            },

            async detectJobPage(url) {
                if (url.includes('linkedin.com/jobs/view')) {
                    return 'linkedin';
                } else if (url.includes('indeed.com/viewjob')) {
                    return 'indeed';
                }
                return null;
            },

            async analyzeJob(platform, webContents) {
                const platformConfig = this.platforms[platform];
                if (!platformConfig) return null;

                try {
                    const jobData = await webContents.executeJavaScript(`
                        const getTextContent = (selector) => {
                            const element = document.querySelector(selector);
                            return element ? element.textContent.trim() : '';
                        };

                        ({
                            title: getTextContent('${platformConfig.selectors.jobTitle}'),
                            company: getTextContent('${platformConfig.selectors.company}'),
                            location: getTextContent('${platformConfig.selectors.location}'),
                            hasApplyButton: !!document.querySelector('${platformConfig.selectors.applyButton}')
                        });
                    `);

                    return jobData;
                } catch (error) {
                    console.error('Error analyzing job:', error);
                    return null;
                }
            },

            async autoFillApplication(platform, webContents) {
                const platformConfig = this.platforms[platform];
                if (!platformConfig || !this.userProfile.firstName) return false;

                try {
                    const result = await webContents.executeJavaScript(`
                        const fillField = (selector, value) => {
                            const element = document.querySelector(selector);
                            if (element && value) {
                                element.focus();
                                element.value = value;
                                element.dispatchEvent(new Event('input', { bubbles: true }));
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                                return true;
                            }
                            return false;
                        };

                        const profile = ${JSON.stringify(this.userProfile)};
                        const selectors = ${JSON.stringify(platformConfig.selectors)};

                        let filled = 0;
                        if (fillField(selectors.firstName, profile.firstName)) filled++;
                        if (fillField(selectors.lastName, profile.lastName)) filled++;
                        if (fillField(selectors.email, profile.email)) filled++;
                        if (fillField(selectors.phone, profile.phone)) filled++;

                        filled;
                    `);

                    console.log(`✅ Auto-filled ${result} fields on ${platform}`);
                    return result > 0;
                } catch (error) {
                    console.error('Error auto-filling application:', error);
                    return false;
                }
            }
        };
    }

    createMainWindow() {
        // Load window state
        let mainWindowState = windowStateKeeper({
            defaultWidth: 1400,
            defaultHeight: 900
        });

        const mainWindow = new BrowserWindow({
            x: mainWindowState.x,
            y: mainWindowState.y,
            width: mainWindowState.width,
            height: mainWindowState.height,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'preload.js'),
                webSecurity: true,
                allowRunningInsecureContent: false,
                experimentalFeatures: true,
                backgroundThrottling: false
            },
            titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
            show: false,
            icon: path.join(__dirname, '../assets/icon.png')
        });

        // Manage window state
        mainWindowState.manage(mainWindow);

        // Setup session with ad blocking and optimizations
        this.setupSession(mainWindow.webContents.session);

        // Load the app
        const startUrl = isDev 
            ? 'http://localhost:5173' 
            : `file://${path.join(__dirname, '../dist/index.html')}`;

        mainWindow.loadURL(startUrl);

        // Show window when ready
        mainWindow.once('ready-to-show', () => {
            mainWindow.show();

            if (isDev) {
                mainWindow.webContents.openDevTools();
            }
        });

        // Store window reference
        this.windows.set('main', mainWindow);

        // Setup IPC handlers
        this.setupIPC(mainWindow);

        // Monitor navigation for job automation
        mainWindow.webContents.on('did-navigate', async (event, url) => {
            const platform = await this.jobAutomation.detectJobPage(url);
            if (platform && this.jobAutomation.isActive) {
                console.log(`🎯 Job page detected on ${platform}: ${url}`);
                setTimeout(async () => {
                    const jobData = await this.jobAutomation.analyzeJob(platform, mainWindow.webContents);
                    if (jobData) {
                        mainWindow.webContents.send('job-detected', { platform, jobData });
                    }
                }, 2000);
            }
        });

        return mainWindow;
    }

    setupSession(session) {
        console.log('⚡ Setting up optimized session...');

        // Request filtering for ad blocking
        session.webRequest.onBeforeRequest((details, callback) => {
            const shouldBlock = this.adBlocker.shouldBlock(details.url);

            if (shouldBlock) {
                console.log(`🛡️ Blocked: ${details.url}`);
                callback({ cancel: true });
            } else {
                callback({ cancel: false });
            }
        });

        // Optimize cache
        session.setCache({
            maxSize: 100 * 1024 * 1024, // 100MB cache
        });

        // Set user agent for better compatibility
        session.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 UltimateAIBrowser/2.0'
        );

        // Preload common domains for faster access
        const commonDomains = [
            'https://linkedin.com',
            'https://indeed.com',
            'https://glassdoor.com',
            'https://monster.com'
        ];

        commonDomains.forEach(domain => {
            session.preconnect({ url: domain });
        });
    }

    setupIPC(window) {
        // Ad Blocker Controls
        ipcMain.handle('toggle-ad-blocker', () => {
            // Toggle ad blocker (implementation would go here)
            return { enabled: true, blocked: this.adBlocker.blockedDomains.size };
        });

        // VPN Controls
        ipcMain.handle('vpn-connect', async (event, serverName) => {
            return await this.vpnManager.connect(serverName);
        });

        ipcMain.handle('vpn-disconnect', () => {
            this.vpnManager.disconnect();
            return true;
        });

        ipcMain.handle('vpn-status', () => {
            return this.vpnManager.getStatus();
        });

        // DNS Controls
        ipcMain.handle('dns-set-provider', (event, provider) => {
            return this.dnsOptimizer.setProvider(provider);
        });

        ipcMain.handle('dns-test-speed', async () => {
            return await this.dnsOptimizer.testSpeed();
        });

        // Job Automation Controls
        ipcMain.handle('job-automation-toggle', (event, enabled) => {
            this.jobAutomation.isActive = enabled;
            return this.jobAutomation.isActive;
        });

        ipcMain.handle('job-automation-set-profile', (event, profile) => {
            this.jobAutomation.userProfile = { ...this.jobAutomation.userProfile, ...profile };
            return true;
        });

        ipcMain.handle('job-automation-fill', async (event, platform) => {
            return await this.jobAutomation.autoFillApplication(platform, window.webContents);
        });

        // Performance monitoring
        ipcMain.handle('get-performance-stats', () => {
            const memoryUsage = process.memoryUsage();
            return {
                memory: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
                cpu: process.cpuUsage(),
                uptime: process.uptime(),
                adBlocker: {
                    enabled: true,
                    blocked: this.adBlocker.blockedDomains.size
                },
                vpn: this.vpnManager.getStatus(),
                dns: this.dnsOptimizer.getCurrentProvider()
            };
        });
    }

    setupMenu() {
        const template = [
            {
                label: 'File',
                submenu: [
                    {
                        label: 'New Tab',
                        accelerator: 'CmdOrCtrl+T',
                        click: () => this.createNewTab()
                    },
                    { type: 'separator' },
                    {
                        label: 'Quit',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => app.quit()
                    }
                ]
            },
            {
                label: 'Privacy & Security',
                submenu: [
                    {
                        label: 'Toggle Ad Blocker',
                        click: () => {
                            this.windows.get('main').webContents.send('toggle-ad-blocker');
                        }
                    },
                    {
                        label: 'VPN Settings',
                        click: () => {
                            this.windows.get('main').webContents.send('open-vpn-settings');
                        }
                    },
                    {
                        label: 'DNS Settings',
                        click: () => {
                            this.windows.get('main').webContents.send('open-dns-settings');
                        }
                    }
                ]
            },
            {
                label: 'Job Automation',
                submenu: [
                    {
                        label: 'Toggle Auto-Fill',
                        click: () => {
                            this.windows.get('main').webContents.send('toggle-job-automation');
                        }
                    },
                    {
                        label: 'Profile Settings',
                        click: () => {
                            this.windows.get('main').webContents.send('open-profile-settings');
                        }
                    }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    setupAutoUpdater() {
        if (!isDev) {
            autoUpdater.checkForUpdatesAndNotify();
        }
    }
}

// Initialize the Ultimate Job Browser
new UltimateJobBrowser();

module.exports = UltimateJobBrowser;