import { describe, expect, it } from 'vitest';
import type { DiseaseKnowledgeRow } from './api';
import { findUniqueDiseaseKnowledge } from './disease';

const regressionCases = [
  ['105', 'Suy dinh dưỡng - Malnutrition', 109],
  ['152', 'Bệnh tim khác - Other heart diseases', 117],
  ['11', 'Phong - Leprosy', 13],
  ['265', 'Dị dạng bẩm sinh khác - Other congenital malformations', 217],
] as const;

function knowledge(id: number, disease_group: string): DiseaseKnowledgeRow {
  return { id, disease_group, title: disease_group, symptoms: `DB symptoms ${id}`,
    warning_signs: `DB warning ${id}`, prevention: `DB prevention ${id}` };
}

const correctRows = regressionCases.map(([, name, id]) => knowledge(id, name));
const distractors = [
  knowledge(239, 'Thai chậm phát triển, suy dinh dưỡng, rối loạn gắn liền với thai nghén và cân nặng không đủ khi sinh - Slow fetal growth, fetal malnutrition and disorders related to short gestation and low birth weight'),
  knowledge(156, 'Bệnh tim thiếu máu cục bộ khác - Other ischaemic heart diseases'),
  knowledge(47, 'Di chứng phong - Sequelae of leprosy'),
  knowledge(211, 'Dị dạng bẩm sinh khác của bộ máy tiêu hoá - Other congenital malformations of the digestive system'),
];

describe('Parent exact guidance mapping', () => {
  it.each(regressionCases)('maps disease %s by its full name without confusing the ID domains', (_diseaseId, name, expectedId) => {
    for (const rows of [[...distractors, ...correctRows], [...correctRows, ...distractors].reverse()]) {
      expect(findUniqueDiseaseKnowledge(name, rows)?.id).toBe(expectedId);
    }
  });

  it('normalizes Vietnamese accents, Unicode composition, case and whitespace only', () => {
    const row = knowledge(19, '  BỆNH  ĐƯỜNG RUỘT - Intestinal disease  ');
    expect(findUniqueDiseaseKnowledge('benh duong ruot - intestinal disease'.normalize('NFD'), [row])).toBe(row);
  });

  it('rejects duplicate normalized full names rather than selecting the first record', () => {
    const first = knowledge(109, regressionCases[0][1]);
    const duplicate = knowledge(999, ' SUY DINH DUONG - MALNUTRITION ');
    expect(findUniqueDiseaseKnowledge(regressionCases[0][1], [first, duplicate])).toBeNull();
    expect(findUniqueDiseaseKnowledge(regressionCases[0][1], [duplicate, first])).toBeNull();
  });

  it('does not use a related name, a title-only match, row ID, or a partial bilingual name as fallback', () => {
    const [diseaseId, name] = regressionCases[0];
    const unrelated = { ...knowledge(Number(diseaseId), 'Other unrelated disease'), title: name };
    expect(findUniqueDiseaseKnowledge(name, [...distractors, unrelated])).toBeNull();
    expect(findUniqueDiseaseKnowledge('Suy dinh dưỡng', correctRows)).toBeNull();
    expect(findUniqueDiseaseKnowledge('', correctRows)).toBeNull();
    expect(findUniqueDiseaseKnowledge('   ', correctRows)).toBeNull();
  });

  it('returns the database object unchanged, including all medical content', () => {
    const row = Object.freeze(knowledge(109, regressionCases[0][1]));
    const rows = Object.freeze([row]);
    expect(findUniqueDiseaseKnowledge(regressionCases[0][1], rows)).toBe(row);
  });
});
