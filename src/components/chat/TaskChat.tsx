import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TaskChatProps {
  taskId: string;
  posterId: string;
  doerId: string;
}

interface Message {
  id: string;
  task_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export function TaskChat({ taskId, posterId, doerId }: TaskChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastNotifiedRef = useRef<number>(0);

  const isParticipant = user?.id === posterId || user?.id === doerId;

  // Fetch messages
  useEffect(() => {
    if (!taskId || !isParticipant) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("task_messages")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) || []);
      setLoading(false);
    };
    fetchMessages();
  }, [taskId, isParticipant]);

  // Real-time subscription
  useEffect(() => {
    if (!taskId || !isParticipant) return;
    const channel = supabase
      .channel(`chat-${taskId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "task_messages", filter: `task_id=eq.${taskId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [taskId, isParticipant]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.from("task_messages").insert({
        task_id: taskId,
        sender_id: user.id,
        content: newMessage.trim(),
      } as any);
      if (error) throw error;

      // Throttled notification (every 30s)
      const now = Date.now();
      if (now - lastNotifiedRef.current > 30000) {
        lastNotifiedRef.current = now;
        const recipientId = user.id === posterId ? doerId : posterId;
        await supabase.from("notifications").insert({
          user_id: recipientId,
          title: "New Message",
          message: `You have a new message about a task.`,
          type: "chat_message",
          data: { task_id: taskId },
        });
      }

      setNewMessage("");
    } catch (e) {
      console.error("Send error:", e);
    } finally {
      setSending(false);
    }
  };

  if (!isParticipant) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" /> Task Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div
          ref={scrollRef}
          className="h-64 overflow-y-auto space-y-2 mb-3 rounded-lg bg-muted/30 p-3"
        >
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Say hello!</p>
          )}
          {messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  <p>{msg.content}</p>
                  <p className={cn("text-[10px] mt-1", isMine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {format(new Date(msg.created_at), "h:mm a")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
