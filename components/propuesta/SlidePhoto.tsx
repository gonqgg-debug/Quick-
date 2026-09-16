type SlidePhotoProps = {
  src: string;
  alt: string;
  objectPosition?: string;
  fit?: "cover" | "contain";
  className?: string;
};

export function SlidePhoto({
  src,
  alt,
  objectPosition = "center",
  fit = "cover",
  className = "",
}: SlidePhotoProps) {
  return (
    <div
      className={`propuesta-slide-photo${fit === "contain" ? " is-contain" : ""}${className ? ` ${className}` : ""}`}
      style={{
        backgroundImage: `url("${src}")`,
        backgroundPosition: objectPosition,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ objectPosition }} />
    </div>
  );
}
