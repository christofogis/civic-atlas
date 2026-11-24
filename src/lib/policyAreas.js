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
