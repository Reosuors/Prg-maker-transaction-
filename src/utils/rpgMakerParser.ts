/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TranslatableItem } from '../types';

// Helper to determine if a string contains actual human-readable dialogue/text
export function isTranslatableString(text: any): boolean {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length === 0) return false;

  // Skip pure numbers or single special chars
  if (/^[\d\s.,\/#!$%\^&\*;:{}=\-_`~()]+$/.test(trimmed)) return false;

  // Skip common JS/code snippets
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('$game') ||
    trimmed.startsWith('this._') ||
    trimmed.startsWith('AudioManager.') ||
    trimmed.startsWith('SoundManager.')
  ) {
    return false;
  }

  // Skip image/audio filenames
  if (/\.(png|jpg|ogg|m4a|wav|mp3|webm)$/i.test(trimmed)) return false;

  return true;
}

export function extractTranslatableItemsFromRpgMakerJson(
  filePath: string,
  jsonContent: any
): TranslatableItem[] {
  const items: TranslatableItem[] = [];
  const fileName = filePath.split('/').pop() || '';

  let counter = 0;
  const generateId = () => `${filePath}_${++counter}`;

  // 1. Map files: MapXXX.json
  if (/^Map\d+\.json$/i.test(fileName)) {
    if (jsonContent && Array.isArray(jsonContent.events)) {
      jsonContent.events.forEach((event: any, eventIndex: number) => {
        if (!event || !Array.isArray(event.pages)) return;
        event.pages.forEach((page: any, pageIndex: number) => {
          if (!page || !Array.isArray(page.list)) return;
          page.list.forEach((cmd: any, cmdIndex: number) => {
            if (!cmd) return;
            // 401: Show Text line
            if (cmd.code === 401 && Array.isArray(cmd.parameters) && typeof cmd.parameters[0] === 'string') {
              const text = cmd.parameters[0];
              if (isTranslatableString(text)) {
                items.push({
                  id: generateId(),
                  filePath,
                  jsonPath: ['events', String(eventIndex), 'pages', String(pageIndex), 'list', String(cmdIndex), 'parameters', '0'],
                  originalText: text,
                  context: `خريطة: حدث ${event.name || eventIndex} - سطر حوار`,
                  status: 'pending',
                });
              }
            }
            // 405: Show Scrolling Text
            if (cmd.code === 405 && Array.isArray(cmd.parameters) && typeof cmd.parameters[0] === 'string') {
              const text = cmd.parameters[0];
              if (isTranslatableString(text)) {
                items.push({
                  id: generateId(),
                  filePath,
                  jsonPath: ['events', String(eventIndex), 'pages', String(pageIndex), 'list', String(cmdIndex), 'parameters', '0'],
                  originalText: text,
                  context: `خريطة: نص متحرك`,
                  status: 'pending',
                });
              }
            }
            // 102: Show Choices
            if (cmd.code === 102 && Array.isArray(cmd.parameters) && Array.isArray(cmd.parameters[0])) {
              cmd.parameters[0].forEach((choice: any, choiceIdx: number) => {
                if (isTranslatableString(choice)) {
                  items.push({
                    id: generateId(),
                    filePath,
                    jsonPath: ['events', String(eventIndex), 'pages', String(pageIndex), 'list', String(cmdIndex), 'parameters', '0', String(choiceIdx)],
                    originalText: choice,
                    context: `خريطة: خيار حوار (${choiceIdx + 1})`,
                    status: 'pending',
                  });
                }
              });
            }
          });
        });
      });
    }
  }

  // 2. CommonEvents.json
  else if (/^CommonEvents\.json$/i.test(fileName)) {
    if (Array.isArray(jsonContent)) {
      jsonContent.forEach((commonEvent: any, ceIndex: number) => {
        if (!commonEvent || !Array.isArray(commonEvent.list)) return;
        commonEvent.list.forEach((cmd: any, cmdIndex: number) => {
          if (!cmd) return;
          if (cmd.code === 401 && Array.isArray(cmd.parameters) && typeof cmd.parameters[0] === 'string') {
            const text = cmd.parameters[0];
            if (isTranslatableString(text)) {
              items.push({
                id: generateId(),
                filePath,
                jsonPath: [String(ceIndex), 'list', String(cmdIndex), 'parameters', '0'],
                originalText: text,
                context: `حدث عام: ${commonEvent.name || ceIndex} - سطر حوار`,
                status: 'pending',
              });
            }
          }
          if (cmd.code === 102 && Array.isArray(cmd.parameters) && Array.isArray(cmd.parameters[0])) {
            cmd.parameters[0].forEach((choice: any, choiceIdx: number) => {
              if (isTranslatableString(choice)) {
                items.push({
                  id: generateId(),
                  filePath,
                  jsonPath: [String(ceIndex), 'list', String(cmdIndex), 'parameters', '0', String(choiceIdx)],
                  originalText: choice,
                  context: `حدث عام: خيار حوار (${choiceIdx + 1})`,
                  status: 'pending',
                });
              }
            });
          }
        });
      });
    }
  }

  // 3. System.json
  else if (/^System\.json$/i.test(fileName)) {
    if (jsonContent) {
      if (isTranslatableString(jsonContent.gameTitle)) {
        items.push({
          id: generateId(),
          filePath,
          jsonPath: ['gameTitle'],
          originalText: jsonContent.gameTitle,
          context: 'عنوان اللعبة الرئيسي',
          status: 'pending',
        });
      }
      if (isTranslatableString(jsonContent.currencyUnit)) {
        items.push({
          id: generateId(),
          filePath,
          jsonPath: ['currencyUnit'],
          originalText: jsonContent.currencyUnit,
          context: 'عملة اللعبة (Gold/ذهب)',
          status: 'pending',
        });
      }
      // terms
      if (jsonContent.terms) {
        ['basic', 'commands', 'params'].forEach((category) => {
          if (Array.isArray(jsonContent.terms[category])) {
            jsonContent.terms[category].forEach((term: any, idx: number) => {
              if (isTranslatableString(term)) {
                items.push({
                  id: generateId(),
                  filePath,
                  jsonPath: ['terms', category, String(idx)],
                  originalText: term,
                  context: `مصطلحات النظام: ${category} [${idx}]`,
                  status: 'pending',
                });
              }
            });
          }
        });

        // terms.messages
        if (jsonContent.terms.messages && typeof jsonContent.terms.messages === 'object') {
          Object.keys(jsonContent.terms.messages).forEach((msgKey) => {
            const val = jsonContent.terms.messages[msgKey];
            if (isTranslatableString(val)) {
              items.push({
                id: generateId(),
                filePath,
                jsonPath: ['terms', 'messages', msgKey],
                originalText: val,
                context: `رسائل النظام: ${msgKey}`,
                status: 'pending',
              });
            }
          });
        }
      }
    }
  }

  // 4. Actors.json, Classes.json, Skills.json, Items.json, Weapons.json, Armors.json, Enemies.json, States.json
  else if (
    /^(Actors|Classes|Skills|Items|Weapons|Armors|Enemies|States)\.json$/i.test(
      fileName
    )
  ) {
    if (Array.isArray(jsonContent)) {
      jsonContent.forEach((entry: any, index: number) => {
        if (!entry) return;
        const entryName = entry.name || `عنصر ${index}`;

        // name
        if (isTranslatableString(entry.name)) {
          items.push({
            id: generateId(),
            filePath,
            jsonPath: [String(index), 'name'],
            originalText: entry.name,
            context: `${fileName.replace('.json', '')}: اسم (${entryName})`,
            status: 'pending',
          });
        }
        // description
        if (isTranslatableString(entry.description)) {
          items.push({
            id: generateId(),
            filePath,
            jsonPath: [String(index), 'description'],
            originalText: entry.description,
            context: `${fileName.replace('.json', '')}: وصف (${entryName})`,
            status: 'pending',
          });
        }
        // nickname, profile
        if (isTranslatableString(entry.nickname)) {
          items.push({
            id: generateId(),
            filePath,
            jsonPath: [String(index), 'nickname'],
            originalText: entry.nickname,
            context: `بطل: لقب (${entryName})`,
            status: 'pending',
          });
        }
        if (isTranslatableString(entry.profile)) {
          items.push({
            id: generateId(),
            filePath,
            jsonPath: [String(index), 'profile'],
            originalText: entry.profile,
            context: `بطل: نبذة (${entryName})`,
            status: 'pending',
          });
        }
        // message1..4 for skills or states
        ['message1', 'message2', 'message3', 'message4'].forEach((msgProp) => {
          if (isTranslatableString(entry[msgProp])) {
            items.push({
              id: generateId(),
              filePath,
              jsonPath: [String(index), msgProp],
              originalText: entry[msgProp],
              context: `${fileName.replace('.json', '')}: رسالة المعركة (${msgProp})`,
              status: 'pending',
            });
          }
        });
      });
    }
  }

  // 5. Generic or plugin JSON fallback: recursive string search for text fields
  else {
    function traverse(node: any, currentPath: string[]) {
      if (!node) return;
      if (typeof node === 'string') {
        if (isTranslatableString(node)) {
          items.push({
            id: generateId(),
            filePath,
            jsonPath: [...currentPath],
            originalText: node,
            context: `نص في ملف: ${fileName}`,
            status: 'pending',
          });
        }
      } else if (Array.isArray(node)) {
        node.forEach((child, i) => traverse(child, [...currentPath, String(i)]));
      } else if (typeof node === 'object') {
        Object.keys(node).forEach((key) => {
          // Skip internal technical metadata keys
          if (
            key === 'id' ||
            key === 'switchId' ||
            key === 'variableId' ||
            key === 'bgm' ||
            key === 'bgs' ||
            key === 'tilesetId' ||
            key === 'width' ||
            key === 'height' ||
            key === 'animationId' ||
            key === 'iconIndex' ||
            key === 'traits'
          ) {
            return;
          }
          traverse(node[key], [...currentPath, key]);
        });
      }
    }

    traverse(jsonContent, []);
  }

  return items;
}

/**
 * Injects translations back into the original JSON object hierarchy safely.
 */
export function applyTranslationsToJson(
  originalJson: any,
  items: TranslatableItem[]
): any {
  // Deep clone to avoid mutating input directly
  const cloned = JSON.parse(JSON.stringify(originalJson));

  items.forEach((item) => {
    if (!item.translatedText || item.status !== 'translated' && item.status !== 'cached') {
      return;
    }

    let cursor = cloned;
    const path = item.jsonPath;

    for (let i = 0; i < path.length - 1; i++) {
      const seg = path[i];
      if (cursor === undefined || cursor === null) return;
      cursor = cursor[seg];
    }

    if (cursor && path.length > 0) {
      const lastKey = path[path.length - 1];
      cursor[lastKey] = item.translatedText;
    }
  });

  return cloned;
}
