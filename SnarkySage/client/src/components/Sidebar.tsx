import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Download, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { ChatSession } from '@shared/schema';

interface SidebarProps {
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onSettingsClick: () => void;
  className?: string;
}

export default function Sidebar({ 
  currentSessionId, 
  onSessionSelect, 
  onNewChat, 
  onSettingsClick,
  className = "" 
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch chat sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ['/api/chat/sessions'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/chat/sessions');
      return response.json();
    }
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest('DELETE', `/api/chat/sessions/${sessionId}`);
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/sessions'] });
      if (currentSessionId === sessionId) {
        onNewChat();
      }
      toast({
        title: "Chat Deleted",
        description: "Chat removed from history",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete chat",
        variant: "destructive",
      });
    }
  });

  // Download chat function
  const downloadChat = async (sessionId: string, title: string) => {
    try {
      const response = await apiRequest('GET', `/api/chat/sessions/${sessionId}/messages`);
      const messages = await response.json();
      
      const chatContent = messages.map((msg: any) => 
        `${msg.role === 'user' ? 'You' : 'Sai Kaki'}: ${msg.content}`
      ).join('\n\n');
      
      const blob = new Blob([chatContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'Chat'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Chat Downloaded",
        description: "Chat saved to your device",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download chat",
        variant: "destructive",
      });
    }
  };

  const formatChatTitle = (title: string) => {
    if (title.length > 20) {
      return title.substring(0, 20) + '...';
    }
    return title;
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Recently';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Recently';
    
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className={`${className} ${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-dark-secondary border-r border-dark-tertiary flex flex-col h-full`}>
      {/* Header */}
      <div className="p-3 border-b border-dark-tertiary">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-lg font-semibold text-text-primary">Sai Kaki</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-dark-tertiary text-text-muted hover:text-text-primary"
            data-testid="button-collapse-sidebar"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Button
          onClick={onNewChat}
          className="w-full bg-chat-user hover:bg-blue-600 text-white"
          data-testid="button-new-chat"
        >
          <Plus className="h-4 w-4 mr-2" />
          {!isCollapsed && "New Chat"}
        </Button>
      </div>

      {/* Chat History */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-2">
          {sessions.map((session: ChatSession) => (
            <div
              key={session.id}
              className={`group relative rounded-lg p-2 cursor-pointer transition-colors ${
                currentSessionId === session.id 
                  ? 'bg-dark-tertiary text-text-primary' 
                  : 'hover:bg-dark-tertiary text-text-muted hover:text-text-primary'
              }`}
              onClick={() => onSessionSelect(session.id)}
              data-testid={`chat-session-${session.id}`}
            >
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {formatChatTitle(session.title)}
                    </div>
                    <div className="text-xs text-text-muted">
                      {formatDate(session.updatedAt?.toString() || session.createdAt?.toString() || null)}
                    </div>
                  </div>
                )}
              </div>
              
              {!isCollapsed && (
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadChat(session.id, session.title);
                      }}
                      className="p-1 h-6 w-6 hover:bg-dark-bg"
                      title="Download Chat"
                      data-testid={`button-download-${session.id}`}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSessionMutation.mutate(session.id);
                      }}
                      className="p-1 h-6 w-6 hover:bg-red-600 hover:text-white"
                      title="Delete Chat"
                      data-testid={`button-delete-${session.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Settings */}
      <div className="p-3 border-t border-dark-tertiary">
        <Button
          variant="ghost"
          onClick={onSettingsClick}
          className="w-full justify-start text-text-muted hover:text-text-primary hover:bg-dark-tertiary"
          data-testid="button-settings"
        >
          <Settings className="h-4 w-4 mr-2" />
          {!isCollapsed && "Settings"}
        </Button>
      </div>
    </div>
  );
}