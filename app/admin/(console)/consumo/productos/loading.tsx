export default function ProductosLoading() {
  return (
    <div className="-mx-4 -mt-6 min-h-full bg-[#F4F5F3] px-4 pb-8 pt-5 md:-mx-6 md:px-6" aria-hidden>
      <div className="h-4 w-32 animate-pulse rounded bg-[#E5E7EB]" />
      <div className="mt-3 h-7 w-64 animate-pulse rounded bg-[#E5E7EB]" />
      <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-[#E5E7EB]" />
      <div className="mt-4 h-16 animate-pulse rounded-lg bg-white" />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-[104px] animate-pulse rounded-lg bg-white" />
        ))}
      </div>
      <div className="mt-4 h-96 animate-pulse rounded-lg bg-white" />
    </div>
  );
}
