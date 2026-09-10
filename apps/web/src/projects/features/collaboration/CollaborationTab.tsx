import React, { useState } from 'react';
import { MessageSquare, Plus, Search, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/supabase';
import { useAuth } from '@/App';

interface CollaborationMessage {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
}

interface CollaborationTabProps {
  projectId: string;
}

export const CollaborationTab: React.FC<CollaborationTabProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchMessages = async () => {
    setIsLoading(true);
    // Try to fetch from project_comments table
    const { data, error } = await supabase
      .from('project_comments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch collaboration messages:', error);
      // Fall back to empty state if table doesn't exist
      setMessages([]);
    } else {
      // Map the data to our interface format
      const mappedMessages = (data || []).map((msg: any) => ({
        id: msg.id,
        project_id: msg.project_id,
        user_id: msg.user_id,
        user_name: msg.user_name,
        message: msg.comment || msg.message,
        created_at: msg.created_at,
      }));
      setMessages(mappedMessages);
    }
    setIsLoading(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    // Try to insert into project_comments table
    const { error } = await supabase
      .from('project_comments')
      .insert({
        project_id: projectId,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email || 'Unknown',
        comment: newMessage.trim(),
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to send message:', error);
      // For demo purposes, add it locally even if DB fails
      const tempMessage: CollaborationMessage = {
        id: `temp-${Date.now()}`,
        project_id: projectId,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email || 'Unknown',
        message: newMessage.trim(),
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
    } else {
      setNewMessage('');
      fetchMessages();
    }
  };

  React.useEffect(() => {
    fetchMessages();
  }, [projectId]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-600" />
          <h3 className="text-sm font-medium text-gray-900">Team Collaboration</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md w-48"
            />
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="text-center text-gray-500 text-sm py-8">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No collaboration messages yet</p>
            <p className="text-xs text-gray-400">Start the conversation by sending a message</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isCurrentUser = msg.user_id === user?.id;
            const showDateHeader = index === 0 || formatDate(messages[index - 1].created_at) !== formatDate(msg.created_at);

            return (
              <div key={msg.id}>
                {showDateHeader && (
                  <div className="text-center text-xs text-gray-400 py-2">
                    {formatDate(msg.created_at)}
                  </div>
                )}
                <div className={`flex items-start gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div className={`max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-medium text-gray-900">{msg.user_name}</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    <div className={`p-3 rounded-lg text-sm ${
                      isCurrentUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message Input */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            size="sm"
            className="px-4"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CollaborationTab;
