import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Mic, MicOff } from "lucide-react";
import { useGeolocation } from "@/hooks/use-geolocation";
import PrivacyPolicyModal from "@/components/PrivacyPolicyModal";
import type { ChatMessage } from "../../shared/schema";

interface ChatResponse {
  userMessage: ChatMessage;
  aiMessage: ChatMessage;
}

export default function Chat() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sessionId: 'welcome',
      role: 'assistant',
      content: '# Welcome to Sai Kaki v0.1\n\nHey there! I\'m Sai Kaki, your AI assistant with a bit of attitude. I can help you with questions, provide real-time information, play chess, and even analyze images. What would you like to know?',
      createdAt: new Date().toISOString()
    }
  ]);
  const [isListening, setIsListening] = useState(false);
  // Renamed to avoid confusion and use ref for mutable instance
  const recognitionInstanceRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const geolocation = useGeolocation();
  const [showPrivacyModal, setShowPrivacyModal] = useState(() => {
    return !localStorage.getItem('privacyPolicyAccepted');
  });

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition(); // Changed recognitionitionInstance to recognition
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setMessageInput(transcript);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Speech Recognition Error",
          description: "Could not recognize speech. Please try again.",
          variant: "destructive"
        });
      };

      // Store the instance in the ref
      recognitionInstanceRef.current = recognition;
    }
  }, [toast]);

  // Create initial session on mount
  useEffect(() => {
    createNewSession();
  }, []);

  const createNewSession = async () => {
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat', userId: 'anonymous' })
      });

      if (response.ok) {
        const session = await response.json();
        setCurrentSessionId(session.id);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handlePrivacyAccept = () => {
    localStorage.setItem('privacyPolicyAccepted', 'true');
    setShowPrivacyModal(false);
  };

  const handlePrivacyClose = () => {
    setShowPrivacyModal(false);
  };

  const requestLocationIfNeeded = async (message: string) => {
    const locationKeywords = ['nearest', 'nearby', 'closest', 'mcdonald', 'restaurant', 'gas station', 'hospital'];
    const needsLocation = locationKeywords.some(keyword =>
      message.toLowerCase().includes(keyword)
    );

    if (needsLocation && !geolocation.data) {
      await geolocation.requestPermission();
    }
  };

  const handleVoiceInput = () => {
    const recognition = recognitionInstanceRef.current; // Use the ref's current value
    if (!recognition) {
      toast({
        title: "Speech Recognition Not Available",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive"
      });
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !currentSessionId || isTyping) return;

    const messageContent = messageInput.trim();
    setMessageInput(""); // Clear input after getting the message
    setIsTyping(true);

    await requestLocationIfNeeded(messageContent);

    try {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        sessionId: currentSessionId,
        role: 'user',
        content: messageContent,
        createdAt: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);

      const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: messageContent,
          role: 'user',
          userLocation: geolocation.data
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Server error:', errorData);
        throw new Error(`Server responded with ${response.status}: ${errorData}`);
      }

      const data: ChatResponse = await response.json();
      setMessages(prev => [...prev.filter(m => m.id !== userMessage.id), data.userMessage, data.aiMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any); // Cast to any to satisfy onSubmit signature
    }
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, index) => (
      <span key={index}>
        {line}
        {index < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  if (showPrivacyModal) {
    return (
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onAccept={handlePrivacyAccept}
        onClose={handlePrivacyClose}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen text-white" style={{ backgroundColor: '#212121' }}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {messages.length === 0 ? (
          // Welcome/Empty State
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-2xl">
              <h1 className="text-4xl md:text-5xl font-light text-center text-white mb-12">
                SAI KAKI 0.1
              </h1>

              {/* Input Form */}
              <form onSubmit={handleSubmit} className="relative">
                <div className="relative rounded-full border border-gray-700 hover:border-gray-600 focus-within:border-gray-500 transition-colors" style={{ backgroundColor: '#303030' }}>
                  <div className="flex items-center pl-4 pr-2 py-2">
                    <div className="flex-1 flex items-center space-x-2">
                      <span className="text-gray-400 text-sm">+</span>
                      <Textarea
                        ref={textareaRef}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything"
                        className="flex-1 bg-transparent border-none resize-none text-white placeholder-gray-400 focus:outline-none focus:ring-0 min-h-[40px] max-h-32 py-2"
                        style={{ fieldSizing: 'content' } as any}
                        disabled={isTyping}
                      />
                    </div>

                    <div className="flex items-center space-x-1 ml-2">
                      {recognitionInstanceRef.current && ( // Check if recognition is available
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleVoiceInput}
                          className={`p-2 rounded-full ${
                            isListening
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/30'
                          }`}
                        >
                          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </Button>
                      )}

                      <Button
                        type="submit"
                        size="sm"
                        disabled={!messageInput.trim() || isTyping}
                        className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : (
          // Chat Messages
          <div className="flex-1 overflow-y-auto p-4 space-y-4 message-container" style={{ backgroundColor: '#36454F' }}>
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs md:max-w-2xl px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800/80 text-blue-300 border border-blue-500/30 backdrop-blur-sm'
                    }`}
                  >
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {formatMessage(message.content)}
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 text-white border border-gray-700 px-4 py-3 rounded-2xl">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Input - Only show when there are messages */}
        {messages.length > 0 && (
          <div className="border-t border-gray-800 px-4 py-4">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSubmit}>
                <div className="relative rounded-full border border-gray-700 hover:border-gray-600 focus-within:border-gray-500 transition-colors" style={{ backgroundColor: '#303030' }}>
                  <div className="flex items-center pl-4 pr-2 py-2">
                    <Textarea
                      ref={textareaRef}
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask anything"
                      className="flex-1 bg-transparent border-none resize-none text-white placeholder-gray-400 focus:outline-none focus:ring-0 min-h-[40px] max-h-32 py-2"
                      style={{ fieldSizing: 'content' } as any}
                      disabled={isTyping}
                    />

                    <div className="flex items-center space-x-1 ml-2">
                      {recognitionInstanceRef.current && ( // Check if recognition is available
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleVoiceInput}
                          className={`p-2 rounded-full ${
                            isListening
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/30'
                          }`}
                        >
                          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </Button>
                      )}

                      <Button
                        type="submit"
                        size="sm"
                        disabled={!messageInput.trim() || isTyping}
                        className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}