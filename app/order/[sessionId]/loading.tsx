export default function OrderLoading() {
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-brand-white px-4 pt-8">
      <div className="h-10 w-36 animate-pulse rounded-full bg-brand-muted/15" />
      <div className="mt-4 h-8 w-52 animate-pulse rounded-full bg-brand-muted/15" />
      <div className="mt-8 space-y-3">
        <div className="h-28 animate-pulse rounded-3xl border border-brand-muted/15 bg-brand-white" />
        <div className="h-28 animate-pulse rounded-3xl border border-brand-muted/15 bg-brand-white" />
        <div className="h-28 animate-pulse rounded-3xl border border-brand-muted/15 bg-brand-white" />
      </div>
    </div>
  );
}
