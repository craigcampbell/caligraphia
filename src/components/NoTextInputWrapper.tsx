"use client";

import { useNoKeyboard } from "@/hooks/useNoKeyboard";

export function NoTextInputWrapper({ children }: { children: React.ReactNode }) {
  useNoKeyboard();
  return <>{children}</>;
}
