"use client";

export function FeatureSwitch({ checked, disabled, label, describedBy, onChange }: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  describedBy?: string;
  onChange: (checked: boolean) => void;
}) {
  return <button type="button" className="feature-switch" role="switch"
    aria-label={label} aria-checked={checked} aria-describedby={describedBy}
    disabled={disabled} onClick={() => onChange(!checked)}>
    <span aria-hidden="true" />
  </button>;
}
