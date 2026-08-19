export type StaffAlertKind = "new" | "urgent";

const MUTE_KEY = "quick-staff-sound-muted";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    return null;
  }
  if (!audioContext) {
    audioContext = new Ctor();
  }
  return audioContext;
}

export function readStaffSoundMuted(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function writeStaffSoundMuted(muted: boolean): void {
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

export async function unlockStaffAlerts(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    await ctx.resume().catch(() => undefined);
  }
}

function tone(ctx: AudioContext, frequency: number, startAt: number, duration: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

export async function playStaffAlert(kind: StaffAlertKind): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }
  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    if (kind === "new") {
      tone(ctx, 880, now, 0.16);
      return;
    }
    tone(ctx, 392, now, 0.18);
    tone(ctx, 523, now + 0.22, 0.22);
  } catch {
    // El navegador puede bloquear audio sin gesto del usuario.
  }
}
