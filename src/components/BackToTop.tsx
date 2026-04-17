import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";

interface Props {
  threshold?: number;
  bottomOffset?: string;
}

export default function BackToTop({ threshold = 400, bottomOffset = "bottom-24" }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className={`fixed right-4 ${bottomOffset} z-[600] flex h-12 w-12 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-elevated active:scale-95 transition-transform`}
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
