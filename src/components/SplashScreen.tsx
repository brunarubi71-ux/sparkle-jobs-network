import { motion } from "framer-motion";
import logo from "@/assets/logo-shinely.png";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center gradient-primary overflow-hidden">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-3xl bg-card/20 backdrop-blur-md p-6 shadow-elevated"
        >
          <img src={logo} alt="Shinely" className="h-24 w-24 object-contain" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-3xl font-extrabold text-primary-foreground tracking-tight"
        >
          Shinely
        </motion.h1>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 80 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="h-1 rounded-full bg-primary-foreground/40"
        />
      </motion.div>
    </div>
  );
}
