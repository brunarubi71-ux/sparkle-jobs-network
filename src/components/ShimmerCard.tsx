export default function ShimmerCard() {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-card space-y-3">
      <div className="h-5 w-24 shimmer rounded-lg" />
      <div className="h-4 w-full shimmer rounded-lg" />
      <div className="h-4 w-3/4 shimmer rounded-lg" />
      <div className="h-10 w-full shimmer rounded-xl" />
    </div>
  );
}
