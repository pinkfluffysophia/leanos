"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShoppingBag, User, Settings, LogOut } from "lucide-react";

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function ProfileDropdown() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [dbUser, setDbUser] = useState<{
    email?: string;
    firstName: string;
    lastName: string;
    nickname?: string | null;
    profilePictureUrl: string | null;
  } | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [dbEmail, setDbEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users/session-check")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.status === "outdated" && data.user) {
          setDbUser(data.user);
          setNickname(data.user.nickname || null);
          if (data.user.email) setDbEmail(data.user.email);
        } else if (data.status === "valid") {
          setNickname(data.nickname || null);
          if (data.email) setDbEmail(data.email);
        }
      })
      .catch(() => {});
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session?.user) return null;

  const firstName = dbUser?.firstName || session.user.firstName || "";
  const lastName = dbUser?.lastName || session.user.lastName || "";
  const profilePictureUrl = dbUser ? dbUser.profilePictureUrl : session.user.profilePictureUrl;
  const initials = getInitials(firstName, lastName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center focus:outline-none">
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarImage src={profilePictureUrl || undefined} />
            <AvatarFallback className="bg-gray-500 text-white text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">
              {firstName} {lastName}{nickname ? ` (${nickname})` : ""}
            </p>
            <p className="text-xs text-gray-500 truncate">{dbEmail || session.user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/purchases" className="cursor-pointer">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Purchases
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-red-600 focus:text-red-600"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
