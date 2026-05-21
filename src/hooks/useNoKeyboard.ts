"use client";

import { useEffect } from "react";

export function useNoKeyboard() {
  useEffect(() => {
    const blockKeyboard = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.id === "username-input") return;
      if (target.closest('[data-allow-text="true"]')) return;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        (target as HTMLElement).isContentEditable
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const blockPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.id === "username-input") return;
      if (target.closest('[data-allow-text="true"]')) return;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        (target as HTMLElement).isContentEditable
      ) {
        e.preventDefault();
      }
    };

    const blockContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.id === "username-input") return;
      if (target.closest('[data-allow-text="true"]')) return;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA"
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", blockKeyboard, true);
    document.addEventListener("keypress", blockKeyboard, true);
    document.addEventListener("keyup", blockKeyboard, true);
    document.addEventListener("paste", blockPaste, true);
    document.addEventListener("contextmenu", blockContextMenu, true);

    return () => {
      document.removeEventListener("keydown", blockKeyboard, true);
      document.removeEventListener("keypress", blockKeyboard, true);
      document.removeEventListener("keyup", blockKeyboard, true);
      document.removeEventListener("paste", blockPaste, true);
      document.removeEventListener("contextmenu", blockContextMenu, true);
    };
  }, []);
}
