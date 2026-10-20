import type { Metadata } from "next";

// Pages are client components, so each route's browser tab title lives in this
// tiny server layout. The root template turns it into "Dashboard · ARG TECH".
export const metadata: Metadata = { title: "Dashboard" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
