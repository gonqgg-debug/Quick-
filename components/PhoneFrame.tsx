type PhoneFrameProps = {
  children: React.ReactNode;
  className?: string;
  /** Applied to the inner screen container. */
  screenClassName?: string;
};

export function PhoneFrame({ children, className = "", screenClassName = "" }: PhoneFrameProps) {
  return (
    <div className={`mx-auto w-full max-w-[320px] md:max-w-[360px] ${className}`}>
      <div className="relative aspect-[9/19.5] w-full rounded-[2.75rem] bg-neutral-900 p-[13px] shadow-2xl shadow-neutral-900/30 md:rounded-[3rem]">
        {/* Volume buttons */}
        <span className="absolute -left-[2px] top-[21%] z-10 h-7 w-[3px] rounded-l-sm bg-neutral-800" />
        <span className="absolute -left-[2px] top-[28%] z-10 h-11 w-[3px] rounded-l-sm bg-neutral-800" />
        {/* Power button */}
        <span className="absolute -right-[2px] top-[24%] z-10 h-14 w-[3px] rounded-r-sm bg-neutral-800" />

        <div
          className={`relative h-full w-full overflow-hidden rounded-[2rem] bg-white md:rounded-[2.25rem] ${screenClassName}`}
        >
          {children}
        </div>

        {/* Dynamic Island */}
        <span className="pointer-events-none absolute left-1/2 top-[22px] z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-neutral-900 md:top-[24px]" />
      </div>
    </div>
  );
}
