"use client";

import { AuthProvider } from "@/hooks/useAuth";
import { NoTextInputWrapper } from "@/components/NoTextInputWrapper";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NoTextInputWrapper>{children}</NoTextInputWrapper>
    </AuthProvider>
  );
}
