/**
 * The syntax theme, expressed in the page's own printing inks.
 *
 * Shiki does the tokenizing; these colours keep highlighted code inside the same
 * palette as the rest of the page (see `--code-*` in styles/tokens.css).
 */
export const INK_THEME_NAME = 'reader-ink'

const COMMENT = '#69737F'
const KEYWORD = '#8C2F6B'
const STRING = '#1F6B4F'
const CONSTANT = '#8A5A00'
const FUNCTION = '#1E4A9B'
const PREPROCESSOR = '#6B4A9E'
const COPY = '#1F2937'
const PUNCTUATION = '#57626F'
const INVALID = '#A9351F'

export const INK_THEME = {
  name: INK_THEME_NAME,
  type: 'light' as const,
  colors: {
    // Mirrors --paper-2; only used if the block is rendered by shiki itself.
    'editor.background': '#F6F8FA',
    'editor.foreground': COPY,
  },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: COMMENT, fontStyle: 'italic' },
    },
    {
      scope: ['keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.control'],
      settings: { foreground: KEYWORD },
    },
    {
      scope: [
        'string',
        'string.quoted',
        'punctuation.definition.string',
        'constant.other.symbol',
        'markup.underline.link',
      ],
      settings: { foreground: STRING },
    },
    {
      scope: [
        'constant',
        'constant.numeric',
        'constant.language',
        'constant.character',
        'support.constant',
        'variable.other.constant',
        'meta.preprocessor.numeric',
      ],
      settings: { foreground: CONSTANT },
    },
    {
      scope: [
        'entity.name.function',
        'support.function',
        'meta.function-call',
        'entity.name.type',
        'support.type',
        'entity.name.class',
        'support.class',
      ],
      settings: { foreground: FUNCTION },
    },
    {
      scope: ['meta.preprocessor', 'keyword.control.import', 'entity.name.tag', 'support.type.property-name'],
      settings: { foreground: PREPROCESSOR },
    },
    {
      scope: ['punctuation', 'keyword.operator', 'keyword.operator.assignment', 'meta.brace'],
      settings: { foreground: PUNCTUATION },
    },
    {
      scope: ['variable', 'variable.parameter', 'variable.other', 'meta.definition.variable'],
      settings: { foreground: COPY },
    },
    { scope: ['invalid', 'invalid.illegal'], settings: { foreground: INVALID } },
  ],
}
