import type { Transition, Variants } from "framer-motion";

// Shared animation vocabulary so every page moves the same way instead of
// each component inventing its own timings.

export const sheetSpring: Transition = { type: "spring", stiffness: 340, damping: 32, mass: 0.9 };
export const popSpring: Transition = { type: "spring", stiffness: 420, damping: 22 };

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const scaleTap = { whileTap: { scale: 0.96 } };

export const listExit: Variants = {
  hidden: { opacity: 0, height: 0 },
  show: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.25, ease: "easeInOut" } },
};
