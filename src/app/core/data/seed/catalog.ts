import { CompanySize, Industry, TeamRole } from '../../models';

/** Static reference material for the demo dataset. All organisations are fictional. */

export interface TeamSeed {
  id: string;
  firstName: string;
  lastName: string;
  role: TeamRole;
  quarterlyQuota: number;
  joinedDaysAgo: number;
}

export const TEAM_SEED: readonly TeamSeed[] = [
  { id: 'tm_alex', firstName: 'Alex', lastName: 'Morgan', role: 'sales-manager', quarterlyQuota: 60000, joinedDaysAgo: 1460 },
  { id: 'tm_priya', firstName: 'Priya', lastName: 'Nair', role: 'account-executive', quarterlyQuota: 100000, joinedDaysAgo: 1120 },
  { id: 'tm_daniel', firstName: 'Daniel', lastName: 'Okafor', role: 'account-executive', quarterlyQuota: 85000, joinedDaysAgo: 980 },
  { id: 'tm_sofia', firstName: 'Sofia', lastName: 'Martinez', role: 'account-executive', quarterlyQuota: 95000, joinedDaysAgo: 760 },
  { id: 'tm_omar', firstName: 'Omar', lastName: 'Haddad', role: 'account-executive', quarterlyQuota: 80000, joinedDaysAgo: 640 },
  { id: 'tm_camille', firstName: 'Camille', lastName: 'Laurent', role: 'account-executive', quarterlyQuota: 100000, joinedDaysAgo: 1300 },
  { id: 'tm_ethan', firstName: 'Ethan', lastName: 'Brooks', role: 'sdr', quarterlyQuota: 20000, joinedDaysAgo: 420 },
  { id: 'tm_mei', firstName: 'Mei', lastName: 'Tanaka', role: 'sdr', quarterlyQuota: 20000, joinedDaysAgo: 380 },
];

/** Team members who own and close deals. SDRs mostly source early-stage opportunities. */
export const CLOSERS = ['tm_alex', 'tm_priya', 'tm_daniel', 'tm_sofia', 'tm_omar', 'tm_camille'];
export const SDRS = ['tm_ethan', 'tm_mei'];

export interface CompanySeed {
  name: string;
  short: string;
  domain: string;
  industry: Industry;
  size: CompanySize;
  city: string;
  countryCode: string;
  description: string;
}

export const COMPANY_SEED: readonly CompanySeed[] = [
  { name: 'Northwind Analytics', short: 'Northwind', domain: 'northwindanalytics.com', industry: 'software', size: '201-500', city: 'Seattle', countryCode: 'US', description: 'Operational analytics platform for mid-market supply chains.' },
  { name: 'Brightpath Health', short: 'Brightpath', domain: 'brightpathhealth.com', industry: 'healthcare', size: '501-1000', city: 'Boston', countryCode: 'US', description: 'Network of outpatient care centres across New England.' },
  { name: 'Lumen Logistics', short: 'Lumen', domain: 'lumenlogistics.com', industry: 'logistics', size: '1000+', city: 'Rotterdam', countryCode: 'NL', description: 'Port-to-door freight forwarding and warehousing.' },
  { name: 'Cobalt Financial', short: 'Cobalt', domain: 'cobaltfinancial.co', industry: 'fintech', size: '201-500', city: 'London', countryCode: 'GB', description: 'Treasury management software for growing businesses.' },
  { name: 'Evergreen Market', short: 'Evergreen', domain: 'evergreenmarket.com', industry: 'retail', size: '1000+', city: 'Toronto', countryCode: 'CA', description: 'Regional grocery chain with 140 neighbourhood stores.' },
  { name: 'Helio Labs', short: 'Helio', domain: 'heliolabs.io', industry: 'software', size: '51-200', city: 'Austin', countryCode: 'US', description: 'Developer tooling for real-time data pipelines.' },
  { name: 'Atlas Fabrication', short: 'Atlas', domain: 'atlasfabrication.com', industry: 'manufacturing', size: '501-1000', city: 'Stuttgart', countryCode: 'DE', description: 'Precision components for automotive and aerospace.' },
  { name: 'Silverline Media', short: 'Silverline', domain: 'silverlinemedia.com', industry: 'media', size: '51-200', city: 'New York', countryCode: 'US', description: 'Independent digital publisher and podcast network.' },
  { name: 'Pinnacle Learning', short: 'Pinnacle', domain: 'pinnaclelearning.com', industry: 'education', size: '201-500', city: 'Chicago', countryCode: 'US', description: 'Online professional certification programmes.' },
  { name: 'Solaris Grid', short: 'Solaris', domain: 'solarisgrid.com', industry: 'energy', size: '1000+', city: 'Madrid', countryCode: 'ES', description: 'Utility-scale solar developer and grid operator.' },
  { name: 'Harbor & Vine Hospitality', short: 'Harbor & Vine', domain: 'harborandvine.com', industry: 'hospitality', size: '501-1000', city: 'Dubai', countryCode: 'AE', description: 'Boutique hotels and waterfront dining venues.' },
  { name: 'Vertex Cloud Systems', short: 'Vertex', domain: 'vertexcloud.io', industry: 'software', size: '1000+', city: 'San Francisco', countryCode: 'US', description: 'Managed cloud infrastructure for regulated industries.' },
  { name: 'Quantum Ledger', short: 'Quantum', domain: 'quantumledger.io', industry: 'fintech', size: '51-200', city: 'Singapore', countryCode: 'SG', description: 'Cross-border payments reconciliation for marketplaces.' },
  { name: 'Meridian Clinics', short: 'Meridian', domain: 'meridianclinics.com', industry: 'healthcare', size: '201-500', city: 'Riyadh', countryCode: 'SA', description: 'Specialist clinics focused on family and preventive care.' },
  { name: 'Crestview Foods', short: 'Crestview', domain: 'crestviewfoods.com', industry: 'retail', size: '501-1000', city: 'Lyon', countryCode: 'FR', description: 'Premium food brands sold through European retailers.' },
  { name: 'Ironbridge Industrial', short: 'Ironbridge', domain: 'ironbridgeindustrial.com', industry: 'manufacturing', size: '1000+', city: 'Manchester', countryCode: 'GB', description: 'Industrial equipment manufacturer with global service teams.' },
  { name: 'Bluefin Freight', short: 'Bluefin', domain: 'bluefinfreight.com', industry: 'logistics', size: '201-500', city: 'Hamburg', countryCode: 'DE', description: 'Temperature-controlled shipping across the North Sea.' },
  { name: 'Aurora Studios', short: 'Aurora', domain: 'aurorastudios.tv', industry: 'media', size: '11-50', city: 'Los Angeles', countryCode: 'US', description: 'Post-production and motion design studio.' },
  { name: 'Summit Academy Group', short: 'Summit', domain: 'summitacademy.org', industry: 'education', size: '51-200', city: 'Denver', countryCode: 'US', description: 'Charter school network serving 6,000 students.' },
  { name: 'Terra Renewables', short: 'Terra', domain: 'terrarenewables.com', industry: 'energy', size: '201-500', city: 'Copenhagen', countryCode: 'DK', description: 'Offshore wind maintenance and monitoring services.' },
  { name: 'Nimbus Software', short: 'Nimbus', domain: 'nimbussoftware.fr', industry: 'software', size: '11-50', city: 'Paris', countryCode: 'FR', description: 'Scheduling software for field service companies.' },
  { name: 'Keystone Payments', short: 'Keystone', domain: 'keystonepayments.com', industry: 'fintech', size: '501-1000', city: 'Dublin', countryCode: 'IE', description: 'Card acquiring and payment orchestration platform.' },
  { name: 'Riverside Medical Group', short: 'Riverside', domain: 'riversidemedical.com', industry: 'healthcare', size: '1000+', city: 'Sydney', countryCode: 'AU', description: 'Private hospital group with nine metropolitan sites.' },
  { name: 'Urban Thread', short: 'Urban Thread', domain: 'urbanthread.co', industry: 'retail', size: '51-200', city: 'New York', countryCode: 'US', description: 'Direct-to-consumer apparel brand.' },
  { name: 'Falconridge Robotics', short: 'Falconridge', domain: 'falconridgerobotics.com', industry: 'manufacturing', size: '201-500', city: 'Montréal', countryCode: 'CA', description: 'Warehouse automation robots and fleet software.' },
  { name: 'Swiftlane Couriers', short: 'Swiftlane', domain: 'swiftlane.com', industry: 'logistics', size: '51-200', city: 'Jeddah', countryCode: 'SA', description: 'Same-day courier network for e-commerce merchants.' },
  { name: 'Mosaic Publishing', short: 'Mosaic', domain: 'mosaicpublishing.fr', industry: 'media', size: '201-500', city: 'Paris', countryCode: 'FR', description: 'Educational and trade book publisher.' },
  { name: 'Beacon Tutoring', short: 'Beacon', domain: 'beacontutoring.co.uk', industry: 'education', size: '11-50', city: 'London', countryCode: 'GB', description: 'One-to-one tutoring marketplace for secondary students.' },
  { name: 'Kinetic Power Co.', short: 'Kinetic', domain: 'kineticpower.com', industry: 'energy', size: '501-1000', city: 'Houston', countryCode: 'US', description: 'Battery storage systems for commercial sites.' },
  { name: 'Oasis Resorts', short: 'Oasis', domain: 'oasisresorts.com', industry: 'hospitality', size: '1000+', city: 'Marrakesh', countryCode: 'MA', description: 'Luxury resorts and spa destinations in North Africa.' },
];

export const FIRST_NAMES = [
  'Sarah', 'James', 'Lena', 'Marcus', 'Aisha', 'Thomas', 'Yuki', 'Rafael', 'Nora', 'Hannah',
  'Lucas', 'Fatima', 'Oliver', 'Chloé', 'Mateo', 'Grace', 'Samuel', 'Leila', 'Benjamin', 'Ines',
  'Victor', 'Amara', 'Noah', 'Elena', 'Karim', 'Julia', 'Henry', 'Zara', 'Felix', 'Maya',
  'Adrian', 'Sophie', 'Ryan', 'Nadia', 'Hugo', 'Clara', 'David', 'Mariam', 'Ethan', 'Isabel',
  'Arjun', 'Emma', 'Liam', 'Rania', 'Paul', 'Anika', 'Simon', 'Laura', 'Youssef', 'Olivia',
];

export const LAST_NAMES = [
  'Kim', 'Whitaker', 'Fischer', 'Bennett', 'Rahman', 'Dubois', 'Sato', 'Costa', 'Lindqvist', 'Patel',
  'Moreau', 'Al-Saud', 'Hughes', 'Martin', 'Silva', 'Thompson', 'Adeyemi', 'Mansour', 'Clarke', 'Garcia',
  'Novak', 'Osei', 'Walsh', 'Rossi', 'Benali', 'Schmidt', 'Turner', 'Qureshi', 'Wagner', 'Chen',
  'Murphy', 'Lefebvre', 'Ortiz', 'Haddad', 'Bernard', 'Jensen', 'Cohen', 'Farouk', 'Reyes', 'Kowalski',
  'Iyer', 'Andersson', 'Kelly', 'Nasser', 'Girard', 'Mehta', 'Fournier', 'Hoffmann', 'Zaki', 'Price',
];

export const JOB_TITLES = [
  'VP of Sales',
  'Head of Operations',
  'Procurement Manager',
  'Chief Technology Officer',
  'Director of Marketing',
  'IT Manager',
  'Chief Operating Officer',
  'Finance Director',
  'Product Manager',
  'Customer Success Lead',
  'Head of Partnerships',
  'Revenue Operations Manager',
];

export const DEAL_TEMPLATES = [
  'Platform Expansion',
  'Annual Subscription',
  'Enterprise License',
  'Pilot Program',
  'Analytics Add-on',
  'Multi-site Rollout',
  'Seat Expansion',
  'Implementation Services',
  'Premium Support Plan',
  'API Integration',
  'Data Migration',
  'Contract Renewal',
];

export const DEAL_TAGS = [
  'enterprise',
  'expansion',
  'renewal',
  'new-logo',
  'pilot',
  'upsell',
  'multi-year',
  'security-review',
  'partner-led',
];

export const DEAL_NOTES = [
  'Champion is strongly aligned; procurement wants a three-year price lock.',
  'Evaluating us against two competitors. Security questionnaire submitted.',
  'Budget approved for this fiscal year. Legal review expected to take two weeks.',
  'Expansion driven by the new regional team. Needs SSO and audit logs.',
  'Pilot results were positive — 18% faster reporting cycle reported by the ops team.',
  'Decision committee meets monthly. Next review scheduled after the demo.',
  'Prefers annual billing. Asked for a reference customer in the same industry.',
  'Integration with their ERP is the main technical requirement.',
];

export const ACTIVITY_TEMPLATES = {
  call: ['Discovery call with {name}', 'Pricing discussion with {name}', 'Check-in call with {name}', 'Stakeholder alignment with {name}'],
  meeting: ['Product demo for {company}', 'Quarterly business review — {company}', 'Contract review with {name}', 'Onsite workshop at {company}'],
  email: ['Send proposal to {name}', 'Share case study with {name}', 'Send contract for signature — {company}', 'Recap email after demo to {name}'],
  'follow-up': ['Follow up on proposal — {company}', 'Follow up after demo with {name}', 'Confirm budget approval — {company}', 'Check legal review status — {company}'],
} as const;

export const ACTIVITY_DESCRIPTIONS = [
  'Review current workflow, confirm success criteria and timeline.',
  'Walk through pricing tiers and answer implementation questions.',
  'Align on next steps with the economic buyer.',
  'Share the security overview and SOC 2 report.',
  'Confirm stakeholders and agree on a mutual action plan.',
  'Recap open questions from the last meeting.',
];

export const CONTACT_NOTES = [
  'Prefers concise email updates; decision maker for tooling budgets.',
  'Met at the regional sales summit. Interested in reporting automation.',
  'Champion for the rollout — introduce to our solutions engineer.',
  'Quarterly check-ins work best on Tuesday mornings.',
  'Evaluating vendors for next fiscal year; asked for a security pack.',
  'Referred two peers last quarter. Keep in the reference program.',
];
