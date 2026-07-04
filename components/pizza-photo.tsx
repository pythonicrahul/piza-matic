"use client";

import Image from "next/image";
import { useState } from "react";
import { PizzaArt } from "./pizza-art";
import { pizzaImageFor } from "@/lib/pizza-images";

interface CommonProps {
  name: string;
  seed: string;
  isVeg?: boolean | null;
  imageUrl?: string; // explicit override (e.g. future menu_items.image_url)
}

// Real product photo with a built-in fallback: if the CDN image fails to load
// (offline demo, blocked network), the illustrated PizzaArt renders instead —
// the page never shows a broken image.

// Circular thumbnail — cart lines, order items, recommendation banner.
export function PizzaThumb({ name, seed, isVeg, imageUrl, size = 52, className = "" }: CommonProps & { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl ?? pizzaImageFor(name, seed);

  if (failed) return <PizzaArt seed={seed} isVeg={isVeg} size={size} className={className} />;
  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// Cover photo that fills its (relative-positioned) parent — menu cards and
// the builder sheet header.
export function PizzaCover({ name, seed, isVeg, imageUrl, sizes, priority, className = "" }: CommonProps & { sizes: string; priority?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl ?? pizzaImageFor(name, seed);

  if (failed) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-orange-100 ${className}`}>
        <PizzaArt seed={seed} isVeg={isVeg} size={96} />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={name}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
