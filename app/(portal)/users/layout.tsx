import type { Metadata } from "next";

// Pages are client components, so each route's browser tab title lives in this
// tiny server layout. The root template turns it into "User Management · ARG TECH".
export const metadata: Metadata = { title: "User Management" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
