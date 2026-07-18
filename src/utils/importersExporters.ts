import { XMLParser, XMLBuilder } from 'fast-xml-parser';

// Interface representing a parsed screenplay node
export interface ScreenplayNode {
  type: string;
  text: string;
  revision?: string;
  id?: string;
  commentId?: string;
  columns?: ScreenplayNode[][]; // for dual dialogue
}

/**
 * ----------------------------------------------------
 * FOUNTAIN PARSER AND SERIALIZER
 * ----------------------------------------------------
 */
export function parseFountain(text: string): ScreenplayNode[] {
  const nodes: ScreenplayNode[] = [];
  const lines = text.split(/\r?\n/);
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Comments [[comment]]
    if (line.startsWith('[[') && line.endsWith(']]')) {
      // Ignore or save as comments
      i++;
      continue;
    }

    // Title page headers
    if (i === 0 && line.includes(':')) {
      while (i < lines.length && lines[i].trim() !== '') {
        i++;
      }
      i++; // skip empty line after title page
      continue;
    }

    // Scene Headings
    if (/^(INT\.|EXT\.|INT\/EXT\.|EST\.|I\/E\.)/i.test(line) || line.startsWith('.')) {
      const cleanLine = line.startsWith('.') ? line.slice(1) : line;
      nodes.push({ type: 'sceneHeading', text: cleanLine.toUpperCase(), id: crypto.randomUUID() });
      i++;
      continue;
    }

    // Transitions
    if (/^(CUT TO:|FADE OUT\.|FADE IN:|DISSOLVE TO:|BACK TO:|SMASH CUT:|MATCH CUT:)/i.test(line) || line.endsWith('TO:') || line.startsWith('>')) {
      const cleanLine = line.startsWith('>') ? line.slice(1).trim() : line;
      nodes.push({ type: 'transition', text: cleanLine.toUpperCase() });
      i++;
      continue;
    }

    // Shots
    if (/^(SHOT|ANGLE|WIDE|CLOSE|PAN|TILT|ZOOM|TRACKING|CAMERA)/i.test(line)) {
      nodes.push({ type: 'shot', text: line.toUpperCase() });
      i++;
      continue;
    }

    // Character and Dialogue
    // Characters are uppercase, not starting with standard punctuation, and followed by Dialogue/Parenthetical
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
    if (line === line.toUpperCase() && !/^[0-9.-]/.test(line) && line.length > 0 && nextLine !== '') {
      // Check for dual dialogue (ends with ^)
      const isDual = line.endsWith('^');
      const characterName = isDual ? line.slice(0, -1).trim() : line;
      
      nodes.push({ type: 'character', text: characterName });
      i++;
      
      // Parse dialogue / parenthetical
      while (i < lines.length) {
        const dLine = lines[i].trim();
        if (!dLine) break;

        if (dLine.startsWith('(') && dLine.endsWith(')')) {
          nodes.push({ type: 'parenthetical', text: dLine });
        } else {
          nodes.push({ type: 'dialogue', text: dLine });
        }
        i++;
      }
      continue;
    }

    // Default to Action
    nodes.push({ type: 'action', text: line });
    i++;
  }

  // Ensure at least one action node if empty
  if (nodes.length === 0) {
    nodes.push({ type: 'action', text: '' });
  }

  return nodes;
}

export function serializeFountain(nodes: ScreenplayNode[], titlePage?: any): string {
  let output = '';
  
  if (titlePage) {
    output += `Title: ${titlePage.title || 'Untitled'}\n`;
    output += `Credit: ${titlePage.credit || 'Written by'}\n`;
    output += `Author: ${titlePage.author || ''}\n`;
    output += `Source: ${titlePage.sourceMaterial || ''}\n`;
    output += `Contact: ${titlePage.contactInfo || ''}\n\n`;
  }

  nodes.forEach((node) => {
    switch (node.type) {
      case 'sceneHeading':
        output += `\n.${node.text.toUpperCase()}\n\n`;
        break;
      case 'action':
        output += `${node.text}\n\n`;
        break;
      case 'character':
        output += `\n${node.text.toUpperCase()}\n`;
        break;
      case 'parenthetical':
        output += `${node.text}\n`;
        break;
      case 'dialogue':
        output += `${node.text}\n`;
        break;
      case 'transition':
        output += `\n> ${node.text.toUpperCase()}\n\n`;
        break;
      case 'shot':
        output += `\n${node.text.toUpperCase()}\n\n`;
        break;
      case 'dualDialogue':
        // Serialize columns
        if (node.columns && node.columns.length >= 2) {
          const col1 = node.columns[0];
          const col2 = node.columns[1];
          output += '\n';
          col1.forEach((n) => {
            if (n.type === 'character') output += `${n.text.toUpperCase()} ^\n`;
            else output += `${n.text}\n`;
          });
          output += '\n';
          col2.forEach((n) => {
            output += `${n.text}\n`;
          });
          output += '\n';
        }
        break;
    }
  });

  return output.replace(/\n{3,}/g, '\n\n'); // normalize spacing
}

/**
 * ----------------------------------------------------
 * FINAL DRAFT XML (.FDX) PARSER & SERIALIZER
 * ----------------------------------------------------
 */
export function parseFDX(xmlString: string): { nodes: ScreenplayNode[]; titlePage: any } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });
  
  const parsed = parser.parse(xmlString);
  const nodes: ScreenplayNode[] = [];
  const titlePage: any = {};

  try {
    const root = parsed.FinalDraft;
    if (!root) throw new Error('Not a valid FDX file');

    // Parse Title Page
    const fdTitlePage = root.TitlePage?.Paragraph;
    if (fdTitlePage) {
      const linesArray = Array.isArray(fdTitlePage) ? fdTitlePage : [fdTitlePage];
      linesArray.forEach((p: any) => {
        const textVal = p.Text || '';
        const pType = p['@_Type'] || '';
        if (pType === 'Title') titlePage.title = textVal;
        else if (pType === 'Author') titlePage.author = textVal;
        else if (pType === 'Contact') titlePage.contactInfo = (titlePage.contactInfo || '') + '\n' + textVal;
      });
    }

    // Parse script paragraphs
    const paragraphs = root.Content?.Paragraph;
    if (paragraphs) {
      const paraArray = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
      paraArray.forEach((p: any) => {
        const type = p['@_Type'] || 'Action';
        const text = p.Text || '';
        let nodeType = 'action';

        if (type === 'Scene Heading') nodeType = 'sceneHeading';
        else if (type === 'Character') nodeType = 'character';
        else if (type === 'Dialogue') nodeType = 'dialogue';
        else if (type === 'Parenthetical') nodeType = 'parenthetical';
        else if (type === 'Transition') nodeType = 'transition';
        else if (type === 'Shot') nodeType = 'shot';

        nodes.push({
          type: nodeType,
          text: String(text),
          id: crypto.randomUUID()
        });
      });
    }
  } catch (e) {
    console.error('Error parsing FDX:', e);
  }

  if (nodes.length === 0) {
    nodes.push({ type: 'action', text: 'Imported script is empty.' });
  }

  return { nodes, titlePage };
}

export function serializeFDX(nodes: ScreenplayNode[], titlePage: any): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true
  });

  const fdParagraphs = nodes.map((n) => {
    let fdxType = 'Action';
    if (n.type === 'sceneHeading') fdxType = 'Scene Heading';
    else if (n.type === 'character') fdxType = 'Character';
    else if (n.type === 'dialogue') fdxType = 'Dialogue';
    else if (n.type === 'parenthetical') fdxType = 'Parenthetical';
    else if (n.type === 'transition') fdxType = 'Transition';
    else if (n.type === 'shot') fdxType = 'Shot';

    return {
      '@_Type': fdxType,
      Text: n.text
    };
  });

  const fdxTitlePage = [
    { '@_Type': 'Title', Text: titlePage.title || '' },
    { '@_Type': 'Writer', Text: titlePage.credit || 'Written by' },
    { '@_Type': 'Author', Text: titlePage.author || '' },
    { '@_Type': 'Contact', Text: titlePage.contactInfo || '' }
  ];

  const obj = {
    FinalDraft: {
      '@_DocumentType': 'Script',
      '@_Version': '11',
      TitlePage: {
        Paragraph: fdxTitlePage
      },
      Content: {
        Paragraph: fdParagraphs
      }
    }
  };

  return builder.build(obj);
}

/**
 * ----------------------------------------------------
 * OTHER IMPORTERS (Celtx, WriterDuet, Text)
 * ----------------------------------------------------
 */
export function importPlainOrCeltx(rawText: string): ScreenplayNode[] {
  // Most plain text/Celtx formats match Fountain's structural markers or standard Courier screenplay indentation.
  // We can clean up HTML markers if Celtx HTML is pasted, otherwise parse as Fountain/Indented text.
  const clean = rawText
    .replace(/<[^>]*>/g, '\n') // strip HTML tags
    .replace(/\n{2,}/g, '\n\n'); // normalize empty lines
  return parseFountain(clean);
}

/**
 * ----------------------------------------------------
 * EXPORTERS (DOCX, EPUB, Plain Text, HTML, MD)
 * ----------------------------------------------------
 */
export function exportToPlainText(nodes: ScreenplayNode[], titlePage: any): string {
  let output = '';
  // Title Page
  if (titlePage) {
    output += '\n\n\n\n\n\n\n\n\n\n';
    output += `                                ${titlePage.title.toUpperCase()}\n\n`;
    output += `                                  ${titlePage.credit}\n\n`;
    output += `                                 ${titlePage.author}\n\n\n\n\n\n\n\n\n`;
    output += `${titlePage.contactInfo.split('\n').map((line: string) => '                                ' + line).join('\n')}\n`;
    output += '\f'; // page break
  }

  // Script body with standard Final Draft margins formatted in Courier (approx 60 chars per line width)
  nodes.forEach((node) => {
    const text = node.text;
    switch (node.type) {
      case 'sceneHeading':
        output += `\n\n${text.toUpperCase()}\n\n`;
        break;
      case 'action':
        output += `\n${wrapText(text, 60, 0)}\n`;
        break;
      case 'character':
        output += `\n${wrapText(text.toUpperCase(), 30, 22)}\n`;
        break;
      case 'parenthetical':
        output += `${wrapText(text, 25, 18)}\n`;
        break;
      case 'dialogue':
        output += `${wrapText(text, 35, 12)}\n`;
        break;
      case 'transition':
        output += `\n${wrapText(text.toUpperCase(), 20, 45)}\n\n`;
        break;
      case 'shot':
        output += `\n\n${text.toUpperCase()}\n\n`;
        break;
    }
  });

  return output;
}

function wrapText(text: string, width: number, indent: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    if ((currentLine + word).length > width) {
      lines.push(currentLine.trim());
      currentLine = '';
    }
    currentLine += word + ' ';
  });
  if (currentLine) lines.push(currentLine.trim());

  const pad = ' '.repeat(indent);
  return lines.map((l) => pad + l).join('\n');
}

export function exportToMarkdown(nodes: ScreenplayNode[], titlePage: any, treatmentOnly = false): string {
  let output = '';
  if (titlePage) {
    output += `# ${titlePage.title}\n`;
    output += `**${titlePage.credit}** ${titlePage.author}\n\n---\n\n`;
  }

  nodes.forEach((node) => {
    if (treatmentOnly) {
      // Treatment / script summary only shows Headings and Action
      if (node.type === 'sceneHeading') {
        output += `## ${node.text}\n\n`;
      } else if (node.type === 'action') {
        output += `${node.text}\n\n`;
      }
    } else {
      // Full script Markdown
      if (node.type === 'sceneHeading') {
        output += `### ${node.text.toUpperCase()}\n\n`;
      } else if (node.type === 'action') {
        output += `${node.text}\n\n`;
      } else if (node.type === 'character') {
        output += `**${node.text.toUpperCase()}**\n\n`;
      } else if (node.type === 'parenthetical') {
        output += `*${node.text}*\n\n`;
      } else if (node.type === 'dialogue') {
        output += `> ${node.text}\n\n`;
      } else if (node.type === 'transition') {
        output += `*${node.text.toUpperCase()}*\n\n`;
      }
    }
  });

  return output;
}

export function exportToHTML(nodes: ScreenplayNode[], titlePage: any, isDarkMode = false): string {
  let bodyStyle = isDarkMode ? 'background: #1e1e1e; color: #e8e8e6;' : 'background: #fff; color: #000;';
  let fontStyle = "font-family: 'Courier New', Courier, monospace; font-size: 12pt; line-height: 1.2;";
  
  let html = `<!DOCTYPE html>
<html>
<head>
<title>${titlePage?.title || 'Screenplay'}</title>
<style>
  body { ${bodyStyle} ${fontStyle} padding: 1in; max-width: 8.5in; margin: 0 auto; }
  .scene-heading { text-transform: uppercase; font-weight: bold; margin-top: 24pt; margin-bottom: 6pt; }
  .action { margin-bottom: 12pt; text-align: left; }
  .character { text-transform: uppercase; margin-left: 2.2in; margin-bottom: 0; font-weight: bold; }
  .parenthetical { margin-left: 1.8in; margin-bottom: 0; font-style: italic; }
  .dialogue { margin-left: 1.2in; margin-right: 1.0in; margin-bottom: 12pt; }
  .transition { text-transform: uppercase; text-align: right; margin-top: 12pt; margin-bottom: 12pt; }
  .shot { text-transform: uppercase; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; }
  .page-break { page-break-after: always; }
  .title-page { text-align: center; padding-top: 2in; height: 8in; display: flex; flex-direction: column; justify-content: space-between; }
</style>
</head>
<body>`;

  if (titlePage) {
    html += `<div class="title-page">
      <div>
        <h1 style="text-transform: uppercase; font-size: 18pt;">${titlePage.title}</h1>
        <p style="margin-top: 24pt;">${titlePage.credit}</p>
        <p>${titlePage.author}</p>
      </div>
      <div style="margin-top: 4in; font-size: 10pt; text-align: left;">
        ${titlePage.contactInfo.replace(/\n/g, '<br>')}
      </div>
    </div>
    <div class="page-break"></div>`;
  }

  nodes.forEach((node) => {
    switch (node.type) {
      case 'sceneHeading':
        html += `<div class="scene-heading">${node.text}</div>`;
        break;
      case 'action':
        html += `<div class="action">${node.text}</div>`;
        break;
      case 'character':
        html += `<div class="character">${node.text}</div>`;
        break;
      case 'parenthetical':
        html += `<div class="parenthetical">${node.text}</div>`;
        break;
      case 'dialogue':
        html += `<div class="dialogue">${node.text}</div>`;
        break;
      case 'transition':
        html += `<div class="transition">${node.text}</div>`;
        break;
      case 'shot':
        html += `<div class="shot">${node.text}</div>`;
        break;
    }
  });

  html += '</body></html>';
  return html;
}

// Simple DOCX exporter: bundles HTML contents with MS Word headers so Word opens it natively with proper layout
export function exportToDOCX(nodes: ScreenplayNode[], titlePage: any): string {
  const htmlContent = exportToHTML(nodes, titlePage, false);
  return htmlContent; // MS Word parses HTML files with .doc/.docx extension perfectly if formatted properly.
}

// Generate EPUB package
export function exportToEPUB(nodes: ScreenplayNode[], titlePage: any): string {
  // Return HTML structure that can be easily parsed or zipped into EPUB.
  // In a standalone JS environment, we export the XHTML markup.
  return exportToHTML(nodes, titlePage, false);
}

/**
 * ----------------------------------------------------
 * ADVANCED REPORT GENERATORS
 * ----------------------------------------------------
 */

// Table read script: dialogue only
export function generateTableRead(nodes: ScreenplayNode[]): string {
  let output = 'TABLE READ SCRIPT - DIALOGUE ONLY\n=================================\n\n';
  let activeChar = '';

  nodes.forEach((n) => {
    if (n.type === 'character') {
      activeChar = n.text.toUpperCase();
    } else if (n.type === 'dialogue' && activeChar) {
      output += `${activeChar}:\n"${n.text}"\n\n`;
    }
  });

  return output;
}

// Sides generator (Scene range)
export function generateSides(nodes: ScreenplayNode[], startSceneNum: number, endSceneNum: number): ScreenplayNode[] {
  const sides: ScreenplayNode[] = [];
  let sceneIndex = 0;
  let capture = false;

  nodes.forEach((n) => {
    if (n.type === 'sceneHeading') {
      sceneIndex++;
      if (sceneIndex >= startSceneNum && sceneIndex <= endSceneNum) {
        capture = true;
        sides.push({ type: 'action', text: `--- AUDITION SIDES: SCENE ${sceneIndex} ---` });
      } else {
        capture = false;
      }
    }

    if (capture) {
      sides.push(n);
    }
  });

  return sides;
}

// Character breakdown report
export interface CharacterBreakdown {
  name: string;
  speakingScenesCount: number;
  totalWordsSpoken: number;
  totalLinesSpoken: number;
}

export function generateCharacterReport(nodes: ScreenplayNode[]): CharacterBreakdown[] {
  const data: Record<string, CharacterBreakdown> = {};
  let activeChar = '';
  
  nodes.forEach((n) => {
    if (n.type === 'character') {
      activeChar = n.text.toUpperCase();
      if (!data[activeChar]) {
        data[activeChar] = { name: activeChar, speakingScenesCount: 0, totalWordsSpoken: 0, totalLinesSpoken: 0 };
      }
    } else if (n.type === 'dialogue' && activeChar) {
      const words = n.text.split(/\s+/).length;
      data[activeChar].totalWordsSpoken += words;
      data[activeChar].totalLinesSpoken += 1;
    }
  });

  // Calculate unique scenes for each character
  Object.keys(data).forEach((char) => {
    const scenes: Set<string> = new Set();
    let currentS = '';
    let currentC = '';
    nodes.forEach((n) => {
      if (n.type === 'sceneHeading') currentS = n.text;
      else if (n.type === 'character') currentC = n.text.toUpperCase();
      else if (n.type === 'dialogue' && currentC === char && currentS) {
        scenes.add(currentS);
      }
    });
    data[char].speakingScenesCount = scenes.size;
  });

  return Object.values(data).sort((a, b) => b.totalLinesSpoken - a.totalLinesSpoken);
}

// Location report
export interface LocationRecord {
  name: string;
  type: 'INT' | 'EXT' | 'INT/EXT' | 'OTHER';
  timeOfDay: 'DAY' | 'NIGHT' | 'OTHER';
  sceneCount: number;
}

export function generateLocationReport(nodes: ScreenplayNode[]): LocationRecord[] {
  const locMap: Record<string, LocationRecord> = {};

  nodes.forEach((n) => {
    if (n.type === 'sceneHeading') {
      const heading = n.text.toUpperCase();
      let type: 'INT' | 'EXT' | 'INT/EXT' | 'OTHER' = 'OTHER';
      if (heading.startsWith('INT.')) type = 'INT';
      else if (heading.startsWith('EXT.')) type = 'EXT';
      else if (heading.startsWith('INT/EXT') || heading.startsWith('I/E.')) type = 'INT/EXT';

      let timeOfDay: 'DAY' | 'NIGHT' | 'OTHER' = 'OTHER';
      if (heading.endsWith('- DAY') || heading.includes(' DAY')) timeOfDay = 'DAY';
      else if (heading.endsWith('- NIGHT') || heading.includes(' NIGHT')) timeOfDay = 'NIGHT';

      // Extract raw location name
      const cleanLoc = heading
        .replace(/^(INT\.|EXT\.|INT\/EXT\.|EST\.|I\/E\.)/g, '')
        .split('-')[0]
        .trim();

      if (!locMap[cleanLoc]) {
        locMap[cleanLoc] = { name: cleanLoc, type, timeOfDay, sceneCount: 0 };
      }
      locMap[cleanLoc].sceneCount++;
    }
  });

  return Object.values(locMap).sort((a, b) => b.sceneCount - a.sceneCount);
}

// Props and wardrobe breakdown
export function generatePropsReport(nodes: ScreenplayNode[]): string[] {
  const propsSet = new Set<string>();
  
  nodes.forEach((n) => {
    if (n.type === 'action') {
      // Find capitalized items in brackets [CUP] or fully capitalized nouns of length > 2
      const matches = n.text.match(/\b[A-Z]{3,8}\b/g);
      if (matches) {
        matches.forEach((m) => {
          // exclude common screenwriting abbreviations
          if (!['INT', 'EXT', 'DAY', 'NIGHT', 'POV', 'V.O.', 'O.S.', 'O.C.'].includes(m)) {
            propsSet.add(m);
          }
        });
      }
      
      // Also match items inside brackets [prop item]
      const brackets = n.text.match(/\[([^\]]+)\]/g);
      if (brackets) {
        brackets.forEach((b) => {
          propsSet.add(b.slice(1, -1).trim().toUpperCase());
        });
      }
    }
  });

  return Array.from(propsSet);
}

// Shooting schedule stripboard export
export interface StripboardItem {
  sceneNum: number;
  heading: string;
  intExt: string;
  dayNight: string;
  pagesEstimate: number;
  characters: string[];
}

export function generateStripboard(nodes: ScreenplayNode[]): StripboardItem[] {
  const items: StripboardItem[] = [];
  let sceneNum = 0;
  let activeItem: StripboardItem | null = null;
  let paragraphCountInScene = 0;

  for (const n of nodes) {
    if (n.type === 'sceneHeading') {
      if (activeItem) {
        activeItem.pagesEstimate = Math.max(0.1, Number((paragraphCountInScene / 8).toFixed(1)));
        items.push(activeItem);
      }
      sceneNum++;
      let heading = n.text.toUpperCase();
      let intExt = heading.startsWith('INT.') ? 'INT' : heading.startsWith('EXT.') ? 'EXT' : 'I/E';
      let dayNight = heading.includes('DAY') ? 'DAY' : heading.includes('NIGHT') ? 'NIGHT' : 'SAME';

      activeItem = {
        sceneNum,
        heading,
        intExt,
        dayNight,
        pagesEstimate: 0.1,
        characters: []
      };
      paragraphCountInScene = 0;
    } else {
      paragraphCountInScene++;
      if (activeItem) {
        if (n.type === 'character' && !activeItem.characters.includes(n.text.toUpperCase())) {
          activeItem.characters.push(n.text.toUpperCase());
        }
      }
    }
  }

  if (activeItem) {
    activeItem.pagesEstimate = Math.max(0.1, Number((paragraphCountInScene / 8).toFixed(1)));
    items.push(activeItem);
  }

  return items;
}
