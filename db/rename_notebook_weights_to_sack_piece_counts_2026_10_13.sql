ALTER TABLE public.bread_weight_entries RENAME TO notebook_sack_entries;
ALTER TABLE public.notebook_sack_entries RENAME COLUMN sample_no TO sack_no;
ALTER TABLE public.notebook_sack_entries RENAME COLUMN weight_g TO pieces_in_sack;
COMMENT ON TABLE public.notebook_sack_entries IS 'Notebook daily checks: each row is one sack and pieces_in_sack is the number of pieces counted in that sack, not a gram weight.';
COMMENT ON COLUMN public.notebook_sack_entries.sack_no IS 'Sack sequence number within the recorded date.';
COMMENT ON COLUMN public.notebook_sack_entries.pieces_in_sack IS 'Count of bread pieces in the sack; this is a count, not a weight in grams.';
