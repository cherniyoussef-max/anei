import type { FormState } from "./constants";

/** Shared prop shape for every onboarding wizard step - keeps step components uniform without a generic form engine. */
export type StepProps = {
  data: FormState;
  errors: Record<string, string>;
  ar: boolean;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
};
