const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');
const windowStateKeeper = require('electron-window-state');

// Performance optimizations
app.commandLine.appendSwitch('--enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('--enable-gpu-rasterization');
app.commandLine.appendSwitch('--enable-zero-copy');

class UltimateBrowser {
    constructor() {
        this.windows = new Map();
        this.aiEngine = null;
        this.jobAutomation = null;
        this.setupApp();
    }

    setupApp() {
        app.whenReady().then(() => {
            this.createMainWindow();
            this.setupAIEngine();
            this.setupJobAutomation();
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
                experimentalFeatures: true
            },
            titleBarStyle: 'hiddenInset',
            show: false,
            icon: path.join(__dirname, 'assets/icon.png')
        });

        // Manage window state
        mainWindowState.manage(mainWindow);

        // Load the app
        const startUrl = isDev 
            ? 'http://localhost:3000' 
            : `file://${path.join(__dirname, '../build/index.html')}`;

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

        return mainWindow;
    }

    setupIPC(window) {
        // AI Job Automation
        ipcMain.handle('start-job-automation', async (event, config) => {
            return await this.jobAutomation.start(config);
        });

        ipcMain.handle('stop-job-automation', async () => {
            return await this.jobAutomation.stop();
        });

        ipcMain.handle('get-job-recommendations', async (event, jobData) => {
            return await this.aiEngine.getJobRecommendations(jobData);
        });

        // Browser Controls
        ipcMain.handle('create-new-tab', (event, url) => {
            return this.createNewTab(url);
        });

        ipcMain.handle('close-tab', (event, tabId) => {
            return this.closeTab(tabId);
        });

        // Performance Monitoring
        ipcMain.handle('get-performance-stats', () => {
            return {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                uptime: process.uptime()
            };
        });
    }

    setupAIEngine() {
        // Initialize AI Engine for job automation
        this.aiEngine = {
            async getJobRecommendations(jobData) {
                // AI-powered job matching logic
                return {
                    matchScore: 0.95,
                    recommendations: [
                        'Highlight Python experience',
                        'Mention AI/ML projects',
                        'Emphasize remote work capability'
                    ],
                    shouldApply: true
                };
            },

            async analyzeJobPage(url) {
                // Analyze job page content
                return {
                    title: 'Senior AI Engineer',
                    company: 'TechCorp',
                    requirements: ['Python', 'Machine Learning', 'React'],
                    salary: '$150k - $200k',
                    remote: true
                };
            }
        };
    }

    setupJobAutomation() {
        // Initialize job automation system
        this.jobAutomation = {
            isRunning: false,

            async start(config) {
                this.isRunning = true;
                console.log('🤖 Job automation started with config:', config);

                // Start automated job application process
                setInterval(() => {
                    if (this.isRunning) {
                        this.processJobApplications();
                    }
                }, 30000); // Every 30 seconds

                return { success: true, message: 'Job automation started' };
            },

            async stop() {
                this.isRunning = false;
                return { success: true, message: 'Job automation stopped' };
            },

            async processJobApplications() {
                // Automated job application logic
                console.log('🔍 Processing job applications...');
            }
        };
    }

    setupAutoUpdater() {
        if (!isDev) {
            autoUpdater.checkForUpdatesAndNotify();

            autoUpdater.on('update-available', () => {
                dialog.showMessageBox(this.windows.get('main'), {
                    type: 'info',
                    title: 'Update Available',
                    message: 'A new version is available. It will be downloaded in the background.',
                    buttons: ['OK']
                });
            });

            autoUpdater.on('update-downloaded', () => {
                dialog.showMessageBox(this.windows.get('main'), {
                    type: 'info',
                    title: 'Update Ready',
                    message: 'Update downloaded. The application will restart to apply the update.',
                    buttons: ['Restart Now', 'Later']
                }).then((result) => {
                    if (result.response === 0) {
                        autoUpdater.quitAndInstall();
                    }
                });
            });
        }
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
                    {
                        label: 'New Window',
                        accelerator: 'CmdOrCtrl+N',
                        click: () => this.createMainWindow()
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
                label: 'AI Automation',
                submenu: [
                    {
                        label: 'Start Job Automation',
                        click: () => {
                            this.windows.get('main').webContents.send('start-automation');
                        }
                    },
                    {
                        label: 'Stop Job Automation',
                        click: () => {
                            this.windows.get('main').webContents.send('stop-automation');
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'AI Settings',
                        click: () => {
                            this.windows.get('main').webContents.send('open-ai-settings');
                        }
                    }
                ]
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
                    { role: 'resetZoom' },
                    { role: 'zoomIn' },
                    { role: 'zoomOut' },
                    { type: 'separator' },
                    { role: 'togglefullscreen' }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    createNewTab(url = 'https://google.com') {
        // Create new tab logic
        const tabId = Date.now().toString();
        this.windows.get('main').webContents.send('new-tab-created', { tabId, url });
        return tabId;
    }

    closeTab(tabId) {
        // Close tab logic
        this.windows.get('main').webContents.send('tab-closed', { tabId });
        return true;
    }
}

// Initialize the Ultimate Browser
new UltimateBrowser();

module.exports = UltimateBrowser;
