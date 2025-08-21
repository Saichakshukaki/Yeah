
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
  User,
  Image as ImageIcon,
  Palette
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

export default function Chat() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentSessionId) throw new Error("No active session");

      // Handle image upload if present
      if (selectedImage) {
        const formData = new FormData();
        formData.append('image', selectedImage);
        formData.append('content', content);
        formData.append('role', 'user');
        
        if (geolocation.data) {
          formData.append('userLocation', JSON.stringify({
            lat: geolocation.data.latitude,
            lon: geolocation.data.longitude
          }));
        }

        const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages-with-image`, {
          method: 'POST',
          body: formData
        });
        return response.json();
      }

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

      const response = await apiRequest("POST", `/api/chat/sessions/${currentSessionId}/messages`, requestBody);
      return response.json();
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: () => {
      setMessageInput("");
      setSelectedImage(null);
      setImagePreview(null);
      setIsTyping(false);
      // Refresh messages and sessions to get updated title
      queryClient.invalidateQueries({ 
        queryKey: ["/api/chat/sessions", currentSessionId, "messages"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/chat/sessions"] 
      });
    },
    onError: (error) => {
      setIsTyping(false);
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

  // Show welcome message if no messages exist
  const allMessages = currentSessionId && messages.length === 0 ? [welcomeMessage as any, ...messages] : messages;

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

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const generateImage = async () => {
    if (!messageInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt for image generation",
        variant: "destructive",
      });
      return;
    }

    if (!currentSessionId) {
      toast({
        title: "Error",
        description: "No active chat session",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsTyping(true);
      
      // Send the image generation request as a regular message
      const requestBody = {
        content: `[IMAGE_GENERATION] ${messageInput.trim()}`,
        role: "user"
      };

      const response = await apiRequest("POST", `/api/chat/sessions/${currentSessionId}/messages`, requestBody);
      
      if (response.ok) {
        setMessageInput("");
        queryClient.invalidateQueries({ 
          queryKey: ["/api/chat/sessions", currentSessionId, "messages"] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ["/api/chat/sessions"] 
        });
      } else {
        throw new Error("Failed to generate image");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate image. Try again!",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
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
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <img 
                        src="/sai-kaki-logo.svg" 
                        alt="Sai Kaki" 
                        className="w-full h-full object-cover"
                      />
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
                      </p>
                      {/* Display generated images */}
                      {(message.content.includes('data:image/') || message.content.includes('Here\'s your generated image')) && (
                        <div className="mt-3">
                          {(() => {
                            const imageMatch = message.content.match(/data:image\/[^"\s]+/);
                            if (imageMatch) {
                              return (
                                <img 
                                  src={imageMatch[0]} 
                                  alt="Generated image" 
                                  className="max-w-sm max-h-64 rounded-lg border border-dark-tertiary object-contain"
                                />
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
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
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <img 
                    src="/sai-kaki-logo.svg" 
                    alt="Sai Kaki" 
                    className="w-full h-full object-cover"
                  />
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
            {/* Image Preview */}
            {imagePreview && (
              <div className="mb-3 relative inline-block">
                <img 
                  src={imagePreview} 
                  alt="Upload preview" 
                  className="max-w-32 max-h-32 rounded-lg border border-dark-tertiary"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex items-end space-x-3">
              <div className="flex flex-col space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-10 h-10 bg-dark-bg hover:bg-dark-tertiary border border-dark-tertiary rounded-lg"
                    asChild
                  >
                    <span>
                      <ImageIcon className="h-4 w-4 text-text-muted" />
                    </span>
                  </Button>
                </label>
                <Button
                  onClick={generateImage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  variant="ghost"
                  size="sm"
                  className="w-10 h-10 bg-dark-bg hover:bg-dark-tertiary border border-dark-tertiary rounded-lg"
                  title="Generate Image"
                >
                  <Palette className="h-4 w-4 text-text-muted" />
                </Button>
              </div>

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
                  disabled={(!messageInput.trim() && !selectedImage) || sendMessageMutation.isPending}
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
