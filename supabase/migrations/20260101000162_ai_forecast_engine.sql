-- =========================================================================
-- PHASE 8 Milestone 2: deterministic forecast engine.
--
-- Per the spec's own "Forecast Engine" section -- "Do not rely exclusively
-- on LLM predictions... AI should NOT invent forecast numbers" -- this is
-- pure statistics against real analytics_snapshots history, using
-- Postgres's built-in regr_slope/regr_intercept (ordinary least squares),
-- no LLM involved. One primary metric per module (the single most
-- representative number for that department) rather than forecasting
-- every metric -- proportionate scope, easy to extend later.
--
-- With fewer than 2 real days of history, this returns an explicit
-- "insufficient data" result instead of guessing -- matching "If data
-- quality is poor: Tell the user" and "AI should say I don't know."
-- =========================================================================
create or replace function public.get_metric_forecast(p_company_id uuid, p_module text, p_metric text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_count int;
  v_first_date date;
  v_last_date date;
  v_slope numeric;
  v_intercept numeric;
  v_last_value numeric;
  v_next_index int;
  v_prediction numeric;
  v_confidence text;
  v_direction text;
begin
  if not public.has_permission(p_company_id, 'AI.COMPANY_ANALYTICS.VIEW') then
    raise exception 'Access denied';
  end if;

  select count(*), min(snapshot_date), max(snapshot_date)
  into v_count, v_first_date, v_last_date
  from public.analytics_snapshots
  where company_id = p_company_id and module = p_module and metrics ? p_metric;

  if v_count is null or v_count < 2 then
    return jsonb_build_object(
      'module', p_module, 'metric', p_metric, 'data_points', coalesce(v_count, 0),
      'method', 'NONE', 'prediction', null, 'trend_direction', null, 'confidence', 'NONE',
      'data_quality', 'Only ' || coalesce(v_count, 0) || ' day(s) of history captured. At least 2 are needed for any trend line, and at least 7 for a reasonably reliable one. No days are backfilled or estimated.'
    );
  end if;

  select regr_slope(value, day_index), regr_intercept(value, day_index)
  into v_slope, v_intercept
  from (
    select (snapshot_date - v_first_date) as day_index, (metrics->>p_metric)::numeric as value
    from public.analytics_snapshots
    where company_id = p_company_id and module = p_module and metrics ? p_metric
  ) points;

  select (metrics->>p_metric)::numeric into v_last_value
  from public.analytics_snapshots
  where company_id = p_company_id and module = p_module and snapshot_date = v_last_date;

  v_next_index := (v_last_date - v_first_date) + 1;
  v_prediction := greatest(round((v_slope * v_next_index + v_intercept)::numeric, 2), 0);
  v_direction := case when v_slope > 0.05 then 'INCREASING' when v_slope < -0.05 then 'DECREASING' else 'STABLE' end;
  v_confidence := case when v_count >= 21 then 'HIGH' when v_count >= 7 then 'MEDIUM' else 'LOW' end;

  return jsonb_build_object(
    'module', p_module, 'metric', p_metric,
    'historical_period', jsonb_build_object('from', v_first_date, 'to', v_last_date),
    'forecast_period', (v_last_date + 1)::text,
    'method', 'LINEAR_TREND', 'data_points', v_count,
    'last_value', v_last_value, 'prediction', v_prediction, 'trend_direction', v_direction,
    'confidence', v_confidence,
    'data_quality', v_count || ' real day(s) of history used. ' ||
      case when v_count < 7 then 'Below the 7-day minimum for a reliable trend -- treat this as directional only.' else 'Meets the 7-day minimum for a reasonably reliable trend.' end
  );
end;
$$;

grant execute on function public.get_metric_forecast(uuid, text, text) to authenticated;
