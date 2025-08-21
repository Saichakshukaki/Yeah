import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Shield, MapPin, Clock, Cloud } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export default function PrivacyPolicyModal({ isOpen, onClose, onAccept }: PrivacyPolicyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-dark-tertiary">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <Shield className="text-white h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Privacy Policy</h2>
              <p className="text-sm text-text-muted">How we protect your data</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-2 hover:bg-dark-tertiary text-text-muted hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 overflow-y-auto max-h-[60vh] space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-blue-400 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-text-primary mb-2">Location Data</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Location access is automatically requested when you ask location-based questions 
                  (e.g., "nearest McDonald's"). This provides precise, accurate results. Your location data:
                </p>
                <ul className="text-sm text-text-muted mt-2 space-y-1 ml-4">
                  <li>• Is used only for the specific query</li>
                  <li>• Never stored permanently on our servers</li>
                  <li>• Cached temporarily for session convenience</li>
                  <li>• Automatically enables for precise distance calculations</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-green-400 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-text-primary mb-2">Real-time Data</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  We collect minimal data to enhance your experience:
                </p>
                <ul className="text-sm text-text-muted mt-2 space-y-1 ml-4">
                  <li>• Your IP address for approximate location and timezone</li>
                  <li>• Current timestamp for accurate time responses</li>
                  <li>• Weather data from your general area (city-level)</li>
                  <li>• This data is processed in real-time and not stored</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Cloud className="h-5 w-5 text-purple-400 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-text-primary mb-2">Chat Data</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Your conversations with Sai Kaki are automatically saved for convenience:
                </p>
                <ul className="text-sm text-text-muted mt-2 space-y-1 ml-4">
                  <li>• Saved locally in your browser for chat history</li>
                  <li>• Associated with anonymous session IDs</li>
                  <li>• You can delete individual chats anytime</li>
                  <li>• Never linked to your personal identity</li>
                  <li>• Can be exported or cleared in Settings</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-dark-bg p-4 rounded-lg border border-dark-tertiary">
            <h3 className="font-semibold text-text-primary mb-2">Your Rights</h3>
            <p className="text-sm text-text-muted">
              You have full control over your data. You can disable location services, clear your chat history, 
              or stop using the service at any time. We believe in privacy by design and minimal data collection.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-dark-tertiary">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={onAccept}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
            >
              Accept & Continue
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-dark-tertiary text-text-muted hover:text-text-primary hover:bg-dark-tertiary"
            >
              Read Later
            </Button>
          </div>
          <p className="text-xs text-text-muted mt-3 text-center">
            By using Sai Kaki, you agree to our privacy practices outlined above.
          </p>
        </div>
      </div>
    </div>
  );
}