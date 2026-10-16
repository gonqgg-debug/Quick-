export default function ConsumoLoading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg bg-[#F3F4F6]" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-[#F3F4F6]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-[#F3F4F6]" />
        <div className="h-64 animate-pulse rounded-lg bg-[#F3F4F6]" />
      </div>
    </div>
  );
}
