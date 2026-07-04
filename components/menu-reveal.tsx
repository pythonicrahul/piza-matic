"use client";

import { Children } from "react";
import { motion } from "framer-motion";
import { staggerContainer, fadeInUp } from "@/lib/motion";

// Thin client wrapper so the (server) menu page can stay a server component
// while still getting a staggered entrance for its children.
export function MenuReveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show">
      {Children.toArray(children).map((child, i) => (
        <motion.div key={i} variants={fadeInUp}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
