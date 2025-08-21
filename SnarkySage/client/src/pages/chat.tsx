import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Send, 
  Copy, 
  RefreshCw,
  Bot,
  User
} from "lucide-react";
import { useGeolocation } from "@/hooks/use-geolocation";
import Sidebar from "@/components/Sidebar";
import SettingsModal from "@/components/SettingsModal";
import PrivacyPolicyModal from "@/components/PrivacyPolicyModal";
import type { ChatSession, ChatMessage } from "@shared/schema";

interface ChatResponse {
  userMessage: ChatMessage;
  aiMessage: ChatMessage;
}

interface StreamingMessage {
  id: string;
  role: 'assistant';
  content: string;
  isStreaming: boolean;
  createdAt: Date;
}

export default function Chat() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const geolocation = useGeolocation();
  const [showPrivacyModal, setShowPrivacyModal] = useState(() => {
    return !localStorage.getItem('privacyPolicyAccepted');
  });

  // Create initial session on mount
  useEffect(() => {
    createNewSession();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [currentSessionId]);

  // Get messages for current session
  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/sessions", currentSessionId, "messages"],
    queryFn: async () => {
      if (!currentSessionId) return [];
      const response = await apiRequest("GET", `/api/chat/sessions/${currentSessionId}/messages`);
      return response.json();
    },
    enabled: !!currentSessionId,
  });

  // Create new session mutation
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/chat/sessions", {
        title: "New Chat",
        userId: "anonymous"
      });
      return response.json();
    },
    onSuccess: (session: ChatSession) => {
      setCurrentSessionId(session.id);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
    },
  });

  // Stream message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentSessionId) throw new Error("No active session");
      
      // Include location data if available
      const requestBody: any = {
        content,
        role: "user"
      };
      
      if (geolocation.data) {
        requestBody.userLocation = {
          lat: geolocation.data.latitude,
          lon: geolocation.data.longitude
        };
      }
      
      // Start SSE connection for streaming
      const eventSource = new EventSource(
        `/api/chat/sessions/${currentSessionId}/messages/stream?${new URLSearchParams(requestBody)}`
      );
      
      return new Promise((resolve, reject) => {
        let tempMessageId: string | null = null;
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'userMessage':
                // User message saved, refresh messages
                queryClient.invalidateQueries({ 
                  queryKey: ["/api/chat/sessions", currentSessionId, "messages"] 
                });
                break;
                
              case 'aiChunk':
                tempMessageId = data.messageId;
                setStreamingMessage(prev => ({
                  id: data.messageId,
                  role: 'assistant',
                  content: (prev?.content || '') + data.chunk,
                  isStreaming: true,
                  createdAt: new Date()
                }));
                break;
                
              case 'aiComplete':
                // AI message complete, update with final message from DB
                setStreamingMessage(null);
                queryClient.invalidateQueries({ 
                  queryKey: ["/api/chat/sessions", currentSessionId, "messages"] 
                });
                resolve(data.message);
                break;
                
              case 'error':
                setStreamingMessage(null);
                queryClient.invalidateQueries({ 
                  queryKey: ["/api/chat/sessions", currentSessionId, "messages"] 
                });
                reject(new Error('AI response error'));
                break;
                
              case 'done':
                eventSource.close();
                break;
            }
          } catch (error) {
            console.error('SSE parsing error:', error);
          }
        };
        
        eventSource.onerror = (error) => {
          console.error('SSE error:', error);
          eventSource.close();
          setStreamingMessage(null);
          
          // Try to fallback to regular API call
          fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          })
          .then(res => res.json())
          .then(data => {
            queryClient.invalidateQueries({ 
              queryKey: ["/api/chat/sessions", currentSessionId, "messages"] 
            });
            resolve(data.aiMessage);
          })
          .catch(() => {
            reject(new Error('Both streaming and regular API failed'));
          });
        };
        
        // Send the actual POST request to start streaming
        fetch(`/api/chat/sessions/${currentSessionId}/messages/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }).catch(error => {
          console.error('Failed to start stream:', error);
          eventSource.close();
          reject(error);
        });
      });
    },
    onMutate: () => {
      setIsTyping(true);
      setStreamingMessage(null);
    },
    onSuccess: () => {
      setMessageInput("");
      setIsTyping(false);
    },
    onError: (error) => {
      setIsTyping(false);
      setStreamingMessage(null);
      toast({
        title: "Error",
        description: "Oops! Even I can't fix that mess. Try again, genius.",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const createNewSession = () => {
    createSessionMutation.mutate();
  };

  const sendMessage = async () => {
    if (!messageInput.trim()) return;
    
    // Auto-request location if needed
    await requestLocationIfNeeded(messageInput.trim());
    
    sendMessageMutation.mutate(messageInput.trim());
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Message copied to clipboard",
    });
  };

  const regenerateResponse = () => {
    // Implementation for regenerating last response
    toast({
      title: "Regenerating",
      description: "Asking Sai Kaki to try again...",
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const welcomeMessage = {
    id: 'welcome',
    role: 'assistant',
    content: "Well, well, well... Another human who thinks they need an AI assistant. 🙄 I'm Sai Kaki, and I'm here to help you while being delightfully sarcastic about it. Try not to bore me to death with your questions.",
    createdAt: new Date(),
  };

  // Combine regular messages with streaming message
  let allMessages = currentSessionId && messages.length === 0 ? [welcomeMessage as any, ...messages] : messages;
  
  if (streamingMessage) {
    allMessages = [...allMessages, streamingMessage as any];
  }

  const handlePrivacyAccept = () => {
    localStorage.setItem('privacyPolicyAccepted', 'true');
    setShowPrivacyModal(false);
  };

  const handlePrivacyClose = () => {
    setShowPrivacyModal(false);
  };

  // Auto-request location when user asks location-based questions
  const requestLocationIfNeeded = async (message: string) => {
    const locationKeywords = ['nearest', 'nearby', 'closest', 'mcdonald', 'restaurant', 'gas station', 'hospital'];
    const needsLocation = locationKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    
    if (needsLocation && !geolocation.data) {
      await geolocation.requestPermission();
    }
  };

  return (
    <>
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onAccept={handlePrivacyAccept}
        onClose={handlePrivacyClose}
      />
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
      
      <div className="flex h-screen bg-dark-bg text-text-primary">
        {/* Sidebar */}
        <Sidebar
          currentSessionId={currentSessionId}
          onSessionSelect={setCurrentSessionId}
          onNewChat={createNewSession}
          onSettingsClick={() => setShowSettingsModal(true)}
        />
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Messages */}
          <main 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-track-dark-secondary scrollbar-thumb-dark-tertiary"
            data-testid="chat-container"
          >
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-text-muted">Loading chat...</div>
              </div>
            ) : (
              allMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 animate-fade-in ${
                    message.role === 'user' ? 'justify-end' : ''
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 bg-gradient-to-r from-chat-ai to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="text-white h-4 w-4" />
                    </div>
                  )}
                  
                  <div
                    className={`rounded-2xl p-4 max-w-2xl relative group ${
                      message.role === 'user'
                        ? 'bg-chat-user rounded-tr-md'
                        : 'bg-dark-secondary rounded-tl-md'
                    }`}
                    data-testid={`message-${message.role}`}
                  >
                    <div className="prose prose-invert max-w-none">
                      <p className="text-white whitespace-pre-wrap break-words mb-0">
                        {message.content}
                        {(message as any).isStreaming && (
                          <span className="inline-block w-2 h-5 bg-white ml-1 animate-pulse"></span>
                        )}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2 text-xs text-text-muted">
                      <span>{formatTime(message.createdAt)}</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyMessage(message.content)}
                          className="p-1 h-6 w-6 hover:bg-dark-tertiary"
                          title="Copy message"
                          data-testid={`button-copy-${message.id}`}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {message.role === 'assistant' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={regenerateResponse}
                            className="p-1 h-6 w-6 hover:bg-dark-tertiary"
                            title="Regenerate response"
                            data-testid={`button-regenerate-${message.id}`}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="w-8 h-8 bg-gradient-to-r from-chat-user to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="text-white h-4 w-4" />
                    </div>
                  )}
                </div>
              ))
            )}
            
            {isTyping && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-chat-ai to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="text-white h-4 w-4" />
                </div>
                <div className="bg-dark-secondary rounded-2xl rounded-tl-md p-4 max-w-2xl">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </main>
          
          {/* Chat Input */}
          <footer className="p-4 border-t border-dark-tertiary bg-dark-secondary">
            <div className="flex items-end space-x-3">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (try not to make it boring)"
                  className="w-full bg-dark-bg border border-dark-tertiary rounded-2xl px-4 py-3 pr-12 text-white placeholder-white/70 resize-none focus:outline-none focus:ring-2 focus:ring-chat-user focus:border-transparent transition-all duration-200 min-h-[44px] max-h-[120px]"
                  rows={1}
                  data-testid="input-message"
                />
                
                <Button
                  onClick={sendMessage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  className="absolute right-2 bottom-2 w-8 h-8 bg-chat-user hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-105 disabled:transform-none p-0"
                  data-testid="button-send"
                >
                  <Send className="text-white h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-2 text-xs text-text-muted">
              <div className="flex items-center space-x-4">
                <span>Press Enter to send • Shift+Enter for new line</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}