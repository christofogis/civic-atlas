import { tr } from "./lang.js";
// The Library of Congress's policy areas, and URL slugs for topic pages.
export const POLICY_AREAS = [
  "Agriculture and Food", "Animals", "Armed Forces and National Security", "Arts, Culture, Religion",
  "Civil Rights and Liberties, Minority Issues", "Commerce", "Congress", "Crime and Law Enforcement",
  "Economics and Public Finance", "Education", "Emergency Management", "Energy", "Environmental Protection",
  "Families", "Finance and Financial Sector", "Foreign Trade and International Finance",
  "Geographic Areas, Entities, and Committees", "Government Operations and Politics", "Health",
  "Housing and Community Development", "Immigration", "International Affairs", "Labor and Employment", "Law",
  "Native Americans", "Private Legislation", "Public Lands and Natural Resources",
  "Science, Technology, Communications", "Social Sciences and History", "Social Welfare",
  "Sports and Recreation", "Taxation", "Transportation and Public Works", "Water Resources Development",
];
export const topicSlug = (area) => area.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const areaFromSlug = (slug) => POLICY_AREAS.find((a) => topicSlug(a) === slug);

// Spanish names for display only; the English name stays the key, as the Library of Congress publishes it.
const ES = {
  "Agriculture and Food": "Agricultura y alimentos", "Animals": "Animales", "Armed Forces and National Security": "Fuerzas armadas y seguridad nacional",
  "Arts, Culture, Religion": "Artes, cultura, religión", "Civil Rights and Liberties, Minority Issues": "Derechos civiles y libertades, asuntos de minorías",
  "Commerce": "Comercio", "Congress": "Congreso", "Crime and Law Enforcement": "Delito y cumplimiento de la ley",
  "Economics and Public Finance": "Economía y finanzas públicas", "Education": "Educación", "Emergency Management": "Manejo de emergencias",
  "Energy": "Energía", "Environmental Protection": "Protección ambiental", "Families": "Familias",
  "Finance and Financial Sector": "Finanzas y sector financiero", "Foreign Trade and International Finance": "Comercio exterior y finanzas internacionales",
  "Geographic Areas, Entities, and Committees": "Áreas geográficas, entidades y comités", "Government Operations and Politics": "Operaciones del gobierno y política",
  "Health": "Salud", "Housing and Community Development": "Vivienda y desarrollo comunitario", "Immigration": "Inmigración",
  "International Affairs": "Asuntos internacionales", "Labor and Employment": "Trabajo y empleo", "Law": "Derecho",
  "Native Americans": "Pueblos nativos americanos", "Private Legislation": "Legislación privada",
  "Public Lands and Natural Resources": "Tierras públicas y recursos naturales", "Science, Technology, Communications": "Ciencia, tecnología, comunicaciones",
  "Social Sciences and History": "Ciencias sociales e historia", "Social Welfare": "Bienestar social", "Sports and Recreation": "Deportes y recreación",
  "Taxation": "Impuestos", "Transportation and Public Works": "Transporte y obras públicas", "Water Resources Development": "Desarrollo de recursos hídricos",
};
export const areaName = (area) => (area ? tr(area, ES[area] ?? area) : area);
