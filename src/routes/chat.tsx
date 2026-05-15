import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatSidebar } from "@/components/ChatSidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AVAILABLE_MODELS, type ModelId } from "@/lib/models";
import {
  PersonalizeDialog,
  type Personalization,
} from "@/components/PersonalizeDialog";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { ApiKeySetupDialog } from "@/components/ApiKeySetupDialog";
import { DeleteChatDialog } from "@/components/DeleteChatDialog";

import {
  ConfigureChatDialog,
  type ChatConfiguration,
} from "../components/ConfigureChatDialog";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Menu,
  Pencil,
  RotateCcw,
  Send,
  MessageSquareText,
  Trash2,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Chat {
  id: string;
  title: string;
  updated_at: string;

  preset_id?: string | null;
  custom_model_name?: string | null;
  custom_personality?: string | null;
  custom_background?: string | null;
  custom_tone?: string | null;

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
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [branchSelection, setBranchSelection] = useState<Record<string, number>>(
    {},
  );
  // Message-level delete (from file 2)
  const [pendingDeleteMsg, setPendingDeleteMsg] = useState<Message | null>(null);
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
  // Chat-level delete dialog (from file 2)
  const [pendingDelete, setPendingDelete] = useState<Chat | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [configuringChat, setConfiguringChat] = useState<Chat | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/" });
    }
  }, [session, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    const initializeChatPage = async () => {
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
    };

    initializeChatPage();
  }, [user]);

  const loadChats = async () => {
    if (!user) return;

    const { data: chatList, error } = await supabase
      .from("chats")
      .select(
        "id, title, updated_at, preset_id, custom_model_name, custom_personality, custom_background, custom_tone",
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!chatList) return;

    const ids = chatList.map((chat) => chat.id);
    const lastByChat: Record<string, { content: string; created_at: string }> =
      {};

    if (ids.length > 0) {
      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("chat_id, content, created_at")
        .in("chat_id", ids)
        .order("created_at", { ascending: false });

      if (messagesError) {
        toast.error(messagesError.message);
        return;
      }

      if (messages) {
        for (const message of messages) {
          if (!lastByChat[message.chat_id]) {
            lastByChat[message.chat_id] = {
              content: message.content,
              created_at: message.created_at,
            };
          }
        }
      }
    }

    const enriched: Chat[] = chatList.map((chat) => ({
      ...chat,
      last_message: lastByChat[chat.id]?.content ?? null,
      last_message_at: lastByChat[chat.id]?.created_at ?? chat.updated_at,
    }));

    enriched.sort((a, b) =>
      (b.last_message_at ?? b.updated_at).localeCompare(
        a.last_message_at ?? a.updated_at,
      ),
    );

    setChats(enriched);
  };

  useEffect(() => {
    if (!activeChatId) {
      setAllMessages([]);
      setBranchSelection({});
      return;
    }

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, role, content, model_used, created_at, parent_id")
        .eq("chat_id", activeChatId)
        .order("created_at", { ascending: true });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data) {
        const messages = data as Message[];

        setAllMessages(messages);

        const selection: Record<string, number> = {};
        const grouped = groupByParent(messages);

        for (const [key, siblings] of Object.entries(grouped)) {
          selection[key] = siblings.length - 1;
        }

        setBranchSelection(selection);
      }
    };

    loadMessages();
  }, [activeChatId]);

  const { path: activePath, groups } = useMemo(() => {
    const grouped = groupByParent(allMessages);
    const path: Message[] = [];
    let parentKey = "root";

    while (grouped[parentKey] && grouped[parentKey].length > 0) {
      const siblings = grouped[parentKey];
      const index = Math.min(
        branchSelection[parentKey] ?? siblings.length - 1,
        siblings.length - 1,
      );

      const message = siblings[index];

      path.push(message);
      parentKey = message.id;
    }

    return { path, groups: grouped };
  }, [allMessages, branchSelection]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activePath, streamedText]);

  const refreshChats = async () => {
    await loadChats();
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setAllMessages([]);
    setStreamedText("");
    setBranchSelection({});
    setMobileSidebarOpen(false);
  };

  const renameChat = async (
    id: string,
    rawTitle: string,
  ): Promise<boolean> => {
    if (!user) return false;

    const title = normalizeChatTitle(rawTitle);

    if (!title) {
      toast.error("Chat title cannot be empty");
      return false;
    }

    const previousChats = chats;

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === id
          ? {
              ...chat,
              title,
            }
          : chat,
      ),
    );

    const { error } = await supabase
      .from("chats")
      .update({ title })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setChats(previousChats);
      toast.error(error.message);
      return false;
    }

    toast.success("Chat renamed");
    return true;
  };

  const deleteChat = async (id: string): Promise<void> => {
    if (!user) return;

    const previousChats = chats;
    const deletedWasActive = activeChatId === id;

    setChats((previous) => previous.filter((chat) => chat.id !== id));

    if (deletedWasActive) {
      setActiveChatId(null);
      setAllMessages([]);
      setStreamedText("");
      setBranchSelection({});
    }

    const { error } = await supabase
      .from("chats")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setChats(previousChats);

      if (deletedWasActive) {
        setActiveChatId(id);
      }

      toast.error(error.message);
      return;
    }

    toast.success("Chat deleted");
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();

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

    const parentId =
      activePath.length > 0 ? activePath[activePath.length - 1].id : null;

    await runSend(prompt, activeChatId, parentId);
  };

  const handlePersonalizeConfirm = async (personalization: Personalization) => {
    if (!user || !pendingPrompt) return;

    const prompt = pendingPrompt;
    setPendingPrompt(null);

    const titleSource =
      personalization.custom_model_name?.trim() || prompt;

    const title =
      titleSource.length > 50 ? `${titleSource.slice(0, 50)}…` : titleSource;

    const { data: newChat, error } = await supabase
      .from("chats")
      .insert({
        user_id: user.id,
        title,
        preset_id: personalization.preset_id,
        custom_model_name: personalization.custom_model_name,
        custom_personality: personalization.custom_personality,
        custom_background: personalization.custom_background,
        custom_tone: personalization.custom_tone,
      })
      .select(
        "id, title, updated_at, preset_id, custom_model_name, custom_personality, custom_background, custom_tone",
      )
      .single();

    if (error || !newChat) {
      toast.error(error?.message ?? "Could not create chat");
      return;
    }

    setActiveChatId(newChat.id);

    setChats((previous) => [
      {
        ...newChat,
        last_message: null,
        last_message_at: newChat.updated_at,
      },
      ...previous,
    ]);

    await runSend(prompt, newChat.id, null);
  };

  const runSend = async (
    prompt: string,
    chatId: string,
    parentId: string | null,
  ) => {
    setInput("");
    setStreaming(true);
    setStreamedText("");

    const { data: inserted, error: insertError } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        role: "user",
        content: prompt,
        parent_id: parentId,
      })
      .select("id, role, content, model_used, created_at, parent_id")
      .single();

    if (insertError || !inserted) {
      toast.error(insertError?.message ?? "Failed to send");
      setStreaming(false);
      return;
    }

    const userMessage = inserted as Message;

    setAllMessages((previous) => [...previous, userMessage]);

    const parentKey = parentId ?? "root";

    setBranchSelection((previous) => {
      const siblings = allMessages.filter(
        (message) => (message.parent_id ?? null) === parentId,
      );

      return {
        ...previous,
        [parentKey]: siblings.length,
      };
    });

    const history = buildAncestorHistory(allMessages, userMessage).map(
      (message) => ({
        role: message.role,
        content: message.content,
      }),
    );

    await streamAssistant(chatId, history, userMessage.id);
  };

  const streamAssistant = async (
    chatId: string,
    history: Array<{ role: string; content: string }>,
    parentMessageId: string,
  ) => {
    try {
      const token = session?.access_token;

      const response = await fetch("/api/chat-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chatId,
          model,
          messages: history,
          parentMessageId,
        }),
      });

      if (!response.ok || !response.body) {
        const errorBody = await response
          .json()
          .catch(() => ({ error: "Request failed" }));

        toast.error(errorBody.error ?? "Request failed");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        accumulatedText += decoder.decode(value, { stream: true });
        setStreamedText(accumulatedText);
      }

      const { data, error } = await supabase
        .from("messages")
        .select("id, role, content, model_used, created_at, parent_id")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data) {
        const messages = data as Message[];

        setAllMessages(messages);

        const children = messages.filter(
          (message) => message.parent_id === parentMessageId,
        );

        if (children.length > 0) {
          setBranchSelection((previous) => ({
            ...previous,
            [parentMessageId]: children.length - 1,
          }));
        }
      }

      setStreamedText("");
      await refreshChats();
    } catch (error) {
      console.error(error);
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

    const newMessage = inserted as Message;
    const updatedMessages = [...allMessages, newMessage];

    setAllMessages(updatedMessages);

    const parentKey = original.parent_id ?? "root";
    const siblings = updatedMessages.filter(
      (message) =>
        (message.parent_id ?? null) === (original.parent_id ?? null),
    );

    setBranchSelection((previous) => ({
      ...previous,
      [parentKey]: siblings.length - 1,
    }));

    const history = buildAncestorHistory(updatedMessages, newMessage).map(
      (message) => ({
        role: message.role,
        content: message.content,
      }),
    );

    await streamAssistant(activeChatId, history, newMessage.id);
  };

  const switchBranch = (parentKey: string, delta: number, total: number) => {
    setBranchSelection((previous) => {
      const current = previous[parentKey] ?? total - 1;
      const next = (current + delta + total) % total;

      return {
        ...previous,
        [parentKey]: next,
      };
    });
  };

  // Collect a message and all its descendants for cascade delete (from file 2)
  const collectDescendantIds = (rootId: string): string[] => {
    const ids: string[] = [];
    const stack = [rootId];
    while (stack.length) {
      const current = stack.pop()!;
      ids.push(current);
      for (const message of allMessages) {
        if (message.parent_id === current) stack.push(message.id);
      }
    }
    return ids;
  };

  // Confirm and execute message-level delete with cascade (from file 2)
  const confirmDeleteMessage = async () => {
    if (!pendingDeleteMsg) return;
    const ids = collectDescendantIds(pendingDeleteMsg.id);
    const wasRoot = pendingDeleteMsg.parent_id === null;
    setPendingDeleteMsg(null);
    const { error } = await supabase.from("messages").delete().in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    const remaining = allMessages.filter((m) => !ids.includes(m.id));
    setAllMessages(remaining);
    toast.success(
      ids.length > 1 ? `Deleted ${ids.length} messages` : "Message deleted",
    );
    if (wasRoot || remaining.length === 0) {
      startNewChat();
    }
    refreshChats();
  };

  // Retry an assistant message by re-streaming from its parent (from file 2)
  const handleRetryAssistant = async (msg: Message) => {
    if (streaming || !activeChatId) return;
    if (!msg.parent_id) {
      toast.error("Cannot retry — no parent message");
      return;
    }
    const parentUser = allMessages.find((m) => m.id === msg.parent_id);
    if (!parentUser) {
      toast.error("Parent message not found");
      return;
    }
    setStreaming(true);
    setStreamedText("");
    const history = buildAncestorHistory(allMessages, parentUser).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    await streamAssistant(activeChatId, history, parentUser.id);
  };

  const handleRetryFromUser = async (userMsg: Message) => {
    if (streaming || !activeChatId) return;
    setStreaming(true);
    setStreamedText("");
    const history = buildAncestorHistory(allMessages, userMsg).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    await streamAssistant(activeChatId, history, userMsg.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setMobileSidebarOpen(false);
  };

  const handleConfigureChat = (chat: { id: string }) => {
    const selectedChat = chats.find((item) => item.id === chat.id);

    if (!selectedChat) {
      toast.error("Could not load chat settings");
      return;
    }

    setConfiguringChat(selectedChat);
    setConfigureOpen(true);
    setMobileSidebarOpen(false);
  };

  const handleSaveChatConfiguration = async (
    configuration: ChatConfiguration,
  ): Promise<boolean> => {
    if (!user || !configuringChat) {
      toast.error("Could not load chat settings");
      return false;
    }

    const { data, error } = await supabase
      .from("chats")
      .update({
        preset_id: configuration.preset_id,
        custom_model_name: configuration.custom_model_name,
        custom_personality: configuration.custom_personality,
        custom_background: configuration.custom_background,
        custom_tone: configuration.custom_tone,
      })
      .eq("id", configuringChat.id)
      .eq("user_id", user.id)
      .select(
        "id, title, updated_at, preset_id, custom_model_name, custom_personality, custom_background, custom_tone",
      )
      .single();

    if (error || !data) {
      toast.error(error?.message ?? "Could not update chat personality");
      return false;
    }

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === configuringChat.id
          ? {
              ...chat,
              ...data,
            }
          : chat,
      ),
    );

    toast.success("Chat personality updated");
    return true;
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  const initials = (profileName || user?.email || "U").slice(0, 2).toUpperCase();

  const sidebarProps = {
    chats,
    activeChatId,
    initials,
    profileName,
    email: user?.email,
    onNewChat: startNewChat,
    onSelectChat: handleSelectChat,
    onRenameChat: renameChat,
    onConfigureChat: handleConfigureChat,
    onDeleteChat: deleteChat,
    onLogout: handleLogout,
  };

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar {...sidebarProps} />

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent
          side="left"
          className="p-0 w-72 max-w-[85vw] bg-sidebar border-r border-sidebar-border [&_aside]:!flex [&_aside]:!w-full [&_aside]:!h-full [&_aside]:!border-r-0"
        >
          <ChatSidebar {...sidebarProps} />
        </SheetContent>
      </Sheet>

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
              <MessageSquareText className="h-4 w-4 text-primary" />
              CompChat
            </Link>
          </div>

          <div className="flex-1 flex items-center justify-end md:justify-start min-w-0">
            <Select
              value={model}
              onValueChange={(value) => setModel(value as ModelId)}
            >
              <SelectTrigger className="w-[200px] md:w-[260px]">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {AVAILABLE_MODELS.map((availableModel) => (
                  <SelectItem key={availableModel.id} value={availableModel.id}>
                    {availableModel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!hasKey && (
            <Link to="/settings">
              <Button variant="outline" size="sm">
                Add API key
              </Button>
            </Link>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {activePath.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center text-center py-20">
                <div className="h-16 w-16 rounded-2xl bg-gradient-hero flex items-center justify-center shadow-glow mb-6">
                  <MessageSquareText className="h-8 w-8 text-primary-foreground" />
                </div>

                <h2 className="text-3xl font-bold tracking-tight">
                  Welcome back
                  {profileName ? `, ${profileName.split(" ")[0]}` : ""}!
                </h2>

                <p className="text-muted-foreground mt-2 max-w-md">
                  Need a friend? Pick a model above and start a conversation.
                </p>
              </div>
            )}

            {activePath.map((message) => {
              const parentKey = message.parent_id ?? "root";
              const siblings = groups[parentKey] ?? [message];
              const siblingIndex = siblings.findIndex(
                (sibling) => sibling.id === message.id,
              );
              const isEditing = editingId === message.id;

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  siblingCount={siblings.length}
                  siblingIndex={siblingIndex}
                  onPrev={() => switchBranch(parentKey, -1, siblings.length)}
                  onNext={() => switchBranch(parentKey, 1, siblings.length)}
                  isEditing={isEditing}
                  editingText={editingText}
                  onEditStart={() => {
                    setEditingId(message.id);
                    setEditingText(message.content);
                  }}
                  onEditChange={setEditingText}
                  onEditCancel={() => {
                    setEditingId(null);
                    setEditingText("");
                  }}
                  onEditSave={() => handleEditSave(message)}
                  onRetry={
                    message.role === "assistant"
                      ? () => handleRetryAssistant(message)
                      : undefined
                  }
                  onDelete={() => setPendingDeleteMsg(message)}
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const lastMsg = activePath[activePath.length - 1];
            const isUserLast = lastMsg?.role === "user";
            if (input.trim()) {
              sendMessage();
            } else if (isUserLast && !streaming) {
              handleRetryFromUser(lastMsg);
            }
          }}
          className="border-t p-4"
        >
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message…"
              rows={1}
              className="flex-1 min-h-[48px] max-h-48 resize-none"
              disabled={streaming}
            />

            {/* Smart send/retry button (from file 2) */}
            {(() => {
              const lastMsg = activePath[activePath.length - 1];
              const isUserLast = lastMsg?.role === "user";
              const showRetry = !input.trim() && isUserLast;
              const isDisabled = streaming || (!input.trim() && !isUserLast);
              return (
                <Button
                  type="submit"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  disabled={isDisabled}
                  aria-label={showRetry ? "Retry last response" : "Send message"}
                >
                  {showRetry ? (
                    <RotateCcw className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              );
            })()}
          </div>
        </form>
      </main>

      {user && (
        <ConfigureChatDialog
          open={configureOpen}
          onOpenChange={(open: boolean) => {
            setConfigureOpen(open);

            if (!open) {
              setConfiguringChat(null);
            }
          }}
          chat={configuringChat}
          onSave={handleSaveChatConfiguration}
        />
      )}

      {user && (
        <PersonalizeDialog
          open={personalizeOpen}
          onOpenChange={(open) => {
            setPersonalizeOpen(open);

            if (!open) {
              setPendingPrompt(null);
            }
          }}
          userId={user.id}
          onConfirm={handlePersonalizeConfirm}
        />
      )}

      {/* Message delete confirmation dialog (from file 2) */}
      <AlertDialog
        open={!!pendingDeleteMsg}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteMsg(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete message and all subsequent replies?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMessage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Chat delete confirmation dialog (from file 2) */}
      <DeleteChatDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        chatName={pendingDelete?.custom_model_name || pendingDelete?.title}
        onConfirm={() => {
          if (pendingDelete) {
            deleteChat(pendingDelete.id);
            setPendingDelete(null);
          }
        }}
      />

      {user && (
        <ApiKeySetupDialog
          open={!hasKey}
          userId={user.id}
          onSaved={() => setHasKey(true)}
          onSignOut={signOut}
        />
      )}
    </div>
  );
}

// ---------- Helpers ----------

function normalizeChatTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

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

  for (const message of messages) {
    const key = message.parent_id ?? "root";
    (groups[key] ||= []).push(message);
  }

  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  return groups;
}

function buildAncestorHistory(allMessages: Message[], leaf: Message): Message[] {
  const byId = new Map(allMessages.map((message) => [message.id, message]));
  const chain: Message[] = [];
  let current: Message | undefined = leaf;

  while (current) {
    chain.push(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
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
  onEditChange?: (value: string) => void;
  onEditCancel?: () => void;
  onEditSave?: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
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
  onRetry,
  onDelete,
  disabled,
}: BubbleProps) {
  const isUser = message.role === "user";
  const showSwitcher = siblingCount > 1 && !streaming;

  return (
    <div
      className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1.5`}
    >
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
              onChange={(event) => onEditChange?.(event.target.value)}
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
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={onEditSave}
                disabled={disabled || !editingText?.trim()}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Save
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

      {!streaming && (
        <div
          className={`flex items-center gap-2 text-xs text-muted-foreground ${
            isUser ? "pr-1" : "pl-1"
          }`}
        >
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
              className="p-0.5 hover:text-foreground rounded inline-flex items-center gap-1 shrink-0"
              aria-label="Edit message"
              disabled={disabled}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
          )}
          {isUser && !isEditing && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-0.5 hover:text-destructive rounded inline-flex items-center gap-1 shrink-0"
              aria-label="Delete message"
              disabled={disabled}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}
          {!isUser && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="p-0.5 hover:text-foreground rounded inline-flex items-center gap-1 shrink-0"
              aria-label="Retry response"
              disabled={disabled}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          )}
          {!isUser && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-0.5 hover:text-destructive rounded inline-flex items-center gap-1 shrink-0"
              aria-label="Delete message"
              disabled={disabled}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
