import { Link, useLocation } from "react-router-dom";
import { Bell, Menu, Plus, User, LogIn, LogOut, MapPin, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const navLinks = [
  { to: "/tasks", label: "Browse Tasks", icon: MapPin },
  { to: "/post-task", label: "Post a Task", icon: Plus },
  { to: "/my-tasks", label: "My Tasks" },
];

export function Header() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  // Real-time notification subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["unread-notifications", user.id] });
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <span className="font-display text-lg font-bold text-primary-foreground">M</span>
          </div>
          <span className="hidden font-display text-xl font-bold tracking-tight min-[360px]:inline">MicroTask</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to}>
              <Button variant={location.pathname === link.to ? "secondary" : "ghost"} size="sm" className="gap-2">
                {link.icon && <link.icon className="h-4 w-4" />}
                {link.label}
              </Button>
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin">
              <Button variant={location.pathname === "/admin" ? "secondary" : "ghost"} size="sm" className="gap-2">
                <Shield className="h-4 w-4" /> Admin
              </Button>
            </Link>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <ThemeToggle />
          {user ? (
            <>
              <Link to="/notifications">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={signOut} className="hidden lg:flex">
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <Link to="/auth" className="hidden lg:block">
              <Button size="sm" className="gap-2">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="font-display">Menu</SheetTitle>
              <nav className="mt-8 flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link key={link.to} to={link.to} onClick={() => setOpen(false)}>
                    <Button variant={location.pathname === link.to ? "secondary" : "ghost"} className="w-full justify-start gap-2">
                      {link.icon && <link.icon className="h-4 w-4" />}
                      {link.label}
                    </Button>
                  </Link>
                ))}
                {isAdmin && (
                  <Link to="/admin" onClick={() => setOpen(false)}>
                    <Button variant={location.pathname === "/admin" ? "secondary" : "ghost"} className="w-full justify-start gap-2">
                      <Shield className="h-4 w-4" /> Admin
                    </Button>
                  </Link>
                )}
                {user ? (
                  <Button variant="ghost" className="w-full justify-start gap-2 mt-4" onClick={() => { signOut(); setOpen(false); }}>
                    <LogOut className="h-4 w-4" /> Sign Out
                  </Button>
                ) : (
                  <Link to="/auth" onClick={() => setOpen(false)}>
                    <Button className="w-full gap-2 mt-4">
                      <LogIn className="h-4 w-4" /> Sign In
                    </Button>
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
