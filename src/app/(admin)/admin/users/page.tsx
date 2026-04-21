"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, ChevronLeft, ChevronRight, ChevronDown, ShieldAlert, CircleCheck, CircleX } from "lucide-react";

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  profilePictureUrl: string | null;
  status: string;
  role: string;
  suspendedUntil: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  tags: TagItem[];
}

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [perPage, setPerPage] = useState(20);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/tags")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.tags) setAllTags(data.tags);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: page.toString(), perPage: perPage.toString() });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (tagFilter.length > 0) params.set("tags", tagFilter.join(","));
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/admin/users?${params}`);
      if (response.status === 401) {
        router.replace("/dashboard");
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoaded(true);
    }
  }, [page, perPage, debouncedSearch, tagFilter, roleFilter, statusFilter, router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  const isSuspended = (user: User) => {
    if (!user.suspendedUntil) return false;
    return new Date(user.suspendedUntil) > new Date();
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage all registered users ({total} total)
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full sm:max-w-xs"
        />
        <Select
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Verified</SelectItem>
            <SelectItem value="inactive">Unverified</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative" ref={tagDropdownRef}>
          <button
            type="button"
            onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
            className="flex h-9 w-full sm:w-[160px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <span>
              {tagFilter.length === 0 ? "All Tags" : `${tagFilter.length} tag${tagFilter.length !== 1 ? "s" : ""}`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </button>
          {tagDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full min-w-[180px] rounded-md border bg-background shadow-md">
              {tagFilter.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setTagFilter([]); setPage(1); }}
                  className="w-full px-3 py-2 text-xs text-muted-foreground hover:bg-accent text-left border-b"
                >
                  Clear all
                </button>
              )}
              {allTags.map((tag) => {
                const isSelected = tagFilter.includes(tag.id);
                return (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => {
                        const next = isSelected
                          ? tagFilter.filter((id) => id !== tag.id)
                          : [...tagFilter, tag.id];
                        setTagFilter(next);
                        setPage(1);
                      }}
                    />
                    <span
                      className="inline-block w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <Select
          value={perPage.toString()}
          onValueChange={(v) => {
            setPerPage(parseInt(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
            <SelectItem value="200">200 / page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                Page {page} of {totalPages || 1}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No users found
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => {
                const suspended = isSuspended(user);
                return (
                  <div
                    key={user.id}
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                    className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    {/* Avatar */}
                    {user.profilePictureUrl ? (
                      <img
                        src={user.profilePictureUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-white">
                          {user.firstName[0]}{user.lastName[0]}
                        </span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {user.firstName} {user.lastName}{user.nickname ? ` (${user.nickname})` : ""}
                        </p>
                        {user.role === "admin" && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            ADMIN
                          </span>
                        )}
                        {suspended && (
                          <span title="Suspended">
                            <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          </span>
                        )}
                        {user.status === "active" ? (
                          <span title="Verified">
                            <CircleCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          </span>
                        ) : (
                          <span title="Unverified">
                            <CircleX className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>

                    {/* Tags */}
                    {user.tags.length > 0 && (
                      <div className="hidden sm:flex flex-wrap gap-1.5">
                        {user.tags.map((tag) => {
                          const isLight = isLightColor(tag.color);
                          return (
                            <span
                              key={tag.id}
                              className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                isLight
                                  ? "text-gray-900 border border-gray-300"
                                  : "text-white"
                              }`}
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Last seen */}
                    <span className="hidden md:block text-xs text-muted-foreground whitespace-nowrap">
                      {user.lastSeenAt ? `Last seen: ${formatDate(user.lastSeenAt)}` : "Never seen"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
