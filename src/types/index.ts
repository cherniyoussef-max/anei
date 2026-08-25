export type Locale = "en" | "ar" | "fr";

export type Course = {
  slug: string;
  category: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  objectives: Record<Locale, string[]>;
  duration: string;
  startDate: string;
  trainer: string;
  price: number;
  mode: "online" | "hybrid" | "onsite";
  level: "beginner" | "intermediate" | "advanced";
  progress?: number;
  accent: string;
};

export type Webinar = {
  id: number;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  date: string;
  time: string;
  trainer: string;
  status: "upcoming" | "replay";
};

export type AvsProfile = {
  id: number;
  name: string;
  city: Record<Locale, string>;
  specialty: Record<Locale, string>;
  availability: Record<Locale, string>;
  certified: boolean;
  initials: string;
};

export type Resource = {
  id: number;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  audience: Record<Locale, string>;
  type: "guide" | "manual" | "tool" | "sheet";
  price: number;
  accent: string;
};

export type NewsItem = {
  id: number;
  title: Record<Locale, string>;
  excerpt: Record<Locale, string>;
  date: string;
  tag: Record<Locale, string>;
};
