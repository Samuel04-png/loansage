import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Send, Search, MessageSquare, Loader2 } from 'lucide-react';
import { formatDateTime } from '../../../lib/utils';
import toast from 'react-hot-toast';

export function MessagesPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*, from_user:users!messages_from_user_id(full_name, email), to_user:users!messages_to_user_id(full_name, email)')
        .or(`from_user_id.eq.${profile.id},to_user_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by conversation
      const grouped: Record<string, any> = {};
      data?.forEach((msg: any) => {
        const otherUserId =
          msg.from_user_id === profile.id ? msg.to_user_id : msg.from_user_id;
        const key = [profile.id, otherUserId].sort().join('-');

        if (!grouped[key]) {
          grouped[key] = {
            otherUser: msg.from_user_id === profile.id ? msg.to_user : msg.from_user,
            otherUserId,
            lastMessage: msg,
            unreadCount: 0,
          };
        }

        if (!msg.read_at && msg.to_user_id === profile.id) {
          grouped[key].unreadCount++;
        }
      });

      return Object.values(grouped);
    },
    enabled: !!profile?.id,
  });

  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation || !profile?.id) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*, from_user:users!messages_from_user_id(full_name, email)')
        .or(`and(from_user_id.eq.${profile.id},to_user_id.eq.${selectedConversation}),and(from_user_id.eq.${selectedConversation},to_user_id.eq.${profile.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Mark as read
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('to_user_id', profile.id)
        .eq('from_user_id', selectedConversation)
        .is('read_at', null);

      return data || [];
    },
    enabled: !!selectedConversation && !!profile?.id,
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!selectedConversation || !profile?.id || !messageText.trim()) return;

      const { error } = await supabase.from('messages').insert({
        agency_id: profile.agency_id,
        from_user_id: profile.id,
        to_user_id: selectedConversation,
        body: messageText,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send message');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
      {/* Conversations List */}
      <Card className="lg:col-span-1">
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="relative">
              <Input placeholder="Search conversations..." className="pl-9" />
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-16rem)]">
            {conversations && conversations.length > 0 ? (
              <div>
                {conversations.map((conv: any) => (
                  <button
                    key={conv.otherUserId}
                    onClick={() => setSelectedConversation(conv.otherUserId)}
                    className={`w-full p-4 border-b hover:bg-slate-50 text-left ${
                      selectedConversation === conv.otherUserId ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">
                          {conv.otherUser?.full_name || 'Unknown User'}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                          {conv.lastMessage?.body}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No conversations</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card className="lg:col-span-2 flex flex-col">
        {selectedConversation ? (
          <>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages && messages.length > 0 ? (
                messages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.from_user_id === profile?.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.from_user_id === profile?.id
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 text-slate-900'
                      }`}
                    >
                      <p className="text-sm">{msg.body}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.from_user_id === profile?.id
                            ? 'text-primary-100'
                            : 'text-slate-500'
                        }`}
                      >
                        {formatDateTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No messages yet. Start the conversation!
                </div>
              )}
            </CardContent>
            <CardContent className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage.mutate();
                    }
                  }}
                />
                <Button
                  onClick={() => sendMessage.mutate()}
                  disabled={!messageText.trim() || sendMessage.isPending}
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center text-slate-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p>Select a conversation to start messaging</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

