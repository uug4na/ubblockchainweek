-- 0045: research PDFs may be up to 20 MB (was 10 MB in 0036). Owner, 16 Nov 2026: few submissions expected.
-- Only the bucket's size cap changes; PDF-only, private, and the upload/read policies stay as they are.
update storage.buckets set file_size_limit = 20971520 where id = 'research-papers';
