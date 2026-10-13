/** The choices of a Call-it report (spec BR-55). The `value` is what the server stores; the `label` is what people read. */
export const CLASSIFICATIONS = [
  { value: 'unsafe_acts', label: 'Unsafe acts' },
  { value: 'unsafe_conditions', label: 'Unsafe conditions' },
  { value: 'unsafe_behaviour', label: 'Unsafe behaviour' },
] as const;

export const SUB_CLASSIFICATIONS = [
  { value: 'people', label: 'People' },
  { value: 'materials', label: 'Materials' },
  { value: 'processes', label: 'Processes' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'environment', label: 'Environment' },
] as const;

export const LOCATIONS = [
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'main_deck', label: 'Main deck' },
  { value: 'poop_deck', label: 'Poop deck' },
  { value: 'cargo_space', label: 'Cargo space' },
  { value: 'ballast_space', label: 'Ballast space' },
  { value: 'hold_space', label: 'Hold space' },
  { value: 'machinery_space', label: 'Machinery space' },
  { value: 'others', label: 'Others' },
] as const;

type Option = { value: string; label: string };
export const labelOf = (options: readonly Option[], value: string | null | undefined) =>
  options.find((o) => o.value === value)?.label ?? '';

export const STATUS_LABEL = { draft: 'Draft', submitted: 'Sent', reviewed: 'Reviewed' } as const;
