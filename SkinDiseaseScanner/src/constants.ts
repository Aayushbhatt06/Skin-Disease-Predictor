/**
 * Skin Disease Scanner — Constants
 */

// ─── Model Configuration ────────────────────────────────────

export const MODEL_INPUT_SIZE = 224;

// ─── Disease Labels (order must match model output indices) ──

export const DISEASE_LABELS: string[] = [
  'Acne',
  'Actinic_Keratosis',
  'Benign_tumors',
  'Bullous',
  'Candidiasis',
  'DrugEruption',
  'Eczema',
  'Infestations_Bites',
  'Lichen',
  'Lupus',
  'Moles',
  'Psoriasis',
  'Rosacea',
  'Seborrh_Keratoses',
  'SkinCancer',
  'Sun_Sunlight_Damage',
  'Tinea',
  'Unknown_Normal',
  'Vascular_Tumors',
  'Vasculitis',
  'Vitiligo',
  'Warts',
];

// ─── Risk Levels ─────────────────────────────────────────────

export type RiskInfo = {
  level: 'Low' | 'Medium' | 'High';
  color: string;
  icon: string;
};

export const RISK_LEVELS: Record<string, RiskInfo> = {
  'Acne':                  {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'Actinic_Keratosis':     {level: 'Medium', color: '#FFA502', icon: '⚠️'},
  'Benign_tumors':         {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'Bullous':               {level: 'Medium', color: '#FFA502', icon: '⚠️'},
  'Candidiasis':           {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'DrugEruption':          {level: 'Medium', color: '#FFA502', icon: '⚠️'},
  'Eczema':                {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'Infestations_Bites':    {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'Lichen':                {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'Lupus':                 {level: 'Medium', color: '#FFA502', icon: '⚠️'},
  'Moles':                 {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'Psoriasis':             {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'Rosacea':               {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'Seborrh_Keratoses':     {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'SkinCancer':            {level: 'High',   color: '#FF4757', icon: '🔴'},
  'Sun_Sunlight_Damage':   {level: 'Medium', color: '#FFA502', icon: '⚠️'},
  'Tinea':                 {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'Unknown_Normal':        {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'Vascular_Tumors':       {level: 'Medium', color: '#FFA502', icon: '⚠️'},
  'Vasculitis':            {level: 'Medium', color: '#FFA502', icon: '⚠️'},
  'Vitiligo':              {level: 'Low',    color: '#2ED573', icon: '🟢'},
  'Warts':                 {level: 'Low',    color: '#2ED573', icon: '🟢'},
};

// ─── Disease Descriptions ────────────────────────────────────

export const DISEASE_INFO: Record<string, string> = {
  'Acne': 'A common skin condition that occurs when hair follicles become plugged with oil and dead skin cells.',
  'Actinic_Keratosis': 'A rough, scaly patch on the skin caused by years of sun exposure. Can progress to squamous cell carcinoma.',
  'Benign_tumors': 'Non-cancerous growths on the skin. Generally harmless but should be monitored for changes.',
  'Bullous': 'Skin conditions characterized by large fluid-filled blisters (bullae).',
  'Candidiasis': 'A fungal infection caused by a yeast (a type of fungus) called Candida.',
  'DrugEruption': 'An adverse skin reaction to a medication.',
  'Eczema': 'A condition that makes your skin red, itchy, and inflamed. Often chronic.',
  'Infestations_Bites': 'Skin reactions caused by insects, mites, or other parasites.',
  'Lichen': 'Inflammatory skin conditions like Lichen Planus, characterized by purplish, itchy, flat-topped bumps.',
  'Lupus': 'An autoimmune disease that can cause rashes and lesions on the skin, often triggered by sunlight.',
  'Moles': 'Common skin growths caused by clusters of pigmented cells. Monitor for changes (ABCD rule).',
  'Psoriasis': 'A condition in which skin cells build up and form scales and itchy, dry patches.',
  'Rosacea': 'A common skin condition that causes redness and visible blood vessels in your face.',
  'Seborrh_Keratoses': 'One of the most common noncancerous skin growths in older adults.',
  'SkinCancer': 'Malignant growth of skin cells. Includes Melanoma, Basal Cell Carcinoma, etc. Immediate medical consultation required.',
  'Sun_Sunlight_Damage': 'Skin changes caused by prolonged sun exposure, including premature aging and increased cancer risk.',
  'Tinea': 'A group of contagious fungal skin infections, such as ringworm, athlete\'s foot, and jock itch.',
  'Unknown_Normal': 'The model did not detect any known abnormal pattern, or the skin appears healthy.',
  'Vascular_Tumors': 'Tumors made up of blood vessels. Can be benign or malignant.',
  'Vasculitis': 'Inflammation of the blood vessels, which can cause skin manifestations like purpura or ulcers.',
  'Vitiligo': 'A disease that causes the loss of skin color in blotches.',
  'Warts': 'Small, fleshy bumps on the skin or mucous membranes caused by human papillomavirus (HPV).',
};
