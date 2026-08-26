import { brand } from "@/lib/theme";

export function LandingInner({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-[1100px] px-6 md:px-8 ${className}`}>{children}</div>
  );
}

export function SectionWave({ fill }: { fill: string }) {
  return (
    <div className="section-wave" aria-hidden="true">
      <svg viewBox="0 0 1440 88" preserveAspectRatio="none">
        <path fill={fill} d="M0 46C200 90 340 8 540 34C760 62 860 94 1080 50C1240 18 1340 12 1440 40L1440 90 0 90Z" />
      </svg>
    </div>
  );
}

export function SoftCircles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <span className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
      <span className="absolute -bottom-24 -left-12 h-80 w-80 rounded-full bg-white/10" />
      <span className="absolute bottom-10 right-1/4 h-32 w-32 rounded-full bg-white/[0.14]" />
    </div>
  );
}

export function SectionEyebrow({
  children,
  className = "",
  centered = false,
}: {
  children: React.ReactNode;
  className?: string;
  centered?: boolean;
}) {
  return (
    <p
      className={`text-xs font-bold uppercase tracking-[0.18em] ${centered ? "text-center" : ""} ${className}`}
      style={{ color: brand.orange }}
    >
      {children}
    </p>
  );
}
