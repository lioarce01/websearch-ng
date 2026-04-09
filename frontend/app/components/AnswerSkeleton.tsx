"use client";

function SkeletonLine({ width = "100%" }: { width?: string }) {
  return (
    <div className="relative h-3.5 rounded-md overflow-hidden bg-white/6" style={{ width }}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/8 to-transparent" />
    </div>
  );
}

export default function AnswerSkeleton() {
  return (
    <div className="space-y-3 pt-1">
      <SkeletonLine width="88%" />
      <SkeletonLine width="100%" />
      <SkeletonLine width="92%" />
      <div className="pt-1" />
      <SkeletonLine width="100%" />
      <SkeletonLine width="96%" />
      <SkeletonLine width="75%" />
    </div>
  );
}
