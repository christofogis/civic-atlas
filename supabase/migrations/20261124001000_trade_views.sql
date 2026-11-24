-- Each trade once, from the earliest filing that reported it. Amended filings re-report
-- earlier trades with a later filing date, which would otherwise look like late reporting.
-- Identical trades within one filing (e.g. two same-size purchases on one day) are all kept.
create view stock_trades_dedup with (security_invoker = true) as
with ranked as (
  select s.*, f.is_amendment, f.source_url,
    first_value(s.filing_id) over (
      partition by s.bioguide_id, s.asset_name, s.transaction_date, s.transaction_type, s.amount_text, s.owner
      order by s.filed_date, f.is_amendment, s.filing_id) as first_filing
  from stock_transactions s
  join ptr_filings f using (filing_id)
)
select filing_id, row_num, bioguide_id, owner, asset_name, ticker, asset_type, transaction_type,
       transaction_date, notification_date, amount_text, amount_min, amount_max, comment,
       filed_date, days_to_file, is_amendment, source_url
from ranked
where filing_id = first_filing;

-- Per-member counts. A trade counts as reported after 45 days only when first reported in an
-- original (not amended) filing, with dates as filed that are in order.
create view member_trade_summary with (security_invoker = true) as
select f.bioguide_id,
  count(distinct f.filing_id) as filings,
  count(distinct f.filing_id) filter (where f.format = 'scanned') as scanned_filings,
  (select count(*) from stock_trades_dedup d where d.bioguide_id = f.bioguide_id) as trades,
  (select count(*) from stock_trades_dedup d where d.bioguide_id = f.bioguide_id
     and d.days_to_file > 45 and not d.is_amendment) as reported_after_45_days,
  (select count(*) from stock_trades_dedup d where d.bioguide_id = f.bioguide_id
     and d.days_to_file between 0 and 100000 and not d.is_amendment) as trades_with_dates
from ptr_filings f
where f.bioguide_id is not null
group by f.bioguide_id;
