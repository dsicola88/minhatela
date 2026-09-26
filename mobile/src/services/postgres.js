/**
 * Camada de cliente — apenas HTTP.
 * Regras de negócio vivem exclusivamente na API.
 */
export { default as api } from './api';
export { default as authService } from './auth';
export { default as catalogService } from './catalog';
export { default as paymentsService } from './payments';
