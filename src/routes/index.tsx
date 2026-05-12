import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles, KeyRound, Lock, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/chat" });
    }
  }, [session, loading, navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in");
    navigate({ to: "/chat" });
  };

const handleGoogle = async () => {
  const isLovablePreview = window.location.hostname.includes("lovable.app") || 
                            window.location.hostname.includes("lovableproject.com");

  if (isLovablePreview) {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/chat",
    });
    if (result.error) toast.error("Could not sign in with Google");
    return;
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/auth/callback",
    },
  });
  if (error) toast.error("Could not sign in with Google");
};
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Hero */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-gradient-hero text-primary-foreground overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5" />
            <span>CompChat</span>
          </div>
        </div>
        <div className="relative z-10 space-y-6 max-w-lg">
          <h1 className="text-5xl font-bold leading-tight tracking-tight">
            Build a chatbot with the personality you want.
          </h1>
          <p className="text-lg opacity-90">
            Customize the name, personality, background, and tone of any LLM. Save your favorite personas and reuse them across chats.
          </p>
          <div className="grid gap-3 pt-4">
            <Feature icon={<Sparkles className="h-4 w-4" />} text="Personalize how the AI responds" />
            <Feature icon={<KeyRound className="h-4 w-4" />} text="Bring your own OpenRouter API key" />
            <Feature icon={<Zap className="h-4 w-4" />} text="Pick various free LLM models with 50 messages a day" />
            <Feature icon={<Lock className="h-4 w-4" />} text="Save & reuse personality presets" />
          </div>
        </div>
        <div className="relative z-10 text-sm opacity-70">© {new Date().getFullYear()} CompChat</div>
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      {/* Login */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md shadow-soft border-border/60">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to continue to your chats.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleGoogle} type="button">
              <GoogleIcon /> Continue with Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or with email</span>
              </div>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground text-center">
              Don't have an account?{" "}
              <Link to="/register" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">{icon}</div>
      <span>{text}</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 5c1.6 0 3 .55 4.1 1.6l3-3C17.2 1.7 14.8.7 12 .7 7.4.7 3.4 3.3 1.4 7.1l3.5 2.7C5.9 7 8.7 5 12 5z" />
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z" />
      <path fill="#FBBC05" d="M4.9 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2L1.4 7.1C.5 8.6 0 10.2 0 12s.5 3.4 1.4 4.9l3.5-2.7z" />
      <path fill="#34A853" d="M12 23.3c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.1-4.2 1.1-3.3 0-6.1-2-7.1-4.9l-3.5 2.7c2 3.8 6 6.9 10.6 6.9z" />
    </svg>
  );
}
