-- FMS 물품별 영양정보 저장 RPC. Supabase SQL Editor에서 한 번 실행합니다.
-- 기존 public.fms_states + fms_save_state 설정(supabase/schema.sql)이 필요합니다.
-- 기존 자료/재고는 유지하며, 로그인 계정의 선택한 물품 영양정보만 변경합니다.
-- 같은 SQL은 다시 실행해도 안전합니다. 모바일에 비밀 키를 넣지 않습니다.
begin;

create or replace function public.fms_save_product_nutrition(
  p_product_id text,
  p_expected_nutrition_revision bigint,
  p_expected_unit text,
  p_nutrition jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  document jsonb;
  state_revision bigint;
  product jsonb;
  product_position bigint;
  matches bigint;
  previous_revision bigint;
  next_revision bigint;
  product_path text[];
  saved_at timestamptz := now();
  amount text;
begin
  if owner_id is null then
    raise exception 'FMS_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_product_id is null or length(p_product_id) not between 1 and 200
     or p_expected_nutrition_revision is null or p_expected_nutrition_revision < 0
     or p_expected_nutrition_revision = 9223372036854775807
     or p_expected_unit is null or length(btrim(p_expected_unit)) not between 1 and 20
     or p_nutrition is null or jsonb_typeof(p_nutrition) is distinct from 'object'
     or octet_length(p_nutrition::text) > 1048576
     or p_nutrition -> 'schemaVersion' is distinct from '1'::jsonb
     or p_nutrition #>> '{basis,type}' is distinct from 'total_package'
     or jsonb_typeof(p_nutrition -> 'package') is distinct from 'object'
     or jsonb_typeof(p_nutrition #> '{package,quantity}') is distinct from 'string'
     or jsonb_typeof(p_nutrition #> '{package,unit}') is distinct from 'string'
     or length(btrim(p_nutrition #>> '{package,unit}')) not between 1 and 20
     or jsonb_typeof(p_nutrition -> 'fmsUnit') is distinct from 'string'
     or p_nutrition ->> 'fmsUnit' is distinct from p_expected_unit
     or p_nutrition ->> 'origin' not in ('photo','manual','reference')
     or p_nutrition ->> 'origin' is null
     or jsonb_typeof(p_nutrition -> 'required') is distinct from 'array'
     or jsonb_typeof(p_nutrition -> 'additional') is distinct from 'array'
     or jsonb_typeof(p_nutrition -> 'source') is distinct from 'object'
     or jsonb_typeof(p_nutrition #> '{source,basis}') is distinct from 'object'
     or jsonb_typeof(p_nutrition #> '{source,required}') is distinct from 'array'
     or jsonb_typeof(p_nutrition #> '{source,additional}') is distinct from 'array' then
    raise exception 'FMS_NUTRITION_INVALID' using errcode = '22023';
  end if;
  -- Separate checks avoid calling array functions on malformed JSON values.
  if jsonb_array_length(p_nutrition -> 'required') > 299
     or jsonb_array_length(p_nutrition -> 'additional') > 299
     or jsonb_array_length(p_nutrition #> '{source,required}') > 299
     or jsonb_array_length(p_nutrition #> '{source,additional}') > 299 then
    raise exception 'FMS_NUTRITION_INVALID' using errcode = '22023';
  end if;
  amount := p_nutrition #>> '{package,quantity}';
  if amount !~ '^[0-9]{1,24}(\.[0-9]{1,12})?$'
     or length(replace(amount,'.','')) > 24 then
    raise exception 'FMS_NUTRITION_INVALID' using errcode = '22023';
  end if;
  if amount::numeric <= 0 then
    raise exception 'FMS_NUTRITION_INVALID' using errcode = '22023';
  end if;

  -- The owner row lock serializes this with web saves and other mobile registrations.
  -- No other user's workspace is read, returned, or replaced.
  select s.payload, s.revision into document, state_revision
    from public.fms_states s where s.user_id = owner_id for update;
  if not found then
    raise exception 'FMS_WORKSPACE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if jsonb_typeof(document #> '{records,collections,products}') is distinct from 'array' then
    raise exception 'FMS_INVALID_DOCUMENT' using errcode = '22023';
  end if;
  select count(*), min(e.ord) into matches, product_position
    from jsonb_array_elements(document #> '{records,collections,products}') with ordinality as e(item,ord)
    where e.item ->> 'id' = p_product_id;
  if matches = 0 then
    raise exception 'FMS_PRODUCT_NOT_FOUND' using errcode = 'P0002';
  elsif matches <> 1 then
    raise exception 'FMS_INVALID_DOCUMENT' using errcode = '22023';
  end if;
  product_path := array['records','collections','products',(product_position-1)::text];
  product := document #> product_path;
  if coalesce(product ->> 'unit','') is distinct from p_expected_unit then
    raise exception 'FMS_PRODUCT_UNIT_CONFLICT' using errcode = '40001';
  end if;
  if not (product ? 'nutritionRevision') then
    previous_revision := 0;
  elsif jsonb_typeof(product -> 'nutritionRevision') = 'number'
        and (product ->> 'nutritionRevision') ~ '^[0-9]{1,18}$' then
    previous_revision := (product ->> 'nutritionRevision')::bigint;
  else
    raise exception 'FMS_INVALID_DOCUMENT' using errcode = '22023';
  end if;
  if previous_revision <> p_expected_nutrition_revision then
    raise exception 'FMS_NUTRITION_REVISION_CONFLICT' using errcode = '40001';
  end if;
  next_revision := previous_revision + 1;
  -- Server timestamp replaces any timestamp supplied by the caller.
  product := jsonb_set(product, '{nutrition}',
    jsonb_set(p_nutrition, '{savedAt}', to_jsonb(saved_at), true), true);
  product := jsonb_set(product, '{nutritionRevision}', to_jsonb(next_revision), true);
  update public.fms_states s
    set payload = jsonb_set(document, product_path, product, false),
        revision = s.revision + 1,
        updated_at = saved_at
    where s.user_id = owner_id
    returning s.revision into state_revision;
  return jsonb_build_object('nutrition_revision',next_revision,'state_revision',state_revision,'saved_at',saved_at);
end;
$$;

revoke all on function public.fms_save_product_nutrition(text,bigint,text,jsonb) from public, anon, authenticated;
grant execute on function public.fms_save_product_nutrition(text,bigint,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
