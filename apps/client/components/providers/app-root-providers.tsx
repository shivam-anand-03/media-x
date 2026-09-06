"use client";
import { ViewTransitions } from "next-view-transitions";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@workspace/ui/components/sonner";
import { StoreProvider } from "@/data-access/redux-service";
import { ThemeProvider } from "./theme-provider";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return <div className="font-inter flex min-h-screen w-full flex-col">{children}</div>;
};

export const AppRootProviders = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
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
            <AppLayout>{children}</AppLayout>
          </ViewTransitions>
        </NuqsAdapter>
      </StoreProvider>
    </ThemeProvider>
  );
};
