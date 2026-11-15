import { buildInventory, inventoryCollections, type InventoryItem } from './fmsInventory';
import type { FmsFood } from './nutritionValidation';
import { readPublicFoods, type PublicFood } from './publicFood';
import type { NutritionRegistration } from './nutritionNormalization';
// Same public client configuration as FMS. Never use a service_role/secret key.
const baseUrl = 'https://aqbmgufdixxhvtmmrwyp.supabase.co';
const publicKey = 'sb_publishable_AUZp6KJ0LDAaWrBMIS3n_g_PfrKVRAy';
type Session = { access_token: string; refresh_token: string; expires_at: number; user: { id: string } };
export type FmsClient = ReturnType<typeof createFmsClient>;
export function createFmsClient(onExpired: () => void) {
  let session: Session | null = null, generation = 0;
  let refreshing: Promise<string> | undefined;
  const clear = () => { generation++; session = null; refreshing = undefined; };
  const expire = () => { clear(); onExpired(); };
  async function request(path: string, options: { body?: unknown; token?: string } = {}) {
    const requestGeneration = generation;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(baseUrl + path, {
        method: options.body === undefined ? 'GET' : 'POST', signal: controller.signal,
        headers: { apikey: publicKey, 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
      const data = await response.json();
      if (!response.ok) {
        if (options.token && response.status === 401) { if (generation === requestGeneration) expire(); throw Error('로그인이 만료됐습니다. 다시 로그인해 주세요.'); }
        if (path.startsWith('/auth/')) throw Error('FMS 계정의 이메일과 비밀번호를 확인해 주세요.');
        if (path.endsWith('/fms_save_product_nutrition')) {
          if (data?.code === 'PGRST202' || (response.status === 404 && !data?.message?.startsWith('FMS_'))) throw Error('영양정보 저장 기능의 SQL이 아직 적용되지 않았습니다. 관리자에게 확인해 주세요.');
          if (data?.message === 'FMS_NUTRITION_REVISION_CONFLICT') throw Error('다른 화면에서 영양정보가 변경됐거나 이전 저장이 완료됐을 수 있습니다. 물품 선택에서 새로고침한 뒤 확인해 주세요.');
          if (data?.message === 'FMS_PRODUCT_UNIT_CONFLICT') throw Error('FMS 물품의 기준단위가 변경됐습니다. 물품을 다시 선택해 주세요.');
          if (data?.message === 'FMS_PRODUCT_NOT_FOUND') throw Error('저장할 물품을 찾지 못했습니다. 물품을 다시 선택해 주세요.');
          throw Error('영양정보를 저장하지 못했습니다. 물품과 입력값을 확인해 주세요.');
        }
        if (response.status === 403) throw Error('자료 조회 권한을 확인해 주세요.');
        throw Error('FMS 자료를 불러오지 못했습니다. 다시 시도해 주세요.');
      }
      return data;
    } catch (error) {
      if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw Error('인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function accept(data: any): Session {
    if (!data?.access_token || !data?.refresh_token || !data?.user?.id) throw Error('로그인 응답을 확인하지 못했습니다.');
    return { access_token: data.access_token, refresh_token: data.refresh_token, user: { id: data.user.id }, expires_at: Number(data.expires_at) || Date.now() / 1000 + Number(data.expires_in || 3600) };
  }
  async function signIn(email: string, password: string) {
    clear(); const current = generation;
    const data = await request('/auth/v1/token?grant_type=password', { body: { email: email.trim(), password } });
    if (generation !== current) throw Error('로그인을 다시 시도해 주세요.');
    session = accept(data);
  }
  async function token(): Promise<string> {
    if (!session) { expire(); throw Error('다시 로그인해 주세요.'); }
    if (session.expires_at * 1000 > Date.now() + 60000) return session.access_token;
    if (!refreshing) {
      const current = generation, saved = session;
      refreshing = request('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: saved.refresh_token } }).then(data => {
        if (generation !== current) throw Error('다시 로그인해 주세요.');
        const next = accept(data);
        if (next.user.id !== saved.user.id) throw Error('계정 확인이 필요합니다. 다시 로그인해 주세요.');
        session = next; return next.access_token;
      }).catch(error => { if (generation === current) expire(); throw error; }).finally(() => { if (generation === current) refreshing = undefined; });
    }
    return refreshing;
  }
  async function loadProducts(): Promise<FmsFood[]> {
    const jwt = await token(), current = generation, userId = session!.user.id;
    // PostgREST projects only the products collection; donor/user/profile data stays on the server.
    const select = 'revision,products:payload->records->collections->products';
    const rows = await request(`/rest/v1/fms_states?select=${encodeURIComponent(select)}&user_id=eq.${encodeURIComponent(userId)}`, { token: jwt });
    if (generation !== current) throw Error('다시 로그인해 주세요.');
    if (!Array.isArray(rows) || rows.length > 1) throw Error('FMS 자료 형식을 확인해 주세요.');
    if (!rows.length) return [];
    if (!Array.isArray(rows[0].products)) throw Error('FMS 물품 자료 형식을 확인해 주세요.');
    return rows[0].products.map((p: any) => {
      if (!p || !['string', 'number'].includes(typeof p.id) || typeof p.name !== 'string') throw Error('FMS 물품 자료 형식을 확인해 주세요.');
      return { id: String(p.id), name: p.name, workspaceUserId: userId,
        barcode: String(p.barcode ?? ''), category: String(p.category ?? ''), unit: String(p.unit ?? ''), brand: String(p.brand ?? ''), nutritionRevision: Number.isSafeInteger(p.nutritionRevision) && p.nutritionRevision >= 0 ? p.nutritionRevision : 0 };
    });
  }
  async function loadInventory(): Promise<InventoryItem[]> {
    const jwt = await token(), current = generation, userId = session!.user.id;
    // Read only product and stock-ledger collections from a single revision.
    const select = ['revision', ...inventoryCollections.map(key => `${key}:payload->records->collections->${key}`)].join(',');
    const rows = await request(`/rest/v1/fms_states?select=${encodeURIComponent(select)}&user_id=eq.${encodeURIComponent(userId)}`, { token: jwt });
    if (generation !== current) throw Error('다시 로그인해 주세요.');
    if (!Array.isArray(rows) || rows.length > 1) throw Error('FMS 자료 형식을 확인해 주세요.');
    return rows.length ? buildInventory(rows[0]) : [];
  }
  async function searchFoods(query: string, offset = 0): Promise<PublicFood[]> {
    const term = query.trim();
    if (!term || term.length > 100) throw Error('식품명을 1~100자로 입력해 주세요.');
    const jwt = await token(), current = generation;
    const rows = await request('/rest/v1/rpc/fms_food_search', {
      token: jwt, body: { p_query: term, p_limit: 30, p_offset: Math.max(0, Math.floor(offset)) },
    });
    if (generation !== current) throw Error('다시 로그인해 주세요.');
    return readPublicFoods(rows);
  }
  async function saveNutrition(food: FmsFood, nutrition: NutritionRegistration, expectedRevision: number) {
    const jwt = await token(), current = generation;
    if (food.workspaceUserId !== session!.user.id) throw Error('현재 계정의 물품을 다시 선택해 주세요.');
    if (!food.unit?.trim()) throw Error('먼저 FMS에서 물품의 기준단위를 입력해 주세요.');
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw Error('물품의 저장 상태를 다시 확인해 주세요.');
    const reply = await request('/rest/v1/rpc/fms_save_product_nutrition', { token: jwt, body: {
      p_product_id: food.id, p_expected_nutrition_revision: expectedRevision,
      p_expected_unit: food.unit, p_nutrition: nutrition,
    } });
    if (generation !== current) throw Error('다시 로그인해 주세요.');
    if (!reply || !Number.isSafeInteger(reply.nutrition_revision) || reply.nutrition_revision !== expectedRevision + 1) throw Error('저장 결과를 확인하지 못했습니다. 물품을 다시 선택해 확인해 주세요.');
    return reply.nutrition_revision as number;
  }
  return { signIn, loadProducts, loadInventory, searchFoods, saveNutrition, clear };
}


