import { createContext, useContext } from 'react';
import type { FmsClient } from '../lib/fmsCloud';
export const FmsCloudContext = createContext<FmsClient | null>(null);
export function useFmsCloud() {
  const client = useContext(FmsCloudContext);
  if (!client) throw Error('FMS 로그인이 필요합니다.');
  return client;
}
