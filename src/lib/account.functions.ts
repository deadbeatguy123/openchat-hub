import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    // Delete user data. chats cascade delete is not configured; clean explicitly.
    await supabaseAdmin.from("messages").delete().in(
      "chat_id",
      (
        await supabaseAdmin.from("chats").select("id").eq("user_id", userId)
      ).data?.map((c) => c.id) ?? []
    );
    await supabaseAdmin.from("chats").delete().eq("user_id", userId);
    await supabaseAdmin.from("personality_presets").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
