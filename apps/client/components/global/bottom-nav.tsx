"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { useUserInfoQuery } from "@/modules/auth/api/auth-api";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const pathname = usePathname();
  const { data: userInfo } = useUserInfoQuery();

  const user = userInfo?.data;
  if (!user) return null;

  const initials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() ||
    "U";

  const navItems = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
      active: pathname === "/dashboard",
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/90 backdrop-blur-md border-t border-border p-2 shadow-lg flex items-center justify-around">
      {navItems.map((item) => {
        const isProfileTab = item.label === "Profile";
        const Icon = item.icon;
        const isActive = item.active;

        return (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center justify-center py-1 px-4 rounded-2xl transition-all duration-200 cursor-pointer group"
          >
            {isProfileTab ? (
              <div
                className={cn(
                  "p-0.5 rounded-full transition-all duration-200 border-2",
                  isActive
                    ? "border-primary scale-105"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Avatar className="size-6">
                  <AvatarImage
                    src={user?.avatar || undefined}
                    alt="Profile"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-extrabold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            ) : (
              <div
                className={cn(
                  "p-1 rounded-full transition-all duration-200",
                  isActive
                    ? "bg-primary/12 text-primary scale-105"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
            )}
            <span
              className={cn(
                "text-[10px] mt-0.5 font-medium transition-colors duration-200",
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground",
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
