"use client";

import dynamic from "next/dynamic";
import type { Branch } from "@/types";

// mapbox-gl is a large (~200KB+ gzipped) client-only library. BranchesMap
// used to be a plain static import here, which meant it — and mapbox-gl
// with it — shipped in the JS bundle for every single page on the site
// (Footer renders in the root layout), even pages that never show a map.
// Splitting it into its own chunk that only loads once this component
// actually mounts keeps the site-wide initial bundle small.
const BranchesMap = dynamic(() => import("@/components/BranchesMap"), {
  ssr: false,
  loading: () => (
    <div className="border-t border-hairline pt-10">
      <div className="mb-4 h-3 w-24 animate-pulse bg-hermes-50" />
      <div className="h-56 w-full animate-pulse border border-hairline bg-hermes-50/30" />
    </div>
  ),
});

export default function BranchesMapLazy({ branches }: { branches: Branch[] }) {
  return <BranchesMap branches={branches} />;
}
