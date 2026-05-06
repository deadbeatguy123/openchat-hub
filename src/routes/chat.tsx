import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, FormEvent, KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AVAILABLE_MODELS, ModelId } from "@/lib/models";
import { PersonalizeDialog, Personalization } from "@/components/PersonalizeDialog";
import {
  Plus,
  Send,
  Settings as SettingsIcon,
  LogOut,
  Sparkles,
  MessageSquare,
  Trash2,
} from "lucide-react";

interface Chat {
  id: string;
  title: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model_used: string | null;
  created_at: string;
}

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "Chat — Keychat" },
      { name: "description", content: "Your private AI chat dashboard." },
    ],
  }),
});

function ChatPage() {
  const { session, user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [model, setModel] = useState<ModelId>("openrouter/auto");
  const [profileName, setProfileName] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  // Load profile + chats
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: profile }, { data: chatList }] = await Promise.all([
        supabase.from("profiles").select("full_name, openrouter_api_key").eq("id", user.id).maybeSingle(),
        supabase
          .from("chats")
          .select("id, title, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
      ]);
      if (profile) {
        setProfileName(profile.full_name ?? "");
        setHasKey(!!profile.openrouter_api_key);
      }
      if (chatList) setChats(chatList);
    })();
  }, [user]);

  // Load messages on chat switch
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", activeChatId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
    })();
  }, [activeChatId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamedText]);

  const refreshChats = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chats")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setChats(data);
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setStreamedText("");
  };

  const deleteChat = async (id: string) => {
    const { error } = await supabase.from("chats").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (activeChatId === id) startNewChat();
    refreshChats();
  };

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    const prompt = input.trim();
    if (!prompt || streaming || !user) return;

    if (!hasKey) {
      toast.error("Add your OpenRouter API key first");
      navigate({ to: "/settings" });
      return;
    }

    // First message in a new chat → ask to personalize first
    if (!activeChatId) {
      setPendingPrompt(prompt);
      setPersonalizeOpen(true);
      return;
    }

    await runSend(prompt, activeChatId);
  };

  const handlePersonalizeConfirm = async (p: Personalization) => {
    if (!user || !pendingPrompt) return;
    const prompt = pendingPrompt;
    setPendingPrompt(null);

    const title = prompt.length > 50 ? prompt.slice(0, 50) + "…" : prompt;
    const { data: newChat, error } = await supabase
      .from("chats")
      .insert({
        user_id: user.id,
        title,
        preset_id: p.preset_id,
        custom_model_name: p.custom_model_name,
        custom_personality: p.custom_personality,
        custom_background: p.custom_background,
        custom_tone: p.custom_tone,
      })
      .select("id, title, updated_at")
      .single();
    if (error || !newChat) {
      toast.error(error?.message ?? "Could not create chat");
      return;
    }
    setActiveChatId(newChat.id);
    setChats((prev) => [newChat, ...prev]);
    await runSend(prompt, newChat.id);
  };

  const runSend = async (prompt: string, chatId: string) => {
    setInput("");
    setStreaming(true);
    setStreamedText("");

    // Persist user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      model_used: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const { error: insertErr } = await supabase.from("messages").insert({
      chat_id: chatId,
      role: "user",
      content: prompt,
    });
    if (insertErr) {
      toast.error(insertErr.message);
      setStreaming(false);
      return;
    }

    // Build history for API
    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const token = session?.access_token;
      const res = await fetch("/api/chat-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ chatId, model, messages: history }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        toast.error(err.error ?? "Request failed");
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreamedText(acc);
      }

      // Finalize: add assistant message to local state
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: acc,
        model_used: model,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamedText("");
      refreshChats();
    } catch (err) {
      console.error(err);
      toast.error("Connection error");
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const initials = (profileName || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-72 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            Keychat
          </Link>
        </div>
        <div className="p-3">
          <Button onClick={startNewChat} className="w-full justify-start gap-2" variant="default">
            <Plus className="h-4 w-4" /> New chat
          </Button>
        </div>
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1 pb-3">
            {chats.length === 0 && (
              <p className="text-xs text-muted-foreground px-3 py-4 text-center">No chats yet</p>
            )}
            {chats.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer transition-colors ${
                  activeChatId === c.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                }`}
                onClick={() => setActiveChatId(c.id)}
              >
                <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
                <span className="flex-1 truncate">{c.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(c.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete chat"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="border-t border-sidebar-border p-3 space-y-1">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground text-xs font-semibold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground">{profileName || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Link to="/settings">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
              <SettingsIcon className="h-4 w-4" /> Settings
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b px-4 py-3 flex items-center justify-between gap-3">
          <div className="md:hidden">
            <Link to="/" className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Keychat
            </Link>
          </div>
          <div className="flex-1 flex items-center justify-end md:justify-start">
            <Select value={model} onValueChange={(v) => setModel(v as ModelId)}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!hasKey && (
            <Link to="/settings">
              <Button variant="outline" size="sm">Add API key</Button>
            </Link>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center text-center py-20">
                <div className="h-16 w-16 rounded-2xl bg-gradient-hero flex items-center justify-center shadow-glow mb-6">
                  <Sparkles className="h-8 w-8 text-primary-foreground" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight">
                  Welcome{profileName ? `, ${profileName.split(" ")[0]}` : ""}.
                </h2>
                <p className="text-muted-foreground mt-2 max-w-md">
                  Pick a model above and start a conversation. Your messages are streamed in real time.
                </p>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} />
            ))}
            {streaming && streamedText && (
              <MessageBubble role="assistant" content={streamedText} streaming />
            )}
            {streaming && !streamedText && (
              <MessageBubble role="assistant" content="" streaming />
            )}
          </div>
        </div>

        <form onSubmit={sendMessage} className="border-t p-4">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message…"
              rows={1}
              className="flex-1 min-h-[48px] max-h-48 resize-none"
              disabled={streaming}
            />
            <Button type="submit" size="icon" className="h-12 w-12 shrink-0" disabled={streaming || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </main>

      {user && (
        <PersonalizeDialog
          open={personalizeOpen}
          onOpenChange={(o) => {
            setPersonalizeOpen(o);
            if (!o) setPendingPrompt(null);
          }}
          userId={user.id}
          onConfirm={handlePersonalizeConfirm}
        />
      )}
    </div>
  );
}

function MessageBubble({
  role,
  content,
  streaming,
}: {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap shadow-soft ${
          isUser
            ? "bg-bubble-user text-bubble-user-foreground rounded-br-sm"
            : "bg-bubble-assistant text-bubble-assistant-foreground rounded-bl-sm"
        }`}
      >
        {content}
        {streaming && (
          <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-current opacity-60 animate-pulse" />
        )}
      </div>
    </div>
  );
}
