import { motion } from "framer-motion";
import logo from "@/assets/shinely-logo.png";

export default function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: "#F5F0FF" }}
    >
      <motion.img
        src={logo}
        alt="Shinely"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ width: 200 }}
        className="object-contain"
      />
    </motion.div>
  );
}
