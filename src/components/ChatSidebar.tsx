import { Link } from "@tanstack/react-router";
import { useState } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  LogOut,
  MessageSquare,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
} from "lucide-react";

export interface SidebarChat {
  id: string;

  /*
   * The current project uses `title`.
   * The requested generic shape uses `name`.
   * Supporting both makes this component safer.
   */
  title?: string | null;
  name?: string | null;

  /*
   * Optional. Current repo does not appear to use chat avatars yet,
   * but this supports the requested { id, name, avatar, lastMessage } shape.
   */
  avatar?: string | null;

  updated_at?: string | null;
  custom_model_name?: string | null;

  /*
   * The current project uses `last_message`.
   * The requested generic shape uses `lastMessage`.
   */
  last_message?: string | null;
  lastMessage?: string | null;
  last_message_at?: string | null;
}

interface ChatSidebarProps {
  chats: SidebarChat[];
  activeChatId: string | null;
  initials: string;
  profileName: string;
  email?: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;

  /*
   * Placeholder configure handler.
   * In the next feature patch, this should open the real ConfigureChatDialog.
   */
  onConfigureChat?: (chat: SidebarChat) => void;

  /*
   * The actual delete logic stays in chat.tsx.
   * That is safer because chat.tsx already knows Supabase, active chat state,
   * messages, branch state, and toast rollback behavior.
   */
  onDeleteChat: (id: string) => Promise<void>;

  onLogout: () => void;
}

export function ChatSidebar({
  chats,
  activeChatId,
  initials,
  profileName,
  email,
  onNewChat,
  onSelectChat,
  onConfigureChat,
  onDeleteChat,
  onLogout,
}: ChatSidebarProps) {
  const [peekChatId, setPeekChatId] = useState<string | null>(null);
  const [busyChatId, setBusyChatId] = useState<string | null>(null);

  const handleConfigure = (chat: SidebarChat) => {
    setPeekChatId(null);

    if (onConfigureChat) {
      onConfigureChat(chat);
      return;
    }

    console.info("Configure chat:", chat.id);
  };

  const handleDelete = async (chatId: string) => {
    setPeekChatId(null);
    setBusyChatId(chatId);

    try {
      await onDeleteChat(chatId);
    } finally {
      setBusyChatId(null);
    }
  };

  return (
    <aside className="hidden md:flex w-72 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="p-4 border-b border-sidebar-border">
        <Link
          to="/"
          className="flex items-center gap-2 font-semibold text-sidebar-foreground"
        >
          <Sparkles className="h-5 w-5 text-primary" />
          CompChat
        </Link>
      </div>

      <div className="p-3">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2"
          variant="default"
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1.5 pb-3">
          {chats.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                No conversations yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Start a new chat to begin
              </p>
            </div>
          )}

          {chats.map((chat) => {
            const isActive = activeChatId === chat.id;
            const isBusy = busyChatId === chat.id;

            const displayTitle =
              (chat.name ?? chat.title ?? "").trim() || "Untitled chat";

            const previewText = getPreviewText(chat);
            const showPeek = peekChatId === chat.id;

            return (
              <div
                key={chat.id}
                className={`group relative flex min-h-[58px] cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-all duration-150 ${
                  isActive
                    ? "border-primary/30 bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "border-sidebar-border/70 bg-sidebar/80 text-sidebar-foreground hover:border-sidebar-border hover:bg-sidebar-accent/60 hover:shadow-sm"
                }`}
                onClick={() => onSelectChat(chat.id)}
                onMouseLeave={() => {
                  setPeekChatId((current) =>
                    current === chat.id ? null : current,
                  );
                }}
              >
                {/* Left/Middle Zone: avatar + chat name. Only this zone triggers the peek preview. */}
                <div
                  className="flex min-w-0 flex-1 items-center gap-3 pr-2"
                  onMouseEnter={() => setPeekChatId(chat.id)}
                  onMouseLeave={() => {
                    setPeekChatId((current) =>
                      current === chat.id ? null : current,
                    );
                  }}
                >
                  <Avatar className="h-10 w-10 shrink-0 border border-sidebar-border/70 shadow-sm">
                    {chat.avatar ? (
                      <AvatarImage src={chat.avatar} alt={displayTitle} />
                    ) : null}

                    <AvatarFallback className="bg-gradient-hero text-primary-foreground text-xs font-semibold">
                      {getChatInitials(displayTitle)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold leading-5"
                      title={displayTitle}
                    >
                      {displayTitle}
                    </p>
                  </div>
                </div>

                {/* Right Zone: action icons. Parent group-hover keeps these visible anywhere inside the card. */}
                <div
                  className="pointer-events-none ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                  onClick={(event) => event.stopPropagation()}
                  onMouseEnter={() => setPeekChatId(null)}
                >
                  <button
                    type="button"
                    onClick={() => handleConfigure(chat)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    aria-label={`Configure ${displayTitle}`}
                    title="Configure chat"
                    disabled={isBusy}
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(chat.id)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    aria-label={`Delete ${displayTitle}`}
                    title="Delete chat"
                    disabled={isBusy}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Floating preview. This does not affect layout height. */}
                {showPeek && (
                  <div className="pointer-events-none absolute left-3 right-3 top-full z-30 mt-2 rounded-xl border border-sidebar-border bg-popover px-3 py-2.5 text-popover-foreground shadow-xl">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Latest message
                    </p>
                    <p className="overflow-hidden text-xs leading-relaxed text-popover-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]">
                      {previewText}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3 space-y-1">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground text-xs font-semibold">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {profileName || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </div>

        <Link to="/settings">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
          >
            <SettingsIcon className="h-4 w-4" />
            Settings
          </Button>
        </Link>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}

function getChatInitials(name: string): string {
  const trimmed = (name || "").trim();

  if (!trimmed) return "?";

  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (words[0][0] + words[1][0]).toUpperCase();
}

function getPreviewText(chat: SidebarChat): string {
  const rawPreview =
    chat.lastMessage ??
    chat.last_message ??
    (chat.custom_model_name ? `Bot: ${chat.custom_model_name}` : null) ??
    "No messages yet";

  return rawPreview.replace(/\s+/g, " ").trim() || "No messages yet";
}
