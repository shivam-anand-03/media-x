"use client";
import { ViewTransitions } from "next-view-transitions";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@workspace/ui/components/sonner";
import { StoreProvider } from "@/data-access/redux-service";
import { RoleProtection } from "./role-protection";
import { SocketProvider } from "./socket-provider";
import { ThemeProvider } from "./theme-provider";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="text-primary-600 font-inter flex min-h-screen w-full">
      <main className="flex w-full flex-col">{children}</main>
    </div>
  );
};

export const AppRootProviders = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <StoreProvider>
        <NuqsAdapter>
          <ViewTransitions>
            <Toaster
              position="top-right"
              expand={false}
              richColors={false}
              toastOptions={{
                style: { top: "20px" },
              }}
            />
            <RoleProtection>
              <SocketProvider>
                <AppLayout>{children}</AppLayout>
              </SocketProvider>
            </RoleProtection>
          </ViewTransitions>
        </NuqsAdapter>
      </StoreProvider>
    </ThemeProvider>
  );
};
