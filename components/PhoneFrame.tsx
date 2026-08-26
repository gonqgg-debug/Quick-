type PhoneFrameProps = {
  children: React.ReactNode;
  className?: string;
};

export function PhoneFrame({ children, className = "" }: PhoneFrameProps) {
  return (
    <div className={`relative mx-auto w-[300px] ${className}`}>
      <div className="relative rounded-[2.75rem] bg-neutral-900 p-3 shadow-2xl">
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2rem] bg-white">
          {children}
          <div className="absolute left-1/2 top-0 z-10 h-6 w-24 -translate-x-1/2 rounded-b-2xl bg-neutral-900" />
        </div>
      </div>
    </div>
  );
}
