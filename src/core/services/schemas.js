import { z } from 'zod';
import { isBlockedDeliveryUrl } from './url-guard.js';

// Reusable http(s) URL validator that also blocks loopback / private / metadata
// targets so the delivery worker cannot be used as an SSRF trampoline.
const httpUrl = z
  .string()
  .max(2000)
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'must be a valid http(s) URL' }
  )
  .refine((v) => !isBlockedDeliveryUrl(v), {
    message: 'must not target loopback, private, or link-local addresses',
  });

export const createSourceSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const createEndpointSchema = z.object({
  url: httpUrl,
});

export const ingestSchema = z
  .object({
    event_type: z.string().trim().min(1).max(200),
    payload: z.unknown(),
  })
  .refine((o) => o.payload !== undefined && o.payload !== null, {
    message: 'payload is required',
    path: ['payload'],
  });
