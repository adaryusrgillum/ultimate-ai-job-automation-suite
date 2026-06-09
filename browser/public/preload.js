const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Browser controls
  createNewTab: (url) => ipcRenderer.invoke('create-new-tab', url),
  closeTab: (tabId) => ipcRenderer.invoke('close-tab', tabId),

  // AI Job Automation
  startJobAutomation: (config) => ipcRenderer.invoke('start-job-automation', config),
  stopJobAutomation: () => ipcRenderer.invoke('stop-job-automation'),
  getJobRecommendations: (jobData) => ipcRenderer.invoke('get-job-recommendations', jobData),

  // Performance monitoring
  getPerformanceStats: () => ipcRenderer.invoke('get-performance-stats'),

  // Event listeners
  onNewTabCreated: (callback) => ipcRenderer.on('new-tab-created', callback),
  onTabClosed: (callback) => ipcRenderer.on('tab-closed', callback),
  onStartAutomation: (callback) => ipcRenderer.on('start-automation', callback),
  onStopAutomation: (callback) => ipcRenderer.on('stop-automation', callback),
  onOpenAISettings: (callback) => ipcRenderer.on('open-ai-settings', callback),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Performance optimizations
window.addEventListener('DOMContentLoaded', () => {
  // Enable hardware acceleration
  document.body.style.transform = 'translateZ(0)';

  // Optimize scrolling
  document.body.style.overflowScrolling = 'touch';

  // Preload critical resources
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'style';
  link.href = './App.css';
  document.head.appendChild(link);
});
