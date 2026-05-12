import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, FormEvent, KeyboardEvent } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { AVAILABLE_MODELS, ModelId } from "@/lib/models";
import { PersonalizeDialog, Personalization } from "@/components/PersonalizeDialog";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { DeleteChatDialog } from "@/components/DeleteChatDialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Plus,
  Send,
  Settings as SettingsIcon,
  LogOut,
  Sparkles,
  MessageSquare,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Menu,
} from "lucide-react";

interface Chat {
  id: string;
  title: string;
  updated_at: string;
  custom_model_name?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model_used: string | null;
  created_at: string;
  parent_id: string | null;
}

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "Chat — CompChat" },
      { name: "description", content: "Your private AI chat dashboard." },
    ],
  }),
});

function ChatPage() {
  const { session, user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  // All messages for current chat (full tree)
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  // For each parent_id (or "root"), which sibling index is active
  const [branchSelection, setBranchSelection] = useState<Record<string, number>>({});
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [model, setModel] = useState<ModelId>("openrouter/auto");
  const [profileName, setProfileName] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Chat | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, openrouter_api_key")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        setProfileName(profile.full_name ?? "");
        setHasKey(!!profile.openrouter_api_key);
      }
      await loadChats();
    })();
  }, [user]);

  const loadChats = async () => {
    if (!user) return;
    const { data: chatList } = await supabase
      .from("chats")
      .select("id, title, updated_at, custom_model_name")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (!chatList) return;
    const ids = chatList.map((c) => c.id);
    let lastByChat: Record<string, { content: string; created_at: string }> = {};
    if (ids.length) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("chat_id, content, created_at")
        .in("chat_id", ids)
        .order("created_at", { ascending: false });
      if (msgs) {
        for (const m of msgs) {
          if (!lastByChat[m.chat_id]) {
            lastByChat[m.chat_id] = { content: m.content, created_at: m.created_at };
          }
        }
      }
    }
    const enriched: Chat[] = chatList.map((c) => ({
      ...c,
      last_message: lastByChat[c.id]?.content ?? null,
      last_message_at: lastByChat[c.id]?.created_at ?? c.updated_at,
    }));
    enriched.sort((a, b) =>
      (b.last_message_at ?? b.updated_at).localeCompare(a.last_message_at ?? a.updated_at),
    );
    setChats(enriched);
  };

  useEffect(() => {
    if (!activeChatId) {
      setAllMessages([]);
      setBranchSelection({});
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, role, content, model_used, created_at, parent_id")
        .eq("chat_id", activeChatId)
        .order("created_at", { ascending: true });
      if (data) {
        setAllMessages(data as Message[]);
        // Default branch selection: latest sibling for each parent group
        const sel: Record<string, number> = {};
        const groups = groupByParent(data as Message[]);
        for (const [k, sibs] of Object.entries(groups)) {
          sel[k] = sibs.length - 1;
        }
        setBranchSelection(sel);
      }
    })();
  }, [activeChatId]);

  // Compute the active linear path through the tree based on branchSelection
  const { path: activePath, groups } = useMemo(() => {
    const groups = groupByParent(allMessages);
    const path: Message[] = [];
    let parentKey = "root";
    while (groups[parentKey] && groups[parentKey].length > 0) {
      const sibs = groups[parentKey];
      const idx = Math.min(branchSelection[parentKey] ?? sibs.length - 1, sibs.length - 1);
      const msg = sibs[idx];
      path.push(msg);
      parentKey = msg.id;
    }
    return { path, groups };
  }, [allMessages, branchSelection]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activePath, streamedText]);

  const refreshChats = async () => {
    await loadChats();
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setAllMessages([]);
    setStreamedText("");
    setBranchSelection({});
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
    if (!activeChatId) {
      setPendingPrompt(prompt);
      setPersonalizeOpen(true);
      return;
    }
    // Parent of the new user message = last message in active path (or null)
    const parentId = activePath.length > 0 ? activePath[activePath.length - 1].id : null;
    await runSend(prompt, activeChatId, parentId);
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
      .select("id, title, updated_at, custom_model_name")
      .single();
    if (error || !newChat) {
      toast.error(error?.message ?? "Could not create chat");
      return;
    }
    setActiveChatId(newChat.id);
    setChats((prev) => [{ ...newChat, last_message: null, last_message_at: newChat.updated_at }, ...prev]);
    await runSend(prompt, newChat.id, null);
  };

  const runSend = async (prompt: string, chatId: string, parentId: string | null) => {
    setInput("");
    setStreaming(true);
    setStreamedText("");

    // Insert user message with parent_id
    const { data: inserted, error: insertErr } = await supabase
      .from("messages")
      .insert({ chat_id: chatId, role: "user", content: prompt, parent_id: parentId })
      .select("id, role, content, model_used, created_at, parent_id")
      .single();
    if (insertErr || !inserted) {
      toast.error(insertErr?.message ?? "Failed to send");
      setStreaming(false);
      return;
    }
    const userMsg = inserted as Message;

    // Update local state and select this new sibling as active
    setAllMessages((prev) => {
      const next = [...prev, userMsg];
      return next;
    });
    const parentKey = parentId ?? "root";
    setBranchSelection((prev) => {
      const sibs = allMessages.filter((m) => (m.parent_id ?? null) === parentId);
      return { ...prev, [parentKey]: sibs.length };
    });

    // Build history for API: ancestors of new user msg + new user msg itself
    const history = buildAncestorHistory(allMessages, userMsg).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    await streamAssistant(chatId, history, userMsg.id);
  };

  const streamAssistant = async (chatId: string, history: Array<{ role: string; content: string }>, parentMessageId: string) => {
    try {
      const token = session?.access_token;
      const res = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId, model, messages: history, parentMessageId }),
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
      // Refetch all messages so we get the assistant message id from the server
      const { data } = await supabase
        .from("messages")
        .select("id, role, content, model_used, created_at, parent_id")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      if (data) {
        setAllMessages(data as Message[]);
        // Select latest assistant child of parentMessageId
        const children = (data as Message[]).filter((m) => m.parent_id === parentMessageId);
        setBranchSelection((prev) => ({ ...prev, [parentMessageId]: children.length - 1 }));
      }
      setStreamedText("");
      refreshChats();
    } catch (err) {
      console.error(err);
      toast.error("Connection error");
    } finally {
      setStreaming(false);
    }
  };

  const handleEditSave = async (original: Message) => {
    if (!activeChatId || !editingText.trim() || streaming) return;
    const newContent = editingText.trim();
    setEditingId(null);
    setEditingText("");
    setStreaming(true);
    setStreamedText("");

    // Insert sibling user message with same parent_id
    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({
        chat_id: activeChatId,
        role: "user",
        content: newContent,
        parent_id: original.parent_id,
      })
      .select("id, role, content, model_used, created_at, parent_id")
      .single();
    if (error || !inserted) {
      toast.error(error?.message ?? "Could not edit");
      setStreaming(false);
      return;
    }
    const newMsg = inserted as Message;
    const updated = [...allMessages, newMsg];
    setAllMessages(updated);
    // Select this new branch
    const parentKey = original.parent_id ?? "root";
    const sibs = updated.filter((m) => (m.parent_id ?? null) === (original.parent_id ?? null));
    setBranchSelection((prev) => ({ ...prev, [parentKey]: sibs.length - 1 }));

    // Build history from ancestors + new message
    const history = buildAncestorHistory(updated, newMsg).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    await streamAssistant(activeChatId, history, newMsg.id);
  };

  const switchBranch = (parentKey: string, delta: number, total: number) => {
    setBranchSelection((prev) => {
      const cur = prev[parentKey] ?? total - 1;
      const next = (cur + delta + total) % total;
      return { ...prev, [parentKey]: next };
    });
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

  const sidebarContent = (
    <div className="flex h-full w-full flex-col bg-sidebar">
      <div className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground min-w-0">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <span className="truncate">CompChat</span>
        </Link>
      </div>
      <div className="p-3">
        <Button
          onClick={() => {
            startNewChat();
            setMobileSidebarOpen(false);
          }}
          className="w-full justify-start gap-2"
          variant="default"
        >
          <Plus className="h-4 w-4 shrink-0" /> <span className="truncate">New chat</span>
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5 pb-3">
          {chats.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Start a new chat to begin</p>
            </div>
          )}
          {chats.map((c) => {
            const displayName = c.custom_model_name || c.title;
            const isActive = activeChatId === c.id;
            return (
              <div
                key={c.id}
                className={`group flex items-start gap-3 rounded-lg px-2.5 py-2.5 cursor-pointer transition-colors min-w-0 ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/60 text-sidebar-foreground"
                }`}
                onClick={() => {
                  setActiveChatId(c.id);
                  setMobileSidebarOpen(false);
                }}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-gradient-hero text-primary-foreground text-xs font-semibold">
                    {getChatInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 min-w-0">
                    <p className="font-semibold text-sm truncate min-w-0 flex-1">{displayName}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {formatChatTime(c.last_message_at ?? c.updated_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5 min-w-0">
                    <p className="text-xs text-muted-foreground truncate min-w-0 flex-1">
                      {c.last_message ? c.last_message.replace(/\s+/g, " ").trim() : "No messages yet"}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(c);
                      }}
                      className="shrink-0 p-1.5 -mr-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Delete chat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <div className="border-t border-sidebar-border p-3 space-y-1">
        <div className="flex items-center gap-3 px-2 py-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground text-xs font-semibold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground">{profileName || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Link to="/settings" onClick={() => setMobileSidebarOpen(false)}>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
            <SettingsIcon className="h-4 w-4 shrink-0" /> <span className="truncate">Settings</span>
          </Button>
        </Link>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4 shrink-0" /> <span className="truncate">Sign out</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-sidebar-border shadow-sm">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72 max-w-[85vw] bg-sidebar border-r border-sidebar-border">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 shrink-0"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="md:hidden">
            <Link to="/" className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> CompChat
            </Link>
          </div>
          <div className="flex-1 flex items-center justify-end md:justify-start min-w-0">
            <Select value={model} onValueChange={(v) => setModel(v as ModelId)}>
              <SelectTrigger className="w-[200px] md:w-[260px]">
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
            {activePath.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center text-center py-20">
                <div className="h-16 w-16 rounded-2xl bg-gradient-hero flex items-center justify-center shadow-glow mb-6">
                  <Sparkles className="h-8 w-8 text-primary-foreground" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight">
                  Welcome back {profileName ? `, ${profileName.split(" ")[0]}` : ""}!
                </h2>
                <p className="text-muted-foreground mt-2 max-w-md">
                  Need a friend? Pick a model above and start a conversation.
                </p>
              </div>
            )}

            {activePath.map((m) => {
              const parentKey = m.parent_id ?? "root";
              const siblings = groups[parentKey] ?? [m];
              const idx = siblings.findIndex((s) => s.id === m.id);
              const isEditing = editingId === m.id;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  siblingCount={siblings.length}
                  siblingIndex={idx}
                  onPrev={() => switchBranch(parentKey, -1, siblings.length)}
                  onNext={() => switchBranch(parentKey, 1, siblings.length)}
                  isEditing={isEditing}
                  editingText={editingText}
                  onEditStart={() => {
                    setEditingId(m.id);
                    setEditingText(m.content);
                  }}
                  onEditChange={setEditingText}
                  onEditCancel={() => {
                    setEditingId(null);
                    setEditingText("");
                  }}
                  onEditSave={() => handleEditSave(m)}
                  disabled={streaming}
                />
              );
            })}
            {streaming && (
              <MessageBubble
                message={{
                  id: "_streaming",
                  role: "assistant",
                  content: streamedText,
                  model_used: null,
                  created_at: "",
                  parent_id: null,
                }}
                siblingCount={1}
                siblingIndex={0}
                streaming
              />
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

// ---------- Helpers ----------

function getChatInitials(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function formatChatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString([], { year: "2-digit", month: "short", day: "numeric" });
}

function groupByParent(messages: Message[]): Record<string, Message[]> {
  const groups: Record<string, Message[]> = {};
  for (const m of messages) {
    const key = m.parent_id ?? "root";
    (groups[key] ||= []).push(m);
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return groups;
}

function buildAncestorHistory(all: Message[], leaf: Message): Message[] {
  const byId = new Map(all.map((m) => [m.id, m]));
  const chain: Message[] = [];
  let cur: Message | undefined = leaf;
  while (cur) {
    chain.push(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return chain.reverse();
}

interface BubbleProps {
  message: Message;
  siblingCount: number;
  siblingIndex: number;
  onPrev?: () => void;
  onNext?: () => void;
  streaming?: boolean;
  isEditing?: boolean;
  editingText?: string;
  onEditStart?: () => void;
  onEditChange?: (v: string) => void;
  onEditCancel?: () => void;
  onEditSave?: () => void;
  disabled?: boolean;
}

function MessageBubble({
  message,
  siblingCount,
  siblingIndex,
  onPrev,
  onNext,
  streaming,
  isEditing,
  editingText,
  onEditStart,
  onEditChange,
  onEditCancel,
  onEditSave,
  disabled,
}: BubbleProps) {
  const isUser = message.role === "user";
  const showSwitcher = siblingCount > 1 && !streaming;
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1.5`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-soft ${
          isUser
            ? "bg-bubble-user text-bubble-user-foreground rounded-br-sm"
            : "bg-bubble-assistant text-bubble-assistant-foreground rounded-bl-sm"
        }`}
      >
        {isEditing && isUser ? (
          <div className="flex flex-col gap-2 min-w-[260px]">
            <Textarea
              value={editingText ?? ""}
              onChange={(e) => onEditChange?.(e.target.value)}
              rows={3}
              className="bg-background text-foreground"
              autoFocus
            />
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onEditCancel}
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onEditSave}
                disabled={disabled || !editingText?.trim()}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Save
              </Button>
            </div>
          </div>
        ) : isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : message.content ? (
          <MarkdownMessage content={message.content} />
        ) : null}
        {streaming && (
          <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-current opacity-60 animate-pulse" />
        )}
      </div>

      {/* Controls row */}
      {!streaming && (
        <div className={`flex items-center gap-2 text-xs text-muted-foreground ${isUser ? "pr-1" : "pl-1"}`}>
          {showSwitcher && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onPrev}
                className="p-0.5 hover:text-foreground rounded"
                aria-label="Previous version"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="tabular-nums">
                {siblingIndex + 1} / {siblingCount}
              </span>
              <button
                type="button"
                onClick={onNext}
                className="p-0.5 hover:text-foreground rounded"
                aria-label="Next version"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {isUser && !isEditing && (
            <button
              type="button"
              onClick={onEditStart}
              className="p-0.5 hover:text-foreground rounded inline-flex items-center gap-1"
              aria-label="Edit message"
              disabled={disabled}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
