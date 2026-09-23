/**
 * /lustrum/<slug> → serveert de generieke vraagpagina. De vraag zelf komt pas
 * via de API na het invoeren van spelerscode en pincode, dus deze HTML bevat
 * nooit vraaginhoud. Andere paden (/lustrum/admin, /lustrum/scorebord) gaan
 * gewoon door naar de statische bestanden.
 */
import { isQuestionSlug } from '../../lustrum/lib/codes.js';

export async function onRequestGet({ params, request, env, next }) {
  if (!isQuestionSlug(params.slug)) return next();
  return env.ASSETS.fetch(new URL('/lustrum/vraag', request.url));
}
