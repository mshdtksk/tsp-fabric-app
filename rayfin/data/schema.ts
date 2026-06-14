import { Address } from './Address.js';
import { RoutePlan } from './RoutePlan.js';

export type TodoAppSchema = {
  Address: Address;
  RoutePlan: RoutePlan;
};

export const schema = [Address, RoutePlan];
