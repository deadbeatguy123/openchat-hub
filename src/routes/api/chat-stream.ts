import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

interface RequestBody {
  chatId: string;
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  parentMessageId?: string | null;
}

export const Route = createFileRoute("/api/chat-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY =
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
        }

        const token = authHeader.replace("Bearer ", "");
        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        let body: RequestBody;
        try {
          body = (await request.json()) as RequestBody;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
        }

        if (!body.chatId || !body.model || !Array.isArray(body.messages) || body.messages.length === 0) {
          return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
        }

        // Verify chat ownership and fetch personalization
        const { data: chat } = await supabase
          .from("chats")
          .select("id, user_id, custom_model_name, custom_personality, custom_background, custom_tone")
          .eq("id", body.chatId)
          .maybeSingle();

        if (!chat || chat.user_id !== userData.user.id) {
          return new Response(JSON.stringify({ error: "Chat not found" }), { status: 404 });
        }

        // Build a system prompt from personalization, if any
        const parts: string[] = [];
        if (chat.custom_model_name) parts.push(`Your name is "${chat.custom_model_name}".`);
        if (chat.custom_personality) parts.push(`Personality: ${chat.custom_personality}.`);
        if (chat.custom_background) parts.push(`Background: ${chat.custom_background}.`);
        if (chat.custom_tone) parts.push(`Tone / response style: ${chat.custom_tone}.`);
        const systemPrompt = parts.length
          ? parts.join(" ") + " Stay in character throughout the conversation."
          : null;

        const messagesForApi = systemPrompt
          ? [{ role: "system" as const, content: systemPrompt }, ...body.messages]
          : body.messages;

        const { data: profile } = await supabase
          .from("profiles")
          .select("openrouter_api_key")
          .eq("id", userData.user.id)
          .maybeSingle();

        const apiKey = profile?.openrouter_api_key;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "Missing OpenRouter API key. Add it in Settings." }),
            { status: 400 }
          );
        }

        const referer = process.env.OPENROUTER_REFERER || "https://lovable.dev";

        const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": referer,
            "X-Title": "Lovable Chat",
          },
          body: JSON.stringify({
            model: body.model,
            messages: messagesForApi,
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          let message = `OpenRouter error (${upstream.status})`;
          if (upstream.status === 401) message = "Invalid OpenRouter API key.";
          else if (upstream.status === 402) message = "OpenRouter credits exhausted.";
          else if (upstream.status === 429) message = "Rate limited. Try again shortly.";
          return new Response(JSON.stringify({ error: message, details: text.slice(0, 500) }), {
            status: upstream.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Stream SSE through, parse to plain text deltas, persist on completion
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let fullText = "";

        const stream = new ReadableStream({
          async start(controller) {
            const reader = upstream.body!.getReader();
            let buffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const payload = trimmed.slice(5).trim();
                  if (payload === "[DONE]") continue;
                  try {
                    const json = JSON.parse(payload);
                    const delta = json.choices?.[0]?.delta?.content ?? "";
                    if (delta) {
                      fullText += delta;
                      controller.enqueue(encoder.encode(delta));
                    }
                  } catch {
                    // ignore parse errors for keepalives
                  }
                }
              }

              // Persist assistant message + bump chat updated_at
              if (fullText) {
                await supabase.from("messages").insert({
                  chat_id: body.chatId,
                  role: "assistant",
                  content: fullText,
                  model_used: body.model,
                  parent_id: body.parentMessageId ?? null,
                });
                await supabase
                  .from("chats")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", body.chatId);
              }
              controller.close();
            } catch (err) {
              console.error("Stream error", err);
              controller.error(err);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
