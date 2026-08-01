type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "start" | "center";
};

export function SectionHeading({ eyebrow, title, description, align = "start" }: Props) {
  return (
    <div className={align === "center" ? "section-heading text-center mx-auto" : "section-heading"}>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
