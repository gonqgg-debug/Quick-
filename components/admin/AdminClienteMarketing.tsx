import { brand } from "@/lib/theme";

type AdminClienteMarketingProps = {
  acepta: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export function AdminClienteMarketing({ acepta, disabled = false, onToggle }: AdminClienteMarketingProps) {
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className="rounded-full px-2 py-0.5 text-[11px] font-bold"
        style={{
          backgroundColor: acepta ? `${brand.green}22` : "#F3F4F6",
          color: acepta ? brand.green : brand.muted,
        }}
      >
        {acepta ? "Sí" : "No"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={acepta}
        aria-label="Acepta marketing"
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }}
        className="inline-flex items-center disabled:opacity-40"
      >
        <span
          className="relative inline-block h-5 w-9 rounded-full"
          style={{ backgroundColor: acepta ? brand.green : "#D1D5DB" }}
        >
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white" style={{ left: acepta ? 16 : 2 }} />
        </span>
      </button>
    </div>
  );
}
