/**
 * Parser para extrair componentes interativos das mensagens da IA
 *
 * Formato suportado:
 * [QUICK_REPLIES:opção1|opção2|opção3|opção4]
 * [ARCHETYPE_CARD:tipo|descrição]
 * [DAY_CARD:dia|título|descrição]
 */

export type ComponentType = 'quick_replies' | 'archetype_card' | 'day_card';

export interface QuickRepliesData {
  options: string[];
}

export interface ArchetypeCardData {
  archetype: 'ansioso' | 'seguro' | 'evitante' | 'desorganizado';
  description?: string;
}

export interface DayCardData {
  day: number;
  title: string;
  description: string;
}

export interface ParsedComponent {
  type: ComponentType;
  data: QuickRepliesData | ArchetypeCardData | DayCardData;
}

export interface ParsedMessage {
  text: string;
  components: ParsedComponent[];
}

const COMPONENT_PATTERNS = {
  quick_replies: /\[QUICK_REPLIES:([^\]]+)\]/g,
  archetype_card: /\[ARCHETYPE_CARD:([^\]]+)\]/g,
  day_card: /\[DAY_CARD:([^\]]+)\]/g,
};

function parseQuickReplies(data: string): QuickRepliesData {
  const options = data.split('|').map((s) => s.trim()).filter(Boolean);
  return { options };
}

function parseArchetypeCard(data: string): ArchetypeCardData {
  const [archetype, ...descParts] = data.split('|');
  const description = descParts.join('|').trim();
  return {
    archetype: archetype.trim() as ArchetypeCardData['archetype'],
    description: description || '',
  };
}

function parseDayCard(data: string): DayCardData {
  const [dayStr, title, ...descParts] = data.split('|');
  const description = descParts.join('|').trim();
  return {
    day: parseInt(dayStr.trim(), 10) || 1,
    title: title?.trim() || '',
    description: description || '',
  };
}

export function parseMessage(content: string): ParsedMessage {
  const components: ParsedComponent[] = [];
  let text = content;

  // Extrair QUICK_REPLIES
  const quickRepliesMatches = text.matchAll(COMPONENT_PATTERNS.quick_replies);
  for (const match of quickRepliesMatches) {
    components.push({
      type: 'quick_replies',
      data: parseQuickReplies(match[1]),
    });
  }
  text = text.replace(COMPONENT_PATTERNS.quick_replies, '');

  // Extrair ARCHETYPE_CARD
  const archetypeMatches = text.matchAll(COMPONENT_PATTERNS.archetype_card);
  for (const match of archetypeMatches) {
    components.push({
      type: 'archetype_card',
      data: parseArchetypeCard(match[1]),
    });
  }
  text = text.replace(COMPONENT_PATTERNS.archetype_card, '');

  // Extrair DAY_CARD
  const dayCardMatches = text.matchAll(COMPONENT_PATTERNS.day_card);
  for (const match of dayCardMatches) {
    components.push({
      type: 'day_card',
      data: parseDayCard(match[1]),
    });
  }
  text = text.replace(COMPONENT_PATTERNS.day_card, '');

  // Limpar texto
  text = text.trim();

  return { text, components };
}

export function hasComponents(content: string): boolean {
  return (
    COMPONENT_PATTERNS.quick_replies.test(content) ||
    COMPONENT_PATTERNS.archetype_card.test(content) ||
    COMPONENT_PATTERNS.day_card.test(content)
  );
}
