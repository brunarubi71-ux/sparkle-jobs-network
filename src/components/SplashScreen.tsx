import { motion } from "framer-motion";
import logo from "@/assets/shinely-logo.png";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden" style={{ backgroundColor: "#A855F7" }}>
      <motion.img
        src={logo}
        alt="Shinely"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ width: 200 }}
        className="object-contain drop-shadow-2xl"
      />
    </div>
  );
}
