import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-shinely.png";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-sm"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl gradient-primary shadow-elevated"
        >
          <img src={logo} alt="Shinely" className="h-14 w-14 object-contain" />
        </motion.div>

        <h1 className="text-7xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
          404
        </h1>
        <h2 className="text-xl font-bold text-foreground mb-2">Page not found</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Looks like this page took a coffee break. Let's get you back to where the action is.
        </p>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => navigate("/")}
            className="h-12 rounded-xl gradient-primary text-primary-foreground font-semibold"
          >
            <Home className="w-4 h-4 mr-2" /> Back to home
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="h-12 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Go back
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
