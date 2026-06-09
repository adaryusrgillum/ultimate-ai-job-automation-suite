import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Import components
import TabBar from './components/TabBar';
import AddressBar from './components/AddressBar';
import WebView from './components/WebView';
import AIPanel from './components/AIPanel';
import JobAutomationPanel from './components/JobAutomationPanel';
import PerformanceMonitor from './components/PerformanceMonitor';

const { ipcRenderer } = window.require('electron');

function App() {
  const [tabs, setTabs] = useState([
    { id: '1', url: 'https://google.com', title: 'Google', active: true }
  ]);
  const [activeTab, setActiveTab] = useState('1');
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [jobAutomationActive, setJobAutomationActive] = useState(false);
  const [performanceStats, setPerformanceStats] = useState({});
  const [jobRecommendations, setJobRecommendations] = useState([]);

  // Performance monitoring
  useEffect(() => {
    const updatePerformance = async () => {
      try {
        const stats = await ipcRenderer.invoke('get-performance-stats');
        setPerformanceStats(stats);
      } catch (error) {
        console.error('Error getting performance stats:', error);
      }
    };

    const interval = setInterval(updatePerformance, 5000); // Every 5 seconds
    updatePerformance(); // Initial call

    return () => clearInterval(interval);
  }, []);

  // Listen for IPC events
  useEffect(() => {
    // Tab management
    ipcRenderer.on('new-tab-created', (event, { tabId, url }) => {
      const newTab = {
        id: tabId,
        url: url,
        title: 'Loading...',
        active: false
      };
      setTabs(prev => [...prev, newTab]);
    });

    ipcRenderer.on('tab-closed', (event, { tabId }) => {
      setTabs(prev => prev.filter(tab => tab.id !== tabId));
    });

    // AI Automation events
    ipcRenderer.on('start-automation', () => {
      handleStartJobAutomation();
    });

    ipcRenderer.on('stop-automation', () => {
      handleStopJobAutomation();
    });

    ipcRenderer.on('open-ai-settings', () => {
      setAiPanelOpen(true);
    });

    return () => {
      ipcRenderer.removeAllListeners('new-tab-created');
      ipcRenderer.removeAllListeners('tab-closed');
      ipcRenderer.removeAllListeners('start-automation');
      ipcRenderer.removeAllListeners('stop-automation');
      ipcRenderer.removeAllListeners('open-ai-settings');
    };
  }, []);

  const createNewTab = async (url = 'https://google.com') => {
    try {
      const tabId = await ipcRenderer.invoke('create-new-tab', url);
      const newTab = {
        id: tabId,
        url: url,
        title: 'Loading...',
        active: false
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTab(tabId);
    } catch (error) {
      console.error('Error creating new tab:', error);
    }
  };

  const closeTab = async (tabId) => {
    try {
      await ipcRenderer.invoke('close-tab', tabId);
      setTabs(prev => {
        const newTabs = prev.filter(tab => tab.id !== tabId);
        if (activeTab === tabId && newTabs.length > 0) {
          setActiveTab(newTabs[0].id);
        }
        return newTabs;
      });
    } catch (error) {
      console.error('Error closing tab:', error);
    }
  };

  const updateTabTitle = (tabId, title) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, title } : tab
    ));
  };

  const updateTabUrl = (tabId, url) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, url } : tab
    ));
  };

  const handleStartJobAutomation = async () => {
    try {
      const config = {
        maxApplicationsPerDay: 10,
        targetRoles: ['Software Engineer', 'AI Engineer', 'Data Scientist'],
        locations: ['Remote', 'San Francisco', 'New York'],
        salaryMin: 100000
      };

      const result = await ipcRenderer.invoke('start-job-automation', config);
      if (result.success) {
        setJobAutomationActive(true);
        console.log('Job automation started:', result.message);
      }
    } catch (error) {
      console.error('Error starting job automation:', error);
    }
  };

  const handleStopJobAutomation = async () => {
    try {
      const result = await ipcRenderer.invoke('stop-job-automation');
      if (result.success) {
        setJobAutomationActive(false);
        console.log('Job automation stopped:', result.message);
      }
    } catch (error) {
      console.error('Error stopping job automation:', error);
    }
  };

  const getJobRecommendations = async (jobData) => {
    try {
      const recommendations = await ipcRenderer.invoke('get-job-recommendations', jobData);
      setJobRecommendations(recommendations);
      setAiPanelOpen(true);
    } catch (error) {
      console.error('Error getting job recommendations:', error);
    }
  };

  const currentTab = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="app">
      {/* Performance Monitor */}
      <PerformanceMonitor stats={performanceStats} />

      {/* Tab Bar */}
      <TabBar 
        tabs={tabs}
        activeTab={activeTab}
        onTabSelect={setActiveTab}
        onTabClose={closeTab}
        onNewTab={createNewTab}
      />

      {/* Address Bar */}
      <AddressBar 
        url={currentTab?.url || ''}
        onNavigate={(url) => updateTabUrl(activeTab, url)}
        onJobAnalysis={getJobRecommendations}
        jobAutomationActive={jobAutomationActive}
        onToggleAutomation={jobAutomationActive ? handleStopJobAutomation : handleStartJobAutomation}
      />

      {/* Main Content Area */}
      <div className="main-content">
        {/* Web View */}
        <div className={`webview-container ${aiPanelOpen ? 'with-ai-panel' : ''}`}>
          {tabs.map(tab => (
            <WebView
              key={tab.id}
              tabId={tab.id}
              url={tab.url}
              active={tab.id === activeTab}
              onTitleChange={(title) => updateTabTitle(tab.id, title)}
              onUrlChange={(url) => updateTabUrl(tab.id, url)}
              onJobPageDetected={getJobRecommendations}
            />
          ))}
        </div>

        {/* AI Panel */}
        {aiPanelOpen && (
          <AIPanel
            recommendations={jobRecommendations}
            onClose={() => setAiPanelOpen(false)}
            onApplyToJob={(jobData) => console.log('Applying to job:', jobData)}
          />
        )}
      </div>

      {/* Job Automation Panel */}
      {jobAutomationActive && (
        <JobAutomationPanel
          onStop={handleStopJobAutomation}
          stats={{
            applicationsToday: 5,
            successRate: 12,
            activeJobs: 23
          }}
        />
      )}
    </div>
  );
}

export default App;
