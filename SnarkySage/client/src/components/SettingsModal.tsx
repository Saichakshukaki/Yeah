import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Settings, MapPin, MessageSquare, Shield } from 'lucide-react';
import PrivacyPolicyModal from './PrivacyPolicyModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  if (!isOpen) return null;

  const clearAllChats = () => {
    localStorage.clear();
    window.location.reload();
  };

  const exportAllChats = async () => {
    try {
      // Get all sessions from the API or localStorage
      const sessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
      const exportData = {
        timestamp: new Date().toISOString(),
        sessions: sessions
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sai-kaki-chats-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-dark-tertiary">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Settings className="text-white h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Settings</h2>
                <p className="text-sm text-text-muted">Manage your preferences</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2 hover:bg-dark-tertiary text-text-muted hover:text-text-primary"
              data-testid="button-close-settings"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 space-y-4">
            {/* Chat Management */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-text-primary flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                Chat Management
              </h3>
              <div className="space-y-2">
                <Button
                  onClick={exportAllChats}
                  variant="outline"
                  className="w-full justify-start border-dark-tertiary text-text-muted hover:text-text-primary hover:bg-dark-tertiary"
                  data-testid="button-export-chats"
                >
                  Export All Chats
                </Button>
                <Button
                  onClick={clearAllChats}
                  variant="outline"
                  className="w-full justify-start border-red-600 text-red-400 hover:text-white hover:bg-red-600"
                  data-testid="button-clear-all-chats"
                >
                  Clear All Chats
                </Button>
              </div>
            </div>

            {/* Location Settings */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-text-primary flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Location Services
              </h3>
              <div className="bg-dark-bg p-3 rounded-lg border border-dark-tertiary">
                <p className="text-sm text-text-muted">
                  Location access is automatically requested when needed for location-based queries 
                  (e.g., "nearest McDonald's"). Your precise location is only used temporarily and 
                  never stored permanently.
                </p>
              </div>
            </div>

            {/* Privacy */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-text-primary flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Privacy & Data
              </h3>
              <Button
                onClick={() => setShowPrivacyModal(true)}
                variant="outline"
                className="w-full justify-start border-dark-tertiary text-text-muted hover:text-text-primary hover:bg-dark-tertiary"
                data-testid="button-view-privacy"
              >
                View Privacy Policy
              </Button>
            </div>

            {/* App Info */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-text-primary">About</h3>
              <div className="bg-dark-bg p-3 rounded-lg border border-dark-tertiary">
                <p className="text-sm text-text-muted">
                  <strong>Sai Kaki AI Assistant</strong><br />
                  Version 0.1<br />
                  AI with attitude, real-time data, and chess capabilities
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onAccept={() => setShowPrivacyModal(false)}
        onClose={() => setShowPrivacyModal(false)}
      />
    </>
  );
}