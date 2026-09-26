export interface ICD10Code {
  code: string;
  description: string;
  category: string;
}

export const COMMON_ICD10_CODES: ICD10Code[] = [
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified", category: "Respiratory" },
  { code: "J20.9", description: "Acute bronchitis, unspecified", category: "Respiratory" },
  { code: "J45.909", description: "Unspecified asthma, uncomplicated", category: "Respiratory" },
  { code: "J18.9", description: "Pneumonia, unspecified organism", category: "Respiratory" },
  { code: "I10", description: "Essential (primary) hypertension", category: "Cardiovascular" },
  { code: "I25.10", description: "Atherosclerotic heart disease of native coronary artery", category: "Cardiovascular" },
  { code: "I50.9", description: "Heart failure, unspecified", category: "Cardiovascular" },
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications", category: "Endocrine" },
  { code: "E03.9", description: "Hypothyroidism, unspecified", category: "Endocrine" },
  { code: "E78.5", description: "Hyperlipidemia, unspecified", category: "Endocrine" },
  { code: "K21.9", description: "Gastro-esophageal reflux disease without esophagitis", category: "Gastrointestinal" },
  { code: "K29.70", description: "Gastritis, unspecified, without bleeding", category: "Gastrointestinal" },
  { code: "K59.00", description: "Constipation, unspecified", category: "Gastrointestinal" },
  { code: "M54.5", description: "Low back pain", category: "Musculoskeletal" },
  { code: "M25.50", description: "Pain in unspecified joint", category: "Musculoskeletal" },
  { code: "M79.3", description: "Panniculitis, unspecified", category: "Musculoskeletal" },
  { code: "N39.0", description: "Urinary tract infection, site not specified", category: "Genitourinary" },
  { code: "N20.0", description: "Calculus of kidney", category: "Genitourinary" },
  { code: "R50.9", description: "Fever, unspecified", category: "General Symptoms" },
  { code: "R51", description: "Headache", category: "General Symptoms" },
  { code: "R53.83", description: "Other fatigue", category: "General Symptoms" },
  { code: "R11.2", description: "Nausea with vomiting, unspecified", category: "General Symptoms" },
  { code: "L20.9", description: "Atopic dermatitis, unspecified", category: "Dermatological" },
  { code: "L30.9", description: "Dermatitis, unspecified", category: "Dermatological" },
  { code: "F41.1", description: "Generalized anxiety disorder", category: "Psychiatric" },
  { code: "F32.9", description: "Major depressive disorder, single episode, unspecified", category: "Psychiatric" },
];
