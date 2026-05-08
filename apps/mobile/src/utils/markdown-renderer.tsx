import { Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';

interface MarkdownTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  boldStyle?: StyleProp<TextStyle>;
  italicStyle?: StyleProp<TextStyle>;
}

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

function parseMarkdownText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];

  // Pattern para **bold** e *italic*
  // Processa o texto sequencialmente
  let remaining = text;

  while (remaining.length > 0) {
    // Procura por **bold**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      segments.push({ text: boldMatch[1], bold: true });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Procura por *italic* (não precedido de *)
    const italicMatch = remaining.match(/^\*([^*]+?)\*/);
    if (italicMatch) {
      segments.push({ text: italicMatch[1], italic: true });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Procura pelo próximo marcador
    const nextBold = remaining.indexOf('**');
    const nextItalic = remaining.search(/(?<!\*)\*(?!\*)/);

    let nextMarker = -1;
    if (nextBold >= 0 && nextItalic >= 0) {
      nextMarker = Math.min(nextBold, nextItalic);
    } else if (nextBold >= 0) {
      nextMarker = nextBold;
    } else if (nextItalic >= 0) {
      nextMarker = nextItalic;
    }

    if (nextMarker > 0) {
      segments.push({ text: remaining.slice(0, nextMarker) });
      remaining = remaining.slice(nextMarker);
    } else {
      // Sem mais marcadores, adiciona o resto como texto normal
      segments.push({ text: remaining });
      break;
    }
  }

  return segments;
}

export function MarkdownText({ children, style, boldStyle, italicStyle }: MarkdownTextProps) {
  const segments = parseMarkdownText(children);

  return (
    <Text style={style}>
      {segments.map((segment, index) => {
        if (segment.bold) {
          return (
            <Text key={index} style={[styles.bold, boldStyle]}>
              {segment.text}
            </Text>
          );
        }
        if (segment.italic) {
          return (
            <Text key={index} style={[styles.italic, italicStyle]}>
              {segment.text}
            </Text>
          );
        }
        return segment.text;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  italic: {
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
  },
});
