"use client";

import * as React from "react";

import { NavMain } from "@workspace/ui/components/nav-main";
import { NavUser } from "@workspace/ui/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar";
import {
  LayoutDashboardIcon,
  UsersIcon,
  BadgeCheckIcon,
  BuildingIcon,
  BriefcaseIcon,
  ScrollTextIcon,
  SparklesIcon,
} from "lucide-react";

type NavUserData = {
  name: string;
  email: string;
  avatar: string;
};

const defaultUser: NavUserData = {
  name: "Admin",
  email: "admin@upgence.com",
  avatar: "/avatar_user.png",
};

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Users",
      url: "/users",
      icon: <UsersIcon />,
    },
    {
      title: "KYC Verifications",
      url: "/kyc",
      icon: <BadgeCheckIcon />,
    },
    {
      title: "Companies",
      url: "/companies",
      icon: <BuildingIcon />,
    },
    {
      title: "Jobs",
      url: "/jobs",
      icon: <BriefcaseIcon />,
    },
    {
      title: "Server Logs",
      url: "/logs",
      icon: <ScrollTextIcon />,
    },
  ],
};

export function AppSidebar({
  user = defaultUser,
  onLogout,
  onAccount,
  activePath,
  logo,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: NavUserData;
  onLogout?: () => void;
  onAccount?: () => void;
  activePath?: string;
  logo?: React.ReactNode;
}) {
  const navMain = data.navMain.map((item) => ({
    ...item,
    isActive: item.url !== "#" && activePath === item.url,
  }));

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="/dashboard" />}
            >
              {logo ?? <SparklesIcon className="size-5! text-primary" />}
              <span className="text-base font-semibold">Upgence</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onAccount={onAccount} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  );
}
