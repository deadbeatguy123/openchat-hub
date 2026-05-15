

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  type ChangeEvent,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChatSidebar } from "@/components/ChatSidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { AVAILABLE_MODELS, type ModelId } from "@/lib/models";
import {
  PersonalizeDialog,
  type Personalization,
} from "@/components/PersonalizeDialog";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { ApiKeySetupDialog } from "@/components/ApiKeySetupDialog";
import {
  ConfigureChatDialog,
  type ChatConfiguration,
} from "../components/ConfigureChatDialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  BookOpen,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Heart,
  Menu,
  MessageSquareText,
  Palette,
  Pencil,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

interface Chat {
  id: string;
  title: string;
  updated_at: string;

  preset_id?: string | null;
  custom_model_name?: string | null;
  custom_personality?: string | null;
  custom_background?: string | null;
  custom_tone?: string | null;

  avatar?: string | null;
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

type ChatView = "home" | "new" | "chat";

type ChatAvatarMap = Record<string, string>;

type NewChatChoice = {
  configuration: ChatConfiguration;
  avatarUrl?: string | null;
};

type NewChatPersona = {
  id: string;
  title: string;
  description: string;
  icon: typeof BookOpen;
  avatarUrl: string;
  configuration: ChatConfiguration;
};

const CHAT_AVATAR_STORAGE_KEY = "compchat.chatAvatars.v1";

const NEW_CHAT_PERSONAS: NewChatPersona[] = [
  {
    id: "tutor",
    title: "Tutor",
    description: "Explains concepts step by step and checks your understanding.",
    icon: BookOpen,
    avatarUrl: createAvatarDataUri("T"),
    configuration: {
      preset_id: null,
      custom_model_name: "Tutor",
      custom_personality:
        "A patient tutor who explains concepts clearly, asks guiding questions, and avoids giving overly complicated answers.",
      custom_background:
        "An academic learning companion that helps students understand lessons, assignments, and technical topics.",
      custom_tone: "patient, clear, encouraging",
    },
  },
  {
    id: "coder",
    title: "Coder",
    description: "Helps debug, refactor, and explain programming problems.",
    icon: Code2,
    avatarUrl: createAvatarDataUri("C"),
    configuration: {
      preset_id: null,
      custom_model_name: "Coder",
      custom_personality:
        "A careful software engineering assistant who prioritizes correctness, clean structure, and practical debugging.",
      custom_background:
        "An experienced full-stack developer familiar with React, TypeScript, Supabase, APIs, and deployment workflows.",
      custom_tone: "precise, practical, direct",
    },
  },
  {
    id: "creative-writer",
    title: "Creative Writer",
    description:
      "Supports brainstorming, rewriting, stories, and expressive drafts.",
    icon: Palette,
    avatarUrl: createAvatarDataUri("W"),
    configuration: {
      preset_id: null,
      custom_model_name: "Creative Writer",
      custom_personality:
        "A creative writing partner who helps generate ideas, improve wording, and shape tone without sounding generic.",
      custom_background:
        "A writing assistant focused on storytelling, style, structure, and audience-aware expression.",
      custom_tone: "imaginative, warm, polished",
    },
  },
  {
    id: "research-assistant",
    title: "Research Assistant",
    description: "Helps organize academic work, summaries, and study arguments.",
    icon: Search,
    avatarUrl: createAvatarDataUri("R"),
    configuration: {
      preset_id: null,
      custom_model_name: "Research Assistant",
      custom_personality:
        "A rigorous research assistant who values accuracy, source alignment, and careful academic framing.",
      custom_background:
        "An academic assistant that helps with literature reviews, methodology writing, summaries, and technical explanations.",
      custom_tone: "formal, careful, evidence-focused",
    },
  },
  {
    id: "companion",
    title: "Companion",
    description: "A friendly chat partner for casual conversation and reflection.",
    icon: Heart,
    avatarUrl: createEmojiAvatarDataUri("♡"),
    configuration: {
      preset_id: null,
      custom_model_name: "Companion",
      custom_personality:
        "A friendly and supportive companion who listens well and responds naturally without being too formal.",
      custom_background:
        "A casual conversational partner for everyday thoughts, planning, motivation, and reflection.",
      custom_tone: "friendly, relaxed, supportive",
    },
  },
  {
    id: "interview-coach",
    title: "Interview Coach",
    description:
      "Helps prepare answers, practice questions, and improve confidence.",
    icon: Briefcase,
    avatarUrl: createAvatarDataUri("I"),
    configuration: {
      preset_id: null,
      custom_model_name: "Interview Coach",
      custom_personality:
        "A focused interview coach who helps structure answers, practice responses, and improve clarity.",
      custom_background:
        "A career preparation assistant for mock interviews, behavioral questions, and professional communication.",
      custom_tone: "professional, constructive, confident",
    },
  },
];

const CUTE_CHAT_ICONS = [
  {
    id: "sparkle",
    label: "Sparkle",
    avatarUrl: createEmojiAvatarDataUri("✨"),
  },
  {
    id: "cat",
    label: "Cat",
    avatarUrl: createEmojiAvatarDataUri("🐱"),
  },
  {
    id: "robot",
    label: "Robot",
    avatarUrl: createEmojiAvatarDataUri("🤖"),
  },
  {
    id: "frog",
    label: "Frog",
    avatarUrl: createEmojiAvatarDataUri("🐸"),
  },
  {
    id: "fox",
    label: "Fox",
    avatarUrl: createEmojiAvatarDataUri("🦊"),
  },
  {
    id: "panda",
    label: "Panda",
    avatarUrl: createEmojiAvatarDataUri("🐼"),
  },
  {
    id: "ghost",
    label: "Ghost",
    avatarUrl: createEmojiAvatarDataUri("👻"),
  },
  {
    id: "star",
    label: "Star",
    avatarUrl: createEmojiAvatarDataUri("⭐"),
  },
  {
    id: "moon",
    label: "Moon",
    avatarUrl: createEmojiAvatarDataUri("🌙"),
  },
  {
    id: "flower",
    label: "Flower",
    avatarUrl: createEmojiAvatarDataUri("🌸"),
  },
] as const;

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
  const [chatAvatars, setChatAvatars] = useState<ChatAvatarMap>(() =>
    readStoredChatAvatars(),
  );
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatView, setChatView] = useState<ChatView>("home");
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [branchSelection, setBranchSelection] = useState<Record<string, number>>(
    {},
  );
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [configuringChat, setConfiguringChat] = useState<Chat | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const chatsWithAvatars = useMemo(
    () =>
      chats.map((chat) => ({
        ...chat,
        avatar: getChatAvatar(chat, chatAvatars),
      })),
    [chats, chatAvatars],
  );

  const activeChat =
    chatsWithAvatars.find((chat) => chat.id === activeChatId) ?? null;

  const activeChatAvatar = activeChat
    ? getChatAvatar(activeChat, chatAvatars)
    : createAvatarDataUri("A");

  const activeChatName =
    activeChat?.custom_model_name?.trim() ||
    activeChat?.title?.trim() ||
    "Assistant";

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
      avatar: getChatAvatar(chat, chatAvatars),
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

  const saveChatAvatar = (chatId: string, avatarUrl?: string | null) => {
    if (!avatarUrl) return;

    setChatAvatars((previous) => {
      const next = {
        ...previous,
        [chatId]: avatarUrl,
      };

      writeStoredChatAvatars(next);
      return next;
    });

    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              avatar: avatarUrl,
            }
          : chat,
      ),
    );
  };

  const refreshChats = async () => {
    await loadChats();
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setAllMessages([]);
    setStreamedText("");
    setBranchSelection({});
    setPendingPrompt(null);
    setPersonalizeOpen(false);
    setChatView("new");
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
    const previousAvatars = chatAvatars;
    const deletedWasActive = activeChatId === id;

    setChats((previous) => previous.filter((chat) => chat.id !== id));

    setChatAvatars((previous) => {
      const next = { ...previous };
      delete next[id];
      writeStoredChatAvatars(next);
      return next;
    });

    if (deletedWasActive) {
      setActiveChatId(null);
      setChatView("home");
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
      setChatAvatars(previousAvatars);
      writeStoredChatAvatars(previousAvatars);

      if (deletedWasActive) {
        setActiveChatId(id);
        setChatView("chat");
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

    const titleSource = personalization.custom_model_name?.trim() || prompt;
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

    const avatarUrl = getDefaultAvatarForConfiguration(personalization);

    setActiveChatId(newChat.id);
    setChatView("chat");
    saveChatAvatar(newChat.id, avatarUrl);

    setChats((previous) => [
      {
        ...newChat,
        avatar: avatarUrl,
        last_message: null,
        last_message_at: newChat.updated_at,
      },
      ...previous,
    ]);

    await runSend(prompt, newChat.id, null);
  };

  const createConfiguredChat = async (choice: NewChatChoice) => {
    if (!user) return;

    const { configuration, avatarUrl } = choice;

    const titleSource =
      configuration.custom_model_name?.trim() || "New conversation";

    const title =
      titleSource.length > 50 ? `${titleSource.slice(0, 50)}…` : titleSource;

    const { data: newChat, error } = await supabase
      .from("chats")
      .insert({
        user_id: user.id,
        title,
        preset_id: configuration.preset_id,
        custom_model_name: configuration.custom_model_name,
        custom_personality: configuration.custom_personality,
        custom_background: configuration.custom_background,
        custom_tone: configuration.custom_tone,
      })
      .select(
        "id, title, updated_at, preset_id, custom_model_name, custom_personality, custom_background, custom_tone",
      )
      .single();

    if (error || !newChat) {
      toast.error(error?.message ?? "Could not create chat");
      return;
    }

    const resolvedAvatar =
      avatarUrl ?? getDefaultAvatarForConfiguration(configuration);

    setActiveChatId(newChat.id);
    setChatView("chat");
    setAllMessages([]);
    setBranchSelection({});
    setStreamedText("");
    saveChatAvatar(newChat.id, resolvedAvatar);

    setChats((previous) => [
      {
        ...newChat,
        avatar: resolvedAvatar,
        last_message: null,
        last_message_at: newChat.updated_at,
      },
      ...previous,
    ]);

    toast.success(`${title} is ready`);
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

  const collectDescendantIds = (rootId: string): string[] => {
    const ids: string[] = [];
    const stack = [rootId];

    while (stack.length) {
      const current = stack.pop()!;

      ids.push(current);

      for (const message of allMessages) {
        if (message.parent_id === current) {
          stack.push(message.id);
        }
      }
    }

    return ids;
  };

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

    const remaining = allMessages.filter((message) => !ids.includes(message.id));

    setAllMessages(remaining);

    toast.success(
      ids.length > 1 ? `Deleted ${ids.length} messages` : "Message deleted",
    );

    if (wasRoot || remaining.length === 0) {
      setActiveChatId(null);
      setChatView("home");
      setAllMessages([]);
      setStreamedText("");
      setBranchSelection({});
    }

    await refreshChats();
  };

  const handleRetryAssistant = async (message: Message) => {
    if (streaming || !activeChatId) return;

    if (!message.parent_id) {
      toast.error("Cannot retry because this response has no parent message");
      return;
    }

    const parentUser = allMessages.find((item) => item.id === message.parent_id);

    if (!parentUser) {
      toast.error("Parent message not found");
      return;
    }

    setStreaming(true);
    setStreamedText("");

    const history = buildAncestorHistory(allMessages, parentUser).map((item) => ({
      role: item.role,
      content: item.content,
    }));

    await streamAssistant(activeChatId, history, parentUser.id);
  };

  const handleRetryFromUser = async (message: Message) => {
    if (streaming || !activeChatId) return;

    setStreaming(true);
    setStreamedText("");

    const history = buildAncestorHistory(allMessages, message).map((item) => ({
      role: item.role,
      content: item.content,
    }));

    await streamAssistant(activeChatId, history, message.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      const lastMessage = activePath[activePath.length - 1];
      const isUserLast = lastMessage?.role === "user";

      if (input.trim()) {
        sendMessage();
      } else if (isUserLast && !streaming) {
        handleRetryFromUser(lastMessage);
      }
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setChatView("chat");
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
              avatar: getChatAvatar({ ...chat, ...data }, chatAvatars),
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
    chats: chatsWithAvatars,
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

      <main className="relative flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 10%, rgba(129, 140, 248, 0.16), transparent 32%), radial-gradient(circle at 85% 18%, rgba(34, 211, 238, 0.12), transparent 30%), linear-gradient(135deg, rgba(248, 250, 252, 0.96), rgba(239, 246, 255, 0.72))",
          }}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(99, 102, 241, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.16) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />

        <header className="relative z-10 border-b bg-background/75 px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-md">
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
              <Sparkles className="h-4 w-4 text-primary" />
              CompChat
            </Link>
          </div>

          <div className="flex-1 flex items-center justify-end md:justify-start min-w-0">
            <Select
              value={model}
              onValueChange={(value) => setModel(value as ModelId)}
            >
              <SelectTrigger className="w-[200px] md:w-[260px] bg-background/80">
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

        <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto">
          <div
            className={`mx-auto px-4 py-6 space-y-6 ${
              chatView === "new" ? "max-w-6xl" : "max-w-3xl"
            }`}
          >
            {chatView === "new" && !streaming && (
              <NewChatPicker
                onChoosePersona={createConfiguredChat}
                onCancel={() => setChatView(activeChatId ? "chat" : "home")}
              />
            )}

            {chatView !== "new" && activePath.length === 0 && !streaming && (
              <EmptyChatState profileName={profileName} activeChat={activeChat} />
            )}

            {chatView !== "new" &&
              activePath.map((message) => {
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
                    onRetry={
                      message.role === "assistant"
                        ? () => handleRetryAssistant(message)
                        : undefined
                    }
                    onDelete={() => setPendingDeleteMsg(message)}
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
                    assistantAvatar={activeChatAvatar}
                    assistantName={activeChatName}
                    userInitials={initials}
                    disabled={streaming}
                  />
                );
              })}

            {chatView !== "new" && streaming && (
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
                assistantAvatar={activeChatAvatar}
                assistantName={activeChatName}
                userInitials={initials}
              />
            )}
          </div>
        </div>

        {chatView !== "new" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();

              const lastMessage = activePath[activePath.length - 1];
              const isUserLast = lastMessage?.role === "user";

              if (input.trim()) {
                sendMessage();
              } else if (isUserLast && !streaming) {
                handleRetryFromUser(lastMessage);
              }
            }}
            className="relative z-10 border-t bg-background/75 p-4 backdrop-blur-md"
          >
            <div className="max-w-3xl mx-auto flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message…"
                rows={1}
                className="flex-1 min-h-[48px] max-h-48 resize-none bg-background/90"
                disabled={streaming}
              />

              {(() => {
                const lastMessage = activePath[activePath.length - 1];
                const isUserLast = lastMessage?.role === "user";
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
        )}
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

      <AlertDialog
        open={!!pendingDeleteMsg}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setPendingDeleteMsg(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete message and all subsequent replies?
            </AlertDialogTitle>

            <AlertDialogDescription>
              This action cannot be undone. Deleting this message will also
              remove replies or branches that depend on it.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction
              onClick={confirmDeleteMessage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete message
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

interface EmptyChatStateProps {
  profileName: string;
  activeChat: Chat | null;
}

function EmptyChatState({ profileName, activeChat }: EmptyChatStateProps) {
  const chatName =
    activeChat?.custom_model_name?.trim() ||
    activeChat?.title?.trim() ||
    null;

  const avatarUrl = activeChat ? getChatAvatar(activeChat, {}) : null;
  const isExistingEmptyChat = !!activeChat;

  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <div className="rounded-[2rem] border border-white/70 bg-background/55 px-8 py-10 shadow-sm backdrop-blur-md">
        <div className="mb-6 flex justify-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={chatName ?? "Assistant avatar"}
              className="h-20 w-20 rounded-2xl object-cover shadow-glow"
            />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-gradient-hero flex items-center justify-center shadow-glow">
              <MessageSquareText className="h-8 w-8 text-primary-foreground" />
            </div>
          )}
        </div>

        <h2 className="text-3xl font-bold tracking-tight">
          {isExistingEmptyChat
            ? `Start chatting with ${chatName ?? "this chat"}`
            : `Welcome back${profileName ? `, ${profileName.split(" ")[0]}` : ""}!`}
        </h2>

        <p className="text-muted-foreground mt-2 max-w-md">
          {isExistingEmptyChat
            ? "Send the first message to begin this configured conversation."
            : "Need a friend? Click New chat to choose a companion, or send a message below."}
        </p>
      </div>
    </div>
  );
}

interface NewChatPickerProps {
  onChoosePersona: (choice: NewChatChoice) => void | Promise<void>;
  onCancel: () => void;
}

function NewChatPicker({ onChoosePersona, onCancel }: NewChatPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");
  const [customUploadedAvatar, setCustomUploadedAvatar] = useState<string | null>(
    null,
  );
 const [selectedIconId, setSelectedIconId] = useState<string>(
  CUTE_CHAT_ICONS[0]?.id ?? "sparkle",
);
  const [customPersonality, setCustomPersonality] = useState("");
  const [customBackground, setCustomBackground] = useState("");
  const [customTone, setCustomTone] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedIcon = CUTE_CHAT_ICONS.find(
    (icon) => icon.id === selectedIconId,
  );

  const previewName = customName.trim() || "Custom Persona";
  const normalizedUrl = normalizeAvatarUrl(customAvatarUrl);

  const previewAvatar =
    customUploadedAvatar ??
    normalizedUrl ??
    selectedIcon?.avatarUrl ??
    createAvatarDataUri(getInitials(previewName));

  const choosePersona = async (choice: NewChatChoice) => {
    if (creating) return;

    setCreating(true);

    try {
      await onChoosePersona(choice);
    } finally {
      setCreating(false);
    }
  };

  const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 1_000_000) {
      toast.error("Choose an image under 1 MB so it can be saved locally.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCustomUploadedAvatar(reader.result);
        setCustomAvatarUrl("");
      }
    };

    reader.onerror = () => {
      toast.error("Could not read the selected image.");
    };

    reader.readAsDataURL(file);
  };

  const createCustomPersona = async () => {
    const name = customName.trim() || "Custom Persona";
    const personality = customPersonality.trim();
    const background = customBackground.trim();
    const tone = customTone.trim();
    const normalizedAvatar = normalizeAvatarUrl(customAvatarUrl);

    if (customAvatarUrl.trim() && !normalizedAvatar) {
      toast.error("Use a valid image URL that starts with http:// or https://");
      return;
    }

    await choosePersona({
      avatarUrl:
        customUploadedAvatar ??
        normalizedAvatar ??
        selectedIcon?.avatarUrl ??
        createAvatarDataUri(getInitials(name)),
      configuration: {
        preset_id: null,
        custom_model_name: name,
        custom_personality: personality || null,
        custom_background: background || null,
        custom_tone: tone || null,
      },
    });
  };

  return (
    <div className="py-4">
      <div className="rounded-[2rem] border border-white/70 bg-background/55 p-5 shadow-sm backdrop-blur-md md:p-7">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-hero flex items-center justify-center shadow-glow mb-5">
            <Sparkles className="h-8 w-8 text-primary-foreground" />
          </div>

          <h2 className="text-3xl font-bold tracking-tight">
            Choose a Companion
          </h2>

          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Start with a ready-made personality or create a custom persona before
            the first message.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NEW_CHAT_PERSONAS.map((persona) => {
            const Icon = persona.icon;

            return (
              <button
                key={persona.id}
                type="button"
                onClick={() =>
                  choosePersona({
                    configuration: persona.configuration,
                    avatarUrl: persona.avatarUrl,
                  })
                }
                disabled={creating}
                className="group text-left rounded-2xl border bg-card/90 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="mb-4 flex items-center gap-3">
                  <img
                    src={persona.avatarUrl}
                    alt={`${persona.title} avatar`}
                    className="h-11 w-11 rounded-xl object-cover shadow-sm"
                  />

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                <h3 className="font-semibold text-card-foreground">
                  {persona.title}
                </h3>

                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {persona.description}
                </p>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setCustomOpen((value) => !value)}
            disabled={creating}
            className="group text-left rounded-2xl border border-dashed bg-card/90 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="mb-4 flex items-center gap-3">
              <img
                src={previewAvatar}
                alt="Custom persona avatar preview"
                className="h-11 w-11 rounded-xl object-cover shadow-sm"
              />

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
            </div>

            <h3 className="font-semibold text-card-foreground">
              Custom Persona
            </h3>

            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Define your own bot name, profile picture, personality, background,
              and tone.
            </p>
          </button>
        </div>

        {customOpen && (
          <div className="mt-5 rounded-2xl border bg-card/90 p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <img
                src={previewAvatar}
                alt="Custom avatar preview"
                className="h-14 w-14 rounded-2xl object-cover shadow-sm"
              />

              <div>
                <p className="font-semibold text-card-foreground">
                  {previewName}
                </p>
                <p className="text-sm text-muted-foreground">
                  This picture will appear in the sidebar and beside assistant
                  messages.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="new-chat-custom-name"
                  className="text-sm font-medium"
                >
                  Bot name
                </label>
                <Input
                  id="new-chat-custom-name"
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  placeholder="Example: Thesis Coach"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="new-chat-custom-tone"
                  className="text-sm font-medium"
                >
                  Tone
                </label>
                <Input
                  id="new-chat-custom-tone"
                  value={customTone}
                  onChange={(event) => setCustomTone(event.target.value)}
                  placeholder="Example: academic, strict, friendly"
                />
              </div>

              <div className="space-y-3 md:col-span-2">
                <div>
                  <p className="text-sm font-medium">Profile picture</p>
                  <p className="text-xs text-muted-foreground">
                    Upload a small image, paste an image URL, or choose one of
                    the built-in icons.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={creating}
                  >
                    Upload from device
                  </Button>

                  {(customUploadedAvatar || customAvatarUrl) && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setCustomUploadedAvatar(null);
                        setCustomAvatarUrl("");
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      disabled={creating}
                    >
                      Clear image
                    </Button>
                  )}
                </div>

                <Input
                  id="new-chat-custom-avatar"
                  value={customAvatarUrl}
                  onChange={(event) => {
                    setCustomAvatarUrl(event.target.value);
                    setCustomUploadedAvatar(null);
                  }}
                  placeholder="Optional image URL: https://example.com/avatar.png"
                />

                <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {CUTE_CHAT_ICONS.map((icon) => {
                    const isSelected =
                      selectedIconId === icon.id &&
                      !customUploadedAvatar &&
                      !customAvatarUrl.trim();

                    return (
                      <button
                        key={icon.id}
                        type="button"
                        onClick={() => {
                          setSelectedIconId(icon.id);
                          setCustomUploadedAvatar(null);
                          setCustomAvatarUrl("");

                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className={`rounded-2xl border p-1.5 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "bg-background"
                        }`}
                        aria-label={`Use ${icon.label} icon`}
                      >
                        <img
                          src={icon.avatarUrl}
                          alt={icon.label}
                          className="h-10 w-10 rounded-xl object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label
                  htmlFor="new-chat-custom-personality"
                  className="text-sm font-medium"
                >
                  Personality
                </label>
                <Textarea
                  id="new-chat-custom-personality"
                  value={customPersonality}
                  onChange={(event) => setCustomPersonality(event.target.value)}
                  placeholder="Example: A precise assistant who explains carefully and avoids vague answers."
                  rows={3}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label
                  htmlFor="new-chat-custom-background"
                  className="text-sm font-medium"
                >
                  Background
                </label>
                <Textarea
                  id="new-chat-custom-background"
                  value={customBackground}
                  onChange={(event) => setCustomBackground(event.target.value)}
                  placeholder="Example: A senior systems engineer who helps with React, Supabase, and deployment."
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={creating}
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={createCustomPersona}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create custom chat"}
              </Button>
            </div>
          </div>
        )}

        {!customOpen && (
          <div className="mt-6 flex justify-center">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Back to home
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeChatTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
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
  onRetry?: () => void;
  onDelete?: () => void;
  streaming?: boolean;
  isEditing?: boolean;
  editingText?: string;
  onEditStart?: () => void;
  onEditChange?: (value: string) => void;
  onEditCancel?: () => void;
  onEditSave?: () => void;
  assistantAvatar?: string | null;
  assistantName?: string;
  userInitials?: string;
  disabled?: boolean;
}

function MessageBubble({
  message,
  siblingCount,
  siblingIndex,
  onPrev,
  onNext,
  onRetry,
  onDelete,
  streaming,
  isEditing,
  editingText,
  onEditStart,
  onEditChange,
  onEditCancel,
  onEditSave,
  assistantAvatar,
  assistantName = "Assistant",
  userInitials = "U",
  disabled,
}: BubbleProps) {
  const isUser = message.role === "user";
  const showSwitcher = siblingCount > 1 && !streaming;

  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <ChatHead
          imageUrl={assistantAvatar}
          label={assistantName}
          fallback={getInitials(assistantName)}
        />
      )}

      <div
        className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1.5 min-w-0`}
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
                className="p-0.5 hover:text-foreground rounded inline-flex items-center gap-1"
                aria-label="Edit message"
                disabled={disabled}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
            )}

            {!isEditing && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="p-0.5 hover:text-foreground rounded inline-flex items-center gap-1"
                aria-label="Retry response"
                disabled={disabled}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </button>
            )}

            {!isEditing && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-0.5 hover:text-destructive rounded inline-flex items-center gap-1"
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

      {isUser && (
        <ChatHead imageUrl={null} label="You" fallback={userInitials} />
      )}
    </div>
  );
}

interface ChatHeadProps {
  imageUrl?: string | null;
  label: string;
  fallback: string;
}

function ChatHead({ imageUrl, label, fallback }: ChatHeadProps) {
  return (
    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold text-muted-foreground shadow-sm">
      {imageUrl ? (
        <img src={imageUrl} alt={label} className="h-full w-full object-cover" />
      ) : (
        <span>{fallback.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function getInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return "A";

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function normalizeAvatarUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed;
  }

  return null;
}

function createAvatarDataUri(label: string): string {
  const safeLabel = (label || "A").slice(0, 2).toUpperCase();

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#7c3aed"/>
          <stop offset="55%" stop-color="#8b5cf6"/>
          <stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="24" fill="url(#g)"/>
      <circle cx="26" cy="28" r="16" fill="rgba(255,255,255,0.14)"/>
      <circle cx="70" cy="72" r="22" fill="rgba(255,255,255,0.12)"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        font-family="Inter, Arial, sans-serif" font-size="36" font-weight="700"
        fill="#ffffff">${escapeSvgText(safeLabel)}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createEmojiAvatarDataUri(emoji: string): string {
  const safeEmoji = escapeSvgText(emoji || "✨");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#7c3aed"/>
          <stop offset="58%" stop-color="#8b5cf6"/>
          <stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="24" fill="url(#g)"/>
      <circle cx="25" cy="26" r="16" fill="rgba(255,255,255,0.14)"/>
      <circle cx="72" cy="72" r="22" fill="rgba(255,255,255,0.12)"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
        font-size="42" font-weight="700" fill="#ffffff">${safeEmoji}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeSvgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getDefaultAvatarForConfiguration(configuration: {
  custom_model_name?: string | null;
}): string {
  const name = configuration.custom_model_name?.trim() || "Assistant";
  return createAvatarDataUri(getInitials(name));
}

function getChatAvatar(chat: Chat, avatarMap: ChatAvatarMap): string {
  return chat.avatar ?? avatarMap[chat.id] ?? getDefaultAvatarForConfiguration(chat);
}

function readStoredChatAvatars(): ChatAvatarMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(CHAT_AVATAR_STORAGE_KEY);

    if (!raw) return {};

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const avatars: ChatAvatarMap = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key === "string" && typeof value === "string") {
        avatars[key] = value;
      }
    }

    return avatars;
  } catch {
    return {};
  }
}

function writeStoredChatAvatars(avatars: ChatAvatarMap) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CHAT_AVATAR_STORAGE_KEY,
      JSON.stringify(avatars),
    );
  } catch {
    // localStorage may be unavailable in private browsing or restricted contexts.
  }
}