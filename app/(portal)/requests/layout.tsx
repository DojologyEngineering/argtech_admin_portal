import type { Metadata } from "next";

// Pages are client components, so each route's browser tab title lives in this
// tiny server layout. The root template turns it into "Requests · ARG TECH".
export const metadata: Metadata = { title: "Requests" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
