-- Read-only operational snapshot for a fresh Alpha project.
-- Run occasionally as postgres. The document-size query serializes data to count logical JSON bytes.
begin transaction read only;
select * from qsync_private.policy;
select current_setting('autovacuum') as autovacuum_enabled,
       current_setting('autovacuum_vacuum_scale_factor') as default_vacuum_scale_factor;

select relation_name,rows,logical_row_bytes,physical_bytes,heap_bytes,index_bytes,
       s.n_live_tup as live_estimate,s.n_dead_tup as dead_estimate,s.last_vacuum,s.last_autovacuum
from (
 select 'history' as relation_name,count(*)::bigint as rows,
        coalesce(sum(octet_length(row_to_json(h)::text)),0)::bigint as logical_row_bytes,
        pg_total_relation_size('qsync_private.history'::regclass)::bigint as physical_bytes,
        pg_relation_size('qsync_private.history'::regclass)::bigint as heap_bytes,
        pg_indexes_size('qsync_private.history'::regclass)::bigint as index_bytes
 from qsync_private.history h
 union all
 select 'receipts',count(*)::bigint,coalesce(sum(octet_length(row_to_json(r)::text)),0)::bigint,
        pg_total_relation_size('qsync_private.receipts'::regclass)::bigint,
        pg_relation_size('qsync_private.receipts'::regclass)::bigint,
        pg_indexes_size('qsync_private.receipts'::regclass)::bigint
 from qsync_private.receipts r
 union all
 select 'daily_usage',count(*)::bigint,coalesce(sum(octet_length(row_to_json(u)::text)),0)::bigint,
        pg_total_relation_size('qsync_private.daily_usage'::regclass)::bigint,
        pg_relation_size('qsync_private.daily_usage'::regclass)::bigint,
        pg_indexes_size('qsync_private.daily_usage'::regclass)::bigint
 from qsync_private.daily_usage u
) measured
left join pg_stat_user_tables s on s.schemaname='qsync_private' and s.relname=measured.relation_name
order by relation_name;

select count(*) as accounts,
       coalesce(max(history_rows),0) as max_history_rows_per_account,
       coalesce(max(receipt_rows),0) as max_receipt_rows_per_account
from (
 select h.user_id,
        (select count(*) from qsync_private.history x where x.user_id=h.user_id) as history_rows,
        (select count(*) from qsync_private.receipts x where x.user_id=h.user_id) as receipt_rows
 from qsync_private.heads h
) by_account;

select utc_day,max(new_operations) as max_operations_one_account,
       max(request_bytes) as max_payload_bytes_one_account,
       sum(new_operations)::bigint as total_new_operations,
       sum(request_bytes)::bigint as total_request_bytes
from qsync_private.daily_usage
where utc_day >= (clock_timestamp() at time zone 'UTC')::date-7
group by utc_day order by utc_day desc;

-- Current user documents only: logical JSON size versus stored column size, without returning payloads or ids.
select count(*) as current_documents,
       coalesce(sum(octet_length(data::text)),0)::bigint as logical_json_bytes,
       coalesce(max(octet_length(data::text)),0)::integer as largest_logical_document_bytes,
       coalesce(sum(pg_column_size(data)),0)::bigint as stored_column_bytes,
       coalesce(max(pg_column_size(data)),0)::integer as largest_stored_column_bytes
from public.user_data;
commit;
