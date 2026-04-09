import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Sparkles, Briefcase, User } from "lucide-react";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"cleaner" | "owner">("cleaner");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, fullName, role);
      } else {
        await signIn(email, password);
      }
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Shinely</h1>
          </div>
          <p className="text-muted-foreground text-sm">Premium cleaning jobs marketplace</p>
        </div>

        <div className="bg-card rounded-2xl shadow-elevated p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <Input
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="rounded-xl h-12"
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("cleaner")}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      role === "cleaner"
                        ? "border-primary bg-accent"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Briefcase className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">Cleaner</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("owner")}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      role === "owner"
                        ? "border-primary bg-accent"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <User className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">Job Owner</span>
                  </button>
                </div>
              </>
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl h-12"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="rounded-xl h-12"
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity"
            >
              {loading ? "..." : isSignUp ? "Sign Up" : "Log In"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
              className="text-primary font-medium hover:underline"
            >
              {isSignUp ? "Log In" : "Sign Up"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
