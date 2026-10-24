export interface SelectOption {
  readonly value: string;
  readonly label: string;
  /** Secondary line shown under the label. */
  readonly description?: string;
  /** Extra text the searchable select matches on (e.g. an email or company). */
  readonly keywords?: string;
  readonly disabled?: boolean;
}
