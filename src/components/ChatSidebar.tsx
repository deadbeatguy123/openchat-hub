import { Link } from "@tanstack/react-router";
import { useState } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  title?: string | null;
  name?: string | null;
  avatar?: string | null;
  updated_at?: string | null;

  preset_id?: string | null;
  custom_model_name?: string | null;
  custom_personality?: string | null;
  custom_background?: string | null;
  custom_tone?: string | null;

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
  onRenameChat?: (id: string, title: string) => Promise<boolean>;
  onConfigureChat?: (chat: SidebarChat) => void;
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
  const [chatPendingDelete, setChatPendingDelete] =
    useState<SidebarChat | null>(null);

  const handleConfigure = (chat: SidebarChat) => {
    setPeekChatId(null);
    onConfigureChat?.(chat);
  };

  const requestDelete = (chat: SidebarChat) => {
    setPeekChatId(null);
    setChatPendingDelete(chat);
  };

  const confirmDelete = async () => {
    if (!chatPendingDelete) return;

    const chatId = chatPendingDelete.id;

    setBusyChatId(chatId);

    try {
      await onDeleteChat(chatId);
      setChatPendingDelete(null);
    } finally {
      setBusyChatId(null);
    }
  };

  const pendingDeleteTitle = chatPendingDelete
    ? getDisplayTitle(chatPendingDelete)
    : "this chat";

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

            const displayTitle = getDisplayTitle(chat);
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
                    title="Configure personality"
                    disabled={isBusy}
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => requestDelete(chat)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    aria-label={`Delete ${displayTitle}`}
                    title="Delete chat"
                    disabled={isBusy}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

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

      <Dialog
        open={!!chatPendingDelete}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setChatPendingDelete(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {pendingDeleteTitle}
              </span>
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setChatPendingDelete(null)}
              disabled={!!busyChatId}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={!!busyChatId}
            >
              {busyChatId ? "Deleting..." : "Delete chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

function getDisplayTitle(chat: SidebarChat): string {
  const botName = chat.custom_model_name?.trim().replace(/\s+/g, " ");

  if (botName) {
    return botName;
  }

  const explicitName = chat.name?.trim().replace(/\s+/g, " ");

  if (explicitName && /[\p{L}\p{N}]/u.test(explicitName)) {
    return explicitName;
  }

  const rawTitle = chat.title?.trim().replace(/\s+/g, " ");

  if (rawTitle && /[\p{L}\p{N}]/u.test(rawTitle)) {
    return rawTitle;
  }

  return "Untitled chat";
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