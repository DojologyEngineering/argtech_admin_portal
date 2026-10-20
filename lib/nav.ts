import {
  CalendarDays,
  Inbox,
  LayoutDashboard,
  Leaf,
  Map,
  Settings,
  ShoppingCart,
  Store,
  Sprout,
  Users,
  Wheat,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Short label for the top bar and mobile header. */
  title: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", title: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "User Management", title: "User Management", icon: Users },
  { href: "/farmers", label: "Farmers", title: "Farmers", icon: Sprout },
  { href: "/plots", label: "Farm Plots", title: "Farm Plots", icon: Map },
  { href: "/crops", label: "Crop Management", title: "Crop Management", icon: Wheat },
  { href: "/cycles", label: "Crop Cycles", title: "Crop Cycles", icon: Leaf },
  { href: "/calendar", label: "Calendar", title: "Calendar", icon: CalendarDays },
  { href: "/buyers", label: "Buyers", title: "Buyers", icon: Store },
  { href: "/requests", label: "Requests", title: "Requests", icon: Inbox },
  { href: "/orders", label: "Purchase Orders", title: "Purchase Orders", icon: ShoppingCart },
];

export const FOOTER_NAV_ITEMS: NavItem[] = [
  { href: "/settings", label: "Settings", title: "Settings", icon: Settings },
];

/** Longest matching prefix wins, so /orders/new still highlights Purchase Orders. */
export function activeNavItem(pathname: string): NavItem | undefined {
  return [...NAV_ITEMS, ...FOOTER_NAV_ITEMS]
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}
